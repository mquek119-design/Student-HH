/**
 * "You've already got these — here's what else you can make."
 *
 * Runs when someone marks a meal as skipped after the order. The ingredients
 * were bought and paid for, so this is not a shopping suggestion: it is the
 * difference between food being eaten and food going in the bin.
 *
 * Deliberately a plain set-intersection query, not a recommender. The house has
 * twenty recipes and four ingredients to work with; anything cleverer would be
 * harder to trust and no more useful. Partial matches count — three of four
 * ingredients is a real suggestion when the fourth is an onion.
 */

import type { Recipe, RecipeIngredient } from './types';

export interface Suggestion {
  recipe: Recipe;
  /** Ingredients this recipe needs that the user already has. */
  have: RecipeIngredient[];
  /** Ingredients they would still need. Shown honestly, never hidden. */
  missing: RecipeIngredient[];
}

/** A suggestion has to use at least this much of what you're holding. */
const MIN_MATCHED = 2;

/** …and cover at least this fraction of the recipe, or it is not a meal. */
const MIN_COVERAGE = 0.5;

export function suggestFromIngredients(
  availableIngredientIds: readonly string[],
  recipes: readonly Recipe[],
  options: { excludeRecipeIds?: readonly string[]; limit?: number } = {}
): Suggestion[] {
  const available = new Set(availableIngredientIds);
  if (available.size === 0) return [];

  const excluded = new Set(options.excludeRecipeIds ?? []);
  const limit = options.limit ?? 3;

  const scored: Suggestion[] = [];

  for (const recipe of recipes) {
    if (excluded.has(recipe.id)) continue;
    if (recipe.ingredients.length === 0) continue;

    const have = recipe.ingredients.filter((ingredient) =>
      available.has(ingredient.ingredientId)
    );
    if (have.length < MIN_MATCHED) continue;
    if (have.length / recipe.ingredients.length < MIN_COVERAGE) continue;

    scored.push({
      recipe,
      have,
      missing: recipe.ingredients.filter(
        (ingredient) => !available.has(ingredient.ingredientId)
      ),
    });
  }

  // Most of your food used first; ties broken by needing least else, then by
  // being quicker to cook. A student with a skipped dinner wants tonight's
  // answer, not next week's project.
  scored.sort((a, b) => {
    if (b.have.length !== a.have.length) return b.have.length - a.have.length;
    if (a.missing.length !== b.missing.length) return a.missing.length - b.missing.length;
    return a.recipe.cookTimeMins - b.recipe.cookTimeMins;
  });

  return scored.slice(0, limit);
}

/**
 * Which of these will not survive being ignored.
 *
 * `fresh` is the only signal the schema carries — there is no shelf-life field
 * and inventing per-product expiry dates would be fabricating data. So this
 * says exactly what it knows: fresh things go off, cupboard things do not.
 */
export function perishablesAmong(ingredients: readonly RecipeIngredient[]): RecipeIngredient[] {
  return ingredients.filter((ingredient) => ingredient.category === 'fresh');
}
