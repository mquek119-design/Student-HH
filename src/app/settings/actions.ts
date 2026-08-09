'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';

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
