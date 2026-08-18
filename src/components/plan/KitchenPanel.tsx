import Link from 'next/link';
import { Icon } from '@/components/media/Icon';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Notice } from '@/components/ui/Notice';
import { MealStatusControls } from '@/components/plan/MealStatusControls';
import { perishablesAmong, suggestFromIngredients } from '@/lib/suggestions';
import type { PlannedMeal, Recipe, User, WeeklyPlan } from '@/lib/types';
import { MEAL_TYPES, MEAL_TYPE_LABELS, WEEKDAYS, WEEKDAY_LABELS } from '@/lib/types';

/**
 * The week after the shop arrives.
 *
 * Replaces "What do you fancy?" once the order is placed, because the question
 * has changed: the food is bought, so nothing here asks what you want. It shows
 * what you have and when it goes off.
 *
 * The one rule worth stating out loud, because it is the whole reason this
 * screen can be relaxed about everything else: **nothing on it moves money.**
 * Skipping, bailing and cooking something else are all free. The split was
 * settled when the order went in.
 */

function suggestionsFor(meal: PlannedMeal, recipes: Recipe[]) {
  const recipe = recipes.find((entry) => entry.id === meal.recipeId);
  if (!recipe) return { recipe: null, suggestions: [], perishables: [] };

  return {
    recipe,
    suggestions: suggestFromIngredients(
      recipe.ingredients.map((ingredient) => ingredient.ingredientId),
      recipes,
      { excludeRecipeIds: [recipe.id] }
    ),
    perishables: perishablesAmong(recipe.ingredients),
  };
}

export function KitchenPanel({
  plan,
  recipes,
  currentUser,
}: {
  plan: WeeklyPlan;
  recipes: Recipe[];
  currentUser: User;
}) {
  const myMeals = plan.meals
    .filter((meal) => meal.participants.some((p) => p.userId === currentUser.id))
    .sort((a, b) => {
      const byDay = WEEKDAYS.indexOf(a.day) - WEEKDAYS.indexOf(b.day);
      return byDay !== 0 ? byDay : MEAL_TYPES.indexOf(a.mealType) - MEAL_TYPES.indexOf(b.mealType);
    });

  if (myMeals.length === 0) {
    return (
      <Card className="flex items-start gap-sm">
        <Icon name="shopping_basket" className="text-on-surface-variant mt-0.5" />
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Shop’s in, but you weren’t down for anything this week — so none of it is yours to
          sort out.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-md">
      <Notice tone="good" title="The shop's been placed">
        Everything below is bought and paid for, so change your mind as much as you like — none of
        it moves anyone&apos;s money.
      </Notice>

      {myMeals.map((meal) => {
        const mine = meal.participants.find((p) => p.userId === currentUser.id);
        const { recipe, suggestions, perishables } = suggestionsFor(meal, recipes);
        const skipped = meal.status === 'skipped';

        return (
          <Card key={meal.id} className="flex flex-col gap-sm">
            <div className="flex items-start justify-between gap-sm">
              <div className="min-w-0">
                <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
                  {WEEKDAY_LABELS[meal.day]} · {MEAL_TYPE_LABELS[meal.mealType]}
                </span>
                <h3 className="font-title-md text-title-md truncate">
                  <Link href={`/recipes/${meal.recipeId}`} className="hover:underline">
                    {meal.recipeTitle}
                  </Link>
                </h3>
              </div>

              {meal.status === 'cooked' ? (
                <Badge tone="solid-primary">COOKED</Badge>
              ) : meal.status === 'swapped' ? (
                <Badge tone="primary">SWAPPED</Badge>
              ) : skipped ? (
                <Badge tone="neutral">SKIPPED</Badge>
              ) : null}
            </div>

            <MealStatusControls
              mealId={meal.id}
              status={meal.status}
              bailed={Boolean(mine?.bailed)}
            />

            {skipped && recipe && (
              <div className="flex flex-col gap-sm pt-sm border-t border-surface-container-highest">
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  You&apos;ve got{' '}
                  <strong className="text-on-surface">
                    {recipe.ingredients.map((ingredient) => ingredient.name).join(', ')}
                  </strong>
                  .
                </p>

                {perishables.length > 0 && (
                  <p className="flex items-start gap-xs font-body-sm text-body-sm text-secondary">
                    <Icon name="schedule" className="text-[18px] mt-0.5" />
                    <span>
                      {perishables.map((ingredient) => ingredient.name).join(', ')}{' '}
                      {perishables.length === 1 ? 'is' : 'are'} fresh — use{' '}
                      {perishables.length === 1 ? 'it' : 'them'} before{' '}
                      {perishables.length === 1 ? 'it goes' : 'they go'} off.
                    </span>
                  </p>
                )}

                {suggestions.length > 0 ? (
                  <>
                    <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
                      What else you could make
                    </span>
                    <ul className="flex flex-col gap-xs">
                      {suggestions.map((suggestion) => (
                        <li key={suggestion.recipe.id}>
                          <Link
                            href={`/recipes/${suggestion.recipe.id}`}
                            className="flex items-center justify-between gap-sm px-md py-sm rounded-lg bg-surface-container-low hover:bg-surface-container transition-colors"
                          >
                            <span className="min-w-0">
                              <span className="font-body-lg text-body-lg font-semibold block truncate">
                                {suggestion.recipe.title}
                              </span>
                              <span className="font-body-sm text-[12px] text-on-surface-variant">
                                Uses {suggestion.have.length} of what you have
                                {suggestion.missing.length > 0
                                  ? ` · still need ${suggestion.missing
                                      .map((ingredient) => ingredient.name)
                                      .join(', ')}`
                                  : ' · nothing else needed'}
                              </span>
                            </span>
                            <Icon name="chevron_right" className="text-on-surface-variant shrink-0" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Nothing in the book uses enough of this. Add a recipe and it’ll turn up here next
                    time this happens.
                  </p>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
