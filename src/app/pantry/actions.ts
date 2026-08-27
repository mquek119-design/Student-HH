'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';
import { findOrCreateIngredient } from '@/lib/ingredients';

export interface PantryActionState {
  status: 'idle' | 'success' | 'error';
  message: string;
}

const fail = (message: string): PantryActionState => ({ status: 'error', message });

/** Marks a pantry item as used up (sets quantity_remaining = 0). */
export async function markPantryItemUsedUp(itemId: string): Promise<PantryActionState> {
  const me = await getCurrentUser();
  if (!me.houseId) return fail('Join a house first.');

  const supabase = await createClient();
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

  const supabase = await createClient();
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

/**
 * Adds something to the pantry.
 *
 * The pantry is what stops the optimiser buying things the house already has,
 * so it needs a way in beyond seeding — otherwise the subtraction step never
 * does anything for a real household.
 */
export async function addPantryItem(
  _prev: PantryActionState,
  formData: FormData
): Promise<PantryActionState> {
  const me = await getCurrentUser();
  if (!me.houseId) return { status: 'error', message: 'Join a house first.' };

  const name = String(formData.get('name') ?? '').trim();
  const quantity = Number.parseFloat(String(formData.get('quantity') ?? ''));
  const unit = String(formData.get('unit') ?? '').trim() || 'g';
  const isShared = String(formData.get('isShared') ?? 'true') === 'true';

  if (!name) return { status: 'error', message: 'Name the item.' };
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { status: 'error', message: 'Give a quantity above zero.' };
  }

  const supabase = await createClient();

  // Reuse the catalogue row when one exists, so pantry stock and recipe
  // ingredients refer to the same thing and the optimiser can match them.
  const resolved = await findOrCreateIngredient(supabase, {
    name,
    unit,
    category: 'cupboard',
  });
  if ('error' in resolved) {
    return { status: 'error', message: resolved.error };
  }
  const ingredientId = resolved.id;
  {
  }

  const inserted = await supabase.from('pantry_items').insert({
    house_id: me.houseId,
    ingredient_id: ingredientId,
    quantity_remaining: quantity,
    unit,
    is_shared: isShared,
    owner_user_id: isShared ? null : me.id,
  });

  if (inserted.error) return { status: 'error', message: inserted.error.message };

  revalidatePath('/pantry');
  revalidatePath('/recipes');
  revalidatePath('/basket');
  return { status: 'success', message: `Added ${name}.` };
}
