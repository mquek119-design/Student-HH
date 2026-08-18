import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AvatarStack } from '@/components/avatars/Avatar';
import { PaymentStatusList } from '@/components/feed/PaymentStatusList';
import { Icon } from '@/components/media/Icon';
import { CountdownCard } from '@/components/timers/CountdownCard';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageShell } from '@/components/ui/PageShell';
import {
  getCurrentUser,
  getHousemates,
  getLeftovers,
  getPantryItems,
  getPaymentStatus,
  getWeeklyPlan,
} from '@/lib/queries';
import { WEEKDAYS, type Weekday } from '@/lib/types';

// The countdown and payment status are live state — never serve a baked copy.
export const dynamic = 'force-dynamic';

const DAY_SHORT: Record<Weekday, string> = {
  mon: 'MON',
  tue: 'TUE',
  wed: 'WED',
  thu: 'THU',
  fri: 'FRI',
  sat: 'SAT',
  sun: 'SUN',
};

export default async function FeedPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser.houseId) redirect('/onboarding');

  const [plan, housemates, payments, pantry, leftovers] = await Promise.all([
    getWeeklyPlan(),
    getHousemates(),
    getPaymentStatus(),
    getPantryItems(),
    getLeftovers(),
  ]);

  if (!plan) redirect('/onboarding');

  const byId = new Map(housemates.map((user) => [user.id, user]));

  // Weekends only appear once somebody plans one. An empty Saturday with an
  // "add a meal" button is the app asking about a night nobody was going to
  // plan — see the same rule in WeekStrip.
  const visibleDays = WEEKDAYS.filter(
    (day) => !['sat', 'sun'].includes(day) || plan.meals.some((meal) => meal.day === day)
  );

  // Today, in the same weekday vocabulary the plan uses.
  const today = WEEKDAYS[(new Date().getDay() + 6) % 7];
  const cookingTonight = plan.meals.filter(
    (meal) => meal.day === today && meal.cookedByUserId === currentUser.id
  );
  // Mouths, not housemates: someone's +1 still has to be fed.
  const mouths = (cookingTonight[0]?.participants ?? []).reduce(
    (sum, participant) => sum + 1 + (participant.guests ?? 0),
    0
  );
  const sharedMealCount = plan.meals.filter((meal) => meal.isShared).length;
  const currentUserHasInput = plan.meals.some((meal) =>
    meal.participants.some((p) => p.userId === currentUser.id)
  );
  const lowStock = pantry.filter((item) => item.isShared && item.lowStock);

  // Anything on the leftovers board with a day or less on it. Not a general
  // "use up your food" nag — only things somebody actually cooked and offered,
  // which is the case where a reminder rescues a real meal.
  const goingOff = leftovers.filter((item) => item.daysLeft <= 1);

  return (
    <PageShell wide className="md:grid md:grid-cols-12 md:gap-lg md:items-start">
      <div className="md:col-span-8 flex flex-col gap-md">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
          <CountdownCard cutoffAt={plan.cutoffAt} />

          <Card className="flex flex-col justify-between relative overflow-hidden">
            {/* Subtle dot field, matching the mockup's primary action card. */}
            <div
              aria-hidden="true"
              className="absolute inset-0 opacity-10 pointer-events-none"
              style={{
                backgroundImage: 'radial-gradient(circle at 1px 1px, #006b3f 1px, transparent 0)',
                backgroundSize: '20px 20px',
              }}
            />
            <div className="relative z-10">
              <h2 className="font-title-md text-title-md text-on-surface mb-xs">
                {currentUserHasInput ? "You're In" : 'Your Input Required'}
              </h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant mb-md">
                {currentUserHasInput
                  ? "You're down for meals this week. Change anything before the cutoff."
                  : "You haven't added your meals or personal items for this week's run yet."}
              </p>
            </div>
            <Link
              href="/plan"
              className="relative z-10 w-full bg-secondary-container text-on-secondary font-title-md text-title-md py-3 rounded-lg shadow-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 mt-auto"
            >
              <Icon name="restaurant" />
              {currentUserHasInput ? 'Review Your Week' : 'Submit Your Fancy?'}
            </Link>
          </Card>
        </div>

        {plan.meals.length === 0 ? (
          <EmptyState
            icon="ti-calendar"
            title="Nobody's picked anything"
            body="You're all just going to wing it again aren't you."
            action={{ href: '/plan', label: 'Start planning' }}
          />
        ) : (
          <Card padded={false} className="overflow-hidden">
            <div className="p-md flex items-center justify-between gap-sm border-b border-surface-container-highest">
              <h2 className="font-title-md text-title-md text-on-surface">This Week&apos;s Plan</h2>
              <Badge tone="solid-primary" className="font-numeric-data text-numeric-data">
                {sharedMealCount} Shared Meal{sharedMealCount === 1 ? '' : 's'}
              </Badge>
            </div>

            <div className="overflow-x-auto hide-scrollbar">
              <ul
                className="flex md:grid gap-sm p-md min-w-max md:min-w-0"
                style={{ gridTemplateColumns: `repeat(${visibleDays.length}, minmax(0, 1fr))` }}
              >
                {visibleDays.map((day) => {
                  const meals = plan.meals.filter((meal) => meal.day === day);
                  const diners = meals
                    .flatMap((meal) => meal.participants.map((p) => byId.get(p.userId)))
                    .filter((user): user is NonNullable<typeof user> => Boolean(user));
                  // Days with a shared-shopping suggestion get a quiet marker,
                  // not a red one. Nothing here is wrong — see overlaps.ts.
                  const hasHint = plan.overlaps.some((entry) => entry.day === day);

                  return (
                    <li
                      key={day}
                      className={`flex flex-col items-center gap-xs w-16 md:w-auto rounded-lg py-1 ${
                        hasHint ? 'bg-secondary-fixed/30 border border-secondary-container/30' : ''
                      }`}
                    >
                      <span className="font-label-caps text-label-caps text-on-surface-variant">
                        {DAY_SHORT[day]}
                      </span>
                      {diners.length > 0 ? (
                        <AvatarStack users={diners.slice(0, 3)} />
                      ) : (
                        <Link
                          href="/plan"
                          aria-label={`Add a meal on ${DAY_SHORT[day]}`}
                          className="w-10 h-10 rounded-full border border-dashed border-outline-variant flex items-center justify-center text-outline-variant hover:border-primary hover:text-primary transition-colors"
                        >
                          <Icon name="add" className="text-[16px]" />
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </Card>
        )}
      </div>

      <div className="md:col-span-4 flex flex-col gap-md mt-md md:mt-0">
        {cookingTonight.length > 0 && (
          <Card accent="secondary" className="flex items-start gap-sm">
            <Icon name="skillet" filled className="text-secondary mt-1" />
            <div className="min-w-0">
              <h3 className="font-title-md text-title-md text-on-surface">
                You&apos;re cooking tonight
              </h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {cookingTonight.map((meal) => meal.recipeTitle).join(' and ')} for {mouths}
                {mouths === 1 ? ' person' : ' people'}.
              </p>
              <Link
                href={`/recipes/${cookingTonight[0].recipeId}`}
                className="inline-flex items-center gap-xs mt-xs text-secondary font-semibold text-[14px] hover:opacity-80"
              >
                Open the recipe
                <Icon name="chevron_right" className="text-[18px]" />
              </Link>
            </div>
          </Card>
        )}

        {goingOff.length > 0 && (
          <Card accent="secondary" className="flex items-start gap-sm">
            <Icon name="schedule" filled className="text-secondary mt-1" />
            <div className="min-w-0">
              <h3 className="font-numeric-data text-numeric-data text-on-surface mb-1">
                Eat this or bin it
              </h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                {goingOff.map((item) => item.description).join(', ')}{' '}
                {goingOff.length === 1 ? 'is' : 'are'} on the board and{' '}
                {goingOff.some((item) => item.daysLeft < 0) ? 'past it' : 'about to go'}.{' '}
                <Link href="/pantry" className="text-secondary font-semibold underline">
                  Claim it
                </Link>
                .
              </p>
            </div>
          </Card>
        )}

        {lowStock.length > 0 && (
          <Card accent="primary" className="flex items-start gap-sm">
            <Icon name="info" filled className="text-primary mt-1" />
            <div>
              <h3 className="font-numeric-data text-numeric-data text-on-surface mb-1">
                House Staples
              </h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Running low on{' '}
                {lowStock.map((item, index) => (
                  <span key={item.id}>
                    <strong>{item.name}</strong>
                    {index < lowStock.length - 2 ? ', ' : index === lowStock.length - 2 ? ' and ' : ''}
                  </span>
                ))}
                .
              </p>
            </div>
          </Card>
        )}

        {payments.length === 0 ? (
          <EmptyState
            icon="ti-receipt"
            title="Clean slate"
            body="No one owes anyone anything. Enjoy it while it lasts."
          />
        ) : (
          <Card padded={false} className="overflow-hidden">
            <PaymentStatusList entries={payments} currentUserId={currentUser.id} />
          </Card>
        )}
      </div>
    </PageShell>
  );
}
