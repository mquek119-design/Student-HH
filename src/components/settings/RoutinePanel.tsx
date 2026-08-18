'use client';

import { useState, useTransition } from 'react';
import { Icon } from '@/components/media/Icon';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { updateCollector, updateCutoff } from '@/app/settings/actions';
import { WEEKDAYS, WEEKDAY_LABELS, type House, type User } from '@/lib/types';

const FIELD =
  'h-11 px-3 rounded-lg bg-surface-container-low border-none focus:ring-2 focus:ring-primary text-body-lg w-full';

/**
 * Editable house routine: the planning cutoff and who collects.
 *
 * Deliberately does NOT hold a delivery day or time. Those used to sit here as
 * read-only text, duplicating the Preferred Slot panel and contradicting the
 * slot actually booked on the Basket page — three places claiming to know when
 * the shop arrives, only one of which was true. The real answer is the booked
 * slot; the preference merely suggests one.
 */
export function RoutinePanel({
  house,
  housemates,
  collectorId,
}: {
  house: House;
  housemates: User[];
  collectorId: string | null;
}) {
  const [state, setState] = useState<{ status: string; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function saveCutoff(formData: FormData) {
    startTransition(async () => setState(await updateCutoff(formData)));
  }
  function saveCollector(formData: FormData) {
    startTransition(async () => setState(await updateCollector(formData)));
  }

  return (
    <Card className="flex flex-col gap-md">
      <div className="min-w-0">
        <h2 className="font-title-md text-title-md">House Routine</h2>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          When planning closes, and whose Tesco account places the order. The delivery time itself
          is whichever slot the collector books on the Basket tab.
        </p>
      </div>

      <form action={saveCutoff} className="flex flex-col gap-sm">
        <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
          Planning cutoff
        </span>
        <div className="flex items-end gap-sm">
          <select name="cutoffDay" defaultValue={house.cutoffDay} className={FIELD}>
            {WEEKDAYS.map((day) => (
              <option key={day} value={day}>
                {WEEKDAY_LABELS[day]}
              </option>
            ))}
          </select>
          <input
            type="time"
            name="cutoffTime"
            defaultValue={house.cutoffTime}
            aria-label="Cutoff time"
            className={`${FIELD} font-numeric-data`}
          />
          <Button
            type="submit"
            pending={pending}
            pendingLabel="Saving…"
            className="rounded-lg shrink-0"
          >
            Save
          </Button>
        </div>
        <span className="font-body-sm text-[12px] text-on-surface-variant">
          Meals lock at this point so the basket can be built from a settled plan.
        </span>
      </form>

      <form action={saveCollector} className="flex flex-col gap-sm">
        <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
          Collector
        </span>
        <div className="flex items-end gap-sm">
          <select name="collectorId" defaultValue={collectorId ?? ''} className={FIELD}>
            {housemates.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
          <Button
            type="submit"
            pending={pending}
            pendingLabel="Saving…"
            className="rounded-lg shrink-0"
          >
            Save
          </Button>
        </div>
        <span className="font-body-sm text-[12px] text-on-surface-variant">
          Rotates weekly. Only their Tesco account is used — the app never sees card details.
        </span>
      </form>

      {state && (
        <p
          role="status"
          className={`font-body-sm text-body-sm flex items-center gap-xs ${
            state.status === 'error' ? 'text-error' : 'text-primary'
          }`}
        >
          <Icon name={state.status === 'error' ? 'error' : 'check_circle'} className="text-[18px]" />
          {state.message}
        </p>
      )}
    </Card>
  );
}
