'use client';

import { useMemo, useState, useTransition } from 'react';
import { Icon } from '@/components/media/Icon';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { clsx } from '@/lib/clsx';
import { formatPence } from '@/lib/money';
import type {
  Pence,
  ReconciliationItem,
  Substitution,
  SubstitutionDecision,
} from '@/lib/types';
import {
  finaliseReconciliation,
  updateItemReceived,
  updateSubstitutionDecision,
} from '@/app/split/actions';

interface ReconciliationProps {
  items: ReconciliationItem[];
  substitutions: Substitution[];
  plannedTotal: Pence;
  isCollector: boolean;
  planId?: string;
}

export function Reconciliation({
  items,
  substitutions,
  plannedTotal,
  isCollector,
  planId,
}: ReconciliationProps) {
  const [received, setReceived] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(items.map((item) => [item.basketItemId, item.received]))
  );
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(items.map((item) => [item.basketItemId, item.receivedQuantity]))
  );
  const [decisions, setDecisions] = useState<Record<string, SubstitutionDecision>>(() =>
    Object.fromEntries(substitutions.map((sub) => [sub.id, sub.decision]))
  );
  const [adjustment, setAdjustment] = useState(0);
  const [finalised, setFinalised] = useState(false);
  const [isPending, startTransition] = useTransition();

  function toggleItemReceived(basketItemId: string) {
    const nextState = !received[basketItemId];
    const qty = quantities[basketItemId] ?? 0;
    setReceived((prev) => ({ ...prev, [basketItemId]: nextState }));
    startTransition(async () => {
      await updateItemReceived(basketItemId, nextState, qty);
    });
  }

  function setItemQuantity(basketItemId: string, nextQty: number) {
    const isRec = received[basketItemId];
    setQuantities((prev) => ({ ...prev, [basketItemId]: nextQty }));
    startTransition(async () => {
      await updateItemReceived(basketItemId, isRec, nextQty);
    });
  }

  function handleDecision(subId: string, decision: SubstitutionDecision) {
    setDecisions((prev) => ({ ...prev, [subId]: decision }));
    startTransition(async () => {
      await updateSubstitutionDecision(subId, decision);
    });
  }

  function handleFinalise() {
    setFinalised(true);
    if (planId) {
      startTransition(async () => {
        await finaliseReconciliation(planId);
      });
    }
  }

  const { actualTotal, refunded, substitutionDelta, pending } = useMemo(() => {
    let actual = 0;
    let refund = 0;

    for (const item of items) {
      const isReceived = received[item.basketItemId];
      const quantity = isReceived ? (quantities[item.basketItemId] ?? 0) : 0;
      actual += item.price * quantity;
      refund += item.price * (item.expectedQuantity - quantity);
    }

    let delta = 0;
    for (const sub of substitutions) {
      const decision = decisions[sub.id];
      if (decision === 'accepted') {
        actual += sub.receivedPrice;
        delta += sub.receivedPrice - sub.orderedPrice;
      } else if (decision === 'rejected') {
        refund += sub.orderedPrice;
      }
    }

    return {
      actualTotal: actual + adjustment,
      refunded: refund,
      substitutionDelta: delta,
      pending: substitutions.filter((sub) => decisions[sub.id] === 'pending').length,
    };
  }, [items, substitutions, received, quantities, decisions, adjustment]);

  const difference = actualTotal - plannedTotal;

  return (
    <div className="flex flex-col gap-lg">
      <Card className="flex flex-col gap-sm">
        <div className="flex items-start justify-between gap-md">
          <div>
            <h2 className="font-title-md text-title-md">Corrected Total</h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Planned {formatPence(plannedTotal)} · Refunded {formatPence(refunded)}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-numeric-data text-headline-lg-mobile text-primary">
              {formatPence(actualTotal)}
            </p>
            <p
              className={clsx(
                'font-numeric-data text-[12px]',
                difference > 0 ? 'text-error' : difference < 0 ? 'text-primary' : 'text-on-surface-variant'
              )}
            >
              {difference === 0
                ? 'matches plan'
                : `${difference > 0 ? '+' : ''}${formatPence(difference)} vs plan`}
            </p>
          </div>
        </div>
        {substitutionDelta !== 0 && (
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Substitutions account for{' '}
            <strong className="font-numeric-data">{formatPence(substitutionDelta)}</strong> of the
            difference.
          </p>
        )}
      </Card>

      <section className="flex flex-col gap-sm">
        <h2 className="font-title-md text-title-md">Received Items</h2>
        <Card padded={false} className="overflow-hidden">
          <ul className="divide-y divide-surface-container-highest">
            {items.map((item) => {
              const isReceived = received[item.basketItemId];
              const quantity = quantities[item.basketItemId] ?? 0;
              const isShort = isReceived && quantity < item.expectedQuantity;

              return (
                <li key={item.basketItemId} className="p-md flex items-center gap-md">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={isReceived}
                    aria-label={`${item.name} received`}
                    onClick={() => toggleItemReceived(item.basketItemId)}
                    className={clsx(
                      'w-6 h-6 border-2 rounded flex items-center justify-center shrink-0 transition-colors',
                      isReceived ? 'bg-primary border-primary' : 'border-outline'
                    )}
                  >
                    <Icon
                      name="check"
                      className={clsx('text-white text-[16px]', !isReceived && 'opacity-0')}
                    />
                  </button>

                  <div className="flex-grow min-w-0">
                    <p
                      className={clsx(
                        'font-body-lg text-body-lg truncate',
                        !isReceived && 'line-through text-on-surface-variant'
                      )}
                    >
                      {item.name}
                    </p>
                    <p className="font-body-sm text-body-sm text-on-surface-variant">
                      Ordered {item.expectedQuantity} @ {formatPence(item.price)}
                      {isShort && (
                        <span className="text-secondary font-semibold"> · short delivered</span>
                      )}
                    </p>
                  </div>

                  {isReceived ? (
                    <div className="flex items-center gap-2 bg-surface-container rounded-lg p-1 shrink-0">
                      <button
                        type="button"
                        aria-label={`Decrease received ${item.name}`}
                        onClick={() =>
                          setItemQuantity(
                            item.basketItemId,
                            Math.max(0, (quantities[item.basketItemId] ?? 0) - 1)
                          )
                        }
                        className="w-6 h-6 flex items-center justify-center text-on-surface-variant hover:bg-surface-container-highest rounded"
                      >
                        <Icon name="remove" className="text-[16px]" />
                      </button>
                      <span className="font-numeric-data text-numeric-data w-4 text-center tabular-nums">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        aria-label={`Increase received ${item.name}`}
                        onClick={() =>
                          setItemQuantity(
                            item.basketItemId,
                            (quantities[item.basketItemId] ?? 0) + 1
                          )
                        }
                        className="w-6 h-6 flex items-center justify-center text-primary hover:bg-primary-container hover:text-on-primary-container rounded"
                      >
                        <Icon name="add" className="text-[16px]" />
                      </button>
                    </div>
                  ) : (
                    <Badge tone="error" className="shrink-0">
                      Refunded
                    </Badge>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      </section>

      <section className="flex flex-col gap-sm">
        <div className="flex items-center justify-between gap-sm">
          <h2 className="font-title-md text-title-md">Substitutions</h2>
          {pending > 0 && <Badge tone="secondary">{pending} to review</Badge>}
        </div>

        {substitutions.length === 0 ? (
          <Card>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Tesco substituted nothing this week.
            </p>
          </Card>
        ) : (
          <ul className="flex flex-col gap-sm">
            {substitutions.map((sub) => {
              const decision = decisions[sub.id];
              const delta = sub.receivedPrice - sub.orderedPrice;

              return (
                <li key={sub.id}>
                  <Card
                    accent={
                      decision === 'accepted'
                        ? 'primary'
                        : decision === 'rejected'
                          ? 'error'
                          : 'secondary'
                    }
                    className="flex flex-col gap-md"
                  >
                    <div className="flex flex-col gap-xs">
                      <p className="font-body-sm text-body-sm text-on-surface-variant line-through">
                        {sub.orderedName} · {formatPence(sub.orderedPrice)}
                      </p>
                      <p className="font-body-lg text-body-lg font-semibold flex items-center gap-xs flex-wrap">
                        <Icon name="swap_horiz" className="text-secondary" />
                        {sub.receivedName} · {formatPence(sub.receivedPrice)}
                        <span
                          className={clsx(
                            'font-numeric-data text-[12px]',
                            delta > 0 ? 'text-error' : 'text-primary'
                          )}
                        >
                          ({delta > 0 ? '+' : ''}
                          {formatPence(delta)})
                        </span>
                      </p>
                    </div>

                    <div className="flex gap-sm">
                      <button
                        type="button"
                        onClick={() => handleDecision(sub.id, 'accepted')}
                        className={clsx(
                          'flex-1 h-10 rounded-lg font-semibold text-[14px] flex items-center justify-center gap-xs transition-colors',
                          decision === 'accepted'
                            ? 'bg-primary text-on-primary'
                            : 'border border-primary text-primary hover:bg-primary/10'
                        )}
                      >
                        <Icon name="check" className="text-[18px]" />
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDecision(sub.id, 'rejected')}
                        className={clsx(
                          'flex-1 h-10 rounded-lg font-semibold text-[14px] flex items-center justify-center gap-xs transition-colors',
                          decision === 'rejected'
                            ? 'bg-error text-on-error'
                            : 'border border-error text-error hover:bg-error-container'
                        )}
                      >
                        <Icon name="close" className="text-[18px]" />
                        Reject
                      </button>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-sm">
        <h2 className="font-title-md text-title-md">Manual Adjustment</h2>
        <Card className="flex items-center justify-between gap-md">
          <div className="min-w-0">
            <p className="font-body-lg text-body-lg font-semibold">Delivery fee / bags</p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Split equally across the house
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-numeric-data text-on-surface-variant">£</span>
            <input
              type="number"
              min={0}
              step="0.01"
              aria-label="Manual adjustment in pounds"
              value={(adjustment / 100).toFixed(2)}
              onChange={(event) => {
                const parsed = Number.parseFloat(event.target.value);
                setAdjustment(Number.isFinite(parsed) ? Math.round(parsed * 100) : 0);
              }}
              className="w-24 h-10 px-2 rounded-lg bg-surface-container-low border-none focus:ring-2 focus:ring-primary font-numeric-data text-right"
            />
          </div>
        </Card>
      </section>

      <button
        type="button"
        disabled={!isCollector || pending > 0 || finalised || isPending}
        onClick={handleFinalise}
        className="w-full h-12 bg-primary text-on-primary font-title-md text-title-md rounded-lg flex items-center justify-center gap-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Icon name={finalised ? 'check_circle' : 'gavel'} filled={finalised} />
        {finalised
          ? 'Split finalised'
          : pending > 0
            ? `Review ${pending} substitution${pending === 1 ? '' : 's'} first`
            : isCollector
              ? 'Finalise Corrected Split'
              : 'Collector finalises the split'}
      </button>
    </div>
  );
}

