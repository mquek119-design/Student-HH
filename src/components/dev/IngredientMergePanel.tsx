'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Notice } from '@/components/ui/Notice';
import { clsx } from '@/lib/clsx';
import { mergeIngredients } from '@/app/dev/ingredientActions';
import type { DuplicateCluster } from '@/app/dev/ingredientActions';

/**
 * Ingredients that mean the same thing but are separate rows.
 *
 * Normalisation stops new duplicates being created; it cannot undo the ones
 * already in the table, and it will never catch pairs like Lettuce / Cos
 * lettuce where the difference sits in the middle of the name. Those need
 * somebody to say they are the same thing — which is what this is.
 *
 * The row with the most uses is offered as the one to keep, because merging
 * into the row nobody references is technically correct and practically
 * infuriating.
 */
export function IngredientMergePanel({ clusters }: { clusters: DuplicateCluster[] }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function merge(keepId: string, dropId: string) {
    setResult(null);
    startTransition(async () => {
      const response = await mergeIngredients(keepId, dropId);
      setResult({ ok: response.status === 'success', message: response.message });
    });
  }

  return (
    <Card className="flex flex-col gap-md">
      <div className="min-w-0">
        <h2 className="font-title-md text-title-md">Duplicate ingredients</h2>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          The optimiser pools by ingredient, so two rows meaning the same thing means two packs
          bought and no saving reported. Folding one into the other repoints every recipe, pantry
          item, staple and basket line that referenced it.
        </p>
      </div>

      {clusters.length === 0 ? (
        <Notice tone="good">
          Nothing to merge. Every ingredient in the catalogue is distinct.
        </Notice>
      ) : (
        <ul className="flex flex-col gap-md">
          {clusters.map((cluster) => {
            const [keeper, ...rest] = cluster.rows;
            return (
              <li
                key={cluster.canonical}
                className="flex flex-col gap-sm p-md rounded-lg bg-surface-container-low"
              >
                <span className="font-numeric-data text-[12px] text-on-surface-variant">
                  {cluster.canonical}
                </span>

                <ul className="flex flex-col gap-xs">
                  {cluster.rows.map((row) => (
                    <li
                      key={row.id}
                      className="flex items-center justify-between gap-sm min-w-0"
                    >
                      <span className="flex items-baseline gap-sm min-w-0">
                        <span
                          className={clsx(
                            'font-body-lg text-body-lg truncate',
                            row.id === keeper.id ? 'font-bold' : 'text-on-surface-variant'
                          )}
                        >
                          {row.name}
                        </span>
                        <span className="font-numeric-data text-[12px] text-on-surface-variant shrink-0">
                          {row.uses} use{row.uses === 1 ? '' : 's'}
                        </span>
                      </span>

                      {row.id === keeper.id ? (
                        <span className="font-label-caps text-label-caps uppercase text-primary shrink-0">
                          Keep
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isPending}
                          onClick={() => merge(keeper.id, row.id)}
                          className="shrink-0"
                        >
                          Fold into {keeper.name}
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>

                {rest.length > 0 && (
                  <p className="font-body-sm text-[12px] text-on-surface-variant">
                    Keeping the most-used row. Rebuild the basket afterwards to see them pool.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

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
