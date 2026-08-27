'use client';

import { Notice } from '@/components/ui/Notice';
import type { Recipe, User } from '@/lib/types';

/**
 * Show dietary information from the recipe's dietary tags.
 * Displays tags for awareness, especially useful when housemates have dietary restrictions.
 */
export function DietaryWarning({
  recipe,
  mealParticipantIds,
  housemates,
}: {
  recipe: Recipe;
  mealParticipantIds: string[];
  housemates: User[];
}) {
  if (!recipe.dietaryTags || recipe.dietaryTags.length === 0) {
    return null;
  }

  // Only show dietary information if there are participants with dietary preferences
  const mealParticipants = housemates.filter((user) => mealParticipantIds.includes(user.id));
  const anyDietaryPreferences = mealParticipants.some(
    (p) => p.dietaryPreferences && p.dietaryPreferences.length > 0
  );

  if (!anyDietaryPreferences) {
    return null;
  }

  // Format the dietary tags as a readable message
  const tags = recipe.dietaryTags.map((t) => t.toLowerCase());
  const unique = Array.from(new Set(tags));
  const message =
    unique.length === 1
      ? `${unique[0]}`
      : unique.join(', ');

  return (
    <Notice tone="suggest" icon="info" className="my-xs">
      {message}
    </Notice>
  );
}
