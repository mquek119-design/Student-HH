/**
 * Where the house could shop together without eating together.
 *
 * This replaced a "conflict detector" that told housemates their choices were
 * *incompatible* and invited them to resolve it. That framing was wrong on the
 * product's own terms: nobody is obliged to eat what somebody else fancies, and
 * an app that nags you towards their dinner is an app you stop opening.
 *
 * The real opportunity is quieter and bigger. Two people cooking different
 * meals on different nights can still be cooking from the same chicken, the
 * same rice, the same jar of paste — one bigger pack is cheaper per gram than
 * two small ones, and the fridge holds it either way. So this looks for
 * sittings where the house is buying two separate sets of ingredients, and
 * answers with *recipes*: cook your own thing, but this version of it shares.
 *
 * It is a suggestion and nothing else. It never blocks a choice, never scores
 * anyone, and stays quiet unless it has a concrete alternative to offer.
 */

import { suggestFromIngredients } from './suggestions';
import type { MealType, PlanOverlap, PlannedMeal, Recipe, Weekday } from './types';

/** Below this Jaccard overlap, two recipes genuinely share nothing. */
const OVERLAP_THRESHOLD = 0.2;

function ingredientIds(recipe: Recipe): Set<string> {
  return new Set(recipe.ingredients.map((ingredient) => ingredient.ingredientId));
}

function overlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const id of a) if (b.has(id)) shared += 1;
  return shared / (a.size + b.size - shared);
}

/**
 * Roughly what buying twice costs.
 *
 * Approximated from cost-per-portion and head count, and deliberately reported
 * as "about" — the real figure only exists once the basket is built. It is
 * shown small and last, because the point is the alternative recipe, not a
 * number designed to make anyone feel bad about wanting a curry.
 */
function estimateDuplicateSpend(a: Recipe, b: Recipe, diners: number, sharedFraction: number) {
  const cheaper = Math.min(a.costPerPortion, b.costPerPortion);
  return Math.round(cheaper * Math.max(1, diners) * (1 - sharedFraction) * 0.5);
}

export function findOverlapGaps(
  meals: PlannedMeal[],
  recipes: Recipe[],
  userNames: Record<string, string>
): PlanOverlap[] {
  const recipeById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const sittings = new Set(meals.map((meal) => `${meal.day}|${meal.mealType}`));
  const gaps: PlanOverlap[] = [];

  for (const sitting of sittings) {
    const [day, mealType] = sitting.split('|') as [Weekday, MealType];
    const sittingMeals = meals.filter((meal) => meal.day === day && meal.mealType === mealType);
    if (sittingMeals.length < 2) continue;

    // Only distinct recipes can miss an overlap. Two people on the same recipe
    // is the outcome we want, not a problem.
    const distinct = new Map<string, PlannedMeal[]>();
    for (const meal of sittingMeals) {
      distinct.set(meal.recipeId, [...(distinct.get(meal.recipeId) ?? []), meal]);
    }
    if (distinct.size < 2) continue;

    const recipeIds = [...distinct.keys()];
    let worst: { a: string; b: string; overlap: number } | null = null;

    for (let i = 0; i < recipeIds.length; i += 1) {
      for (let j = i + 1; j < recipeIds.length; j += 1) {
        const recipeA = recipeById.get(recipeIds[i]);
        const recipeB = recipeById.get(recipeIds[j]);
        if (!recipeA || !recipeB) continue;

        const score = overlap(ingredientIds(recipeA), ingredientIds(recipeB));
        if (worst === null || score < worst.overlap) {
          worst = { a: recipeIds[i], b: recipeIds[j], overlap: score };
        }
      }
    }

    if (!worst || worst.overlap >= OVERLAP_THRESHOLD) continue;

    const recipeA = recipeById.get(worst.a);
    const recipeB = recipeById.get(worst.b);
    if (!recipeA || !recipeB) continue;

    // Everything this sitting already commits the house to buying. A recipe
    // drawing on that pool costs the shop less than one starting from nothing.
    const alreadyBuying = new Set(
      recipeIds.flatMap((id) => {
        const recipe = recipeById.get(id);
        return recipe ? recipe.ingredients.map((ingredient) => ingredient.ingredientId) : [];
      })
    );

    // Suggesting scrambled eggs for Wednesday dinner is technically an overlap
    // and obviously useless. Recipes tag their sitting; honour it when they do.
    const fitsSitting = (recipe: Recipe) => {
      const tags = recipe.tags.map((tag) => tag.toLowerCase());
      const claimed = (['breakfast', 'lunch', 'dinner'] as MealType[]).filter((type) =>
        tags.includes(type)
      );
      return claimed.length === 0 || claimed.includes(mealType);
    };

    const suggestions = suggestFromIngredients(
      [...alreadyBuying],
      recipes.filter(fitsSitting),
      { excludeRecipeIds: recipeIds, limit: 3 }
    ).map((suggestion) => ({
      recipeId: suggestion.recipe.id,
      title: suggestion.recipe.title,
      shares: suggestion.have.map((ingredient) => ingredient.name),
    }));

    // Nothing useful to offer, so say nothing. A warning with no alternative is
    // just a complaint about what somebody chose to eat.
    if (suggestions.length === 0) continue;

    const involved = [
      ...(distinct.get(worst.a) ?? []),
      ...(distinct.get(worst.b) ?? []),
    ].flatMap((meal) => meal.participants.map((participant) => participant.userId));

    const userIds = [...new Set(involved)];
    const names = userIds.map((id) => userNames[id] ?? 'Someone');
    const nameList =
      names.length <= 1
        ? (names[0] ?? 'Someone')
        : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

    gaps.push({
      day,
      mealType,
      userIds,
      message: `${nameList} are cooking separately, so the shop buys two sets of ingredients.`,
      missedSaving: estimateDuplicateSpend(recipeA, recipeB, userIds.length, worst.overlap),
      suggestions,
    });
  }

  return gaps;
}
