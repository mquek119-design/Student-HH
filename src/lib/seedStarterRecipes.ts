/**
 * Seeds starter recipes into a new house.
 * Called from the house creation flow to give new users some meal options.
 */

'use server';

import { createClient } from '@/lib/supabase/server';
import { findOrCreateIngredient } from '@/lib/ingredients';
import { STARTER_RECIPES } from '@/lib/starterRecipes';

export async function seedStarterRecipes(houseId: string, createdBy: string): Promise<void> {
  const supabase = await createClient();

  for (const recipe of STARTER_RECIPES) {
    // Create the recipe row
    const recipeResult = await supabase
      .from('recipes')
      .insert({
        house_id: houseId,
        created_by: createdBy,
        title: recipe.title,
        cook_time_mins: recipe.cookTimeMins,
        servings: recipe.servings,
        tags: recipe.tags,
        dietary_tags: [],
        instructions: recipe.instructions,
        difficulty: 'easy',
        cost_per_portion: 0,
      })
      .select('id')
      .single();

    if (!recipeResult.data?.id) {
      continue;
    }

    // Resolve ingredient ids and create links
    const ingredientIds: string[] = [];
    for (const ing of recipe.ingredients) {
      const result = await findOrCreateIngredient(supabase, {
        name: ing.name,
        unit: ing.unit,
        category: ing.category,
      });
      if ('error' in result) {
        continue;
      }
      ingredientIds.push(result.id);
    }

    // Create recipe_ingredient links
    const links = recipe.ingredients.map((ing, index) => ({
      recipe_id: recipeResult.data.id,
      ingredient_id: ingredientIds[index],
      quantity: ing.quantity,
      unit: ing.unit,
    }));

    // Deduplicate in case same ingredient appears twice
    const deduped = [...new Map(links.map((link) => [link.ingredient_id, link])).values()];

    const linkResult = await supabase.from('recipe_ingredients').insert(deduped);
    if (linkResult.error) {
      // Error handled silently - ingredients may already exist
    }
  }
}
