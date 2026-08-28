'use client';

import { useState, useMemo } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Avatar } from '@/components/avatars/Avatar';
import { Icon } from '@/components/media/Icon';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { IconSubmitButton, useSubmitState } from '@/components/ui/SubmitButton';
import { clsx } from '@/lib/clsx';
import { formatPence } from '@/lib/money';
import {
  deleteExpense,
  logExpense,
  settleExpenseShare,
  type ExpenseActionState,
} from '@/app/split/expenseActions';
import type { Expense, User } from '@/lib/types';

/**
 * Purchases made outside the Tesco shop — a shower curtain, a replacement
 * toaster, something grabbed from Aldi.
 *
 * Equal split by default with optional per-person amounts, because "we split it
 * but Sam only used half" is a real sentence in a shared house. The custom
 * amounts must add up to the total; a split that quietly loses £3 is worse than
 * no feature at all.
 */

const INITIAL: ExpenseActionState = { status: 'idle', message: '' };

function LogButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" icon="add" pending={pending} pendingLabel="Saving…" className="self-start">
      Log it
    </Button>
  );
}

/**
 * One housemate's share of a purchase, tapped to mark settled.
 *
 * Money copy stays flat: no tick-and-cheer, just the name, the amount and
 * whether it is paid. Its own component so the spinner lands on the person
 * tapped — each share is its own form.
 */
function SettleChip({
  user,
  amount,
  settled,
}: {
  user: User;
  amount: number;
  settled: boolean;
}) {
  const { pending } = useSubmitState();

  return (
    <button
      type="submit"
      disabled={pending}
      className={clsx(
        'flex items-center gap-xs pl-1 pr-sm py-1 rounded-full border text-[12px] font-semibold transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        'disabled:opacity-60',
        settled
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-outline-variant text-on-surface-variant hover:bg-surface-container'
      )}
    >
      {pending ? (
        <Icon name="progress_activity" className="text-[16px] animate-spin ml-1" />
      ) : (
        <Avatar user={user} size="xs" />
      )}
      {user.name} {formatPence(amount)}
      <Icon
        name={settled ? 'check_circle' : 'radio_button_unchecked'}
        className="text-[14px]"
      />
    </button>
  );
}

function ExpenseRow({
  expense,
  housemates,
  currentUserId,
}: {
  expense: Expense;
  housemates: User[];
  currentUserId: string;
}) {
  const [, settleAction] = useFormState(settleExpenseShare, INITIAL);
  const [deleteState, deleteAction] = useFormState(deleteExpense, INITIAL);
  // Memoize housemates lookup Map to avoid recreation on every render
  const byId = useMemo(() => new Map(housemates.map((user) => [user.id, user])), [housemates]);
  const payer = byId.get(expense.paidByUserId);
  const owing = expense.shares.filter(
    (share) => share.userId !== expense.paidByUserId && share.amount > 0
  );

  return (
    <li className="py-sm flex flex-col gap-xs">
      <div className="flex items-start justify-between gap-sm">
        <div className="min-w-0">
          <p className="font-body-lg text-body-lg font-semibold truncate">{expense.description}</p>
          <p className="font-body-sm text-[12px] text-on-surface-variant">
            {payer?.name ?? 'Someone'} paid · {expense.spentOn}
            {expense.note && ` · ${expense.note}`}
          </p>
        </div>
        <div className="flex items-center gap-xs shrink-0">
          <span className="font-numeric-data text-body-lg font-bold">
            {formatPence(expense.amount)}
          </span>
          {expense.paidByUserId === currentUserId && (
            <form action={deleteAction}>
              <input type="hidden" name="expenseId" value={expense.id} />
              <IconSubmitButton label="Remove purchase" className="p-1" />
            </form>
          )}
        </div>
      </div>

      <ul className="flex flex-wrap gap-xs">
        {owing.map((share) => {
          const user = byId.get(share.userId);
          if (!user) return null;
          return (
            <li key={share.userId}>
              <form action={settleAction}>
                <input type="hidden" name="expenseId" value={expense.id} />
                <input type="hidden" name="userId" value={share.userId} />
                <input type="hidden" name="settled" value={share.settled ? 'false' : 'true'} />
                <SettleChip user={user} amount={share.amount} settled={share.settled} />
              </form>
            </li>
          );
        })}
      </ul>

      {deleteState.status === 'error' && (
        <p role="alert" className="font-body-sm text-[12px] text-error">
          {deleteState.message}
        </p>
      )}
    </li>
  );
}

export function ExpensePanel({
  expenses,
  housemates,
  currentUserId,
}: {
  expenses: Expense[];
  housemates: User[];
  currentUserId: string;
}) {
  const [state, action] = useFormState(logExpense, INITIAL);
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(false);
  const [between, setBetween] = useState<string[]>(housemates.map((user) => user.id));

  function toggle(userId: string) {
    setBetween((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId]
    );
  }

  return (
    <Card className="flex flex-col gap-sm">
      <div className="flex items-start justify-between gap-sm">
        <div className="min-w-0">
          <h2 className="font-title-md text-title-md">Other purchases</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Anything bought outside the weekly shop. Goes straight onto the balances.
          </p>
        </div>
        <Button
          variant="ghost"
          icon={open ? 'close' : 'receipt_long'}
          onClick={() => setOpen((value) => !value)}
          className="shrink-0 border border-primary"
        >
          {open ? 'Cancel' : 'Log a purchase'}
        </Button>
      </div>

      {open && (
        <form action={action} className="flex flex-col gap-md pt-sm border-t border-surface-container-highest">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-sm">
            <label className="flex flex-col gap-xs sm:col-span-2">
              <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
                What was it
              </span>
              <input
                name="description"
                required
                maxLength={120}
                placeholder="Replacement toaster"
                className="h-11 px-3 rounded-lg bg-surface-container-low border-none focus:ring-2 focus:ring-primary text-body-lg"
              />
            </label>

            <label className="flex flex-col gap-xs">
              <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
                How much
              </span>
              <input
                name="amount"
                required
                inputMode="decimal"
                placeholder="18.50"
                className="h-11 px-3 rounded-lg bg-surface-container-low border-none focus:ring-2 focus:ring-primary text-body-lg font-numeric-data"
              />
            </label>
          </div>

          <label className="flex flex-col gap-xs">
            <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
              When
            </span>
            <input
              name="spentOn"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              className="h-11 px-3 rounded-lg bg-surface-container-low border-none focus:ring-2 focus:ring-primary text-body-lg font-numeric-data self-start"
            />
          </label>

          <fieldset className="flex flex-col gap-xs">
            <legend className="font-label-caps text-label-caps uppercase text-on-surface-variant mb-xs">
              Split between
            </legend>
            <div className="flex flex-col gap-xs">
              {housemates.map((user) => {
                const included = between.includes(user.id);
                return (
                  <div key={user.id} className="flex items-center gap-sm">
                    <label
                      className={clsx(
                        'flex-1 flex items-center gap-sm px-sm py-2 rounded-lg border cursor-pointer transition-colors',
                        included
                          ? 'border-primary bg-primary/10'
                          : 'border-outline-variant hover:bg-surface-container'
                      )}
                    >
                      <input
                        type="checkbox"
                        name="between"
                        value={user.id}
                        checked={included}
                        onChange={() => toggle(user.id)}
                        className="sr-only"
                      />
                      <Avatar user={user} size="xs" />
                      <span className="font-body-lg text-body-lg font-semibold">{user.name}</span>
                      {included && <Icon name="check" className="ml-auto text-primary text-[18px]" />}
                    </label>

                    {custom && included && (
                      <input
                        name={`amount_${user.id}`}
                        inputMode="decimal"
                        placeholder="0.00"
                        aria-label={`Amount for ${user.name}`}
                        className="w-24 h-11 px-3 rounded-lg bg-surface-container-low border-none focus:ring-2 focus:ring-primary font-numeric-data text-right"
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setCustom((value) => !value)}
              className="self-start font-body-sm text-[13px] text-primary font-semibold hover:opacity-80 mt-xs"
            >
              {custom ? 'Split equally instead' : 'Enter amounts per person'}
            </button>
          </fieldset>

          <label className="flex flex-col gap-xs">
            <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
              Note
            </span>
            <input
              name="note"
              maxLength={300}
              placeholder="Receipt's in the kitchen drawer"
              className="h-11 px-3 rounded-lg bg-surface-container-low border-none focus:ring-2 focus:ring-primary text-body-lg"
            />
            <span className="font-body-sm text-[12px] text-on-surface-variant">
              No photo upload yet — there&apos;s no file storage set up, so this is where the
              receipt lives for now.
            </span>
          </label>

          <LogButton />
        </form>
      )}

      {state.status !== 'idle' && (
        <p
          role="status"
          className={clsx(
            'font-body-sm text-body-sm',
            state.status === 'error' ? 'text-error' : 'text-primary'
          )}
        >
          {state.message}
        </p>
      )}

      {expenses.length > 0 ? (
        <ul className="flex flex-col divide-y divide-surface-container-highest">
          {expenses.map((expense) => (
            <ExpenseRow
              key={expense.id}
              expense={expense}
              housemates={housemates}
              currentUserId={currentUserId}
            />
          ))}
        </ul>
      ) : (
        !open && (
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Nothing logged yet. Bin bags from the corner shop, a replacement kettle, someone&apos;s
            Aldi run — it all lands on the same balances as the weekly shop.
          </p>
        )
      )}
    </Card>
  );
}
