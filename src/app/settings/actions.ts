'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';
import { WEEKDAYS, type Weekday } from '@/lib/types';

export async function updateFulfillmentSettings(
  method: 'collect' | 'delivery',
  postcode: string | null,
  collectStore: string
): Promise<{ status: 'success' | 'error'; message: string }> {
  const me = await getCurrentUser();
  if (!me.houseId) return { status: 'error', message: 'Not in a house.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('houses')
    .update({
      fulfillment_method: method,
      delivery_postcode: postcode,
      click_collect_store: collectStore || 'coventry cannon park rear car park 1',
    })
    .eq('id', me.houseId);

  if (error) {
    if (error.message.includes('fulfillment_method')) {
      return {
        status: 'error',
        message: `Failed to save: columns are missing in database. Please run the SQL migration inside "supabase/migrations/0005_fulfillment_settings.sql" in your Supabase SQL editor.`,
      };
    }
    return { status: 'error', message: `Failed to update fulfillment settings: ${error.message}` };
  }

  revalidatePath('/settings');
  revalidatePath('/basket');
  return { status: 'success', message: 'Fulfillment settings updated successfully!' };
}

/**
 * Saves the house's optional slot preference.
 *
 * Every field is genuinely optional and an empty form clears the lot. This only
 * ever pre-suggests a slot in the picker — the collector still selects one, so
 * a household that ignores this screen loses nothing.
 */
export async function updateSlotPreference(formData: FormData) {
  const me = await getCurrentUser();
  if (!me.houseId) return { status: 'error' as const, message: 'Join a house first.' };

  const raw = (key: string) => {
    const value = String(formData.get(key) ?? '').trim();
    return value === '' ? null : value;
  };

  const method = raw('preferredMethod');
  const day = raw('preferredDay');
  const start = raw('windowStart');
  const end = raw('windowEnd');

  if (method !== null && method !== 'delivery' && method !== 'collect') {
    return { status: 'error' as const, message: 'Unrecognised fulfilment preference.' };
  }
  if (day !== null && !(WEEKDAYS as string[]).includes(day)) {
    return { status: 'error' as const, message: 'Unrecognised day.' };
  }
  // The DB enforces this too; catching it here gives a readable message.
  if ((start === null) !== (end === null)) {
    return {
      status: 'error' as const,
      message: 'Give both ends of the time window, or leave both blank.',
    };
  }
  if (start !== null && end !== null && start >= end) {
    return { status: 'error' as const, message: 'The window must end after it starts.' };
  }

  const supabase = await createClient();
  const result = await supabase
    .from('houses')
    .update({
      preferred_fulfillment_method: method as 'delivery' | 'collect' | null,
      preferred_day: day as Weekday | null,
      preferred_window_start: start,
      preferred_window_end: end,
    })
    .eq('id', me.houseId);

  if (result.error) {
    const hint =
      result.error.code === '42703'
        ? ' — run supabase/migrations/0010_slot_preferences.sql.'
        : '';
    return { status: 'error' as const, message: `${result.error.message}${hint}` };
  }

  revalidatePath('/settings');
  revalidatePath('/basket');
  return {
    status: 'success' as const,
    message:
      method || day || start
        ? 'Preference saved. The basket will suggest a matching slot.'
        : 'Preference cleared. The slot picker will open empty.',
  };
}

/**
 * Saves the planning cutoff — the only part of the old "Delivery Routine" that
 * is still meaningful.
 *
 * Delivery day and time used to live here too, duplicating the Preferred Slot
 * panel and, worse, disagreeing with it: the real delivery time is whatever
 * slot the collector books, not a value typed on a settings screen. Two places
 * claiming to hold the same fact is how a house ends up trusting the wrong one.
 */
export async function updateCutoff(formData: FormData) {
  const me = await getCurrentUser();
  if (!me.houseId) return { status: 'error' as const, message: 'Join a house first.' };

  const day = String(formData.get('cutoffDay') ?? '');
  const time = String(formData.get('cutoffTime') ?? '');

  if (!(WEEKDAYS as string[]).includes(day)) {
    return { status: 'error' as const, message: 'Pick a valid day.' };
  }
  if (!/^\d{2}:\d{2}$/.test(time)) {
    return { status: 'error' as const, message: 'Pick a valid time.' };
  }

  const supabase = await createClient();
  const result = await supabase
    .from('houses')
    .update({ cutoff_day: day as Weekday, cutoff_time: time })
    .eq('id', me.houseId);

  if (result.error) return { status: 'error' as const, message: result.error.message };

  revalidatePath('/settings');
  revalidatePath('/plan');
  revalidatePath('/');
  return { status: 'success' as const, message: 'Cutoff updated.' };
}

/** Hands the collector role to another housemate. */
export async function updateCollector(formData: FormData) {
  const me = await getCurrentUser();
  if (!me.houseId) return { status: 'error' as const, message: 'Join a house first.' };

  const collectorId = String(formData.get('collectorId') ?? '').trim();
  if (!collectorId) return { status: 'error' as const, message: 'Pick a housemate.' };

  const supabase = await createClient();
  const result = await supabase
    .from('houses')
    .update({ collector_user_id: collectorId })
    .eq('id', me.houseId);

  if (result.error) return { status: 'error' as const, message: result.error.message };

  revalidatePath('/settings');
  revalidatePath('/basket');
  revalidatePath('/split');
  return { status: 'success' as const, message: 'Collector updated.' };
}
