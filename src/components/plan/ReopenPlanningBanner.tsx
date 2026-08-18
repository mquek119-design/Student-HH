'use client';

import { useState, useTransition } from 'react';
import { Icon } from '@/components/media/Icon';
import { Card } from '@/components/ui/Card';
import { reopenPlanning } from '@/app/plan/actions';
import type { PlanStatus } from '@/lib/types';

const EXPLANATION: Record<Exclude<PlanStatus, 'planning'>, string> = {
  locked: 'The cutoff has passed, so meals are fixed while the basket is built.',
  ordered: 'The order has gone to Tesco, so changing meals no longer changes the shop.',
  delivered: 'This week has been delivered and reconciled.',
};

/**
 * Lets the house put a locked week back into planning.
 *
 * Without this a plan that reaches `ordered` can never be edited again — and a
 * bug used to set that status on every basket rebuild, so plans got stranded
 * having never been ordered at all. A one-way door with no handle is a bug even
 * when the status is correct.
 */
export function ReopenPlanningBanner({ status }: { status: PlanStatus }) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (status === 'planning') return null;

  function reopen() {
    startTransition(async () => {
      const result = await reopenPlanning();
      setMessage(result.status === 'error' ? result.message : null);
    });
  }

  return (
    <Card accent="secondary" className="flex flex-col gap-sm">
      <div className="flex items-start gap-sm">
        <Icon name="lock" filled className="text-secondary mt-0.5 shrink-0" />
        <div className="min-w-0">
          <h2 className="font-title-md text-title-md">Planning is closed</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {EXPLANATION[status as Exclude<PlanStatus, 'planning'>] ?? 'This week is closed.'}{' '}
            Reopen it if you still need to change meals — the basket is rebuilt from the plan, so
            nothing is lost.
          </p>
        </div>
      </div>

      <button
        type="button"
        disabled={pending}
        onClick={reopen}
        className="self-start flex items-center gap-xs px-md py-2 rounded-full bg-primary text-on-primary text-[14px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
      >
        <Icon name={pending ? 'progress_activity' : 'lock_open'} className="text-[18px]" />
        {pending ? 'Reopening…' : 'Reopen planning'}
      </button>

      {message && (
        <p role="alert" className="font-body-sm text-body-sm text-error">
          {message}
        </p>
      )}
    </Card>
  );
}
