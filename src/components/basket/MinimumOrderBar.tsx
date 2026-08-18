import { Icon } from '@/components/media/Icon';
import { Card } from '@/components/ui/Card';
import { clsx } from '@/lib/clsx';
import { formatPence } from '@/lib/money';
import type { Pence } from '@/lib/types';

/**
 * Whether the basket clears Tesco's minimum spend.
 *
 * This is the app's founding premise made visible: one household order reaches
 * a threshold a single student cannot. Leaving it off meant the collector only
 * discovered a short basket at Tesco, after doing all the work.
 *
 * The shortfall is stated in money, not a percentage — "£6.40 short" tells you
 * what to do; "84%" does not.
 */
export function MinimumOrderBar({
  total,
  minimum,
  method,
}: {
  total: Pence;
  minimum: Pence;
  method: 'delivery' | 'collect';
}) {
  const met = total >= minimum;
  const shortfall = Math.max(0, minimum - total);
  const fraction = minimum > 0 ? Math.min(1, total / minimum) : 1;
  const label = method === 'collect' ? 'Click & Collect' : 'Delivery';

  return (
    <Card accent={met ? 'primary' : 'secondary'} className="flex flex-col gap-sm">
      <div className="flex items-start justify-between gap-md">
        <div className="min-w-0">
          <h2 className="font-title-md text-title-md flex items-center gap-xs">
            <Icon
              name={met ? 'check_circle' : 'error'}
              filled
              className={met ? 'text-primary' : 'text-secondary'}
            />
            {met ? 'Minimum met' : `${formatPence(shortfall)} short`}
          </h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            {label} needs at least {formatPence(minimum)}. You have{' '}
            <strong className="font-numeric-data">{formatPence(total)}</strong>.
            {!met && ' Add more meals or a few household items to reach it.'}
          </p>
        </div>
      </div>

      <div
        className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={minimum}
        aria-valuenow={Math.min(total, minimum)}
        aria-label={`Progress toward the ${label} minimum`}
      >
        <div
          className={clsx(
            'h-full rounded-full transition-all duration-500',
            met ? 'bg-primary' : 'bg-secondary-container'
          )}
          style={{ width: `${fraction * 100}%` }}
        />
      </div>
    </Card>
  );
}
