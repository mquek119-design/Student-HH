'use client';

import { useState, useTransition } from 'react';
import { Icon } from '@/components/media/Icon';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Notice } from '@/components/ui/Notice';
import { clsx } from '@/lib/clsx';
import { clearDemoData, seedDemoData, simulateOrderPlaced } from '@/app/settings/seedActions';
import {
  clearDelivery,
  rotateCollector,
  simulateDelivery,
  simulatePayments,
} from '@/app/dev/actions';
import { postSplit } from '@/app/split/postActions';
import type { PlanStatus } from '@/lib/types';

/**
 * One week, start to finish, without leaving the country.
 *
 * The weekly cycle only completes if a Tesco order is really placed and really
 * delivered to a UK address. Everything downstream of that — reconciliation,
 * the posted split, who has paid — was therefore unreachable in development and
 * shipped unseen. These steps write exactly what the real events write and
 * nothing more: no Tesco call, no invented price, no money moved.
 *
 * Ordered as the week runs, because that ordering is the thing being tested.
 */

interface Step {
  key: string;
  title: string;
  detail: string;
  action: string;
  icon: string;
  /** Where to go and look once it has run. */
  see?: { href: string; label: string };
  run: () => Promise<{ status: string; message: string }>;
  /** Shown as "done" once the week has reached one of these. */
  doneWhen?: PlanStatus[];
}

export function WeekRunner({ status }: { status: PlanStatus }) {
  const [isPending, startTransition] = useTransition();
  const [running, setRunning] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);

  const steps: Step[] = [
    {
      key: 'seed',
      title: '1. Seed the week',
      detail:
        'Four demo housemates, fifteen recipes, a Monday–Sunday plan, a guest on Saturday lunch, a pantry, a staples list, a leftover and one off-shop purchase. Clears the house first.',
      action: 'Reset demo data',
      icon: 'database',
      see: { href: '/plan', label: 'Plan' },
      run: seedDemoData,
    },
    {
      key: 'ordered',
      title: '3. Place the order',
      detail:
        'Flips the week to ordered. The Plan tab stops asking what you fancy and starts showing what you have; Split → Delivery opens. Nothing is sent to Tesco.',
      action: 'Mark week as ordered',
      icon: 'local_shipping',
      see: { href: '/plan', label: 'Plan' },
      run: () => simulateOrderPlaced(true),
      doneWhen: ['ordered', 'delivered'],
    },
    {
      key: 'post',
      title: '4. Post the split',
      detail:
        'Writes a real debt per housemate from the basket allocations. Until this runs, "I’ve Paid" has no row to update and Balances is empty — the arithmetic exists but the week has no ending.',
      action: 'Post the split',
      icon: 'receipt_long',
      see: { href: '/split', label: 'This Week' },
      run: postSplit,
    },
    {
      key: 'deliver',
      title: '5. Take the delivery',
      detail:
        'Substitutes one item for a dearer one, loses another entirely, and short-delivers a third — one of each case the money rules handle.',
      action: 'Simulate delivery',
      icon: 'inventory',
      see: { href: '/split/reconcile', label: 'Delivery' },
      run: simulateDelivery,
      doneWhen: ['delivered'],
    },
    {
      key: 'collector',
      title: '6. See it from the other side',
      detail:
        'Rotates who the collector is. The collector has nothing to pay and everyone to chase; everybody else has the opposite. From one account you can only ever see one of those, so swap to check both.',
      action: 'Swap collector',
      icon: 'swap_horiz',
      see: { href: '/split', label: 'This Week' },
      run: rotateCollector,
    },
    {
      key: 'pay',
      title: '7. Housemates pay',
      detail:
        'Marks half of them as having paid, so the collector’s side — who to chase, confirming, disputing — is visible. Never touches your own row.',
      action: 'Half of them say they paid',
      icon: 'payments',
      see: { href: '/split/balances', label: 'Balances' },
      run: () => simulatePayments('notified'),
    },
  ];

  function run(step: Step) {
    setRunning(step.key);
    setResult(null);
    startTransition(async () => {
      try {
        const response = await step.run();
        setResult({ ok: response.status === 'success', message: response.message });
      } catch (error) {
        setResult({
          ok: false,
          message: error instanceof Error ? error.message : 'Something went wrong.',
        });
      } finally {
        setRunning(null);
      }
    });
  }

  function runRaw(fn: () => Promise<{ status: string; message: string }>, key: string) {
    setRunning(key);
    setResult(null);
    startTransition(async () => {
      const response = await fn();
      setResult({ ok: response.status === 'success', message: response.message });
      setRunning(null);
    });
  }

  return (
    <div className="flex flex-col gap-md">
      <h2 className="font-title-md text-title-md">Walk the week</h2>
      <Notice tone="good" icon="science" title="Everything here writes to your real house">
        Nothing contacts Tesco, no card is touched and no price is invented — each step writes
        exactly the rows the real event would. Step 2 is the only one you do yourself.
      </Notice>

      {steps.map((step, index) => {
        const done = step.doneWhen?.includes(status) ?? false;
        const busy = isPending && running === step.key;

        return (
          <div key={step.key} className="flex flex-col gap-sm">
            <Card className="flex flex-col gap-sm">
              <div className="flex items-start justify-between gap-sm">
                <div className="min-w-0">
                  <h3 className="font-title-md text-title-md flex items-center gap-xs">
                    {step.title}
                    {done && <Icon name="check_circle" filled className="text-primary text-[18px]" />}
                  </h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">{step.detail}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-sm">
                <Button
                  disabled={isPending}
                  pending={busy}
                  pendingLabel="Running…"
                  icon={step.icon}
                  onClick={() => run(step)}
                >
                  {step.action}
                </Button>

                {step.see && (
                  <ButtonLink href={step.see.href} variant="outline" iconRight="chevron_right">
                    Look at {step.see.label}
                  </ButtonLink>
                )}
              </div>
            </Card>

            {/* Step 2 is a real screen doing real work, so it is a signpost
                rather than a button — nothing here should fake a Tesco call. */}
            {index === 0 && (
              <Card className="flex items-start gap-sm">
                <Icon name="shopping_basket" className="text-on-surface-variant mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <h3 className="font-title-md text-title-md">2. Build the basket</h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Do this one for real on the Basket tab — it resolves every ingredient against
                    live Tesco search for prices, pack sizes and pictures. There is no simulated
                    version because a made-up price would sit in the same column the split reads.
                  </p>
                  <ButtonLink
                    href="/basket"
                    variant="ghost"
                    size="sm"
                    iconRight="chevron_right"
                    className="mt-xs -ml-sm"
                  >
                    Go to Basket
                  </ButtonLink>
                </div>
              </Card>
            )}
          </div>
        );
      })}

      {result && (
        <p
          role="status"
          className={clsx(
            'font-body-sm text-body-sm font-semibold px-md py-sm rounded-lg',
            result.ok
              ? 'text-primary bg-primary/10'
              : 'text-error bg-error-container/40'
          )}
        >
          {result.message}
        </p>
      )}

      <Card className="flex flex-col gap-sm">
        <h3 className="font-title-md text-title-md">Start over</h3>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Rewind a step, or empty the house completely.
        </p>
        <div className="flex flex-wrap gap-sm">
          <Button
            variant="outline"
            disabled={isPending}
            icon="undo"
            onClick={() => runRaw(() => simulateOrderPlaced(false), 'reopen')}
          >
            Reopen planning
          </Button>
          <Button
            variant="outline"
            disabled={isPending}
            icon="restart_alt"
            onClick={() => runRaw(clearDelivery, 'cleardelivery')}
          >
            Undo the delivery
          </Button>
          <Button
            variant="outline"
            disabled={isPending}
            icon="money_off"
            onClick={() => runRaw(() => simulatePayments('pending'), 'unpay')}
          >
            Nobody has paid
          </Button>
        </div>

        {confirmingClear ? (
          <div className="flex flex-col gap-sm p-md rounded-lg border border-error/40 bg-error-container/30">
            <p className="font-body-sm text-body-sm text-on-error-container">
              This deletes every plan, recipe, pantry item, basket, staple, leftover and purchase in
              this house — including anything you wrote yourself — and removes the demo housemates.
              It cannot be undone.
            </p>
            <div className="flex gap-sm">
              <Button
                fullWidth
                className="flex-1 bg-error text-on-error hover:opacity-90"
                onClick={() => {
                  setConfirmingClear(false);
                  runRaw(clearDemoData, 'clear');
                }}
              >
                Yes, clear everything
              </Button>
              <Button
                variant="outline"
                fullWidth
                className="flex-1"
                onClick={() => setConfirmingClear(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="danger"
            disabled={isPending}
            icon="delete_sweep"
            onClick={() => setConfirmingClear(true)}
            className="self-start"
          >
            Clear everything
          </Button>
        )}
      </Card>
    </div>
  );
}
