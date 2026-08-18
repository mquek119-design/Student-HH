'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { IconSubmitButton, SubmitButton } from '@/components/ui/SubmitButton';
import { clsx } from '@/lib/clsx';
import {
  addStaple,
  removeStaple,
  updateStapleFrequency,
  type StapleActionState,
} from '@/app/settings/stapleActions';
import { STAPLE_FREQUENCY_LABELS, daysUntilStapleDue } from '@/lib/staples';
import type { HouseStaple, StapleFrequency } from '@/lib/types';

/**
 * The house's standing list of non-food essentials.
 *
 * `shared_staples_enabled` has existed since the first migration, but all it
 * ever did was change how a household basket line was *split* — and nothing
 * ever created one, because recipes do not call for bin bags. This is the half
 * that was missing: the list that puts them in the basket in the first place.
 */

const INITIAL: StapleActionState = { status: 'idle', message: '' };

const FREQUENCIES: StapleFrequency[] = ['weekly', 'fortnightly', 'monthly'];

const SUGGESTIONS = [
  'Toilet roll',
  'Bin bags',
  'Washing up liquid',
  'Kitchen roll',
  'Sponges',
  'Hand soap',
];

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" icon="add" pending={pending} className="shrink-0">
      Add
    </Button>
  );
}

function FrequencySelect({ staple }: { staple: HouseStaple }) {
  const [, action] = useFormState(updateStapleFrequency, INITIAL);
  return (
    <form action={action}>
      <input type="hidden" name="stapleId" value={staple.id} />
      <select
        name="frequency"
        defaultValue={staple.frequency}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="h-9 pl-2 pr-6 rounded-full bg-surface-container-low border-none text-[13px] font-semibold text-on-surface-variant focus:ring-2 focus:ring-primary"
      >
        {FREQUENCIES.map((frequency) => (
          <option key={frequency} value={frequency}>
            {STAPLE_FREQUENCY_LABELS[frequency]}
          </option>
        ))}
      </select>
    </form>
  );
}

function RemoveButton({ stapleId }: { stapleId: string }) {
  const [, action] = useFormState(removeStaple, INITIAL);
  return (
    <form action={action}>
      <input type="hidden" name="stapleId" value={stapleId} />
      <IconSubmitButton label="Remove staple" />
    </form>
  );
}

export function StaplesPanel({
  staples,
  splitEqually,
}: {
  staples: HouseStaple[];
  /** Mirrors `houses.shared_staples_enabled`, the toggle directly above. */
  splitEqually: boolean;
}) {
  const [state, action] = useFormState(addStaple, INITIAL);

  return (
    <div className="flex flex-col gap-sm">
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        Things the house always needs. Each one is added to the basket automatically when it&apos;s
        due, and{' '}
        {splitEqually
          ? 'split equally across everyone.'
          : 'attributed like any other item — turn on the toggle above to split them equally.'}
      </p>

      {staples.length > 0 && (
        <ul className="flex flex-col divide-y divide-surface-container-highest">
          {staples.map((staple) => {
            const days = daysUntilStapleDue(staple.frequency, staple.lastAddedOn);
            return (
              <li key={staple.id} className="py-sm flex items-center justify-between gap-sm">
                <div className="min-w-0 flex flex-col gap-xs">
                  <span className="flex items-center gap-xs min-w-0">
                    <span className="font-body-lg text-body-lg font-semibold truncate">
                      {staple.name}
                    </span>
                    {staple.due && <Badge tone="solid-primary">DUE</Badge>}
                  </span>
                  <span className="font-body-sm text-[12px] text-on-surface-variant">
                    {staple.due
                      ? staple.lastAddedOn
                        ? `Last added ${staple.lastAddedOn}`
                        : 'Never added — goes in the next basket'
                      : `Back in ${days} day${days === 1 ? '' : 's'}`}
                  </span>
                </div>

                <div className="flex items-center gap-xs shrink-0">
                  <FrequencySelect staple={staple} />
                  <RemoveButton stapleId={staple.id} />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <form action={action} className="flex flex-col gap-sm">
        <div className="flex gap-sm">
          <input
            name="name"
            required
            maxLength={80}
            placeholder="Toilet roll"
            className="flex-1 min-w-0 h-11 px-3 rounded-lg bg-surface-container-low border-none focus:ring-2 focus:ring-primary text-body-lg"
          />
          <select
            name="frequency"
            defaultValue="weekly"
            className="h-11 pl-2 pr-6 rounded-lg bg-surface-container-low border-none text-[13px] font-semibold text-on-surface-variant focus:ring-2 focus:ring-primary"
          >
            {FREQUENCIES.map((frequency) => (
              <option key={frequency} value={frequency}>
                {STAPLE_FREQUENCY_LABELS[frequency]}
              </option>
            ))}
          </select>
          <AddButton />
        </div>

        {staples.length === 0 && (
          <div className="flex flex-wrap gap-xs">
            {/* One form, many submits — `name`/`value` keep the spinner on the
                suggestion actually tapped rather than lighting all six. */}
            {SUGGESTIONS.map((suggestion) => (
              <SubmitButton
                key={suggestion}
                name="name"
                value={suggestion}
                variant="outline"
                size="sm"
                icon="add"
              >
                {suggestion}
              </SubmitButton>
            ))}
          </div>
        )}

        {state.status !== 'idle' && (
          <p
            role="status"
            className={clsx(
              'font-body-sm text-body-sm',
              state.status === 'error' ? 'text-error' : 'text-primary'
            )}
          >
            {state.message}
          </p>
        )}
      </form>
    </div>
  );
}
