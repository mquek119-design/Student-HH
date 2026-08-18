'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';
import { readViewAsId, viewAsRefusal } from '@/lib/viewAs';
import type { SplitStatus, SubstitutionDecision } from '@/lib/types';

export interface SplitActionState {
  status: 'idle' | 'success' | 'error';
  message: string;
}

const fail = (message: string): SplitActionState => ({ status: 'error', message });

/**
 * Sets a split's status, whoever you are currently being.
 *
 * `splits_update` is scoped to `auth.uid()`, so while the app is rendering as a
 * demo housemate the direct update matches nothing — which is precisely the
 * flow the demo housemates exist to test. When impersonating, this goes through
 * `demo_set_split_status` (migration 0020), which makes the same house check in
 * SQL and refuses anything that is not a demo profile.
 *
 * Signed in as yourself, nothing changes: the ordinary update runs under RLS.
 */
async function writeSplitStatus(
  splitId: string,
  status: SplitStatus,
  scope: { column: 'from_user_id' | 'to_user_id'; userId: string }
): Promise<{ changed: number } | { error: string }> {
  const supabase = createClient();
  const actingAs = readViewAsId();

  if (actingAs) {
    const { data, error } = await supabase.rpc('demo_set_split_status', {
      p_split_id: splitId,
      p_status: status,
      p_acting_as: actingAs,
    });
    if (error) {
      const hint =
        error.code === 'PGRST202'
          ? ' — run supabase/migrations/0020_demo_write_functions.sql.'
          : '';
      return { error: `${error.message}${hint}` };
    }
    return { changed: data ?? 0 };
  }

  const { data, error } = await supabase
    .from('splits')
    .update({ status })
    .eq('id', splitId)
    .eq(scope.column, scope.userId)
    .select('id');

  if (error) return { error: error.message };
  return { changed: data?.length ?? 0 };
}

/** Notifies collector that payment was sent (status = 'notified'). */
export async function notifyPaymentSent(splitId: string): Promise<SplitActionState> {
  const me = await getCurrentUser();
  if (!me.houseId) return fail('Join a house first.');

  const written = await writeSplitStatus(splitId, 'notified', {
    column: 'from_user_id',
    userId: me.id,
  });

  if ('error' in written) return fail(written.error);
  if (written.changed === 0) {
    return fail((await viewAsRefusal('Payment status')) ?? 'That split is no longer yours to mark.');
  }

  revalidatePath('/split');
  revalidatePath('/split/balances');
  revalidatePath('/');

  return { status: 'success', message: 'Payment notification sent.' };
}

/** Resets payment status to 'pending'. */
export async function undoPaymentNotification(splitId: string): Promise<SplitActionState> {
  const me = await getCurrentUser();
  if (!me.houseId) return fail('Join a house first.');

  const written = await writeSplitStatus(splitId, 'pending', {
    column: 'from_user_id',
    userId: me.id,
  });

  if ('error' in written) return fail(written.error);
  if (written.changed === 0) {
    return fail((await viewAsRefusal('Payment status')) ?? 'That split is no longer yours to change.');
  }

  revalidatePath('/split');
  revalidatePath('/split/balances');
  revalidatePath('/');

  return { status: 'success', message: 'Notification undone.' };
}

/** Collector confirms payment received (status = 'confirmed'). */
export async function confirmPaymentReceived(splitId: string): Promise<SplitActionState> {
  const me = await getCurrentUser();
  if (!me.houseId) return fail('Join a house first.');

  const written = await writeSplitStatus(splitId, 'confirmed', {
    column: 'to_user_id',
    userId: me.id,
  });

  if ('error' in written) return fail(written.error);
  if (written.changed === 0) {
    return fail((await viewAsRefusal('Confirming a payment')) ?? 'Only the collector can confirm that one.');
  }

  revalidatePath('/split');
  revalidatePath('/split/balances');
  revalidatePath('/');

  return { status: 'success', message: 'Payment confirmed.' };
}

/** Collector disputes payment (status = 'disputed'). */
export async function disputePayment(splitId: string): Promise<SplitActionState> {
  const me = await getCurrentUser();
  if (!me.houseId) return fail('Join a house first.');

  const written = await writeSplitStatus(splitId, 'disputed', {
    column: 'to_user_id',
    userId: me.id,
  });

  if ('error' in written) return fail(written.error);
  if (written.changed === 0) {
    return fail((await viewAsRefusal('Disputing a payment')) ?? 'Only the collector can dispute that one.');
  }

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
