'use client';

import { useActionState } from 'react';
import { Icon } from '@/components/media/Icon';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { sendSignupLink, type SignupState } from './actions';

const INITIAL: SignupState = { status: 'idle', message: '' };

/**
 * Sign up form using magic-link email verification.
 *
 * Reuses the same OTP flow as login but always redirects to /onboarding/instructions
 * after the user verifies their email.
 */
export function SignupForm() {
  const [state, formAction] = useActionState(sendSignupLink, INITIAL);

  if (state.status === 'sent') {
    return (
      <div className="flex flex-col items-center text-center gap-sm px-md py-lg rounded-xl bg-surface-container-lowest border border-surface-container-highest shadow-ambient-card">
        <Icon name="mark_email_read" filled className="text-[40px] text-primary" />
        <p className="font-title-md text-title-md">Check your inbox</p>
        <p className="font-body-sm text-body-sm text-on-surface-variant">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-md">
      <label className="flex flex-col gap-xs">
        <span className="font-body-sm text-body-sm font-semibold">Email</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="you@university.ac.uk"
          className="h-12 px-3 rounded-lg bg-surface-container-lowest border border-surface-container-highest focus:ring-2 focus:ring-primary focus:border-primary text-body-lg"
        />
      </label>

      {state.status === 'error' && (
        <p role="alert" className="font-body-sm text-body-sm text-error">
          {state.message}
        </p>
      )}

      <SubmitButton variant="secondary" size="lg" fullWidth icon="mail" pendingLabel="Sending…">
        Email me a link
      </SubmitButton>
    </form>
  );
}
