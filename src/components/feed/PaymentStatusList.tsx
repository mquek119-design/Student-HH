'use client';

import { useState } from 'react';
import { Avatar } from '@/components/avatars/Avatar';
import { Badge } from '@/components/ui/Badge';
import { clsx } from '@/lib/clsx';
import type { User } from '@/lib/types';

interface PaymentStatusListProps {
  entries: { user: User; paid: boolean }[];
  currentUserId: string;
}

/**
 * "I've Paid" is social, not verified — see CLAUDE.md. Outstanding housemates
 * are shown prominently because peer pressure is the only enforcement the app
 * has. Nudging is a no-op until notifications exist; the button records intent.
 */
export function PaymentStatusList({ entries, currentUserId }: PaymentStatusListProps) {
  const [nudged, setNudged] = useState(false);
  const unpaid = entries.filter((entry) => !entry.paid);

  return (
    <div className="flex flex-col">
      <div className="p-md border-b border-surface-container-highest bg-surface-container-low/50">
        <h2 className="font-title-md text-title-md text-on-surface">Payment Status</h2>
        <p className="font-body-sm text-body-sm text-on-surface-variant">Last week&apos;s groceries</p>
      </div>

      <ul className="divide-y divide-surface-container-highest">
        {entries.map(({ user, paid }) => {
          const isYou = user.id === currentUserId;
          return (
            <li
              key={user.id}
              className={clsx(
                'p-md flex items-center justify-between gap-sm',
                isYou && 'bg-surface-container-low/30'
              )}
            >
              <div className="flex items-center gap-sm min-w-0">
                <Avatar user={user} size="md" ring={isYou ? 'primary' : 'none'} />
                <span className="font-numeric-data text-numeric-data text-on-surface truncate">
                  {isYou ? 'You' : user.name}
                  {!isYou && user.room && <span className="text-on-surface-variant"> (Room {user.room})</span>}
                </span>
              </div>
              {paid ? (
                <Badge tone="primary" icon="check_circle">
                  Paid
                </Badge>
              ) : (
                <Badge tone="secondary" icon="pending">
                  Unpaid
                </Badge>
              )}
            </li>
          );
        })}
      </ul>

      <div className="p-sm border-t border-surface-container-highest">
        <button
          type="button"
          disabled={unpaid.length === 0 || nudged}
          onClick={() => setNudged(true)}
          className="w-full text-center py-2 text-primary font-title-md text-title-md rounded hover:bg-surface-container-low transition-colors disabled:text-outline disabled:hover:bg-transparent disabled:cursor-not-allowed"
        >
          {unpaid.length === 0
            ? 'Everyone has paid'
            : nudged
              ? `Nudged ${unpaid.length} housemate${unpaid.length === 1 ? '' : 's'}`
              : `Nudge Unpaid (${unpaid.length})`}
        </button>
      </div>
    </div>
  );
}
