import Link from 'next/link';
import { Avatar } from '@/components/avatars/Avatar';
import { Icon } from '@/components/media/Icon';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { PageShell } from '@/components/ui/PageShell';
import { formatPence } from '@/lib/money';
import { getCurrentUser, getHouse, getLedger, getSavings, getWeeklyPlan } from '@/lib/queries';

export const metadata = { title: 'My Account · HouseGrocer' };

// Reads the signed-in user's house — nothing to prerender at build time.
export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const [user, house, ledger, savings, plan] = await Promise.all([
    getCurrentUser(),
    getHouse(),
    getLedger(),
    getSavings(),
    getWeeklyPlan(),
  ]);

  const ordersJoined = new Set(ledger.map((entry) => entry.weekNumber)).size;
  const mealsPlanned =
    plan?.meals.filter((meal) => meal.participants.some((p) => p.userId === user.id)).length ?? 0;

  return (
    <PageShell>
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
        <Card padded={false} className="overflow-hidden">
          <ul className="divide-y divide-surface-container-highest">
            <li className="p-md flex items-start gap-md">
              <Icon name="payments" className="text-on-surface-variant mt-0.5" />
              <div className="flex-grow min-w-0">
                <p className="font-body-lg text-body-lg">Payment details</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                  {user.paymentDetailsText ?? 'Not set — housemates cannot pay you'}
                </p>
              </div>
            </li>
            <li className="p-md flex items-start gap-md">
              <Icon name="restaurant_menu" className="text-on-surface-variant mt-0.5" />
              <div className="flex-grow min-w-0">
                <p className="font-body-lg text-body-lg">Dietary profile</p>
                <div className="flex flex-wrap gap-xs mt-xs">
                  {user.dietaryPreferences.length === 0 ? (
                    <span className="font-body-sm text-body-sm text-on-surface-variant">
                      No restrictions set
                    </span>
                  ) : (
                    user.dietaryPreferences.map((preference) => (
                      <Badge key={preference} tone="primary">
                        {preference}
                      </Badge>
                    ))
                  )}
                </div>
              </div>
            </li>
            <li>
              <Link
                href="/account/savings"
                className="p-md flex items-center gap-md hover:bg-surface-container-low transition-colors"
              >
                <Icon name="trending_up" className="text-on-surface-variant" />
                <span className="flex-grow font-body-lg text-body-lg">Savings history</span>
                <Icon name="chevron_right" className="text-on-surface-variant" />
              </Link>
            </li>
          </ul>
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

        <button
          type="button"
          className="w-full h-12 rounded-lg border border-error text-error font-title-md text-title-md flex items-center justify-center gap-sm hover:bg-error-container transition-colors"
        >
          <Icon name="logout" />
          Leave House
        </button>
      </section>
    </PageShell>
  );
}
