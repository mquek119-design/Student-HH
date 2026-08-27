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
 * Identical to login but always redirects to /onboarding/instructions after
 * email verification, so new users see the "how Grub works" education page
 * before creating their house.
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

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { status: 'error', message: 'Enter a valid email address.' };
  }

  const origin = headers().get('origin') ?? '';
  const supabase = createClient();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent('/onboarding/instructions')}`,
    },
  });

  if (error) {
    return { status: 'error', message: error.message };
  }

  return { status: 'sent', message: `Check ${email} for your sign-up link.` };
}
