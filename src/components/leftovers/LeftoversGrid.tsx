import { LeftoverCard } from './LeftoverCard';
import type { PlannedMeal, Recipe, User } from '@/lib/types';

interface LeftoversGridProps {
  meals: PlannedMeal[];
  recipes: Map<string, Recipe>;
  usersById: Map<string, User>;
}

export function LeftoversGrid({ meals, recipes, usersById }: LeftoversGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
      {meals.map((meal) => {
        const recipe = recipes.get(meal.recipeId);
        const cook = meal.cookedByUserId ? usersById.get(meal.cookedByUserId) : null;

        return (
          <LeftoverCard
            key={meal.id}
            meal={meal}
            recipe={recipe}
            cook={cook}
          />
        );
      })}
    </div>
  );
}
