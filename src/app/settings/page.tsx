import { Avatar } from '@/components/avatars/Avatar';
import { InviteLink } from '@/components/settings/InviteLink';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageShell } from '@/components/ui/PageShell';
import { getCollector, getHouse, getHouseStaples, getHousemates } from '@/lib/queries';
import { FulfillmentSettingsPanel } from '@/components/settings/FulfillmentSettingsPanel';
import { TescoSessionPanel } from '@/components/settings/TescoSessionPanel';
import { SlotPreferencePanel } from '@/components/settings/SlotPreferencePanel';
import { RoutinePanel } from '@/components/settings/RoutinePanel';
import { StaplesPanel } from '@/components/settings/StaplesPanel';
import { SharedStaplesToggle } from '@/components/settings/SharedStaplesToggle';

export const metadata = { title: 'House Settings · Grub' };

// Reads the signed-in user's house — nothing to prerender at build time.
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const [house, housemates, collector, staples] = await Promise.all([
    getHouse(),
    getHousemates(),
    getCollector(),
    getHouseStaples(),
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
        <h2 className="font-title-md text-title-md">Tesco Session & Credentials</h2>
        <TescoSessionPanel />
      </section>

      <section className="flex flex-col gap-sm">
        <h2 className="font-title-md text-title-md">Tesco Fulfillment Options</h2>
        <FulfillmentSettingsPanel house={house} />
      </section>

      <SlotPreferencePanel house={house} />

      <RoutinePanel house={house} housemates={housemates} collectorId={collector?.id ?? null} />

      <section className="flex flex-col gap-sm">
        <h2 className="font-title-md text-title-md">Shared Staples</h2>
        <Card className="flex flex-col gap-md">
          <SharedStaplesToggle enabled={house.sharedStaplesEnabled} />
          <div className="border-t border-surface-container-highest pt-md">
            <StaplesPanel staples={staples} splitEqually={house.sharedStaplesEnabled} />
          </div>
        </Card>
      </section>
    </PageShell>
  );
}
