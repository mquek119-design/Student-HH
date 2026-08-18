'use client';

import { useFormState } from 'react-dom';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { WEEKDAYS, WEEKDAY_LABELS } from '@/lib/types';
import { createHouse, type OnboardingState } from '../actions';

const INITIAL: OnboardingState = { status: 'idle', message: '' };

const FIELD =
  'h-12 px-3 rounded-lg bg-surface-container-lowest border border-surface-container-highest focus:ring-2 focus:ring-primary focus:border-primary text-body-lg';

export function CreateHouseForm() {
  const [state, formAction] = useFormState(createHouse, INITIAL);

  return (
    <form action={formAction} className="flex flex-col gap-md">
      <label className="flex flex-col gap-xs">
        <span className="font-body-sm text-body-sm font-semibold">House name</span>
        <input name="name" required maxLength={60} placeholder="e.g. Ellesmere Road" className={FIELD} />
      </label>

      <label className="flex flex-col gap-xs">
        <span className="font-body-sm text-body-sm font-semibold">Delivery day</span>
        <select name="deliveryDay" defaultValue="mon" className={FIELD}>
          {WEEKDAYS.map((day) => (
            <option key={day} value={day}>
              {WEEKDAY_LABELS[day]}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-md">
        <label className="flex flex-col gap-xs">
          <span className="font-body-sm text-body-sm font-semibold">Cutoff day</span>
          <select name="cutoffDay" defaultValue="sun" className={FIELD}>
            {WEEKDAYS.map((day) => (
              <option key={day} value={day}>
                {WEEKDAY_LABELS[day]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-xs">
          <span className="font-body-sm text-body-sm font-semibold">Cutoff time</span>
          <input
            type="time"
            name="cutoffTime"
            defaultValue="17:00"
            className={`${FIELD} font-numeric-data`}
          />
        </label>
      </div>

      <p className="font-body-sm text-body-sm text-on-surface-variant">
        Planning locks at the cutoff. The optimiser then builds one basket from everyone&apos;s
        picks.
      </p>

      {state.status === 'error' && (
        <p role="alert" className="font-body-sm text-body-sm text-error">
          {state.message}
        </p>
      )}

      <SubmitButton variant="secondary" size="lg" fullWidth className="mt-sm" pendingLabel="Creating…">
        Create House
      </SubmitButton>
    </form>
  );
}
