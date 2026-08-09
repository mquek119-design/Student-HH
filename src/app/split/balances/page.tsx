import { Avatar } from '@/components/avatars/Avatar';
import { Icon } from '@/components/media/Icon';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatPence } from '@/lib/money';
import { getCurrentUser, getHousemates, getLedger, netBalances } from '@/lib/queries';

export const metadata = { title: 'Balances · HouseGrocer' };

// Reads the signed-in user's house — nothing to prerender at build time.
export const dynamic = 'force-dynamic';

export default async function BalancesPage() {
  const [housemates, ledger, currentUser] = await Promise.all([
    getHousemates(),
    getLedger(),
    getCurrentUser(),
  ]);

  const byId = new Map(housemates.map((user) => [user.id, user]));
  const balances = netBalances(
    ledger,
    housemates.map((user) => user.id)
  );
  const yourNet = balances[currentUser.id] ?? 0;

  if (ledger.length === 0) {
    return (
      <EmptyState
        icon="account_balance"
        title="No balances yet"
        body="Every settled week is recorded here, so you can see who is owed what across the whole tenancy. Nothing has been settled yet."
      />
    );
  }

  return (
    <>
      <Card className="flex flex-col items-center text-center gap-xs py-lg">
        <span className="font-label-caps text-label-caps uppercase tracking-wider text-on-surface-variant">
          Your Net Position
        </span>
        <span
          className={`font-numeric-data text-display-lg tabular-nums ${
            yourNet >= 0 ? 'text-primary' : 'text-secondary'
          }`}
        >
          {formatPence(Math.abs(yourNet))}
        </span>
        <span className="font-body-lg text-body-lg text-on-surface-variant">
          {yourNet === 0
            ? 'All square with the house'
            : yourNet > 0
              ? 'You are owed'
              : 'You owe the house'}
        </span>
      </Card>

      <section className="flex flex-col gap-sm">
        <h2 className="font-title-md text-title-md text-on-background">Per Housemate</h2>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-sm">
          {housemates
            .filter((user) => user.id !== currentUser.id)
            .map((user) => {
              const net = balances[user.id] ?? 0;
              return (
                <li key={user.id}>
                  <Card className="flex items-center gap-md">
                    <Avatar user={user} size="md" />
                    <div className="flex-grow min-w-0">
                      <p className="font-title-md text-title-md truncate">{user.name}</p>
                      <p className="font-body-sm text-body-sm text-on-surface-variant">
                        {net === 0 ? 'Settled up' : net > 0 ? 'Is owed' : 'Owes the house'}
                      </p>
                    </div>
                    <span
                      className={`font-numeric-data text-numeric-data font-bold shrink-0 ${
                        net > 0 ? 'text-primary' : net < 0 ? 'text-secondary' : 'text-on-surface-variant'
                      }`}
                    >
                      {formatPence(Math.abs(net))}
                    </span>
                  </Card>
                </li>
              );
            })}
        </ul>
      </section>

      <section className="flex flex-col gap-sm">
        <h2 className="font-title-md text-title-md text-on-background">Running History</h2>
        <Card padded={false} className="overflow-hidden">
          <ul className="divide-y divide-surface-container-highest">
            {ledger.map((entry) => {
              const from = byId.get(entry.fromUserId);
              const to = byId.get(entry.toUserId);
              const involvesYou =
                entry.fromUserId === currentUser.id || entry.toUserId === currentUser.id;

              return (
                <li key={entry.id} className="p-md flex items-center gap-md">
                  <span className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant shrink-0">
                    <Icon
                      name={entry.status === 'confirmed' ? 'check_circle' : 'schedule'}
                      className="text-[20px]"
                    />
                  </span>

                  <div className="flex-grow min-w-0">
                    <p className="font-body-lg text-body-lg truncate">
                      <span className="font-semibold">
                        {entry.fromUserId === currentUser.id ? 'You' : (from?.name ?? 'Someone')}
                      </span>{' '}
                      → {entry.toUserId === currentUser.id ? 'you' : (to?.name ?? 'someone')}
                    </p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                      Week {entry.weekNumber} ·{' '}
                      {new Date(entry.date).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}{' '}
                      · {entry.note}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-xs shrink-0">
                    <span
                      className={`font-numeric-data text-numeric-data ${
                        involvesYou ? 'text-on-surface font-bold' : 'text-on-surface-variant'
                      }`}
                    >
                      {formatPence(entry.amount)}
                    </span>
                    <Badge tone={entry.status === 'confirmed' ? 'primary' : 'secondary'}>
                      {entry.status === 'confirmed' ? 'Settled' : 'Outstanding'}
                    </Badge>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      </section>
    </>
  );
}
