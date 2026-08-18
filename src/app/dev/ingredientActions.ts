'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';
import { canonicalName } from '@/lib/ingredients';
import type { DevResult } from './actions';

const fail = (message: string): DevResult => ({ status: 'error', message });

export interface DuplicateCluster {
  canonical: string;
  rows: { id: string; name: string; uses: number }[];
}

/**
 * Ingredients that mean the same thing but are separate rows.
 *
 * Normalisation stops new duplicates; it cannot fix the ones already written,
 * and it never will fix pairs like Lettuce / Cos lettuce, where the difference
 * is a word in the middle. Those need a person to say they are the same thing.
 *
 * Usage counts are shown so the collector can tell which row is the real one —
 * merging into the row nobody uses would be technically correct and practically
 * annoying.
 */
export async function findDuplicateIngredients(): Promise<DuplicateCluster[]> {
  const me = await getCurrentUser();
  if (!me.houseId) return [];

  const supabase = createClient();
  const rows = await supabase.from('ingredients').select('id, name');
  if (rows.error || !rows.data) return [];

  const byCanonical = new Map<string, { id: string; name: string }[]>();
  for (const row of rows.data) {
    const key = canonicalName(row.name);
    byCanonical.set(key, [...(byCanonical.get(key) ?? []), row]);
  }

  const clusters = [...byCanonical.entries()].filter(([, group]) => group.length > 1);
  if (clusters.length === 0) return [];

  // One query per table rather than per row: a house with a messy catalogue
  // would otherwise fire hundreds of round trips to draw one panel.
  const ids = clusters.flatMap(([, group]) => group.map((row) => row.id));
  const [recipeUses, pantryUses, stapleUses] = await Promise.all([
    supabase.from('recipe_ingredients').select('ingredient_id').in('ingredient_id', ids),
    supabase.from('pantry_items').select('ingredient_id').in('ingredient_id', ids),
    supabase.from('house_staples').select('ingredient_id').in('ingredient_id', ids),
  ]);

  const counts = new Map<string, number>();
  for (const result of [recipeUses, pantryUses, stapleUses]) {
    for (const row of result.data ?? []) {
      const id = row.ingredient_id;
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }

  return clusters
    .map(([canonical, group]) => ({
      canonical,
      rows: group
        .map((row) => ({ ...row, uses: counts.get(row.id) ?? 0 }))
        .sort((a, b) => b.uses - a.uses),
    }))
    .sort((a, b) => a.canonical.localeCompare(b.canonical));
}

/**
 * Folds one ingredient into another.
 *
 * Four tables carry `ingredient_id` and three of them are `on delete restrict`,
 * so everything must be repointed before the loser can go — a plain delete just
 * fails with a foreign-key error and tells you nothing useful.
 */
export async function mergeIngredients(keepId: string, dropId: string): Promise<DevResult> {
  const me = await getCurrentUser();
  if (!me.houseId) return fail('Join a house first.');
  if (keepId === dropId) return fail('Those are the same ingredient.');

  const supabase = createClient();

  const names = await supabase.from('ingredients').select('id, name').in('id', [keepId, dropId]);
  if (names.error) return fail(names.error.message);
  if ((names.data ?? []).length !== 2) return fail('One of those ingredients no longer exists.');

  const keepName = names.data.find((row) => row.id === keepId)?.name ?? 'it';
  const dropName = names.data.find((row) => row.id === dropId)?.name ?? 'the other';

  // `recipe_ingredients` is keyed on (recipe_id, ingredient_id), so a recipe
  // holding *both* rows cannot simply be repointed — the update would collide
  // with a key that already exists. Those get dropped rather than merged, and
  // the count is reported: quietly losing a line from somebody's recipe is
  // exactly the kind of silent damage this tool must not do.
  const [keepLinks, dropLinks] = await Promise.all([
    supabase.from('recipe_ingredients').select('recipe_id').eq('ingredient_id', keepId),
    supabase.from('recipe_ingredients').select('recipe_id').eq('ingredient_id', dropId),
  ]);
  if (keepLinks.error) return fail(keepLinks.error.message);
  if (dropLinks.error) return fail(dropLinks.error.message);

  const alreadyHasKeeper = new Set((keepLinks.data ?? []).map((row) => row.recipe_id));
  const collided = (dropLinks.data ?? [])
    .map((row) => row.recipe_id)
    .filter((recipeId) => alreadyHasKeeper.has(recipeId));

  if (collided.length > 0) {
    const removed = await supabase
      .from('recipe_ingredients')
      .delete()
      .eq('ingredient_id', dropId)
      .in('recipe_id', collided);
    if (removed.error) return fail(removed.error.message);
  }

  for (const table of ['recipe_ingredients', 'pantry_items', 'house_staples', 'basket_items'] as const) {
    const repointed = await supabase
      .from(table)
      .update({ ingredient_id: keepId })
      .eq('ingredient_id', dropId);
    if (repointed.error) return fail(`${table}: ${repointed.error.message}`);
  }

  const deleted = await supabase.from('ingredients').delete().eq('id', dropId);
  if (deleted.error) return fail(`Could not remove "${dropName}": ${deleted.error.message}`);

  revalidatePath('/', 'layout');

  const note =
    collided.length > 0
      ? ` ${collided.length} recipe${collided.length === 1 ? '' : 's'} already had both, so the duplicate line was dropped.`
      : '';

  return {
    status: 'success',
    message: `"${dropName}" folded into "${keepName}".${note} Rebuild the basket to see them pool.`,
  };
}
