'use client';

import { useState, useTransition } from 'react';
import { Avatar } from '@/components/avatars/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Notice } from '@/components/ui/Notice';
import { clsx } from '@/lib/clsx';
import { startViewingAs, stopViewingAs } from '@/app/dev/viewAsActions';
import type { User } from '@/lib/types';

/**
 * Look through a demo housemate's eyes.
 *
 * The split has two sides and one account can only ever see one of them: the
 * collector has nothing to pay and everybody to chase, everyone else has the
 * opposite. Demo housemates have no auth account and cannot sign in, so without
 * this half the settle-up flow is unreachable without a second real email
 * address and a second magic link.
 */
export function ViewAsPanel({
  demoHousemates,
  viewingAs,
}: {
  demoHousemates: User[];
  /** Set when the app is already rendering as somebody else. */
  viewingAs: User | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function run(fn: () => Promise<{ status: string; message: string }>) {
    setResult(null);
    startTransition(async () => {
      const response = await fn();
      setResult({ ok: response.status === 'success', message: response.message });
    });
  }

  return (
    <Card className="flex flex-col gap-md">
      <div className="min-w-0">
        <h3 className="font-title-md text-title-md">See it as somebody else</h3>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Renders the whole app as a demo housemate. Real accounts can never be
          impersonated — only the seeded ones, and only in this house.
        </p>
      </div>

      {demoHousemates.length === 0 ? (
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          No demo housemates yet. Reset the demo data first.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-surface-container-highest">
          {demoHousemates.map((user) => {
            const active = viewingAs?.id === user.id;
            return (
              <li key={user.id} className="py-sm flex items-center justify-between gap-sm">
                <span className="flex items-center gap-sm min-w-0">
                  <Avatar user={user} size="sm" />
                  <span
                    className={clsx(
                      'font-body-lg text-body-lg truncate',
                      active ? 'font-bold text-primary' : 'font-semibold'
                    )}
                  >
                    {user.name}
                  </span>
                </span>

                <Button
                  size="sm"
                  variant={active ? 'outline' : 'primary'}
                  disabled={isPending || active}
                  onClick={() => run(() => startViewingAs(user.id))}
                >
                  {active ? 'Viewing' : 'View as'}
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {viewingAs && (
        <Button
          variant="outline"
          icon="undo"
          disabled={isPending}
          onClick={() => run(stopViewingAs)}
          className="self-start"
        >
          Back to yourself
        </Button>
      )}

      {/* Stated up front rather than found by confusion. */}
      <Notice tone="info" icon="shield">
        Meals, guests, baskets, purchases, payment status and their profile all save as them.
        Row-level security judges writes by who is really signed in, so the three writes it would
        refuse go through checked database functions instead — they verify the same house
        membership in SQL, and refuse any profile that is not a seeded one.
      </Notice>

      <Notice tone="check" icon="block">
        <strong className="text-on-surface font-semibold">Real housemates are never reachable.</strong>{' '}
        Not a policy, a condition in the functions themselves: they refuse a target that is not{' '}
        <code>is_demo</code>, so no amount of tampering with the cookie reaches a real account.
      </Notice>

      {result && (
        <p
          role="status"
          className={clsx(
            'font-body-sm text-body-sm font-semibold',
            result.ok ? 'text-primary' : 'text-error'
          )}
        >
          {result.message}
        </p>
      )}
    </Card>
  );
}
