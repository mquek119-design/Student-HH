'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';

export async function updateFulfillmentSettings(
  method: 'collect' | 'delivery',
  postcode: string | null,
  collectStore: string
) {
  const me = await getCurrentUser();
  if (!me.houseId) throw new Error('Not in a house');

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
    throw new Error(`Failed to update fulfillment settings: ${error.message}`);
  }

  revalidatePath('/settings');
  revalidatePath('/basket');
}
