'use client';

import { Notice } from '@/components/ui/Notice';
import type { Recipe, User } from '@/lib/types';

/**
 * Show dietary warnings when the current user's dietary preferences
 * don't match the recipe's dietary tags.
 *
 * For example: "Not dairy-free (you marked as dairy-free)"
 */
export function DietaryWarning({
  recipe,
  currentUser,
}: {
  recipe: Recipe;
  currentUser: User;
}) {
  // If the user has no dietary preferences or the recipe has no dietary tags, no warning
  if (
    !currentUser.dietaryPreferences ||
    currentUser.dietaryPreferences.length === 0 ||
    !recipe.dietaryTags ||
    recipe.dietaryTags.length === 0
  ) {
    return null;
  }

  // Normalize the recipe's dietary tags to lowercase for comparison
  const recipeTags = new Set(recipe.dietaryTags.map((t) => t.toLowerCase()));

  // Check for any unmet dietary preferences (dietary restrictions not satisfied by the recipe)
  const unmatchedPreferences = currentUser.dietaryPreferences.filter(
    (pref) => !recipeTags.has(pref.toLowerCase())
  );

  // No warnings if all dietary preferences are satisfied
  if (unmatchedPreferences.length === 0) {
    return null;
  }

  // Format the warning message
  const warningTags = unmatchedPreferences.join(', ');
  const message =
    unmatchedPreferences.length === 1
      ? `Not ${unmatchedPreferences[0]} (you marked as ${unmatchedPreferences[0]})`
      : `Not suitable for: ${warningTags}`;

  return (
    <Notice tone="check" icon="info" className="my-xs">
      {message}
    </Notice>
  );
}
