'use client';

import { useFormState } from 'react-dom';
import { Icon } from '@/components/media/Icon';
import { useSubmitState } from '@/components/ui/SubmitButton';
import { clsx } from '@/lib/clsx';
import { bailFromMeal, setMealStatus, type PlanActionState } from '@/app/plan/actions';
import type { MealStatus } from '@/lib/types';

/**
 * What happened to a meal, recorded after the shop arrived.
 *
 * There is no confirmation on any of these and no way to get one wrong: every
 * option is reversible and none of them touches money. The food is bought and
 * paid for. This is a kitchen record, not an invoice.
 */

const INITIAL: PlanActionState = { status: 'idle', message: '' };

const OPTIONS: { status: MealStatus; label: string; icon: string }[] = [
  { status: 'cooked', label: 'Cooked it', icon: 'skillet' },
  { status: 'swapped', label: 'Made something else', icon: 'swap_horiz' },
  { status: 'skipped', label: "Didn't happen", icon: 'block' },
];

function StatusButton({
  option,
  active,
}: {
  option: (typeof OPTIONS)[number];
  active: boolean;
}) {
  // Three of these share one form, so scope the spinner to the pressed one.
  const value = active ? 'planned' : option.status;
  const { pending, thisOne } = useSubmitState('status', value);

  return (
    <button
      type="submit"
      name="status"
      value={value}
      disabled={pending}
      aria-pressed={active}
      className={clsx(
        'flex items-center gap-xs px-md py-2 rounded-full border text-[13px] font-semibold transition-colors disabled:opacity-60',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        active
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-outline-variant text-on-surface-variant hover:bg-surface-container'
      )}
    >
      <Icon
        name={thisOne ? 'progress_activity' : option.icon}
        className={clsx('text-[16px]', thisOne && 'animate-spin')}
      />
      {option.label}
    </button>
  );
}

function BailButton({ bailed }: { bailed: boolean }) {
  const { pending } = useSubmitState();

  return (
    <button
      type="submit"
      disabled={pending}
      className={clsx(
        'flex items-center gap-xs px-md py-2 rounded-full border text-[13px] font-semibold transition-colors disabled:opacity-60',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        bailed
          ? 'border-secondary bg-secondary-fixed/40 text-secondary'
          : 'border-outline-variant text-on-surface-variant hover:bg-surface-container'
      )}
    >
      <Icon
        name={pending ? 'progress_activity' : bailed ? 'undo' : 'person_off'}
        className={clsx('text-[16px]', pending && 'animate-spin')}
      />
      {bailed ? "I'm back in" : "I'm out"}
    </button>
  );
}

export function MealStatusControls({
  mealId,
  status,
  bailed,
}: {
  mealId: string;
  status: MealStatus;
  bailed: boolean;
}) {
  const [statusState, statusAction] = useFormState(setMealStatus, INITIAL);
  const [bailState, bailAction] = useFormState(bailFromMeal, INITIAL);
  const error = [statusState, bailState].find((state) => state.status === 'error');

  return (
    <div className="flex flex-col gap-xs">
      <div className="flex flex-wrap gap-xs">
        {OPTIONS.map((option) => (
          <form key={option.status} action={statusAction}>
            <input type="hidden" name="mealId" value={mealId} />
            <StatusButton option={option} active={status === option.status} />
          </form>
        ))}

        <form action={bailAction}>
          <input type="hidden" name="mealId" value={mealId} />
          <input type="hidden" name="undo" value={bailed ? 'true' : 'false'} />
          <BailButton bailed={bailed} />
        </form>
      </div>

      {bailed && (
        <p className="font-body-sm text-[12px] text-on-surface-variant">
          Your share of this meal stays yours — it was bought with your money and it&apos;s in the
          fridge. Nobody else&apos;s split moves.
        </p>
      )}

      {error && (
        <p role="alert" className="font-body-sm text-body-sm text-error">
          {error.message}
        </p>
      )}
    </div>
  );
}
