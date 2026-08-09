'use server';

import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export interface LoginState {
  status: 'idle' | 'sent' | 'error';
  message: string;
}

/**
 * Magic-link sign-in.
 *
 * Chosen over passwords deliberately: students share houses, not password
 * managers, and a link to a university inbox is the lowest-friction path that
 * still proves control of the address. No password means no password reset
 * flow and nothing to leak.
 */
export async function sendMagicLink(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  if (!isSupabaseConfigured) {
    return {
      status: 'error',
      message: 'Supabase is not configured yet — the app is running on fixtures.',
    };
  }

  const email = String(formData.get('email') ?? '').trim();
  const next = String(formData.get('next') ?? '/');

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { status: 'error', message: 'Enter a valid email address.' };
  }

  const origin = headers().get('origin') ?? '';
  const supabase = createClient();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    return { status: 'error', message: error.message };
  }

  return { status: 'sent', message: `Check ${email} for your sign-in link.` };
}
