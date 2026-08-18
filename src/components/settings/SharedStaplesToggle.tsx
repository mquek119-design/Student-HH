'use client';

import { useFormState } from 'react-dom';
import { clsx } from '@/lib/clsx';
import { updateSharedStaples, type StapleActionState } from '@/app/settings/stapleActions';

const INITIAL: StapleActionState = { status: 'idle', message: '' };

/**
 * Whether household lines divide equally.
 *
 * Submits on change. The previous version of this control was a bare
 * `defaultChecked` checkbox with nothing behind it — it looked like a saved
 * setting and silently reset on every reload.
 */
export function SharedStaplesToggle({ enabled }: { enabled: boolean }) {
  const [state, action] = useFormState(updateSharedStaples, INITIAL);

  return (
    <form action={action} className="flex items-center justify-between gap-md">
      <div className="min-w-0">
        <p className="font-body-lg text-body-lg font-semibold">Split staples equally</p>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Oil, salt, washing-up liquid and similar are divided across everyone rather than
          charged to whoever&apos;s recipe called for them.
        </p>
        {state.status !== 'idle' && (
          <p
            role="status"
            className={clsx(
              'font-body-sm text-[12px] mt-xs',
              state.status === 'error' ? 'text-error' : 'text-primary'
            )}
          >
            {state.message}
          </p>
        )}
      </div>

      <label className="relative inline-flex items-center cursor-pointer shrink-0">
        <input
          type="checkbox"
          name="enabled"
          value="true"
          defaultChecked={enabled}
          onChange={(event) => event.currentTarget.form?.requestSubmit()}
          className="sr-only peer"
        />
        <span className="sr-only">Split shared staples equally</span>
        <span className="w-11 h-6 bg-surface-container-highest rounded-full peer peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-gray-300 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
      </label>
    </form>
  );
}
