import type { ReactNode } from 'react';
import { PageShell } from '@/components/ui/PageShell';
import { SubTabs } from '@/components/ui/SubTabs';

/** Split, Balances and Delivery reconciliation all live under the Split tab. */
const SPLIT_TABS = [
  { href: '/split', label: 'This Week' },
  { href: '/split/balances', label: 'Balances' },
  { href: '/split/reconcile', label: 'Delivery' },
];

export default function SplitLayout({ children }: { children: ReactNode }) {
  return (
    <PageShell wide>
      <SubTabs tabs={SPLIT_TABS} />
      {children}
    </PageShell>
  );
}
