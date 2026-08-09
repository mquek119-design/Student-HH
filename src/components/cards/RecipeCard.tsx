import Link from 'next/link';
import { FoodImage } from '@/components/media/FoodImage';
import { Icon } from '@/components/media/Icon';
import { formatPence } from '@/lib/money';
import type { PantryItem, Recipe } from '@/lib/types';

/** Image left, title + metadata right, green Plan button — as in the mockups. */
export function RecipeCard({
  recipe,
  pantryMatchCount,
}: {
  recipe: Recipe;
  pantryMatchCount?: number;
}) {
  return (
    <article className="bg-surface-container-lowest rounded-xl shadow-ambient-card border border-surface-container-highest p-sm flex items-center gap-md">
      <Link href={`/recipes/${recipe.id}`} className="shrink-0">
        <FoodImage
          seed={recipe.id}
          alt={recipe.title}
          className="w-16 h-16 rounded-lg text-[28px]"
        />
      </Link>

      <div className="flex-1 flex flex-col min-w-0">
        <Link href={`/recipes/${recipe.id}`} className="hover:underline">
          <h3 className="font-body-lg text-body-lg font-semibold truncate">{recipe.title}</h3>
        </Link>
        <p className="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-xs flex-wrap">
          <span className="flex items-center gap-0.5">
            <Icon name="schedule" className="text-[14px]" />
            {recipe.cookTimeMins} min
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-numeric-data">{formatPence(recipe.costPerPortion)}/portion</span>
        </p>
        {pantryMatchCount !== undefined && pantryMatchCount > 0 && (
          <span className="font-label-caps text-label-caps text-primary mt-xs">
            {pantryMatchCount} ingredient{pantryMatchCount === 1 ? '' : 's'} already in the pantry
          </span>
        )}
      </div>

      <Link
        href={`/plan#roster`}
        className="shrink-0 px-md py-2 rounded-full bg-primary text-on-primary font-semibold text-[14px] hover:opacity-90 transition-opacity"
      >
        Plan
      </Link>
    </article>
  );
}

/** How many of a recipe's ingredients the house already has to hand. */
export function pantryMatchCount(recipe: Recipe, pantry: PantryItem[]): number {
  const stocked = new Set(pantry.filter((item) => !item.lowStock).map((item) => item.ingredientId));
  return recipe.ingredients.filter(
    (ingredient) => ingredient.inPantry || stocked.has(ingredient.ingredientId)
  ).length;
}
