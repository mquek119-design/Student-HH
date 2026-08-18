import { Reconciliation } from '@/components/split/Reconciliation';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  basketTotal,
  getBasketItems,
  getCollector,
  getCurrentUser,
  getReconciliationItems,
  getSubstitutions,
  getWeeklyPlan,
} from '@/lib/queries';

export const metadata = { title: 'Reconciliation · Grub' };
export const dynamic = 'force-dynamic';

export default async function ReconcilePage() {
  const [items, substitutions, basket, currentUser, collector, plan] = await Promise.all([
    getReconciliationItems(),
    getSubstitutions(),
    getBasketItems(),
    getCurrentUser(),
    getCollector(),
    getWeeklyPlan(),
  ]);

  // Nothing has been bought yet, so there is nothing that could have gone
  // wrong with it. Showing a delivery form here invites people to tick off
  // food that does not exist.
  if (plan && plan.status !== 'ordered' && plan.status !== 'delivered') {
    return (
      <EmptyState
        icon="local_shipping"
        title="No order to reconcile"
        body="This opens once the shop is placed. Tesco substitutes and refunds, so what you owe is only final after what turned up is recorded here."
        action={{ href: '/basket', label: 'Go to Basket' }}
      />
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon="local_shipping"
        title="Nothing delivered yet"
        body="After the order arrives, tick off what actually turned up here. Tesco substitutes and refunds, so the split is rebuilt from the delivery rather than the plan."
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Order Reconciliation"
        subtitle="Tick off what actually arrived. The split is rebuilt from this, not from the plan."
      />
      <Reconciliation
        items={items}
        substitutions={substitutions}
        plannedTotal={basketTotal(basket)}
        isCollector={collector?.id === currentUser.id}
      />
    </>
  );
}
