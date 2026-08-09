'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { joinHouse, type OnboardingState } from '../actions';

const INITIAL: OnboardingState = { status: 'idle', message: '' };

const FIELD =
  'h-12 px-3 rounded-lg bg-surface-container-lowest border border-surface-container-highest focus:ring-2 focus:ring-primary focus:border-primary text-body-lg';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full h-12 rounded-lg bg-secondary-container text-on-primary font-title-md text-title-md flex items-center justify-center hover:bg-secondary transition-colors mt-sm disabled:opacity-60"
    >
      {pending ? 'Joining…' : 'Join House'}
    </button>
  );
}

export function JoinHouseForm({ defaultCode }: { defaultCode: string }) {
  const [state, formAction] = useFormState(joinHouse, INITIAL);

  return (
    <form action={formAction} className="flex flex-col gap-md">
      <label className="flex flex-col gap-xs">
        <span className="font-body-sm text-body-sm font-semibold">Invite code</span>
        <input
          name="code"
          required
          defaultValue={defaultCode}
          placeholder="ELLE-4482"
          autoCapitalize="characters"
          autoComplete="off"
          className={`${FIELD} font-numeric-data text-title-md tracking-widest uppercase`}
        />
      </label>

      <label className="flex flex-col gap-xs">
        <span className="font-body-sm text-body-sm font-semibold">Your name</span>
        <input name="name" required maxLength={60} placeholder="e.g. Maya" className={FIELD} />
      </label>

      {state.status === 'error' && (
        <p role="alert" className="font-body-sm text-body-sm text-error">
          {state.message}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
