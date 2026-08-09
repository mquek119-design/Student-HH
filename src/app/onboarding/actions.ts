'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { WEEKDAYS, type Weekday } from '@/lib/types';

export interface OnboardingState {
  status: 'idle' | 'error';
  message: string;
}

function asWeekday(value: FormDataEntryValue | null, fallback: Weekday): Weekday {
  const raw = String(value ?? '');
  return (WEEKDAYS as string[]).includes(raw) ? (raw as Weekday) : fallback;
}

/**
 * Creates the house and makes the caller its admin and first collector.
 *
 * Both halves happen inside the `create_house` SQL function so a failure can't
 * leave an orphan house with no members.
 */
export async function createHouse(
  _prev: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  if (!isSupabaseConfigured) {
    return { status: 'error', message: 'Supabase is not configured yet.' };
  }

  const name = String(formData.get('name') ?? '').trim();
  if (name.length < 1 || name.length > 60) {
    return { status: 'error', message: 'Give your house a name (1–60 characters).' };
  }

  const cutoffTimeRaw = String(formData.get('cutoffTime') ?? '17:00');
  const cutoffTime = /^\d{2}:\d{2}$/.test(cutoffTimeRaw) ? cutoffTimeRaw : '17:00';

  const supabase = createClient();
  const { error } = await supabase.rpc('create_house', {
    p_name: name,
    p_delivery_day: asWeekday(formData.get('deliveryDay'), 'mon'),
    p_cutoff_day: asWeekday(formData.get('cutoffDay'), 'sun'),
    p_cutoff_time: cutoffTime,
  });

  if (error) {
    return { status: 'error', message: error.message };
  }

  revalidatePath('/', 'layout');
  redirect('/onboarding/invite');
}

/**
 * Joins an existing house by invite code.
 *
 * `join_house` returns null rather than raising on a bad code, so the response
 * is identical whether the code is malformed or simply does not exist — a
 * caller cannot use this to enumerate valid codes.
 */
export async function joinHouse(
  _prev: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  if (!isSupabaseConfigured) {
    return { status: 'error', message: 'Supabase is not configured yet.' };
  }

  const code = String(formData.get('code') ?? '').trim();
  if (!code) {
    return { status: 'error', message: 'Enter the invite code your housemate shared.' };
  }

  const supabase = createClient();
  const { data, error } = await supabase.rpc('join_house', { p_invite_code: code });

  if (error) {
    return { status: 'error', message: error.message };
  }
  if (!data) {
    return { status: 'error', message: "That code doesn't match a house. Check it and try again." };
  }

  const name = String(formData.get('name') ?? '').trim();
  if (name) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('profiles').update({ name }).eq('id', user.id);
    }
  }

  revalidatePath('/', 'layout');
  redirect('/');
}

export async function signOut(): Promise<void> {
  if (isSupabaseConfigured) {
    const supabase = createClient();
    await supabase.auth.signOut();
  }
  revalidatePath('/', 'layout');
  redirect('/login');
}
