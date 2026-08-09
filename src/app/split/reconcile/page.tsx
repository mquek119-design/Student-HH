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
} from '@/lib/queries';

export const metadata = { title: 'Reconciliation · HouseGrocer' };
export const dynamic = 'force-dynamic';

export default async function ReconcilePage() {
  const [items, substitutions, basket, currentUser, collector] = await Promise.all([
    getReconciliationItems(),
    getSubstitutions(),
    getBasketItems(),
    getCurrentUser(),
    getCollector(),
  ]);

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
