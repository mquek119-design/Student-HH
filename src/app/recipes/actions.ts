'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { findOrCreateIngredient } from '@/lib/ingredients';
import { getCurrentUser } from '@/lib/queries';
import { parsePounds } from '@/lib/money';
import { parseIngredientLine, type ParsedIngredient } from '@/lib/parseIngredient';
import { parseRecipeFromHtml } from '@/lib/recipeImport';
import { canonicalName } from '@/lib/ingredients';
import type { IngredientCategory } from '@/lib/types';

export interface RecipeFormState {
  status: 'idle' | 'error';
  message: string;
}

export interface IngredientSuggestion {
  id: string;
  name: string;
  canonicalName: string;
  imageUrl: string | null;
}

const CATEGORIES: IngredientCategory[] = ['fresh', 'cupboard', 'frozen', 'household'];

function asCategory(value: FormDataEntryValue | null): IngredientCategory {
  const raw = String(value ?? '');
  return (CATEGORIES as string[]).includes(raw) ? (raw as IngredientCategory) : 'cupboard';
}

/**
 * Search for ingredients by canonical name, for autocomplete suggestions.
 * Returns distinct canonical names (one suggestion per unique ingredient),
 * ordered alphabetically, limited to 10 results.
 */
export async function searchIngredients(query: string): Promise<IngredientSuggestion[]> {
  if (!query.trim()) return [];

  const supabase = await createClient();
  const searchCanonical = canonicalName(query);

  // Search by canonical name, case-insensitive prefix match.
  // Group by canonical_name to avoid showing duplicates, but preserve
  // the original typed name from the most recently created row.
  const result = await supabase
    .from('ingredients')
    .select('id, name, canonical_name, image_url')
    .ilike('canonical_name', `${searchCanonical}%`)
    .order('canonical_name')
    .order('created_at', { ascending: false })
    .limit(50);

  if (result.error) {
    return [];
  }

  // Deduplicate by canonical_name, keeping the first (most recent) name per canonical
  const seen = new Set<string>();
  return result.data
    .filter((row) => {
      const canonical = row.canonical_name || row.name;
      if (seen.has(canonical)) return false;
      seen.add(canonical);
      return true;
    })
    .slice(0, 10)
    .map((row) => ({
      id: row.id,
      name: row.name,
      canonicalName: row.canonical_name || row.name,
      imageUrl: row.image_url || null,
    }));
}


/**
 * Finds or creates an ingredient row per parsed line, preserving order.
 * Shared by create and update so the catalogue stays consistent.
 */
async function resolveIngredientIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  lines: ParsedIngredient[],
  category: IngredientCategory
): Promise<{ ids: string[] } | { error: string }> {
  const ids: string[] = [];
  for (const parsed of lines) {
    const result = await findOrCreateIngredient(supabase, {
      name: parsed.name,
      unit: parsed.unit,
      category,
    });
    if ('error' in result) return { error: result.error };
    ids.push(result.id);
  }
  return { ids };
}

export async function createRecipe(
  _prev: RecipeFormState,
  formData: FormData
): Promise<RecipeFormState> {
  const me = await getCurrentUser();
  if (!me.houseId) return { status: 'error', message: 'Join a house first.' };

  const title = String(formData.get('title') ?? '').trim();
  if (!title) return { status: 'error', message: 'Give the recipe a title.' };

  const servings = Number.parseInt(String(formData.get('servings') ?? '4'), 10);
  const cookTime = Number.parseInt(String(formData.get('cookTimeMins') ?? '30'), 10);
  if (!Number.isFinite(servings) || servings < 1) {
    return { status: 'error', message: 'Servings must be at least 1.' };
  }
  if (!Number.isFinite(cookTime) || cookTime < 1) {
    return { status: 'error', message: 'Cook time must be at least 1 minute.' };
  }

  const costPerPortion = parsePounds(String(formData.get('costPerPortion') ?? '0')) ?? 0;

  const ingredientLines = String(formData.get('ingredients') ?? '')
    .split('\n')
    .map(parseIngredientLine)
    .filter((value): value is ParsedIngredient => value !== null);

  if (ingredientLines.length === 0) {
    return {
      status: 'error',
      message: 'Add at least one ingredient, e.g. "500 g Penne pasta".',
    };
  }

  const instructions = String(formData.get('instructions') ?? '')
    .split('\n')
    .map((step) => step.trim())
    .filter(Boolean);

  const tags = String(formData.get('tags') ?? '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

  const supabase = await createClient();
  const category = asCategory(formData.get('category'));

  // Ingredients are a shared catalogue matched on their canonical name, so
  // "chicken breasts" reuses the row somebody created as "Chicken breast" and
  // the optimiser can pool them.
  const ingredientIds: string[] = [];
  for (const parsed of ingredientLines) {
    const result = await findOrCreateIngredient(supabase, {
      name: parsed.name,
      unit: parsed.unit,
      category,
    });

    if ('error' in result) {
      return { status: 'error', message: result.error };
    }
    ingredientIds.push(result.id);
  }

  const recipe = await supabase
    .from('recipes')
    .insert({
      house_id: me.houseId,
      created_by: me.id,
      title,
      source_url: String(formData.get('sourceUrl') ?? '').trim() || null,
      cook_time_mins: cookTime,
      servings,
      cost_per_portion: costPerPortion,
      difficulty: 'easy',
      tags,
      dietary_tags: [],
      instructions,
      pro_tip: String(formData.get('proTip') ?? '').trim() || null,
    })
    .select('id')
    .single();

  if (recipe.error || !recipe.data) {
    return { status: 'error', message: recipe.error?.message ?? 'Could not save the recipe.' };
  }

  const links = ingredientLines.map((parsed, index) => ({
    recipe_id: recipe.data.id,
    ingredient_id: ingredientIds[index],
    quantity: parsed.quantity,
    unit: parsed.unit,
  }));

  // Two lines naming the same ingredient would violate the composite primary
  // key, so collapse them rather than failing the whole save.
  const deduped = [...new Map(links.map((link) => [link.ingredient_id, link])).values()];

  const linkResult = await supabase.from('recipe_ingredients').insert(deduped);
  if (linkResult.error) {
    return { status: 'error', message: linkResult.error.message };
  }

  revalidatePath('/recipes');
  revalidatePath('/plan');
  redirect(`/recipes/${recipe.data.id}`);
}

/**
 * Updates a recipe in place.
 *
 * Ingredients are replaced wholesale rather than diffed: `recipe_ingredients`
 * is keyed on (recipe_id, ingredient_id), so a rename plus a quantity change is
 * indistinguishable from a delete plus an insert. Replacing is simpler and
 * cannot leave a stale row behind.
 */
export async function updateRecipe(
  _prev: RecipeFormState,
  formData: FormData
): Promise<RecipeFormState> {
  const me = await getCurrentUser();
  if (!me.houseId) return { status: 'error', message: 'Join a house first.' };

  const recipeId = String(formData.get('recipeId') ?? '');
  if (!recipeId) return { status: 'error', message: 'Missing recipe.' };

  const title = String(formData.get('title') ?? '').trim();
  if (!title) return { status: 'error', message: 'Give the recipe a title.' };

  const servings = Number.parseInt(String(formData.get('servings') ?? '4'), 10);
  const cookTime = Number.parseInt(String(formData.get('cookTimeMins') ?? '30'), 10);
  if (!Number.isFinite(servings) || servings < 1) {
    return { status: 'error', message: 'Servings must be at least 1.' };
  }
  if (!Number.isFinite(cookTime) || cookTime < 1) {
    return { status: 'error', message: 'Cook time must be at least 1 minute.' };
  }

  const ingredientLines = String(formData.get('ingredients') ?? '')
    .split('\n')
    .map(parseIngredientLine)
    .filter((value): value is ParsedIngredient => value !== null);

  if (ingredientLines.length === 0) {
    return { status: 'error', message: 'Add at least one ingredient, e.g. "500 g Penne pasta".' };
  }

  const supabase = await createClient();
  const category = asCategory(formData.get('category'));

  const updated = await supabase
    .from('recipes')
    .update({
      title,
      source_url: String(formData.get('sourceUrl') ?? '').trim() || null,
      cook_time_mins: cookTime,
      servings,
      cost_per_portion: parsePounds(String(formData.get('costPerPortion') ?? '0')) ?? 0,
      tags: String(formData.get('tags') ?? '')
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      instructions: String(formData.get('instructions') ?? '')
        .split('\n')
        .map((step) => step.trim())
        .filter(Boolean),
      pro_tip: String(formData.get('proTip') ?? '').trim() || null,
    })
    .eq('id', recipeId)
    .eq('house_id', me.houseId);

  if (updated.error) return { status: 'error', message: updated.error.message };

  const ingredientIds = await resolveIngredientIds(supabase, ingredientLines, category);
  if ('error' in ingredientIds) return { status: 'error', message: ingredientIds.error };

  await supabase.from('recipe_ingredients').delete().eq('recipe_id', recipeId);

  const links = ingredientLines.map((parsed, index) => ({
    recipe_id: recipeId,
    ingredient_id: ingredientIds.ids[index],
    quantity: parsed.quantity,
    unit: parsed.unit,
  }));
  const deduped = [...new Map(links.map((link) => [link.ingredient_id, link])).values()];

  const linked = await supabase.from('recipe_ingredients').insert(deduped);
  if (linked.error) return { status: 'error', message: linked.error.message };

  revalidatePath('/recipes');
  revalidatePath(`/recipes/${recipeId}`);
  revalidatePath('/plan');
  redirect(`/recipes/${recipeId}`);
}

/**
 * Deletes a recipe.
 *
 * Refuses while the recipe is on a plan: `planned_meals.recipe_id` is
 * `on delete restrict`, so the database would reject it anyway — better to say
 * why than to surface a foreign-key error.
 */
export async function deleteRecipe(recipeId: string): Promise<RecipeFormState> {
  const me = await getCurrentUser();
  if (!me.houseId) return { status: 'error', message: 'Join a house first.' };

  const supabase = await createClient();

  const planned = await supabase
    .from('planned_meals')
    .select('id')
    .eq('recipe_id', recipeId)
    .limit(1);

  if ((planned.data?.length ?? 0) > 0) {
    return {
      status: 'error',
      message: 'This recipe is on a plan. Remove it from the week first, then delete it.',
    };
  }

  await supabase.from('recipe_ingredients').delete().eq('recipe_id', recipeId);
  const removed = await supabase
    .from('recipes')
    .delete()
    .eq('id', recipeId)
    .eq('house_id', me.houseId);

  if (removed.error) return { status: 'error', message: removed.error.message };

  revalidatePath('/recipes');
  revalidatePath('/plan');
  redirect('/recipes');
}

export interface ImportState {
  status: 'idle' | 'error' | 'success';
  message: string;
  recipe?: import('@/lib/recipeImport').ImportedRecipe;
}

/**
 * Fetches a recipe page and pulls schema.org JSON-LD out of it.
 *
 * Returns the parsed recipe for the form to pre-fill rather than saving
 * directly: an import is a starting point, and the user should see what was
 * understood — especially the lines that could not be parsed — before it
 * becomes a recipe the whole house plans meals from.
 */
export async function importRecipeFromUrl(
  _prev: ImportState,
  formData: FormData
): Promise<ImportState> {
  const me = await getCurrentUser();
  if (!me.houseId) return { status: 'error', message: 'Join a house first.' };

  const raw = String(formData.get('url') ?? '').trim();
  if (!raw) return { status: 'error', message: 'Paste a recipe link.' };

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { status: 'error', message: 'That does not look like a link.' };
  }

  // Only public web pages. Without this the server could be pointed at
  // localhost or a cloud metadata endpoint and made to fetch on someone's
  // behalf — a classic SSRF.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { status: 'error', message: 'Only http and https links can be imported.' };
  }
  if (/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|\[?::1)/i.test(url.hostname)) {
    return { status: 'error', message: 'That address is not publicly reachable.' };
  }

  let html: string;
  try {
    const response = await fetch(url.toString(), {
      headers: {
        // Some sites serve a stub to unknown agents.
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      return { status: 'error', message: `That page returned ${response.status}.` };
    }
    html = await response.text();
  } catch (error) {
    const message = (error as Error).name === 'TimeoutError' ? 'timed out' : (error as Error).message;
    return { status: 'error', message: `Could not fetch that page: ${message}.` };
  }

  const recipe = parseRecipeFromHtml(html, url.toString());
  if (!recipe) {
    return {
      status: 'error',
      message:
        'That page has no structured recipe data, so there is nothing reliable to read. Add it by hand instead.',
    };
  }
  if (recipe.ingredientLines.length === 0) {
    return {
      status: 'error',
      message: 'Found the recipe but none of its ingredients could be read. Add it by hand.',
    };
  }

  return {
    status: 'success',
    message:
      `Read ${recipe.ingredientLines.length} ingredient${recipe.ingredientLines.length === 1 ? '' : 's'}` +
      (recipe.unparsed.length > 0
        ? `. ${recipe.unparsed.length} line${recipe.unparsed.length === 1 ? '' : 's'} need a quantity adding.`
        : '.'),
    recipe,
  };
}
