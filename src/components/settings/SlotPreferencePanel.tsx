'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { updateSlotPreference } from '@/app/settings/actions';
import { WEEKDAYS, WEEKDAY_LABELS, type House } from '@/lib/types';

const FIELD =
  'h-11 px-3 rounded-lg bg-surface-container-low border-none focus:ring-2 focus:ring-primary text-body-lg w-full';

/**
 * Optional slot preference.
 *
 * Emphatically optional: a household that never opens this still gets a working
 * picker. All this does is let the basket *suggest* a slot — the collector
 * always selects one themselves, so a stale or half-filled preference can never
 * book the wrong thing.
 */
export function SlotPreferencePanel({ house }: { house: House }) {
  const [state, setState] = useState<{ status: string; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const preference = house.slotPreference;
  const hasAny = Boolean(
    preference.method || preference.day || (preference.windowStart && preference.windowEnd)
  );

  function save(formData: FormData) {
    startTransition(async () => setState(await updateSlotPreference(formData)));
  }

  return (
    <Card className="flex flex-col gap-md">
      <div className="flex items-start justify-between gap-md">
        <div className="min-w-0">
          <h2 className="font-title-md text-title-md">Preferred Slot</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Optional. If set, the basket highlights the closest matching slot — you still choose it
            yourself. Leave blank to browse every slot each week.
          </p>
        </div>
        {hasAny && (
          <span className="shrink-0 font-label-caps text-label-caps uppercase text-primary">
            Set
          </span>
        )}
      </div>

      <form action={save} className="flex flex-col gap-md">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
          <label className="flex flex-col gap-xs">
            <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
              Method
            </span>
            <select
              name="preferredMethod"
              defaultValue={preference.method ?? ''}
              className={FIELD}
            >
              <option value="">No preference</option>
              <option value="delivery">Delivery</option>
              <option value="collect">Click &amp; Collect</option>
            </select>
          </label>

          <label className="flex flex-col gap-xs">
            <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
              Day
            </span>
            <select name="preferredDay" defaultValue={preference.day ?? ''} className={FIELD}>
              <option value="">No preference</option>
              {WEEKDAYS.map((day) => (
                <option key={day} value={day}>
                  {WEEKDAY_LABELS[day]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <fieldset className="flex flex-col gap-xs">
          <legend className="font-label-caps text-label-caps uppercase text-on-surface-variant mb-xs">
            Time window
          </legend>
          <div className="flex items-center gap-sm">
            <input
              type="time"
              name="windowStart"
              defaultValue={preference.windowStart ?? ''}
              aria-label="Window start"
              className={`${FIELD} font-numeric-data`}
            />
            <span className="font-body-sm text-body-sm text-on-surface-variant shrink-0">to</span>
            <input
              type="time"
              name="windowEnd"
              defaultValue={preference.windowEnd ?? ''}
              aria-label="Window end"
              className={`${FIELD} font-numeric-data`}
            />
          </div>
          <span className="font-body-sm text-[12px] text-on-surface-variant">
            Both or neither — a half window can&apos;t be matched against.
          </span>
        </fieldset>

        <Button
          type="submit"
          icon="check"
          pending={pending}
          pendingLabel="Saving…"
          className="self-start"
        >
          Save preference
        </Button>

        {state && (
          <p
            role="status"
            className={`font-body-sm text-body-sm ${
              state.status === 'error' ? 'text-error' : 'text-primary'
            }`}
          >
            {state.message}
          </p>
        )}
      </form>
    </Card>
  );
}
