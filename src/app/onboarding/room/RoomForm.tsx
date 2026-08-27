'use client';

import { useFormState } from 'react-dom';
import Link from 'next/link';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { setRoomAndContinue, type OnboardingState } from '../actions';

const INITIAL: OnboardingState = { status: 'idle', message: '' };

const FIELD =
  'h-12 px-3 rounded-lg bg-surface-container-lowest border border-surface-container-highest focus:ring-2 focus:ring-primary focus:border-primary text-body-lg';

export function RoomForm() {
  const [state, formAction] = useFormState(setRoomAndContinue, INITIAL);

  return (
    <form action={formAction} className="flex flex-col gap-md">
      <label className="flex flex-col gap-xs">
        <span className="font-body-sm text-body-sm font-semibold">Your room</span>
        <input
          type="text"
          name="room"
          placeholder="e.g. Room 1, 2B, Master Bedroom"
          maxLength={60}
          className={FIELD}
        />
      </label>

      <p className="font-body-sm text-body-sm text-on-surface-variant">
        Optional — leave blank if you don't have a room number or prefer to add it later.
      </p>

      {state.status === 'error' && (
        <p role="alert" className="font-body-sm text-body-sm text-error">
          {state.message}
        </p>
      )}

      <div className="flex flex-col gap-sm">
        <SubmitButton variant="secondary" size="lg" fullWidth className="mt-sm" pendingLabel="Saving…">
          Save and Continue
        </SubmitButton>
        <Link
          href="/onboarding/invite"
          className="w-full h-12 rounded-lg border border-primary text-primary font-title-md text-title-md flex items-center justify-center hover:bg-primary/10 transition-colors"
        >
          Skip for now
        </Link>
      </div>
    </form>
  );
}
