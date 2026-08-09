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

  const supabase = createClient();
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

  const supabase = createClient();
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
