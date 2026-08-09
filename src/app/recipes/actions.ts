'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/queries';
import { parsePounds } from '@/lib/money';
import { parseIngredientLine, type ParsedIngredient } from '@/lib/parseIngredient';
import type { IngredientCategory } from '@/lib/types';

export interface RecipeFormState {
  status: 'idle' | 'error';
  message: string;
}

const CATEGORIES: IngredientCategory[] = ['fresh', 'cupboard', 'frozen', 'household'];

function asCategory(value: FormDataEntryValue | null): IngredientCategory {
  const raw = String(value ?? '');
  return (CATEGORIES as string[]).includes(raw) ? (raw as IngredientCategory) : 'cupboard';
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

  const supabase = createClient();
  const category = asCategory(formData.get('category'));

  // Ingredients are a shared catalogue keyed on lower(name); reuse a row when
  // one already exists so pantry matching works across recipes.
  const ingredientIds: string[] = [];
  for (const parsed of ingredientLines) {
    const existing = await supabase
      .from('ingredients')
      .select('id')
      .ilike('name', parsed.name)
      .maybeSingle();

    if (existing.data) {
      ingredientIds.push(existing.data.id);
      continue;
    }

    const inserted = await supabase
      .from('ingredients')
      .insert({ name: parsed.name, default_unit: parsed.unit, category })
      .select('id')
      .single();

    if (inserted.error || !inserted.data) {
      return { status: 'error', message: `Could not save ingredient "${parsed.name}".` };
    }
    ingredientIds.push(inserted.data.id);
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
