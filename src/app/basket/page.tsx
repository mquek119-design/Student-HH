import { redirect } from 'next/navigation';
import { BasketView } from '@/components/basket/BasketView';
import { BuildBasketPanel } from '@/components/basket/BuildBasketPanel';
import { SlotPicker } from '@/components/basket/SlotPicker';
import { PackDataForm } from '@/components/basket/PackDataForm';
import { Notice } from '@/components/ui/Notice';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageShell } from '@/components/ui/PageShell';
import { MinimumOrderBar } from '@/components/basket/MinimumOrderBar';
import { AddItemPanel } from '@/components/basket/AddItemPanel';
import { ORDER_MINIMUMS } from '@/lib/orderMinimums';
import { basketTotal } from '@/lib/calc';
import {
  getBasketItems,
  getHouse,
  getCollector,
  getCurrentUser,
  getHousemates,
  getWeeklyPlan,
} from '@/lib/queries';

export const metadata = { title: 'Basket · Grub' };
export const dynamic = 'force-dynamic';

export default async function BasketPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser.houseId) redirect('/onboarding');

  const [items, housemates, collector, plan, house] = await Promise.all([
    getBasketItems(),
    getHousemates(),
    getCollector(),
    getWeeklyPlan(),
    getHouse(),
  ]);

  const mealCount = plan?.meals.length ?? 0;
  const unpriced = items.filter((item) => item.needsPackData);

  // Unpriced lines cannot count toward a spend threshold — including them would
  // claim the minimum was met on the strength of items worth an unknown amount.
  const pricedTotal = basketTotal(items.filter((item) => !item.needsPackData));
  const method = plan?.slot?.method ?? house.fulfillmentMethod;

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

      {items.length > 0 && (
        <MinimumOrderBar
          total={pricedTotal}
          minimum={ORDER_MINIMUMS[method]}
          method={method}
        />
      )}

      {/* Deliberately not gated on the basket having items: Tesco lets you hold
          a slot before you have shopped, and slots for a busy weekend go early.
          Only a plan is required, since the charge is stored against it. */}
      {plan?.id && (
        <SlotPicker
          preference={house.slotPreference}
          bookedSlot={
            plan.slot
              ? { startsAt: plan.slot.startsAt, charge: plan.slot.charge, method: plan.slot.method }
              : null
          }
          isCollector={collector?.id === currentUser.id}
        />
      )}

      {/* Pack size and price normally come from Tesco search. This only appears
          for the leftovers — an ingredient with no sensible product match. */}
      {unpriced.length > 0 && (
        <section className="flex flex-col gap-sm">
          <Notice
            tone="info"
            icon="search_off"
            title={`Tesco drew a blank on ${unpriced.length} thing${unpriced.length === 1 ? '' : 's'}`}
          >
            Everything else was priced automatically. These had no clear product match, so they
            need filling in once — or rename the ingredient to something closer to a product name
            and rebuild.
          </Notice>
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
          icon="ti-shopping-cart"
          title="No basket yet"
          body={
            mealCount > 0
              ? "Your meals are planned but the basket hasn't been built yet. Let the optimiser do its thing."
              : 'Plan some meals first. The basket is derived from what the house is cooking.'
          }
          action={mealCount === 0 ? { href: '/plan', label: 'Plan meals' } : undefined}
        />
      ) : (
        <>
        <AddItemPanel />
        <BasketView
          items={items}
          housemates={housemates}
          isCollector={collector?.id === currentUser.id}
          collectorName={collector?.name ?? 'The collector'}
          planId={plan?.id}
        />
        </>
      )}
    </PageShell>
  );
}
