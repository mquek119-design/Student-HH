import Link from 'next/link';
import { Avatar } from '@/components/avatars/Avatar';
import { Icon } from '@/components/media/Icon';
import { Badge } from '@/components/ui/Badge';
import { clsx } from '@/lib/clsx';
import { formatPence } from '@/lib/money';
import type { PlannedMeal, User, Weekday, WeeklyPlan } from '@/lib/types';
import { WEEKDAYS, WEEKDAY_LABELS } from '@/lib/types';

/**
 * Days × housemates. One card per day; meals within a day become groups so a
 * split night (roast vs lasagne) reads as two rows rather than a jumble.
 * Days carrying a conflict get the error treatment from the mockup.
 */

interface PlanGridProps {
  plan: WeeklyPlan;
  housemates: User[];
  weekStartDate: string;
}

function dayDate(weekStartDate: string, day: Weekday): string {
  const index = WEEKDAYS.indexOf(day);
  const date = new Date(`${weekStartDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + index);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function MealGroup({
  meal,
  housemates,
  index,
  tone,
  showGroupLabel,
}: {
  meal: PlannedMeal;
  housemates: User[];
  index: number;
  tone: 'primary' | 'secondary' | 'neutral';
  /** Only meaningful when the day actually splits into two or more groups. */
  showGroupLabel: boolean;
}) {
  const byId = new Map(housemates.map((user) => [user.id, user]));
  const diners = meal.participants
    .map((p) => byId.get(p.userId))
    .filter((user): user is User => Boolean(user));

  return (
    <div className="flex flex-col gap-sm">
      {showGroupLabel && (
        <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
          Group {index + 1}: {meal.recipeTitle}
        </span>
      )}
      <ul className="grid grid-cols-3 sm:grid-cols-4 gap-sm">
        {diners.map((user) => (
          <li key={user.id} className="flex flex-col items-center gap-xs">
            <Link href={`/recipes/${meal.recipeId}`} aria-label={`${meal.recipeTitle} for ${user.name}`}>
              <Avatar
                user={user}
                size="md"
                ring={tone === 'secondary' ? 'secondary' : 'primary'}
              />
            </Link>
            <span
              className={clsx(
                'font-body-sm text-[12px] text-center line-clamp-1 w-full',
                tone === 'secondary' ? 'text-secondary' : 'text-primary font-semibold'
              )}
            >
              {meal.recipeTitle}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PlanGrid({ plan, housemates, weekStartDate }: PlanGridProps) {
  const byId = new Map(housemates.map((user) => [user.id, user]));

  return (
    <div className="flex flex-col gap-md">
      {WEEKDAYS.map((day) => {
        const meals = plan.meals.filter((meal) => meal.day === day);
        const conflict = plan.conflicts.find((c) => c.day === day);
        const isShared = meals.length === 1 && meals[0].isShared;
        const isSplitNight = meals.length > 1 && meals.every((meal) => meal.isShared);

        return (
          <section
            key={day}
            className={clsx(
              'rounded-xl border overflow-hidden shadow-ambient-card',
              conflict
                ? 'bg-error-container/30 border-error/30'
                : isSplitNight
                  ? 'bg-secondary-fixed/30 border-secondary-container/30'
                  : 'bg-surface-container-lowest border-surface-container-highest'
            )}
          >
            <header className="flex items-start justify-between gap-sm p-md border-b border-black/5">
              <div className="flex flex-col">
                <h3
                  className={clsx(
                    'font-title-md text-title-md',
                    conflict ? 'text-error' : isSplitNight ? 'text-secondary' : 'text-on-surface'
                  )}
                >
                  {WEEKDAY_LABELS[day]}
                </h3>
                <span className="font-numeric-data text-[12px] text-on-surface-variant">
                  {dayDate(weekStartDate, day)}
                </span>
              </div>

              {conflict ? (
                <Icon name="warning" filled className="text-error" />
              ) : isShared ? (
                <Badge tone="solid-primary">SHARED: {meals[0].recipeTitle}</Badge>
              ) : isSplitNight ? (
                <div className="flex flex-col items-end gap-1">
                  {meals.map((meal) => (
                    <span
                      key={meal.id}
                      className="font-label-caps text-label-caps uppercase text-secondary"
                    >
                      {meal.recipeTitle}
                    </span>
                  ))}
                </div>
              ) : null}
            </header>

            {conflict && (
              <div className="flex items-start gap-sm p-md border-b border-error/20 bg-error-container/40">
                <Icon name="error" filled className="text-error mt-0.5" />
                <div className="flex flex-col gap-xs">
                  <span className="font-title-md text-title-md text-error">Conflict Detected</span>
                  <p className="font-body-sm text-body-sm text-on-error-container">
                    {conflict.message} Shared savings:{' '}
                    <strong className="font-numeric-data">
                      {formatPence(conflict.savingsImpact)}
                    </strong>
                    .{' '}
                    <Link href="/plan#roster" className="underline font-semibold">
                      Tap to resolve.
                    </Link>
                  </p>
                </div>
              </div>
            )}

            <div className="p-md flex flex-col gap-md">
              {meals.length === 0 ? (
                <Link
                  href="/plan#roster"
                  className="flex items-center justify-center gap-sm py-md rounded-lg border border-dashed border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary transition-colors"
                >
                  <Icon name="add" />
                  <span className="font-body-sm text-body-sm">Add a meal</span>
                </Link>
              ) : conflict ? (
                // Conflicting days list every housemate's own pick side by side.
                <ul className="grid grid-cols-3 gap-sm">
                  {meals.flatMap((meal) =>
                    meal.participants.map((participant) => {
                      const user = byId.get(participant.userId);
                      if (!user) return null;
                      const inConflict = conflict.userIds.includes(user.id);
                      return (
                        <li
                          key={`${meal.id}-${user.id}`}
                          className="flex flex-col items-center gap-xs"
                        >
                          <Avatar user={user} size="md" ring={inConflict ? 'error' : 'none'} />
                          <span
                            className={clsx(
                              'font-body-sm text-[12px] text-center line-clamp-1 w-full',
                              inConflict ? 'text-error font-semibold' : 'text-on-surface-variant'
                            )}
                          >
                            {meal.recipeTitle}
                          </span>
                        </li>
                      );
                    })
                  )}
                </ul>
              ) : (
                meals.map((meal, index) => (
                  <MealGroup
                    key={meal.id}
                    meal={meal}
                    housemates={housemates}
                    index={index}
                    tone={isSplitNight ? 'secondary' : 'primary'}
                    showGroupLabel={meals.length > 1}
                  />
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
