'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';
import type { SubstitutionDecision } from '@/lib/types';

export interface SplitActionState {
  status: 'idle' | 'success' | 'error';
  message: string;
}

const fail = (message: string): SplitActionState => ({ status: 'error', message });

/** Notifies collector that payment was sent (status = 'notified'). */
export async function notifyPaymentSent(splitId: string): Promise<SplitActionState> {
  const me = await getCurrentUser();
  if (!me.houseId) return fail('Join a house first.');

  const supabase = createClient();
  const { error } = await supabase
    .from('splits')
    .update({ status: 'notified' })
    .eq('id', splitId)
    .eq('from_user_id', me.id);

  if (error) return fail(error.message);

  revalidatePath('/split');
  revalidatePath('/split/balances');
  revalidatePath('/');

  return { status: 'success', message: 'Payment notification sent.' };
}

/** Resets payment status to 'pending'. */
export async function undoPaymentNotification(splitId: string): Promise<SplitActionState> {
  const me = await getCurrentUser();
  if (!me.houseId) return fail('Join a house first.');

  const supabase = createClient();
  const { error } = await supabase
    .from('splits')
    .update({ status: 'pending' })
    .eq('id', splitId)
    .eq('from_user_id', me.id);

  if (error) return fail(error.message);

  revalidatePath('/split');
  revalidatePath('/split/balances');
  revalidatePath('/');

  return { status: 'success', message: 'Notification undone.' };
}

/** Collector confirms payment received (status = 'confirmed'). */
export async function confirmPaymentReceived(splitId: string): Promise<SplitActionState> {
  const me = await getCurrentUser();
  if (!me.houseId) return fail('Join a house first.');

  const supabase = createClient();
  const { error } = await supabase
    .from('splits')
    .update({ status: 'confirmed' })
    .eq('id', splitId)
    .eq('to_user_id', me.id);

  if (error) return fail(error.message);

  revalidatePath('/split');
  revalidatePath('/split/balances');
  revalidatePath('/');

  return { status: 'success', message: 'Payment confirmed.' };
}

/** Collector disputes payment (status = 'disputed'). */
export async function disputePayment(splitId: string): Promise<SplitActionState> {
  const me = await getCurrentUser();
  if (!me.houseId) return fail('Join a house first.');

  const supabase = createClient();
  const { error } = await supabase
    .from('splits')
    .update({ status: 'disputed' })
    .eq('id', splitId)
    .eq('to_user_id', me.id);

  if (error) return fail(error.message);

  revalidatePath('/split');
  revalidatePath('/split/balances');
  revalidatePath('/');

  return { status: 'success', message: 'Payment disputed.' };
}

/** Updates decision for a substitution item ('pending' | 'accepted' | 'rejected'). */
export async function updateSubstitutionDecision(
  substitutionId: string,
  decision: SubstitutionDecision
): Promise<SplitActionState> {
  const me = await getCurrentUser();
  if (!me.houseId) return fail('Join a house first.');

  const supabase = createClient();
  const { error } = await supabase
    .from('substitutions')
    .update({ decision })
    .eq('id', substitutionId);

  if (error) return fail(error.message);

  revalidatePath('/split/reconcile');
  revalidatePath('/split');

  return { status: 'success', message: `Substitution ${decision}.` };
}

/** Records delivery receipt status and received quantity for a basket item. */
export async function updateItemReceived(
  basketItemId: string,
  received: boolean,
  receivedQuantity: number
): Promise<SplitActionState> {
  const me = await getCurrentUser();
  if (!me.houseId) return fail('Join a house first.');

  const supabase = createClient();
  const { error } = await supabase.from('delivery_receipts').upsert({
    basket_item_id: basketItemId,
    received,
    received_quantity: Math.max(0, receivedQuantity),
    recorded_at: new Date().toISOString(),
  });

  if (error) return fail(error.message);

  revalidatePath('/split/reconcile');
  revalidatePath('/split');

  return { status: 'success', message: 'Receipt updated.' };
}

/** Finalises the order reconciliation and sets weekly plan status to 'delivered'. */
export async function finaliseReconciliation(planId: string): Promise<SplitActionState> {
  const me = await getCurrentUser();
  if (!me.houseId) return fail('Join a house first.');

  const supabase = createClient();
  const { error } = await supabase
    .from('weekly_plans')
    .update({ status: 'delivered' })
    .eq('id', planId)
    .eq('house_id', me.houseId);

  if (error) return fail(error.message);

  revalidatePath('/split/reconcile');
  revalidatePath('/split');
  revalidatePath('/split/balances');
  revalidatePath('/');

  return { status: 'success', message: 'Split finalised and marked as delivered.' };
}
