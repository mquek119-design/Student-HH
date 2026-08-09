'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Icon } from '@/components/media/Icon';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { clsx } from '@/lib/clsx';
import { formatPence } from '@/lib/money';
import type { Recipe, User, WeeklyPlan } from '@/lib/types';
import { WEEKDAYS, WEEKDAY_LABELS } from '@/lib/types';
import {
  addMealToPlan,
  leaveMeal,
  saveConstraints,
  type PlanActionState,
} from '@/app/plan/actions';

/**
 * "What do you fancy?" — the top half of the Plan tab.
 *
 * Every control here writes straight to the database through a server action;
 * there is no local draft state and no explicit save. That matters because
 * housemates plan concurrently: a "Done Planning" button would let two people
 * overwrite each other's week.
 */

const INITIAL: PlanActionState = { status: 'idle', message: '' };

const SUGGESTED_CONSTRAINTS = [
  { label: 'Vegetarian', icon: 'eco' },
  { label: 'Vegan', icon: 'spa' },
  { label: 'No pork', icon: 'block' },
  { label: 'Gluten free', icon: 'grain' },
  { label: 'Dairy free', icon: 'water_drop' },
  { label: 'On a budget', icon: 'savings' },
];

function SubmitButton({
  label,
  pendingLabel,
  icon,
  className,
}: {
  label: string;
  pendingLabel: string;
  icon: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={clsx('disabled:opacity-60', className)}>
      <Icon name={pending ? 'progress_activity' : icon} className="text-[18px]" />
      {pending ? pendingLabel : label}
    </button>
  );
}

export function FancyForm({
  plan,
  recipes,
  currentUser,
}: {
  plan: WeeklyPlan;
  recipes: Recipe[];
  currentUser: User;
  housemates: User[];
}) {
  const [addState, addAction] = useFormState(addMealToPlan, INITIAL);
  const [leaveState, leaveAction] = useFormState(leaveMeal, INITIAL);
  const [constraintState, constraintAction] = useFormState(saveConstraints, INITIAL);

  const locked = plan.status !== 'planning';
  const myMeals = plan.meals.filter((meal) =>
    meal.participants.some((p) => p.userId === currentUser.id)
  );

  const error = [addState, leaveState, constraintState].find((s) => s.status === 'error');

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-md md:gap-lg">
      <div className="md:col-span-7 flex flex-col gap-md md:gap-lg">
        <Card className="flex flex-col gap-md">
          <div className="flex justify-between items-center gap-sm">
            <h3 className="font-title-md text-title-md text-on-background">Your Week</h3>
            <Badge tone={locked ? 'neutral' : 'primary'}>{locked ? 'LOCKED' : 'OPEN'}</Badge>
          </div>

          {myMeals.length === 0 ? (
            <p className="font-body-sm text-body-sm text-on-surface-variant py-sm">
              You&apos;re not down for any meals this week. Add one below and your housemates will
              see it on the plan.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-surface-container-highest">
              {WEEKDAYS.flatMap((day) => {
                const dayMeals = myMeals.filter((meal) => meal.day === day);
                return dayMeals.map((meal) => (
                  <li key={meal.id} className="py-sm flex items-center justify-between gap-sm">
                    <span className="flex flex-col min-w-0">
                      <span className="font-title-md text-title-md truncate">
                        {WEEKDAY_LABELS[day]}
                      </span>
                      <span className="font-body-sm text-body-sm text-on-surface-variant truncate">
                        {meal.recipeTitle}
                        {meal.isShared && ' · shared'}
                      </span>
                    </span>

                    <form action={leaveAction}>
                      <input type="hidden" name="mealId" value={meal.id} />
                      <SubmitButton
                        label="Leave"
                        pendingLabel="…"
                        icon="close"
                        className="flex items-center gap-xs px-md py-2 rounded-full border border-outline-variant text-on-surface-variant text-[14px] font-semibold hover:bg-surface-container transition-colors"
                      />
                    </form>
                  </li>
                ));
              })}
            </ul>
          )}
        </Card>

        <Card className="flex flex-col gap-md">
          <h3 className="font-title-md text-title-md text-on-background">My Constraints</h3>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Saved to your profile and visible to the house when planning.
          </p>

          <form action={constraintAction} className="flex flex-col gap-md">
            <div className="flex flex-wrap gap-sm">
              {SUGGESTED_CONSTRAINTS.map((constraint) => {
                const isActive = currentUser.dietaryPreferences.includes(constraint.label);
                return (
                  <label
                    key={constraint.label}
                    className={clsx(
                      'px-md py-sm rounded-full border flex items-center gap-xs text-[14px] font-semibold cursor-pointer transition-colors',
                      'has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:text-primary',
                      'border-outline-variant bg-surface text-on-surface-variant hover:bg-surface-container'
                    )}
                  >
                    <input
                      type="checkbox"
                      name="constraint"
                      value={constraint.label}
                      defaultChecked={isActive}
                      className="sr-only"
                    />
                    <Icon name={constraint.icon} className="text-[18px]" />
                    {constraint.label}
                  </label>
                );
              })}
            </div>

            <SubmitButton
              label="Save constraints"
              pendingLabel="Saving…"
              icon="check"
              className="self-start flex items-center gap-xs px-md py-2 rounded-full bg-primary text-on-primary text-[14px] font-semibold hover:opacity-90 transition-opacity"
            />
          </form>
        </Card>
      </div>

      <div className="md:col-span-5 flex flex-col gap-md md:gap-lg">
        <Card accent="primary" className="flex flex-col gap-md">
          <h3 className="font-title-md text-title-md text-on-background">Add a meal</h3>

          <form action={addAction} className="flex flex-col gap-sm">
            <label className="flex flex-col gap-xs">
              <span className="font-body-sm text-body-sm font-semibold">Day</span>
              <select
                name="day"
                required
                disabled={locked}
                className="h-12 px-3 rounded-lg bg-surface-container-low border-none focus:ring-2 focus:ring-primary text-body-lg disabled:opacity-60"
              >
                {WEEKDAYS.map((day) => (
                  <option key={day} value={day}>
                    {WEEKDAY_LABELS[day]}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-xs">
              <span className="font-body-sm text-body-sm font-semibold">Recipe</span>
              <select
                name="recipeId"
                required
                disabled={locked}
                defaultValue=""
                className="h-12 px-3 rounded-lg bg-surface-container-low border-none focus:ring-2 focus:ring-primary text-body-lg disabled:opacity-60"
              >
                <option value="" disabled>
                  Choose a recipe…
                </option>
                {recipes.map((recipe) => (
                  <option key={recipe.id} value={recipe.id}>
                    {recipe.title}
                    {recipe.costPerPortion > 0
                      ? ` — ${formatPence(recipe.costPerPortion)}/portion`
                      : ''}
                  </option>
                ))}
              </select>
            </label>

            <SubmitButton
              label={locked ? 'Planning locked' : 'Add to plan'}
              pendingLabel="Adding…"
              icon="add"
              className="w-full h-12 mt-xs bg-secondary-container text-on-primary font-title-md text-title-md rounded-lg hover:bg-secondary transition-colors flex items-center justify-center gap-sm"
            />
          </form>

          <p className="font-body-sm text-[12px] text-on-surface-variant">
            Picking a recipe a housemate already chose joins you to their meal rather than adding a
            second one — that overlap is where the savings come from.
          </p>
        </Card>

        {error && (
          <p role="alert" className="font-body-sm text-body-sm text-error">
            {error.message}
          </p>
        )}
      </div>
    </div>
  );
}
