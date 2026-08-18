/**
 * Who a meal belongs to.
 *
 * Pure, and shared by the server action and the component that renders the
 * control, so the button only appears when pressing it would actually work.
 * A UI that offers an action the server will refuse is worse than one that
 * offers nothing.
 */

import type { PlannedMeal } from './types';

/**
 * The person whose meal this is: whoever put it on the plan.
 *
 * Falls back to the cook for rows written before `created_by` existed, which is
 * a good guess rather than a coincidence — `addMealToPlan` has always set the
 * cook to the meal's creator. Falls back to the first participant after that,
 * so a meal from the very earliest data is not permanently un-owned.
 */
export function mealOwnerId(meal: PlannedMeal): string | null {
  return meal.createdBy ?? meal.cookedByUserId ?? meal.participants[0]?.userId ?? null;
}

/** Whether this person may say how many the meal feeds. */
export function canSetCapacity(meal: PlannedMeal, userId: string): boolean {
  return mealOwnerId(meal) === userId;
}

/** Everyone eating, guests included — the number a cap is measured against. */
export function mouthsAt(meal: PlannedMeal): number {
  return meal.participants.reduce(
    (sum, participant) => sum + 1 + (participant.guests ?? 0),
    0
  );
}
