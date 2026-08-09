import { Avatar } from '@/components/avatars/Avatar';
import { Icon } from '@/components/media/Icon';
import { InviteLink } from '@/components/settings/InviteLink';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageShell } from '@/components/ui/PageShell';
import { getCollector, getHouse, getHousemates } from '@/lib/queries';
import { WEEKDAY_LABELS } from '@/lib/types';

export const metadata = { title: 'House Settings · HouseGrocer' };

// Reads the signed-in user's house — nothing to prerender at build time.
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const [house, housemates, collector] = await Promise.all([
    getHouse(),
    getHousemates(),
    getCollector(),
  ]);

  return (
    <PageShell>
      <PageHeader title="House Settings" subtitle={house.name} />

      <section className="flex flex-col gap-sm">
        <h2 className="font-title-md text-title-md">Members</h2>
        <Card padded={false} className="overflow-hidden">
          <ul className="divide-y divide-surface-container-highest">
            {housemates.map((user) => (
              <li key={user.id} className="p-md flex items-center gap-md">
                <Avatar user={user} size="md" />
                <div className="flex-grow min-w-0">
                  <p className="font-body-lg text-body-lg font-semibold truncate">{user.name}</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                    {user.room ?? 'No room set'}
                    {user.dietaryPreferences.length > 0 &&
                      ` · ${user.dietaryPreferences.join(', ')}`}
                  </p>
                </div>
                <div className="flex gap-xs shrink-0">
                  {user.id === collector?.id && <Badge tone="solid-primary">Collector</Badge>}
                  {user.isAdmin && <Badge tone="primary">Admin</Badge>}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <section className="flex flex-col gap-sm">
        <h2 className="font-title-md text-title-md">Invite Housemates</h2>
        <Card className="flex flex-col gap-sm">
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Share this code. Anyone who joins can plan meals and see the split.
          </p>
          <InviteLink inviteCode={house.inviteCode} />
        </Card>
      </section>

      <section className="flex flex-col gap-sm">
        <h2 className="font-title-md text-title-md">Delivery Routine</h2>
        <Card padded={false} className="overflow-hidden">
          <dl className="divide-y divide-surface-container-highest">
            {[
              { label: 'Delivery day', value: WEEKDAY_LABELS[house.deliveryDay], icon: 'local_shipping' },
              { label: 'Delivery slot', value: house.deliveryTime, icon: 'schedule' },
              {
                label: 'Planning cutoff',
                value: `${WEEKDAY_LABELS[house.cutoffDay]} ${house.cutoffTime}`,
                icon: 'lock_clock',
              },
              { label: 'Collector', value: collector?.name ?? 'Not set', icon: 'account_circle' },
            ].map((row) => (
              <div key={row.label} className="p-md flex items-center gap-md">
                <Icon name={row.icon} className="text-on-surface-variant" />
                <dt className="flex-grow font-body-lg text-body-lg">{row.label}</dt>
                <dd className="font-numeric-data text-numeric-data text-on-surface-variant shrink-0">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          The collector rotates weekly. Only their Tesco account is used to place the order — the
          app never sees card details.
        </p>
      </section>

      <section className="flex flex-col gap-sm">
        <h2 className="font-title-md text-title-md">Shared Staples</h2>
        <Card className="flex items-center justify-between gap-md">
          <div className="min-w-0">
            <p className="font-body-lg text-body-lg font-semibold">Split staples equally</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Oil, salt, washing-up liquid and similar are divided across everyone.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              defaultChecked={house.sharedStaplesEnabled}
              className="sr-only peer"
            />
            <span className="sr-only">Split shared staples equally</span>
            <span className="w-11 h-6 bg-surface-container-highest rounded-full peer peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-gray-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
          </label>
        </Card>
      </section>
    </PageShell>
  );
}
