'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';
import { findOrCreateIngredient } from '@/lib/ingredients';
import { STAPLE_INTERVAL_DAYS } from '@/lib/staples';
import type { StapleFrequency } from '@/lib/types';

export interface StapleActionState {
  status: 'idle' | 'error' | 'success';
  message: string;
}

const OK: StapleActionState = { status: 'idle', message: '' };
const fail = (message: string): StapleActionState => ({ status: 'error', message });

const MISSING_TABLE_HINT =
  ' — run supabase/migrations/0013_meal_lifecycle_and_staples.sql.';

function isMissingTable(code: string | undefined): boolean {
  return code === 'PGRST205' || code === '42P01';
}

/**
 * Adds a staple to the house's standing list.
 *
 * Staples are `ingredients` rows like everything else, so they price and
 * picture themselves through the same Tesco resolution as food. A separate
 * "products" concept for bin bags would mean a second code path for exactly
 * the same problem, and it would be the one nobody maintained.
 *
 * Category is forced to `household`: that is what makes the basket split it
 * equally across the house rather than attributing it to whoever's curry
 * happened to need it.
 */
export async function addStaple(
  _prev: StapleActionState,
  formData: FormData
): Promise<StapleActionState> {
  const me = await getCurrentUser();
  if (!me.houseId) return fail('Join a house first.');

  const name = String(formData.get('name') ?? '').trim();
  const rawFrequency = String(formData.get('frequency') ?? 'weekly');
  const frequency: StapleFrequency = (
    rawFrequency in STAPLE_INTERVAL_DAYS ? rawFrequency : 'weekly'
  ) as StapleFrequency;

  if (!name) return fail('Give it a name.');
  if (name.length > 80) return fail('That name is too long.');

  const supabase = createClient();

  const resolved = await findOrCreateIngredient(supabase, {
    name,
    unit: 'each',
    category: 'household',
  });
  if ('error' in resolved) return fail(resolved.error);
  const ingredientId = resolved.id;

  const added = await supabase
    .from('house_staples')
    .insert({ house_id: me.houseId, ingredient_id: ingredientId, frequency });

  if (added.error) {
    if (added.error.code === '23505') return fail(`${name} is already on the list.`);
    return fail(`${added.error.message}${isMissingTable(added.error.code) ? MISSING_TABLE_HINT : ''}`);
  }

  revalidatePath('/settings');
  revalidatePath('/basket');
  return { status: 'success', message: `${name} added.` };
}

/** Changes how often a staple comes back. */
export async function updateStapleFrequency(
  _prev: StapleActionState,
  formData: FormData
): Promise<StapleActionState> {
  const me = await getCurrentUser();
  if (!me.houseId) return fail('Join a house first.');

  const id = String(formData.get('stapleId') ?? '');
  const rawFrequency = String(formData.get('frequency') ?? '');
  if (!id) return fail('Missing staple.');
  if (!(rawFrequency in STAPLE_INTERVAL_DAYS)) return fail('Unknown frequency.');

  const supabase = createClient();
  const updated = await supabase
    .from('house_staples')
    .update({ frequency: rawFrequency as StapleFrequency })
    .eq('id', id)
    .eq('house_id', me.houseId);

  if (updated.error) return fail(updated.error.message);

  revalidatePath('/settings');
  revalidatePath('/basket');
  return OK;
}

/** Removes a staple. The ingredient row stays — other houses may use it. */
export async function removeStaple(
  _prev: StapleActionState,
  formData: FormData
): Promise<StapleActionState> {
  const me = await getCurrentUser();
  if (!me.houseId) return fail('Join a house first.');

  const id = String(formData.get('stapleId') ?? '');
  if (!id) return fail('Missing staple.');

  const supabase = createClient();
  const removed = await supabase
    .from('house_staples')
    .delete()
    .eq('id', id)
    .eq('house_id', me.houseId);

  if (removed.error) return fail(removed.error.message);

  revalidatePath('/settings');
  revalidatePath('/basket');
  return OK;
}

/**
 * Turns equal splitting of household lines on or off.
 *
 * This toggle has existed on the settings page since the first build and was
 * never wired to anything: a bare `defaultChecked` checkbox with no form, no
 * action and no handler. It read as a saved preference and was not one. Now it
 * writes, which matters more than it used to — it decides whether the staples
 * list below it divides equally or gets attributed like food.
 */
export async function updateSharedStaples(
  _prev: StapleActionState,
  formData: FormData
): Promise<StapleActionState> {
  const me = await getCurrentUser();
  if (!me.houseId) return fail('Join a house first.');

  const enabled = String(formData.get('enabled') ?? '') === 'true';

  const supabase = createClient();
  const updated = await supabase
    .from('houses')
    .update({ shared_staples_enabled: enabled })
    .eq('id', me.houseId);

  if (updated.error) return fail(updated.error.message);

  revalidatePath('/settings');
  revalidatePath('/basket');
  revalidatePath('/split');
  return {
    status: 'success',
    message: enabled
      ? 'Household items will be split equally.'
      : 'Household items will be attributed like food.',
  };
}
