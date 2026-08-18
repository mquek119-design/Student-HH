'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';

export interface LeftoverActionState {
  status: 'idle' | 'error' | 'success';
  message: string;
}

const OK: LeftoverActionState = { status: 'idle', message: '' };
const fail = (message: string): LeftoverActionState => ({ status: 'error', message });

/** Default shelf life. Long enough to be useful, short enough to stay honest. */
const DEFAULT_DAYS = 3;

/**
 * Puts a dish on the board.
 *
 * `eat_by` is stored rather than computed, because the window genuinely differs
 * per dish: a chilli keeps, a fish pie does not. The form offers 2, 3 or 5 days
 * and the cook picks.
 */
export async function addLeftover(
  _prev: LeftoverActionState,
  formData: FormData
): Promise<LeftoverActionState> {
  const me = await getCurrentUser();
  if (!me.houseId) return fail('Join a house first.');

  const description = String(formData.get('description') ?? '').trim();
  if (!description) return fail('What is it?');
  if (description.length > 80) return fail('Keep it under 80 characters.');

  const portions = Number(formData.get('portions') ?? 1);
  if (!Number.isInteger(portions) || portions < 1 || portions > 20) {
    return fail('Between 1 and 20 portions.');
  }

  const days = Number(formData.get('days') ?? DEFAULT_DAYS);
  const shelfLife = [2, 3, 5].includes(days) ? days : DEFAULT_DAYS;

  const madeOn = new Date();
  const eatBy = new Date(madeOn);
  eatBy.setDate(eatBy.getDate() + shelfLife);

  const supabase = createClient();
  const added = await supabase.from('leftovers').insert({
    house_id: me.houseId,
    created_by: me.id,
    description,
    portions,
    made_on: madeOn.toISOString().slice(0, 10),
    eat_by: eatBy.toISOString().slice(0, 10),
  });

  if (added.error) {
    const hint =
      added.error.code === 'PGRST205' || added.error.code === '42P01'
        ? ' — run supabase/migrations/0014_guests_expenses_leftovers.sql.'
        : '';
    return fail(`${added.error.message}${hint}`);
  }

  revalidatePath('/pantry');
  revalidatePath('/');
  return { status: 'success', message: `${description} is on the board.` };
}

/**
 * Claims or bins a dish. Either way the row goes.
 *
 * No "claimed by" bookkeeping: a claimed leftover is a plate of food and no
 * longer anybody's business. Anyone can remove anything — this is a note on a
 * fridge door, and permissions on a fridge door are theatre.
 */
export async function clearLeftover(
  _prev: LeftoverActionState,
  formData: FormData
): Promise<LeftoverActionState> {
  const me = await getCurrentUser();
  if (!me.houseId) return fail('Join a house first.');

  const id = String(formData.get('leftoverId') ?? '');
  if (!id) return fail('Missing item.');

  const supabase = createClient();
  const removed = await supabase
    .from('leftovers')
    .delete()
    .eq('id', id)
    .eq('house_id', me.houseId);

  if (removed.error) return fail(removed.error.message);

  revalidatePath('/pantry');
  revalidatePath('/');
  return OK;
}
