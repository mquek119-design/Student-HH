'use client';

import { useState, useTransition } from 'react';
import { Icon } from '@/components/media/Icon';
import { Card } from '@/components/ui/Card';
import { formatPence } from '@/lib/money';
import { buildBasket, type BasketActionState } from '@/app/basket/actions';

/**
 * Rebuilds the basket from the plan.
 *
 * The basket is derived, not authored: regenerating discards manual edits, so
 * when one already exists the button asks first rather than silently wiping
 * the collector's adjustments.
 */
export function BuildBasketPanel({
  hasBasket,
  mealCount,
  overlapSavings,
}: {
  hasBasket: boolean;
  mealCount: number;
  overlapSavings: number;
}) {
  const [state, setState] = useState<BasketActionState>({ status: 'idle', message: '' });
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function run() {
    setConfirming(false);
    startTransition(async () => setState(await buildBasket()));
  }

  return (
    <Card accent={state.status === 'error' ? 'error' : 'primary'} className="flex flex-col gap-sm">
      <div className="flex items-start justify-between gap-md">
        <div className="min-w-0">
          <h2 className="font-title-md text-title-md">
            {hasBasket ? 'Rebuild from the plan' : 'Build the basket'}
          </h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {mealCount === 0
              ? 'Plan some meals first.'
              : `Aggregates ingredients across ${mealCount} meal${mealCount === 1 ? '' : 's'}, subtracts the pantry, and rounds up to whole packs.`}
          </p>
        </div>
        {overlapSavings > 0 && (
          <span className="shrink-0 text-right">
            <span className="block font-label-caps text-label-caps uppercase text-on-surface-variant">
              Saved by pooling
            </span>
            <span className="block font-numeric-data text-numeric-data text-primary">
              {formatPence(overlapSavings)}
            </span>
          </span>
        )}
      </div>

      {confirming ? (
        <div className="flex flex-col gap-sm">
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            This replaces the current basket. Quantity changes you made by hand will be lost.
          </p>
          <div className="flex gap-sm">
            <button
              type="button"
              onClick={run}
              className="flex-1 h-11 rounded-lg bg-error text-on-error font-semibold hover:opacity-90 transition-opacity"
            >
              Replace basket
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="flex-1 h-11 rounded-lg border border-outline-variant text-on-surface-variant font-semibold hover:bg-surface-container transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={pending || mealCount === 0}
          onClick={() => (hasBasket ? setConfirming(true) : run())}
          className="w-full h-12 rounded-lg bg-secondary-container text-on-primary font-title-md text-title-md flex items-center justify-center gap-sm hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Icon name={pending ? 'progress_activity' : 'auto_awesome'} />
          {pending ? 'Optimising…' : hasBasket ? 'Rebuild basket' : 'Build basket'}
        </button>
      )}

      {state.message && (
        <p
          role="status"
          className={`font-body-sm text-body-sm ${
            state.status === 'error' ? 'text-error' : 'text-primary'
          }`}
        >
          {state.message}
        </p>
      )}
    </Card>
  );
}
