'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/media/Icon';
import { Button } from '@/components/ui/Button';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { sendSignupLink, type SignupState } from './actions';

const INITIAL: SignupState = { status: 'idle', message: '' };
const REDIRECT_DELAY_MS = 3000;

/**
 * Sign up form using magic-link email verification.
 *
 * After successful submission, displays "Check your inbox" message for 3 seconds
 * before auto-redirecting to instructions. User can click the button to skip the wait.
 *
 * Reuses the same OTP flow as login but always redirects to /onboarding/instructions
 * after the user verifies their email.
 */
export function SignupForm() {
  const [state, formAction] = useActionState(sendSignupLink, INITIAL);
  const [redirecting, setRedirecting] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(3);
  const router = useRouter();

  // Auto-redirect to instructions after 3 seconds when signup succeeds
  useEffect(() => {
    if (state.status === 'sent') {
      const interval = setInterval(() => {
        setCountdownSeconds((prev) => {
          if (prev <= 1) {
            setRedirecting(true);
            router.push('/onboarding/instructions');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      const timer = setTimeout(() => {
        setRedirecting(true);
        router.push('/onboarding/instructions');
      }, REDIRECT_DELAY_MS);

      return () => {
        clearInterval(interval);
        clearTimeout(timer);
      };
    }
  }, [state.status, router]);

  const handleContinue = () => {
    setRedirecting(true);
    router.push('/onboarding/instructions');
  };

  if (state.status === 'sent') {
    return (
      <div className="flex flex-col items-center text-center gap-sm px-md py-lg rounded-xl bg-surface-container-lowest border border-surface-container-highest shadow-ambient-card">
        <Icon name="mark_email_read" filled className="text-[40px] text-primary" />
        <p className="font-title-md text-title-md">Check your inbox</p>
        <p className="font-body-sm text-body-sm text-on-surface-variant">{state.message}</p>
        <Button
          onClick={handleContinue}
          variant="secondary"
          size="lg"
          fullWidth
          pending={redirecting}
          className="mt-sm"
        >
          I've verified my email
        </Button>
        <p className="font-body-xs text-body-xs text-on-surface-variant mt-sm">
          Or continue in {countdownSeconds}s…
        </p>
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
