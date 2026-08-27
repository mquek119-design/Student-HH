'use client';

import Link from 'next/link';
import { FoodImage } from '@/components/media/FoodImage';
import { Icon } from '@/components/media/Icon';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { PlannedMeal, Recipe, User } from '@/lib/types';
import { MEAL_TYPE_ICONS, MEAL_TYPE_LABELS } from '@/lib/types';

interface LeftoverCardProps {
  meal: PlannedMeal;
  recipe?: Recipe;
  cook?: User | null;
}

export function LeftoverCard({ meal, recipe, cook }: LeftoverCardProps) {
  return (
    <Card padded={false} className="flex flex-col overflow-hidden hover:shadow-md transition-shadow">
      {/* Image */}
      <Link
        href={`/recipes/${meal.recipeId}`}
        className="flex-shrink-0 h-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <FoodImage
          src={recipe?.imageUrl}
          seed={meal.recipeId}
          alt={meal.recipeTitle}
          className="w-full h-full text-[60px]"
        />
      </Link>

      {/* Content */}
      <div className="p-md flex flex-col gap-sm flex-1">
        {/* Sitting + Title */}
        <div className="flex items-start gap-xs min-w-0">
          <span className="flex items-center gap-0.5 font-label-caps text-label-caps uppercase text-on-surface-variant shrink-0">
            <Icon name={MEAL_TYPE_ICONS[meal.mealType]} className="text-[13px]" />
            {MEAL_TYPE_LABELS[meal.mealType]}
          </span>
          <Link href={`/recipes/${meal.recipeId}`} className="min-w-0 hover:underline">
            <h3 className="font-title-md text-title-md text-on-surface leading-tight">
              {meal.recipeTitle}
            </h3>
          </Link>
        </div>

        {/* Cook info */}
        <div className="flex items-center gap-xs text-body-sm text-on-surface-variant">
          <Icon name="skillet" className="text-[14px]" />
          <span>
            {cook ? (
              <>
                <strong className="text-on-surface">{cook.name}</strong>
                {cook.room && <span> (Room {cook.room}) </span>}
                cooked
              </>
            ) : (
              'No cook assigned'
            )}
          </span>
        </div>

        {/* Prep time */}
        {recipe && recipe.cookTimeMins > 0 && (
          <div className="flex items-center gap-xs text-body-sm text-on-surface-variant">
            <Icon name="schedule" className="text-[14px]" />
            <span className="font-numeric-data">{recipe.cookTimeMins} mins</span>
          </div>
        )}

        {/* Claim button */}
        <Button
          disabled
          variant="secondary"
          size="sm"
          fullWidth
          className="mt-auto"
          title="Leftovers claiming feature coming soon"
        >
          Claim leftovers
        </Button>
      </div>
    </Card>
  );
}
