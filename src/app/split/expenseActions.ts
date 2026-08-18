'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser, getHousemates } from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';
import { parsePounds, splitPence } from '@/lib/money';

export interface ExpenseActionState {
  status: 'idle' | 'error' | 'success';
  message: string;
}

const fail = (message: string): ExpenseActionState => ({ status: 'error', message });

const MISSING_TABLE_HINT = ' — run supabase/migrations/0014_guests_expenses_leftovers.sql.';

function isMissingTable(code: string | undefined): boolean {
  return code === 'PGRST205' || code === '42P01';
}

/**
 * Logs a purchase made outside the weekly shop.
 *
 * Shares are resolved to pence here and stored that way, not as weights. An
 * equal split of £10 three ways is 334/333/333 at the moment it is entered and
 * it stays that way forever — the arithmetic of a debt should not be able to
 * change later because someone edited a rounding rule.
 *
 * The payer gets a share too. Theirs is never a debt (the ledger skips it), but
 * recording it keeps the shares summing to the amount, which is the invariant
 * that makes the whole thing auditable.
 *
 * No receipt photo: there is no storage bucket configured, and adding one is an
 * infrastructure decision rather than a form field. The note carries "receipt's
 * in the kitchen drawer" until then.
 */
export async function logExpense(
  _prev: ExpenseActionState,
  formData: FormData
): Promise<ExpenseActionState> {
  const me = await getCurrentUser();
  if (!me.houseId) return fail('Join a house first.');

  const description = String(formData.get('description') ?? '').trim();
  if (!description) return fail('What was it?');
  if (description.length > 120) return fail('Keep the description under 120 characters.');

  const amount = parsePounds(String(formData.get('amount') ?? ''));
  if (amount === null || amount <= 0) return fail('Enter an amount, e.g. 12.40.');

  const note = String(formData.get('note') ?? '').trim();
  if (note.length > 300) return fail('Keep the note under 300 characters.');

  const spentOn = String(formData.get('spentOn') ?? '').trim();
  const spentOnDate = /^\d{4}-\d{2}-\d{2}$/.test(spentOn)
    ? spentOn
    : new Date().toISOString().slice(0, 10);

  const housemates = await getHousemates();
  const houseIds = new Set(housemates.map((user) => user.id));

  const between = formData
    .getAll('between')
    .map((value) => String(value))
    .filter((id) => houseIds.has(id));

  if (between.length === 0) return fail('Pick at least one person to split it between.');

  // Custom amounts, when given, must add up. Anything else is a typo that would
  // quietly leave money unaccounted for on somebody's balance.
  const customEntries = between
    .map((userId) => ({
      userId,
      raw: String(formData.get(`amount_${userId}`) ?? '').trim(),
    }))
    .filter((entry) => entry.raw !== '');

  let shares: { userId: string; amount: number }[];

  if (customEntries.length === 0) {
    shares = splitPence(
      amount,
      between.map(() => 1)
    ).map((share, index) => ({ userId: between[index], amount: share }));
  } else {
    if (customEntries.length !== between.length) {
      return fail('Give an amount for everyone, or leave them all blank to split equally.');
    }
    const parsed = customEntries.map((entry) => ({
      userId: entry.userId,
      amount: parsePounds(entry.raw),
    }));
    if (parsed.some((entry) => entry.amount === null || entry.amount < 0)) {
      return fail('One of the amounts is not a number.');
    }
    const total = parsed.reduce((sum, entry) => sum + (entry.amount ?? 0), 0);
    if (total !== amount) {
      return fail(
        `Those amounts add up to £${(total / 100).toFixed(2)}, not £${(amount / 100).toFixed(2)}.`
      );
    }
    shares = parsed.map((entry) => ({ userId: entry.userId, amount: entry.amount ?? 0 }));
  }

  const supabase = createClient();
  const created = await supabase
    .from('expenses')
    .insert({
      house_id: me.houseId,
      paid_by_user_id: me.id,
      description,
      amount,
      spent_on: spentOnDate,
      note,
    })
    .select('id')
    .single();

  if (created.error) {
    return fail(`${created.error.message}${isMissingTable(created.error.code) ? MISSING_TABLE_HINT : ''}`);
  }

  const linked = await supabase.from('expense_shares').insert(
    shares.map((share) => ({
      expense_id: created.data.id,
      user_id: share.userId,
      amount: share.amount,
      // The payer does not owe themselves, so their share starts settled.
      settled: share.userId === me.id,
    }))
  );

  if (linked.error) {
    // Leave no half-written expense behind: an amount with no shares would show
    // on the ledger as a debt to nobody.
    await supabase.from('expenses').delete().eq('id', created.data.id);
    return fail(`Could not save the split: ${linked.error.message}`);
  }

  revalidatePath('/split');
  revalidatePath('/split/balances');
  revalidatePath('/');

  return {
    status: 'success',
    message: `Logged ${description} — £${(amount / 100).toFixed(2)} across ${shares.length} ${
      shares.length === 1 ? 'person' : 'people'
    }.`,
  };
}

/** Marks one person's share of a purchase as settled, or unsettles it. */
export async function settleExpenseShare(
  _prev: ExpenseActionState,
  formData: FormData
): Promise<ExpenseActionState> {
  const me = await getCurrentUser();
  if (!me.houseId) return fail('Join a house first.');

  const expenseId = String(formData.get('expenseId') ?? '');
  const userId = String(formData.get('userId') ?? '');
  const settled = String(formData.get('settled') ?? 'true') === 'true';
  if (!expenseId || !userId) return fail('Missing share.');

  const supabase = createClient();
  const updated = await supabase
    .from('expense_shares')
    .update({ settled })
    .eq('expense_id', expenseId)
    .eq('user_id', userId);

  if (updated.error) return fail(updated.error.message);

  revalidatePath('/split');
  revalidatePath('/split/balances');
  revalidatePath('/');
  return { status: 'idle', message: '' };
}

/**
 * Deletes a purchase.
 *
 * Only the person who paid can: everyone else's balance depends on it, and a
 * housemate quietly deleting a debt they owe is the one failure mode this
 * whole feature must not have.
 */
export async function deleteExpense(
  _prev: ExpenseActionState,
  formData: FormData
): Promise<ExpenseActionState> {
  const me = await getCurrentUser();
  const expenseId = String(formData.get('expenseId') ?? '');
  if (!expenseId) return fail('Missing purchase.');

  const supabase = createClient();
  const removed = await supabase
    .from('expenses')
    .delete()
    .eq('id', expenseId)
    .eq('paid_by_user_id', me.id)
    .select('id');

  if (removed.error) return fail(removed.error.message);
  if ((removed.data ?? []).length === 0) {
    return fail('Only the person who paid can remove it.');
  }

  revalidatePath('/split');
  revalidatePath('/split/balances');
  revalidatePath('/');
  return { status: 'success', message: 'Removed.' };
}
