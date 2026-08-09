import { redirect } from 'next/navigation';
import { BasketView } from '@/components/basket/BasketView';
import { BuildBasketPanel } from '@/components/basket/BuildBasketPanel';
import { PackDataForm } from '@/components/basket/PackDataForm';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageShell } from '@/components/ui/PageShell';
import {
  getBasketItems,
  getCollector,
  getCurrentUser,
  getHousemates,
  getWeeklyPlan,
} from '@/lib/queries';

export const metadata = { title: 'Basket · HouseGrocer' };
export const dynamic = 'force-dynamic';

export default async function BasketPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser.houseId) redirect('/onboarding');

  const [items, housemates, collector, plan] = await Promise.all([
    getBasketItems(),
    getHousemates(),
    getCollector(),
    getWeeklyPlan(),
  ]);

  const mealCount = plan?.meals.length ?? 0;
  const unpriced = items.filter((item) => item.needsPackData);

  return (
    // Extra bottom padding clears the fixed total/checkout bar.
    <PageShell className="pb-[140px] md:pb-[120px]">
      <PageHeader
        title="The Basket"
        subtitle={
          collector
            ? `Built from this week's plan. ${collector.name} places the order.`
            : "Built from this week's plan."
        }
      />

      <BuildBasketPanel
        hasBasket={items.length > 0}
        mealCount={mealCount}
        overlapSavings={plan?.sharedSavings ?? 0}
      />

      {/* Pack size and price normally come from Tesco search. This only appears
          for the leftovers — an ingredient with no sensible product match. */}
      {unpriced.length > 0 && (
        <section className="flex flex-col gap-sm">
          <h2 className="font-title-md text-title-md">
            {unpriced.length} item{unpriced.length === 1 ? '' : 's'} Tesco couldn&apos;t match
          </h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Everything else was priced automatically from Tesco. These had no clear product match,
            so they need filling in once — try renaming the ingredient to something closer to a
            product name and rebuilding first.
          </p>
          {unpriced.map((item) =>
            item.ingredientId ? (
              <PackDataForm
                key={item.id}
                ingredientId={item.ingredientId}
                name={item.name}
                suggestedUnit={item.subtitle.replace(/[\d.\s]|needed|pack/gi, '') || 'g'}
              />
            ) : null
          )}
        </section>
      )}

      {items.length === 0 ? (
        <EmptyState
          icon="shopping_basket"
          title="No basket yet"
          body={
            mealCount > 0
              ? 'Build it from the plan above — ingredients get pooled across meals, so overlapping recipes are only bought once.'
              : 'Plan some meals first. The basket is derived from what the house is cooking.'
          }
          action={mealCount === 0 ? { href: '/plan', label: 'Plan meals' } : undefined}
        />
      ) : (
        <BasketView
          items={items}
          housemates={housemates}
          isCollector={collector?.id === currentUser.id}
          collectorName={collector?.name ?? 'The collector'}
          planId={plan?.id}
        />
      )}
    </PageShell>
  );
}
