import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Avatar } from '@/components/avatars/Avatar';
import { Icon } from '@/components/media/Icon';
import { Card } from '@/components/ui/Card';
import { PageShell } from '@/components/ui/PageShell';
import { Notice } from '@/components/ui/Notice';
import { formatPence } from '@/lib/money';
import {
  getCurrentUser,
  getHouse,
  getLedger,
  getRealUser,
  getSavings,
  getWeeklyPlan,
} from '@/lib/queries';
import {
  DeleteAccountPanel,
  DietaryPanel,
  LeaveHousePanel,
  PaymentDetailsPanel,
} from '@/components/account/AccountPanels';

export const metadata = { title: 'My Account · Grub' };

// Reads the signed-in user's house — nothing to prerender at build time.
export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser.houseId) redirect('/onboarding');

  const [user, house, ledger, savings, plan] = await Promise.all([
    Promise.resolve(currentUser),
    getHouse(),
    getLedger(),
    getSavings(),
    getWeeklyPlan(),
  ]);

  const ordersJoined = new Set(ledger.map((entry) => entry.weekNumber)).size;
  const mealsPlanned =
    plan?.meals.filter((meal) => meal.participants.some((p) => p.userId === user.id)).length ?? 0;

  // Impersonation swaps who the app renders for while `auth.uid()` stays you,
  // so profile edits go through `demo_update_*` (migration 0020) and save
  // properly against the demo housemate. Leaving and deleting deliberately do
  // not: those end an account, and a seeded housemate is not yours to end.
  const realUser = await getRealUser();
  const viewingAs = realUser && realUser.id !== user.id ? user.name : null;

  return (
    <PageShell>
      {viewingAs && (
        <Notice tone="info" icon="visibility" title={`This is ${viewingAs}'s account`}>
          Payment details and dietary profile save against them, which is what makes paying them
          testable. Leaving and deleting are hidden — those end an account. Switch back on{' '}
          <Link href="/dev" className="underline font-semibold">
            Testing &amp; Development
          </Link>
          .
        </Notice>
      )}

      <section className="flex flex-col items-center text-center gap-sm py-lg">
        <Avatar user={user} size="xl" />
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile">{user.name}</h1>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          {user.room ?? 'No room set'} · {house.name}
        </p>
      </section>

      <section className="flex flex-col gap-sm">
        <h2 className="font-title-md text-title-md">My Impact</h2>
        <div className="grid grid-cols-3 gap-sm">
          {[
            { label: 'Orders', value: ordersJoined.toString(), icon: 'local_shipping' },
            { label: 'Meals', value: mealsPlanned.toString(), icon: 'restaurant' },
            { label: 'Saved', value: formatPence(savings.totalAllTime), icon: 'savings' },
          ].map((stat) => (
            <Card key={stat.label} className="flex flex-col items-center gap-xs text-center">
              <Icon name={stat.icon} className="text-primary" />
              <span className="font-numeric-data text-title-md">{stat.value}</span>
              <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
                {stat.label}
              </span>
            </Card>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-sm">
        <h2 className="font-title-md text-title-md">Personal Settings</h2>
        <PaymentDetailsPanel user={user} />
        <DietaryPanel user={user} />
        <Card padded={false} className="overflow-hidden">
          <Link
            href="/account/savings"
            className="p-md flex items-center gap-md hover:bg-surface-container-low transition-colors"
          >
            <Icon name="trending_up" className="text-on-surface-variant" />
            <span className="flex-grow font-body-lg text-body-lg">Savings history</span>
            <Icon name="chevron_right" className="text-on-surface-variant" />
          </Link>
        </Card>
      </section>

      <section className="flex flex-col gap-sm">
        <h2 className="font-title-md text-title-md">Household</h2>
        <Card className="flex flex-col gap-sm">
          <div className="flex items-center justify-between gap-md">
            <span className="font-body-lg text-body-lg">Invite code</span>
            <code className="font-numeric-data text-numeric-data tracking-wider">
              {house.inviteCode}
            </code>
          </div>
          <Link
            href="/settings"
            className="flex items-center gap-xs text-primary font-semibold text-[14px] hover:opacity-80"
          >
            <Icon name="settings" className="text-[18px]" />
            House settings
          </Link>
        </Card>

        {!viewingAs && (
          <>
            <LeaveHousePanel />
            <DeleteAccountPanel />
          </>
        )}
      </section>
    </PageShell>
  );
}
