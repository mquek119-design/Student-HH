import Link from 'next/link';
import { Icon } from '@/components/media/Icon';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageShell } from '@/components/ui/PageShell';
import { formatPence } from '@/lib/money';
import { getSavings } from '@/lib/queries';

export const metadata = { title: 'Savings · HouseGrocer' };
export const dynamic = 'force-dynamic';

export default async function SavingsPage() {
  const savings = await getSavings();

  return (
    <PageShell>
      <Link
        href="/account"
        className="flex items-center gap-xs text-primary font-semibold text-[14px] hover:opacity-80 w-fit"
      >
        <Icon name="arrow_back" className="text-[18px]" />
        Account
      </Link>

      {savings.totalAllTime === 0 ? (
        <EmptyState
          icon="savings"
          title="No savings recorded yet"
          body="When the basket swaps a branded item for own-brand, the difference is banked here. Nothing has been swapped yet."
        />
      ) : (
        <>
          <div className="flex flex-col items-center text-center gap-xs px-md py-lg rounded-xl bg-gradient-to-br from-primary to-primary-container text-on-primary shadow-ambient-card">
            <span className="font-label-caps text-label-caps uppercase tracking-wider opacity-80">
              Own-brand savings, all time
            </span>
            <span className="font-numeric-data text-display-lg">
              {formatPence(savings.totalAllTime)}
            </span>
            {savings.thisWeek > 0 && (
              <span className="font-body-sm text-body-sm opacity-90 flex items-center gap-xs">
                <Icon name="trending_up" className="text-[18px]" />
                {formatPence(savings.thisWeek)} this week
              </span>
            )}
          </div>

          {savings.ownBrandSwaps.length > 0 && (
            <section className="flex flex-col gap-sm">
              <h2 className="font-title-md text-title-md">This Week&apos;s Swaps</h2>
              <Card padded={false} className="overflow-hidden">
                <ul className="divide-y divide-surface-container-highest">
                  {savings.ownBrandSwaps.map((swap) => (
                    <li key={swap.label} className="p-md flex items-center gap-md">
                      <Icon name="check_circle" filled className="text-primary shrink-0" />
                      <span className="flex-grow font-body-sm text-body-sm min-w-0 truncate">
                        {swap.label}
                      </span>
                      <span className="font-numeric-data text-numeric-data text-primary shrink-0">
                        {formatPence(swap.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          )}
        </>
      )}

      {/* Deliberately no bulk-buying or pantry-reuse breakdown, and no comparison
          against other households: we cannot derive those honestly yet. */}
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        Only own-brand swaps are counted, because they are the one saving we can evidence line by
        line. Bulk and pantry savings arrive with the basket optimiser.
      </p>
    </PageShell>
  );
}
