/**
 * Plan conflict detection.
 *
 * A "conflict" is a day where the house has split across multiple recipes that
 * share almost nothing, so the shop has to carry two sets of ingredients that
 * could have been one. It is a nudge, not an error — housemates are allowed to
 * eat different things; we just show what it costs.
 *
 * This is a heuristic and deliberately conservative: it only fires when the
 * recipes are genuinely disjoint, so the warning stays credible. Replace the
 * savings estimate with real basket deltas once the optimiser exists.
 */

import type { PlanConflict, PlannedMeal, Recipe, Weekday } from './types';

/** Below this Jaccard overlap, two recipes count as genuinely disjoint. */
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
 * Cost of *not* converging: the cheaper meal's non-shared ingredients get
 * bought a second time. Approximated from cost-per-portion and head count,
 * scaled by how little the two recipes have in common.
 */
function estimateDuplicateSpend(a: Recipe, b: Recipe, diners: number, sharedFraction: number) {
  const cheaper = Math.min(a.costPerPortion, b.costPerPortion);
  const duplicated = Math.round(cheaper * Math.max(1, diners) * (1 - sharedFraction) * 0.5);
  return -duplicated;
}

export function detectConflicts(
  meals: PlannedMeal[],
  recipes: Recipe[],
  userNames: Record<string, string>
): PlanConflict[] {
  const recipeById = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const days = new Set(meals.map((meal) => meal.day));
  const conflicts: PlanConflict[] = [];

  for (const day of days) {
    const dayMeals = meals.filter((meal) => meal.day === day);
    if (dayMeals.length < 2) continue;

    // A day where every meal is shared is a deliberate split night — the house
    // chose to cook in two groups. That is a plan, not a clash, so it never
    // warns however little the two recipes have in common.
    if (dayMeals.every((meal) => meal.isShared)) continue;

    // Only distinct recipes can conflict. Two people on the same recipe is the
    // outcome we want, not a problem.
    const distinct = new Map<string, PlannedMeal[]>();
    for (const meal of dayMeals) {
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

    conflicts.push({
      day: day as Weekday,
      userIds,
      message: `${nameList} have incompatible choices.`,
      savingsImpact: estimateDuplicateSpend(recipeA, recipeB, userIds.length, worst.overlap),
    });
  }

  return conflicts;
}
