'use server';

import { revalidatePath } from 'next/cache';
import { perPersonTotals } from '@/lib/calc';
import { splitPence } from '@/lib/money';
import {
  getBasketItems,
  getCollector,
  getCurrentUser,
  getHousemates,
  getWeeklyPlan,
} from '@/lib/queries';
import { createClient } from '@/lib/supabase/server';

export interface PostSplitState {
  status: 'idle' | 'error' | 'success';
  message: string;
}

const fail = (message: string): PostSplitState => ({ status: 'error', message });

/**
 * Turns the computed shares into real debts.
 *
 * Until this existed the split was only ever *calculated*: `getCurrentSplit()`
 * derived everyone's share on the fly and handed the UI an id of
 * `${planId}:${userId}`, which is not a row. So "I've Paid" updated nothing,
 * `getLedger()` read an empty table, and Balances and payment status were
 * permanently blank. The arithmetic was right and the week simply had no
 * ending.
 *
 * Posting writes one row per housemate who owes the collector. It is
 * idempotent — safe to run again after reconciliation changes the numbers.
 *
 * **A changed amount resets the status to pending.** If someone marked £20 as
 * paid and reconciliation moves it to £22, they have not paid £22, and leaving
 * the row settled would quietly write off the difference. Unchanged amounts
 * keep whatever status they had, so re-posting never un-pays anybody.
 */
export async function postSplit(): Promise<PostSplitState> {
  const me = await getCurrentUser();
  if (!me.houseId) return fail('Join a house first.');

  const [plan, items, housemates, collector] = await Promise.all([
    getWeeklyPlan(),
    getBasketItems(),
    getHousemates(),
    getCollector(),
  ]);

  if (!plan?.id) return fail('No plan for this week yet.');
  if (!collector) return fail('The house has no collector set — pick one in House Settings.');
  if (items.length === 0) return fail('Build the basket first: there is nothing to split.');

  const allUserIds = housemates.map((user) => user.id);
  const totals = perPersonTotals(items, allUserIds);

  // The delivery charge is a real cost of the shop and divides equally.
  // splitPence keeps it penny-exact rather than letting a rounding remainder
  // quietly vanish out of the collector's pocket.
  const slotShares =
    plan.slot && plan.slot.charge > 0 && allUserIds.length > 0
      ? splitPence(plan.slot.charge, allUserIds.map(() => 1))
      : allUserIds.map(() => 0);

  const supabase = createClient();
  const existing = await supabase
    .from('splits')
    .select('id, from_user_id, amount, status')
    .eq('plan_id', plan.id);

  if (existing.error) return fail(existing.error.message);
  const previous = new Map((existing.data ?? []).map((row) => [row.from_user_id, row]));

  const unpriced = items.filter((item) => item.needsPackData).length;
  let posted = 0;

  for (const [index, userId] of allUserIds.entries()) {
    if (userId === collector.id) continue;

    const amount = (totals[userId] ?? 0) + slotShares[index];
    if (amount <= 0) continue;

    const before = previous.get(userId);
    const status = before && before.amount === amount ? before.status : 'pending';

    const written = await supabase.from('splits').upsert(
      {
        plan_id: plan.id,
        from_user_id: userId,
        to_user_id: collector.id,
        amount,
        status,
        note: `Week ${plan.weekNumber} groceries`,
      },
      { onConflict: 'plan_id,from_user_id,to_user_id' }
    );

    if (written.error) return fail(written.error.message);
    posted += 1;
  }

  // Anyone whose share has gone to zero (they left every meal, or the basket
  // shrank) should not keep a debt row hanging around the ledger.
  for (const [userId, row] of previous) {
    const stillOwes = allUserIds.some(
      (id, index) => id === userId && (totals[id] ?? 0) + slotShares[index] > 0
    );
    if (!stillOwes) await supabase.from('splits').delete().eq('id', row.id);
  }

  revalidatePath('/split');
  revalidatePath('/split/balances');
  revalidatePath('/');

  const caveat =
    unpriced > 0
      ? ` ${unpriced} unpriced item${unpriced === 1 ? '' : 's'} are excluded, so this is lower than the real bill.`
      : '';

  return {
    status: 'success',
    message: `Split posted to ${posted} housemate${posted === 1 ? '' : 's'}.${caveat}`,
  };
}
