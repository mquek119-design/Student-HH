'use server';

import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export interface SignupState {
  status: 'idle' | 'sent' | 'error';
  message: string;
}

/**
 * Send signup magic link.
 *
 * Redirects to the `next` URL after email verification (default: /onboarding/instructions).
 * This allows signup to be chained with other flows like invites.
 *
 * Example: /onboarding/signup?next=/onboarding/join?code=ABC123
 */
export async function sendSignupLink(
  _prev: SignupState,
  formData: FormData
): Promise<SignupState> {
  if (!isSupabaseConfigured) {
    return {
      status: 'error',
      message: 'Supabase is not configured yet — the app is running on fixtures.',
    };
  }

  const email = String(formData.get('email') ?? '').trim();
  const next = String(formData.get('next') ?? '/onboarding/instructions');

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { status: 'error', message: 'Enter a valid email address.' };
  }

  const origin = (await headers()).get('origin') ?? '';
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    return { status: 'error', message: error.message };
  }

  return { status: 'sent', message: `Check ${email} for your sign-up link.` };
}
