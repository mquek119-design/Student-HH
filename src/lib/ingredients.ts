import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './supabase/database.types';
import type { IngredientCategory } from './types';

/**
 * Making two people who typed the same ingredient land on the same row.
 *
 * The optimiser pools by `ingredientId`, so the whole claim of the app — one
 * bigger pack instead of two small ones — depends on "Chicken breast" and
 * "chicken breasts" being one thing. They were not: every call site did
 * `ilike('name', x)`, which is case-insensitive but otherwise exact, so a
 * plural made a second row, the shop bought twice, and the saving was reported
 * as zero. No error anywhere.
 */

/**
 * Words that describe a product without changing what it is — but only at the
 * front. "Fresh basil" and "basil" are the same ingredient; "peanut butter" and
 * "butter" are emphatically not, which is why nothing in the middle is touched.
 */
const LEADING_QUALIFIERS = [
  'fresh',
  'free range',
  'free-range',
  'organic',
  'large',
  'small',
  'british',
  'tesco',
  'value',
  'finest',
];

/** Plurals that are not plurals. Stripping the `s` here changes the word. */
const NEVER_SINGULARISE = new Set([
  'hummus',
  'couscous',
  'asparagus',
  'molasses',
  'oats',
  'greens',
  'chips',
  'crisps',
  'beans',
  'peas',
  'lentils',
  'noodles',
  'oporto',
]);

/**
 * Endings where the plural is `-es` rather than a bare `-s`.
 *
 * The distinction matters: a blanket "strip -es" turns `cheeses` into `chees`,
 * which then never matches `cheese` and quietly creates the exact duplicate
 * this function exists to prevent.
 */
const ES_PLURALS = ['sses', 'shes', 'ches', 'xes', 'zes'];

function singularise(word: string): string {
  if (NEVER_SINGULARISE.has(word)) return word;
  if (word.endsWith('ss') || word.endsWith('us') || word.endsWith('is')) return word;

  if (word.endsWith('ies') && word.length > 4) return `${word.slice(0, -3)}y`;
  if (word.endsWith('oes') && word.length > 4) return word.slice(0, -2);
  if (ES_PLURALS.some((ending) => word.endsWith(ending))) return word.slice(0, -2);

  // Four characters, not five: `eggs` must reach `egg`, and a three-letter word
  // ending in `s` is almost always the stem itself (`gas`).
  if (word.endsWith('s') && word.length >= 4) return word.slice(0, -1);

  return word;
}

/**
 * The key two ingredient names are compared on.
 *
 * Deliberately conservative: it only ever touches the head and the tail of a
 * string. Over-merging is far worse than under-merging — folding "Butter" into
 * "Peanut butter" would corrupt a shop and then a split, whereas failing to
 * merge "Lettuce" and "Cos lettuce" just leaves a job for the merge tool.
 */
export function canonicalName(raw: string): string {
  let name = raw.toLowerCase().trim().replace(/\s+/g, ' ');

  // Strip qualifiers from the front, repeatedly — "fresh organic basil".
  let stripped = true;
  while (stripped) {
    stripped = false;
    for (const qualifier of LEADING_QUALIFIERS) {
      const prefix = `${qualifier} `;
      if (name.startsWith(prefix) && name.length > prefix.length) {
        name = name.slice(prefix.length);
        stripped = true;
        break;
      }
    }
  }

  const words = name.split(' ');
  if (words.length > 0) {
    words[words.length - 1] = singularise(words[words.length - 1]);
  }

  return words.join(' ');
}

/**
 * Find an ingredient by what it *means*, or create it.
 *
 * The one replacement for seven copies of a lookup-or-insert block. The raw
 * string is kept as the display `name` — housemates should see what they typed
 * — while `canonical_name` is what matching happens on.
 *
 * `.limit(1)` rather than a bare `.maybeSingle()` on purpose: two rows may share
 * a canonical name until the merge tool has been run, and `maybeSingle()`
 * *errors* on multiple rows rather than picking one. That trap has cost this
 * project time before.
 */
export async function findOrCreateIngredient(
  supabase: SupabaseClient<Database>,
  { name, unit, category }: { name: string; unit: string; category: IngredientCategory }
): Promise<{ id: string } | { error: string }> {
  const canonical = canonicalName(name);
  if (!canonical) return { error: 'An ingredient needs a name.' };

  const existing = await supabase
    .from('ingredients')
    .select('id')
    .eq('canonical_name', canonical)
    .order('created_at', { ascending: true })
    .limit(1);

  if (existing.error) {
    // 42703: migration 0018 has not been applied. Fall back to the old exact
    // match rather than blocking every recipe the house tries to save.
    if (existing.error.code === '42703') {
      const legacy = await supabase.from('ingredients').select('id').ilike('name', name).limit(1);
      if (legacy.data?.[0]) return { id: legacy.data[0].id };
    } else {
      return { error: existing.error.message };
    }
  } else if (existing.data?.[0]) {
    return { id: existing.data[0].id };
  }

  const created = await supabase
    .from('ingredients')
    .insert({ name: name.trim(), canonical_name: canonical, default_unit: unit, category })
    .select('id')
    .single();

  if (created.error) {
    // Lost a race, or the legacy `lower(name)` unique index caught a duplicate
    // this canonical lookup missed. Re-read the winner either way.
    const retry = await supabase.from('ingredients').select('id').ilike('name', name).limit(1);
    if (retry.data?.[0]) return { id: retry.data[0].id };
    return { error: `Could not save ingredient "${name}": ${created.error.message}` };
  }

  return { id: created.data.id };
}
