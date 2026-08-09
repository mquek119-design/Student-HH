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

  const [plan, housemates, payments, pantry] = await Promise.all([
    getWeeklyPlan(),
    getHousemates(),
    getPaymentStatus(),
    getPantryItems(),
  ]);

  if (!plan) redirect('/onboarding');

  const byId = new Map(housemates.map((user) => [user.id, user]));
  const sharedMealCount = plan.meals.filter((meal) => meal.isShared).length;
  const currentUserHasInput = plan.meals.some((meal) =>
    meal.participants.some((p) => p.userId === currentUser.id)
  );
  const lowStock = pantry.filter((item) => item.isShared && item.lowStock);

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
              className="relative z-10 w-full bg-secondary-container text-on-primary font-title-md text-title-md py-3 rounded-lg shadow-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 mt-auto"
            >
              <Icon name="restaurant" />
              {currentUserHasInput ? 'Review Your Week' : 'Submit Your Fancy?'}
            </Link>
          </Card>
        </div>

        {plan.meals.length === 0 ? (
          <EmptyState
            icon="calendar_add_on"
            title="No meals planned yet"
            body="Add what you fancy this week and the plan fills in here. Once the cutoff passes, the basket is built from it."
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
              <ul className="flex md:grid md:grid-cols-7 gap-sm p-md min-w-max md:min-w-0">
                {WEEKDAYS.map((day) => {
                  const meals = plan.meals.filter((meal) => meal.day === day);
                  const diners = meals
                    .flatMap((meal) => meal.participants.map((p) => byId.get(p.userId)))
                    .filter((user): user is NonNullable<typeof user> => Boolean(user));
                  const hasConflict = plan.conflicts.some((conflict) => conflict.day === day);

                  return (
                    <li
                      key={day}
                      className={`flex flex-col items-center gap-xs w-16 md:w-auto rounded-lg py-1 ${
                        hasConflict ? 'bg-error-container/40 border border-error/20' : ''
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
            icon="payments"
            title="Nothing to settle"
            body="Once an order is placed and reconciled, who owes what shows up here."
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
