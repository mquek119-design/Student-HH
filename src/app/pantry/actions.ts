'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';

export interface PantryActionState {
  status: 'idle' | 'success' | 'error';
  message: string;
}

const fail = (message: string): PantryActionState => ({ status: 'error', message });

/** Marks a pantry item as used up (sets quantity_remaining = 0). */
export async function markPantryItemUsedUp(itemId: string): Promise<PantryActionState> {
  const me = await getCurrentUser();
  if (!me.houseId) return fail('Join a house first.');

  const supabase = createClient();
  const { error } = await supabase
    .from('pantry_items')
    .update({ quantity_remaining: 0, low_stock: true })
    .eq('id', itemId)
    .eq('house_id', me.houseId);

  if (error) return fail(error.message);

  revalidatePath('/pantry');
  revalidatePath('/basket');
  revalidatePath('/plan');

  return { status: 'success', message: 'Pantry item marked as used up.' };
}

/** Flags a pantry item as low stock so it gets added to the next shop. */
export async function addPantryItemToBasket(itemId: string): Promise<PantryActionState> {
  const me = await getCurrentUser();
  if (!me.houseId) return fail('Join a house first.');

  const supabase = createClient();
  const { error } = await supabase
    .from('pantry_items')
    .update({ low_stock: true })
    .eq('id', itemId)
    .eq('house_id', me.houseId);

  if (error) return fail(error.message);

  revalidatePath('/pantry');
  revalidatePath('/basket');
  revalidatePath('/plan');

  return { status: 'success', message: 'Item flagged to restock.' };
}
