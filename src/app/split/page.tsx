import { redirect } from 'next/navigation';
import { Icon } from '@/components/media/Icon';
import { PayPanel } from '@/components/split/PayPanel';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatPence } from '@/lib/money';
import {
  getBasketItems,
  getCollector,
  getCurrentSplit,
  getCurrentUser,
  getWeeklyPlan,
} from '@/lib/queries';

export const metadata = { title: 'Split · HouseGrocer' };
export const dynamic = 'force-dynamic';

export default async function SplitPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser.houseId) redirect('/onboarding');

  const [split, collector, plan, basket] = await Promise.all([
    getCurrentSplit(),
    getCollector(),
    getWeeklyPlan(),
    getBasketItems(),
  ]);

  const unpriced = basket.filter((item) => item.needsPackData).length;

  if (!split || !collector) {
    const isCollector = collector?.id === currentUser.id;
    return (
      <EmptyState
        icon="receipt_long"
        title={isCollector ? "You're the collector this week" : 'Nothing to settle yet'}
        body={
          isCollector
            ? 'You place the order, so you have nothing to pay. Housemates see what they owe you here once the basket exists.'
            : 'Once a basket is built for this week, your share of it is worked out here — with the arithmetic shown.'
        }
        action={(plan?.meals.length ?? 0) === 0 ? { href: '/plan', label: 'Plan meals' } : undefined}
      />
    );
  }

  return (
    <>
      <section className="flex flex-col items-center justify-center text-center py-lg">
        <p className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider mb-xs">
          Week {plan?.weekNumber ?? ''} Settlement
        </p>
        <h1 className="font-display-lg text-display-lg text-primary mb-sm">Total You Owe</h1>
        <div className="font-numeric-data text-[56px] leading-[64px] font-bold text-on-background mb-lg tabular-nums">
          {formatPence(split.amount)}
        </div>
        <p className="font-body-lg text-body-lg text-tertiary max-w-md mx-auto">
          Settle up with <span className="font-bold text-on-background">{collector.name}</span> for
          this week&apos;s groceries and shared supplies.
        </p>
      </section>

      {unpriced > 0 && (
        <div
          role="alert"
          className="flex items-start gap-sm px-md py-sm rounded-lg bg-secondary-fixed/50 border border-secondary-container/30"
        >
          <Icon name="warning" filled className="text-secondary mt-0.5 shrink-0" />
          <p className="font-body-sm text-body-sm text-on-secondary-fixed">
            This total leaves out <strong>{unpriced}</strong> basket item
            {unpriced === 1 ? '' : 's'} with no recorded price, so it is lower than the real bill.
            Add pack details on the Basket tab to settle accurately.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-xl items-start">
        <div className="lg:col-span-7 flex flex-col gap-md">
          <h2 className="font-title-md text-title-md text-on-background">Cost Breakdown</h2>

          {split.lines.map((line) => (
            <div
              key={line.label}
              className="bg-surface-container-lowest rounded-lg border border-surface-container-highest shadow-ambient-card overflow-hidden"
            >
              <div className="flex items-center gap-md p-md border-b border-surface-container-highest">
                <span className="w-10 h-10 rounded-full bg-primary-container/20 flex items-center justify-center text-primary shrink-0">
                  <Icon name={line.icon} />
                </span>
                <div className="flex-grow min-w-0">
                  <h3 className="font-title-md text-title-md text-on-background truncate">
                    {line.label}
                  </h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                    {line.detail}
                  </p>
                </div>
                <span className="font-numeric-data text-numeric-data text-on-background font-bold shrink-0">
                  {formatPence(line.amount)}
                </span>
              </div>

              {/* Every row here traces to a real basket line. An opaque split is
                  the fastest way to lose trust in a shared house. */}
              <dl className="p-md flex flex-col gap-xs">
                {line.workings.map((working) => (
                  <div
                    key={working.label}
                    className="flex items-center justify-between gap-md text-body-sm text-on-surface-variant"
                  >
                    <dt className="min-w-0 truncate">{working.label}</dt>
                    <dd className="font-numeric-data text-right shrink-0">{working.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}

          <div className="flex items-center justify-between gap-md px-md py-sm rounded-lg bg-surface-container">
            <span className="font-title-md text-title-md">Total</span>
            <span className="font-numeric-data text-title-md font-bold">
              {formatPence(split.amount)}
            </span>
          </div>
        </div>

        <div className="lg:col-span-5">
          <PayPanel
            collectorName={collector.name}
            paymentDetails={collector.paymentDetailsText}
          />
        </div>
      </div>
    </>
  );
}
