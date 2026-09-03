import { redirect } from 'next/navigation';
import { IngredientMergePanel } from '@/components/dev/IngredientMergePanel';
import { ViewAsPanel } from '@/components/dev/ViewAsPanel';
import { WeekRunner } from '@/components/dev/WeekRunner';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/media/Icon';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageShell } from '@/components/ui/PageShell';
import { getCurrentUser, getHousemates, getRealUser, getWeeklyPlan } from '@/lib/queries';
import { findDuplicateIngredients } from '@/app/dev/ingredientActions';

export const metadata = { title: 'Testing & Development · Grub' };

export const dynamic = 'force-dynamic';

const STAGE_LABELS: Record<string, string> = {
  planning: 'Planning — the week is still being decided',
  locked: 'Locked — planning closed, order not placed',
  ordered: 'Ordered — the shop is placed and paid for',
  delivered: 'Delivered — reconcile what actually turned up',
};

/**
 * Its own page rather than a panel buried in House Settings.
 *
 * Settings is a screen four housemates share; this is a workbench for one
 * person, and half of what is on it deletes the house. Mixing them meant a
 * destructive button sat one scroll below the delivery-day picker.
 */
export default async function DevPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser.houseId) redirect('/onboarding');

  const [plan, housemates, realUser, duplicateIngredients] = await Promise.all([
    getWeeklyPlan(),
    getHousemates(),
    getRealUser(),
    findDuplicateIngredients(),
  ]);
  const status = plan?.status ?? 'planning';

  const viewingAs = realUser && currentUser.id !== realUser.id ? currentUser : null;

  return (
    <PageShell>
      <PageHeader
        title="Testing & Development"
        subtitle="A whole week, start to finish, without troubling Tesco."
      />

      <Card className="flex items-center justify-between gap-md">
        <div className="min-w-0">
          <p className="font-label-caps text-label-caps uppercase text-on-surface-variant">
            This week
          </p>
          <p className="font-body-lg text-body-lg font-semibold">
            {STAGE_LABELS[status] ?? status}
          </p>
        </div>
        <Icon
          name={
            status === 'delivered'
              ? 'inventory'
              : status === 'ordered'
                ? 'local_shipping'
                : 'edit_calendar'
          }
          filled
          className="text-primary text-[28px] shrink-0"
        />
      </Card>

      <ViewAsPanel
        demoHousemates={housemates.filter((user) => user.isDemo)}
        viewingAs={viewingAs}
      />

      <IngredientMergePanel clusters={duplicateIngredients} />

      <WeekRunner status={status} />

      <Card className="flex items-start gap-sm">
        <Icon name="database" className="text-on-surface-variant mt-0.5 shrink-0" />
        <div className="min-w-0">
          <h2 className="font-title-md text-title-md">Migrations these need</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            <span className="font-numeric-data">0012</span>–<span className="font-numeric-data">0019</span>{' '}
            in the Supabase SQL editor. Each step degrades legibly without them — a missing table
            empties a panel, a missing column returns a &ldquo;run migration NNNN&rdquo; hint — so
            if a button reports something odd, that is the first thing to check.
          </p>
        </div>
      </Card>
    </PageShell>
  );
}
