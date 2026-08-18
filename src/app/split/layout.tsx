import type { ReactNode } from 'react';
import { Notice } from '@/components/ui/Notice';
import { PageShell } from '@/components/ui/PageShell';
import { SubTabs } from '@/components/ui/SubTabs';
import { getWeeklyPlan } from '@/lib/queries';
import type { PlanStatus } from '@/lib/types';

/**
 * Ordered as the money actually moves, which is not how it used to be.
 *
 * The old order was This Week → Balances → Delivery, which put the last step
 * of the week in the middle and the middle step at the end. Reconciliation
 * happens *before* a split is final — the receipt never matches the plan, so
 * what you owe is not known until what turned up is known.
 *
 *   1. This Week  — what you owe for this shop
 *   2. Delivery   — what actually arrived, which corrects (1)
 *   3. Balances   — every week's debts, running
 */
const SPLIT_TABS = [
  { href: '/split', label: 'This Week' },
  { href: '/split/reconcile', label: 'Delivery' },
  { href: '/split/balances', label: 'Balances' },
];

const STAGE_NOTE: Record<PlanStatus, string> = {
  planning:
    'The shop has not been placed, so this is a live estimate — it moves as the house changes its mind.',
  locked:
    'Planning is closed and the basket is settled. Nothing is owed until the order goes in.',
  ordered:
    'Ordered. When it arrives, tick off what turned up under Delivery — the split is rebuilt from that, not from the plan.',
  delivered:
    'Delivered. Reconcile Delivery first if you have not, then settle up with the collector.',
};

export default async function SplitLayout({ children }: { children: ReactNode }) {
  const plan = await getWeeklyPlan();
  const status: PlanStatus = plan?.status ?? 'planning';

  return (
    <PageShell wide>
      <SubTabs tabs={SPLIT_TABS} />

      {/* One line saying where the week is, so the three tabs read as a
          sequence rather than three unrelated screens. */}
      <Notice
        tone="info"
        icon={
          status === 'delivered'
            ? 'inventory'
            : status === 'ordered'
              ? 'local_shipping'
              : 'edit_calendar'
        }
      >
        {STAGE_NOTE[status]}
      </Notice>

      {children}
    </PageShell>
  );
}
