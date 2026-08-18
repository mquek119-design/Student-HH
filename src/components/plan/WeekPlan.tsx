'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Avatar } from '@/components/avatars/Avatar';
import { MealOptionsSheet } from '@/components/plan/MealOptionsSheet';
import { FoodImage } from '@/components/media/FoodImage';
import { Icon } from '@/components/media/Icon';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { clsx } from '@/lib/clsx';
import { canSetCapacity, mealOwnerId, mouthsAt } from '@/lib/meals';
import { joinMeal, leaveMeal, type PlanActionState } from '@/app/plan/actions';
import type { PlannedMeal, User, Weekday, WeeklyPlan } from '@/lib/types';
import type { WeekChoice } from '@/lib/weeks';
import { MEAL_TYPES, MEAL_TYPE_ICONS, MEAL_TYPE_LABELS, WEEKDAYS, WEEKDAY_LABELS } from '@/lib/types';

/**
 * The week as a list of days, two abreast on a wide screen.
 *
 * A meal is two lines: sitting and title on one, everything true about it on
 * the next. The controls that only matter to people eating it — cook, guests,
 * how many the pan holds — appear on a third line and only for them, so a meal
 * you are not in stays two lines high and the week stays scannable.
 *
 * A day holds as many meals as people want. Joining somebody else's is an
 * invitation, never an obligation, and adding your own for the same night is
 * equally normal — so meals stack, with no group numbering and no error colour.
 */

const INITIAL: PlanActionState = { status: 'idle', message: '' };

const WEEKEND: Weekday[] = ['sat', 'sun'];

function dayDate(weekStartDate: string, day: Weekday): string {
  const index = WEEKDAYS.indexOf(day);
  const date = new Date(`${weekStartDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + index);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function JoinToggle({ joined, full }: { joined: boolean; full: boolean }) {
  const { pending } = useFormStatus();

  if (full && !joined) {
    return (
      <span
        title="Cooked for a set number. Put your own meal on for the same night instead."
        className="shrink-0 inline-flex items-center gap-xs px-sm h-9 rounded-full border border-outline-variant text-on-surface-variant/70 text-[13px] font-semibold"
      >
        <Icon name="lock" className="text-[16px]" />
        Full
      </span>
    );
  }

  return (
    <Button
      type="submit"
      size="sm"
      pending={pending}
      pendingLabel="…"
      variant={joined ? 'outline' : 'primary'}
      icon={joined ? 'logout' : 'add'}
      className="shrink-0"
    >
      {joined ? 'Leave' : 'Join'}
    </Button>
  );
}

function MealRow({
  meal,
  housemates,
  currentUser,
  locked,
  past,
}: {
  meal: PlannedMeal;
  housemates: User[];
  currentUser: User;
  locked: boolean;
  /**
   * The day has been and gone. Closes planning — you cannot join Monday's
   * dinner on Thursday — but deliberately leaves the options sheet open,
   * because whether it got cooked is recorded after the night, usually the
   * next morning.
   */
  past: boolean;
}) {
  const [, joinAction] = useFormState(joinMeal, INITIAL);
  const [, leaveAction] = useFormState(leaveMeal, INITIAL);
  const [optionsOpen, setOptionsOpen] = useState(false);

  const byId = new Map(housemates.map((user) => [user.id, user]));
  const diners = meal.participants
    .map((participant) => ({ user: byId.get(participant.userId), guests: participant.guests ?? 0 }))
    .filter((entry): entry is { user: User; guests: number } => Boolean(entry.user));

  const mine = meal.participants.find((participant) => participant.userId === currentUser.id);
  const joined = Boolean(mine);
  const cook = meal.cookedByUserId ? byId.get(meal.cookedByUserId) : undefined;
  const offeredTo = meal.cookOfferTo ? byId.get(meal.cookOfferTo) : undefined;
  const askedMe = meal.cookOfferTo === currentUser.id;
  const mouths = mouthsAt(meal);
  const full = meal.maxDiners !== null && mouths >= meal.maxDiners;

  // Capping a meal belongs to whoever put it on, not to the table. Everyone
  // else sees the number as a fact about the night, which is all it is to them.
  const isOwner = canSetCapacity(meal, currentUser.id);
  const owner = mealOwnerId(meal);
  const ownerName = owner ? byId.get(owner)?.name : undefined;

  return (
    <article className={clsx('flex flex-col gap-xs px-md py-sm', joined && 'bg-primary-fixed/25')}>
      <div className="flex items-center gap-sm min-w-0">
        <Link
          href={`/recipes/${meal.recipeId}`}
          className="shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <FoodImage
            seed={meal.recipeId}
            alt={meal.recipeTitle}
            className="w-11 h-11 rounded-lg text-[20px]"
          />
        </Link>

        <div className="min-w-0 flex-1">
          {/* Sitting sits inline with the title rather than above it: a whole
              line per meal for one word is a line the week cannot spare. */}
          <div className="flex items-baseline gap-xs min-w-0">
            <span className="flex items-center gap-0.5 font-label-caps text-label-caps uppercase text-on-surface-variant shrink-0">
              <Icon name={MEAL_TYPE_ICONS[meal.mealType]} className="text-[13px]" />
              {MEAL_TYPE_LABELS[meal.mealType]}
            </span>
            <Link href={`/recipes/${meal.recipeId}`} className="min-w-0 hover:underline">
              <h4 className="font-title-md text-title-md text-on-surface leading-tight truncate">
                {meal.recipeTitle}
              </h4>
            </Link>
          </div>

          <div className="flex items-center gap-x-sm gap-y-0 flex-wrap font-body-sm text-[12px] text-on-surface-variant">
            {diners.length > 0 ? (
              <span className="flex items-center gap-xs">
                <span className="flex items-center -space-x-1.5">
                  {diners.slice(0, 5).map(({ user }) => (
                    <Avatar
                      key={user.id}
                      user={user}
                      size="xs"
                      className="ring-2 ring-surface-container-lowest"
                    />
                  ))}
                </span>
                <span className="font-numeric-data">
                  {mouths}
                  {meal.maxDiners !== null && ` of ${meal.maxDiners}`} in
                </span>
              </span>
            ) : (
              // "0 in" reads like a bug. This is a meal waiting for someone.
              <span className="italic">Nobody&apos;s in yet</span>
            )}

            <span className={clsx('flex items-center gap-0.5', !cook && 'italic opacity-70')}>
              <Icon name="skillet" className="text-[13px]" />
              {cook ? `${cook.name} cooks` : 'No cook yet'}
            </span>

            {/* A pending hand-over is worth seeing from the week: it is the one
                state where the person on the meal is not the person who will
                end up cooking it. */}
            {offeredTo && (
              <span
                className="flex items-center gap-0.5 text-on-secondary-fixed"
                title={`${cook?.name ?? 'They'} asked ${offeredTo.name} to take it`}
              >
                <Icon name="pending" className="text-[13px]" />
                {askedMe ? 'they asked you' : `asked ${offeredTo.name}`}
              </span>
            )}

            {(mine?.guests ?? 0) > 0 && (
              <span className="flex items-center gap-0.5">
                <Icon name="person_add" className="text-[13px]" />
                you +{mine?.guests}
              </span>
            )}

            {/* Read-only for everybody but the owner, so a cap is never a
                mystery — you can see the number and whose call it was. */}
            {meal.maxDiners !== null && !isOwner && (
              <span
                className="flex items-center gap-0.5 text-on-secondary-fixed"
                title={
                  ownerName
                    ? `${ownerName} is cooking for ${meal.maxDiners}`
                    : `Cooked for ${meal.maxDiners}`
                }
              >
                <Icon name="lock" className="text-[13px]" />
                Cooking for {meal.maxDiners}
              </span>
            )}
          </div>
        </div>

        {!locked && (
          <div className="flex items-center gap-xs shrink-0">
            {/* Cook, guests, capacity and who's in all live behind this. They
                are settings you change once, not information you read every
                time, and three permanent controls per meal buried the week. */}
            {joined && (
              <button
                type="button"
                onClick={() => setOptionsOpen(true)}
                aria-label={`Options for ${meal.recipeTitle}`}
                className={clsx(
                  'w-9 h-9 rounded-full transition-colors flex items-center justify-center',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  askedMe
                    ? 'bg-secondary-fixed text-on-secondary-fixed'
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                )}
              >
                <Icon name={askedMe ? 'notifications' : 'tune'} className="text-[18px]" />
              </button>
            )}
            {/* Gone days keep the sheet and lose the toggle. */}
            {!past && (
              <form action={joined ? leaveAction : joinAction}>
                <input type="hidden" name="mealId" value={meal.id} />
                <JoinToggle joined={joined} full={full} />
              </form>
            )}
          </div>
        )}
      </div>

      {optionsOpen && (
        <MealOptionsSheet
          meal={meal}
          diners={diners}
          currentUser={currentUser}
          onClose={() => setOptionsOpen(false)}
        />
      )}
    </article>
  );
}

export function WeekPlan({
  plan,
  housemates,
  currentUser,
  week,
}: {
  plan: WeeklyPlan;
  housemates: User[];
  currentUser: User;
  /** Carried into the recipe book so a meal lands on the week you were looking at. */
  week: WeekChoice;
}) {
  const locked = plan.status !== 'planning';
  // Only this week has a today, and only this week has a past. Next week is all
  // still ahead of you, so greying Monday there would be pointing at a day that
  // has not happened.
  const todayIndex = week === 'this' ? (new Date().getDay() + 6) % 7 : -1;
  const today = todayIndex >= 0 ? WEEKDAYS[todayIndex] : null;

  const days = WEEKDAYS.filter(
    (day) => !WEEKEND.includes(day) || plan.meals.some((meal) => meal.day === day)
  );

  return (
    // Two abreast once there is room. A single column on a 1400px screen left
    // two thirds of the page empty and pushed Friday below the fold.
    <ul className="grid grid-cols-1 lg:grid-cols-2 gap-md items-start">
      {days.map((day) => {
        const dayMeals = plan.meals
          .filter((meal) => meal.day === day)
          .sort((a, b) => MEAL_TYPES.indexOf(a.mealType) - MEAL_TYPES.indexOf(b.mealType));

        const isToday = day === today;
        const isPast = todayIndex >= 0 && WEEKDAYS.indexOf(day) < todayIndex;
        const shared = dayMeals.length === 1 && dayMeals[0].isShared ? dayMeals[0] : null;

        return (
          <li
            key={day}
            className={clsx(
              'rounded-xl border bg-surface-container-lowest shadow-ambient-card overflow-hidden',
              isToday ? 'border-primary/40' : 'border-surface-container-highest',
              // Receded rather than hidden — what you ate on Monday is still
              // part of the week, it is just not a decision any more.
              isPast && 'opacity-70'
            )}
          >
            <header
              className={clsx(
                'flex items-center justify-between gap-sm px-md py-sm border-b',
                isToday
                  ? 'bg-primary-fixed border-primary/20'
                  : 'bg-surface-container-low/60 border-surface-container-highest'
              )}
            >
              <div className="flex items-baseline gap-sm min-w-0">
                <h3
                  className={clsx(
                    'font-title-md text-title-md',
                    isToday
                      ? 'text-on-primary-fixed'
                      : isPast
                        ? 'text-on-surface-variant'
                        : 'text-on-surface'
                  )}
                >
                  {WEEKDAY_LABELS[day]}
                </h3>
                <span
                  className={clsx(
                    'font-numeric-data text-[12px]',
                    isToday ? 'text-on-primary-fixed/70' : 'text-on-surface-variant'
                  )}
                >
                  {dayDate(plan.weekStartDate, day)}
                </span>
                {isToday && <Badge tone="solid-primary">TODAY</Badge>}
                {isPast && <Badge>GONE</Badge>}
              </div>

              {/* One meal the whole table is on is the outcome the app exists
                  to produce, so it gets said out loud. */}
              {shared && (
                <Badge tone="primary" className="shrink-0 max-w-[50%] truncate">
                  ALL IN
                </Badge>
              )}
            </header>

            <div className="divide-y divide-surface-container-highest">
              {dayMeals.map((meal) => (
                <MealRow
                  key={meal.id}
                  meal={meal}
                  housemates={housemates}
                  currentUser={currentUser}
                  locked={locked}
                  past={isPast}
                />
              ))}

              {!locked && !isPast && (
                <Link
                  href={`/recipes?day=${day}${week === 'next' ? '&week=next' : ''}`}
                  className={clsx(
                    'flex items-center justify-center gap-xs py-sm text-on-surface-variant',
                    'hover:text-primary hover:bg-primary/5 transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary'
                  )}
                >
                  <Icon name="add" className="text-[18px]" />
                  <span className="font-body-sm text-body-sm font-semibold">
                    {dayMeals.length === 0 ? 'Put something on' : 'Add another'}
                  </span>
                </Link>
              )}

              {(locked || isPast) && dayMeals.length === 0 && (
                <p className="font-body-sm text-body-sm text-on-surface-variant text-center py-md">
                  {isPast && !locked ? 'Nobody planned anything.' : 'Nothing planned.'}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
