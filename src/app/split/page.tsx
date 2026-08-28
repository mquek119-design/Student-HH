import { redirect } from 'next/navigation';
import { Icon } from '@/components/media/Icon';
import { PayPanel } from '@/components/split/PayPanel';
import { ExpensePanel } from '@/components/split/ExpensePanel';
import { CollectorPanel } from '@/components/split/CollectorPanel';
import { Notice } from '@/components/ui/Notice';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatPence } from '@/lib/money';
import {
  getBasketItems,
  getCollector,
  getCurrentSplit,
  getCurrentUser,
  getExpenses,
  getHousemates,
  getPostedSplits,
  getWeeklyPlan,
} from '@/lib/queries';

export const metadata = { title: 'Split · Grub' };
export const dynamic = 'force-dynamic';

export default async function SplitPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser.houseId) redirect('/onboarding');

  const [split, collector, plan, basket, expenses, housemates] = await Promise.all([
    getCurrentSplit(),
    getCollector(),
    getWeeklyPlan(),
    getBasketItems(),
    getExpenses(),
    getHousemates(),
  ]);

  const postedSplits = await getPostedSplits();

  // Rendered whether or not there is a weekly split: a house with no basket can
  // still have bought a kettle, and that debt is just as real.
  const purchases = (
    <ExpensePanel expenses={expenses} housemates={housemates} currentUserId={currentUser.id} />
  );

  const unpriced = basket.filter((item) => item.needsPackData).length;

  if (!split || !collector) {
    const isCollector = collector?.id === currentUser.id;

    // The collector is not a spectator here — posting the week is their job,
    // and chasing it is the rest of it.
    if (isCollector) {
      return (
        <div className="flex flex-col gap-lg">
          <CollectorPanel splits={postedSplits} basketIsEmpty={basket.length === 0} />
          {purchases}
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-lg">
        <EmptyState
          icon="receipt_long"
          title={isCollector ? "You're the collector this week" : 'Nothing to settle yet'}
          body={
            isCollector
              ? 'You place the order, so you have nothing to pay. Housemates see what they owe you here once the basket exists.'
              : 'Once a basket is built for this week, your share of it is worked out here — with the arithmetic shown.'
          }
          action={
            (plan?.meals.length ?? 0) === 0 ? { href: '/plan', label: 'Plan meals' } : undefined
          }
        />
        {purchases}
      </div>
    );
  }

  // What the breakdown actually adds up to. Equal to `split.amount` in the
  // ordinary case; they part company when the basket moves after posting.
  const breakdownTotal = split.lines.reduce((sum, line) => sum + line.amount, 0);
  const isCollector = collector?.id === currentUser.id;

  return (
    <>
      <section className="flex flex-col items-center justify-center text-center py-lg">
        <p className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider mb-xs">
          Week {plan?.weekNumber ?? ''} Settlement
        </p>
        <h1 className="font-display-lg text-display-lg text-primary mb-sm">
          {isCollector ? 'Total Owed to You' : 'Total You Owe'}
        </h1>
        <div className="font-numeric-data text-[56px] leading-[64px] font-bold text-on-background mb-lg tabular-nums">
          {formatPence(split.amount)}
        </div>
        <p className="font-body-lg text-body-lg text-tertiary max-w-md mx-auto">
          Settle up with <span className="font-bold text-on-background">{collector.name}</span> for
          this week&apos;s groceries and shared supplies.
        </p>
      </section>

      {!split.isPosted && (
        <Notice tone="info" icon="pending">
          This is what you <em>will</em> owe. It moves with the basket until the collector posts
          the split, and only then can it be paid or appear on Balances.
        </Notice>
      )}

      {unpriced > 0 && (
        <Notice tone="check" icon="warning" role="alert">
          This total leaves out <strong>{unpriced}</strong> basket item
          {unpriced === 1 ? '' : 's'} with no recorded price, so it is lower than the real bill.
          Add pack details on the Basket tab to settle accurately.
        </Notice>
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

          {/* The sum of the lines above, not `split.amount`. Those two are the
              same number right up until the basket moves after the split was
              posted — and then this row was quietly printing a total the
              breakdown above it did not add up to. The agreed figure keeps the
              headline; the disagreement gets said out loud below. */}
          <div className="flex items-center justify-between gap-md px-md py-sm rounded-lg bg-surface-container">
            <span className="font-title-md text-title-md">Total</span>
            <span className="font-numeric-data text-title-md font-bold">
              {formatPence(breakdownTotal)}
            </span>
          </div>

          {breakdownTotal !== split.amount && (
            <Notice tone="check" icon="difference" role="alert">
              The basket has changed since this split was posted. You owe the agreed{' '}
              <strong>{formatPence(split.amount)}</strong>; the basket as it stands now comes to{' '}
              <strong>{formatPence(breakdownTotal)}</strong>. The collector can re-post the split to
              bring the two together.
            </Notice>
          )}
        </div>

        <div className="lg:col-span-5 flex flex-col gap-md">
          {isCollector ? (
            <>
              <CollectorPanel splits={postedSplits} basketIsEmpty={basket.length === 0} />
              {purchases}
            </>
          ) : (
            <>
              {/* splitId is the posted row. Without one, "I've Paid" is a button
                  that updates nothing — so it is only offered once posted. */}
              <PayPanel
                collectorName={collector.name}
                collectorRoom={collector.room}
                payment={collector.payment}
                splitId={split.isPosted ? split.id : undefined}
                isNotified={split.status === 'notified' || split.status === 'confirmed'}
                isPosted={split.isPosted}
              />
              {purchases}
            </>
          )}
        </div>
      </div>
    </>
  );
}
