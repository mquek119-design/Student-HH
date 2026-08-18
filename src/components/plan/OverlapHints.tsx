import Link from 'next/link';
import { Icon } from '@/components/media/Icon';
import { formatPence } from '@/lib/money';
import type { PlanOverlap } from '@/lib/types';
import { MEAL_TYPE_LABELS, WEEKDAY_LABELS } from '@/lib/types';

/**
 * "You could cook different things from the same shopping."
 *
 * Framed as an offer and toned as one — see `overlaps.ts` for why this replaced
 * a red "Conflict Detected" panel. The saving is last and small on purpose: the
 * useful part is the recipe, not a number that makes someone feel billed for
 * wanting a curry. Nothing here blocks anything.
 */
export function OverlapHints({ overlaps }: { overlaps: PlanOverlap[] }) {
  if (overlaps.length === 0) return null;

  return (
    <div className="flex flex-col gap-sm">
      {overlaps.map((overlap) => (
        <div
          key={`${overlap.day}-${overlap.mealType}`}
          className="flex flex-col gap-sm p-md rounded-lg bg-secondary-fixed/40 border border-secondary-container/40"
        >
          <div className="flex items-start gap-sm">
            <Icon name="lightbulb" filled className="text-secondary mt-0.5 text-[18px] shrink-0" />
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              <strong className="font-semibold text-on-surface">
                {WEEKDAY_LABELS[overlap.day]} {MEAL_TYPE_LABELS[overlap.mealType].toLowerCase()}:
                shop once, cook separately.
              </strong>{' '}
              {overlap.message} These would use what is already going in the basket:
            </p>
          </div>

          <ul className="flex flex-col gap-xs">
            {overlap.suggestions.map((suggestion) => (
              <li key={suggestion.recipeId}>
                <Link
                  href={`/recipes/${suggestion.recipeId}`}
                  className="flex items-center justify-between gap-sm px-md py-sm rounded-lg bg-surface-container-lowest border border-surface-container-highest hover:border-secondary-container transition-colors"
                >
                  <span className="min-w-0">
                    <span className="font-body-lg text-body-lg font-semibold block truncate">
                      {suggestion.title}
                    </span>
                    <span className="font-body-sm text-[12px] text-on-surface-variant">
                      Shares {suggestion.shares.join(', ')}
                    </span>
                  </span>
                  <Icon name="chevron_right" className="text-on-surface-variant shrink-0" />
                </Link>
              </li>
            ))}
          </ul>

          <p className="font-body-sm text-[12px] text-on-surface-variant">
            Nobody has to change anything — cooking what you fancy is the point. Buying the same
            ingredients twice costs the house about{' '}
            <span className="font-numeric-data">{formatPence(overlap.missedSaving)}</span>.
          </p>
        </div>
      ))}
    </div>
  );
}
