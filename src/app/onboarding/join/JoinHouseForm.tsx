'use client';

import { useActionState, useState } from 'react';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { joinHouse, type OnboardingState } from '../actions';

const INITIAL: OnboardingState = { status: 'idle', message: '' };

const FIELD =
  'h-12 px-3 rounded-lg bg-surface-container-lowest border border-surface-container-highest focus:ring-2 focus:ring-primary focus:border-primary text-body-lg';

export function JoinHouseForm({ defaultCode }: { defaultCode: string }) {
  const [state, formAction] = useActionState(joinHouse, INITIAL);
  const [code, setCode] = useState(defaultCode);
  const [name, setName] = useState('');

  return (
    <form action={formAction} className="flex flex-col gap-md">
      <label className="flex flex-col gap-xs">
        <span className="font-body-sm text-body-sm font-semibold">
          Invite code <span aria-hidden="true" className="text-error">*</span>
        </span>
        <input
          name="code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
          aria-required="true"
          placeholder="ELLE-4482"
          autoCapitalize="characters"
          autoComplete="off"
          className={`${FIELD} font-numeric-data text-title-md tracking-widest uppercase`}
        />
      </label>

      <label className="flex flex-col gap-xs">
        <span className="font-body-sm text-body-sm font-semibold">
          Your name <span aria-hidden="true" className="text-error">*</span>
        </span>
        <input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          aria-required="true"
          maxLength={60}
          placeholder="e.g. Maya"
          className={FIELD}
        />
      </label>

      {state.status === 'error' && (
        <p role="alert" className="font-body-sm text-body-sm text-error">
          {state.message}
        </p>
      )}

      <SubmitButton variant="secondary" size="lg" fullWidth className="mt-sm" pendingLabel="Joining…">
        Join House
      </SubmitButton>
    </form>
  );
}
