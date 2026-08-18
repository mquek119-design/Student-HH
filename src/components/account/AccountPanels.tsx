'use client';

import { useFormState } from 'react-dom';
import { useState, useTransition } from 'react';
import { Icon } from '@/components/media/Icon';
import { Button } from '@/components/ui/Button';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { Card } from '@/components/ui/Card';
import { clsx } from '@/lib/clsx';
import {
  deleteAccount,
  leaveHouse,
  updateDietaryPreferences,
  updatePaymentDetails,
  type AccountActionState,
} from '@/app/account/actions';
import type { User } from '@/lib/types';

const INITIAL: AccountActionState = { status: 'idle', message: '' };

const FIELD =
  'w-full px-3 py-3 rounded-lg bg-surface-container-low border-none focus:ring-2 focus:ring-primary text-body-lg';

const COMMON_PREFERENCES = [
  'Vegetarian',
  'Vegan',
  'Pescatarian',
  'Halal',
  'No pork',
  'Gluten free',
  'Dairy free',
  'Nut allergy',
];

function SaveButton({ label = 'Save' }: { label?: string }) {
  return (
    <SubmitButton icon="check" className="self-start" pendingLabel="Saving…">
      {label}
    </SubmitButton>
  );
}

function Status({ state }: { state: AccountActionState }) {
  if (state.status === 'idle') return null;
  return (
    <p
      role="status"
      className={clsx(
        'font-body-sm text-body-sm',
        state.status === 'error' ? 'text-error' : 'text-primary'
      )}
    >
      {state.message}
    </p>
  );
}

/**
 * How housemates pay you.
 *
 * Free text on purpose — the app never touches money, so it has no business
 * validating a sort code, and Revolut or Monzo links must work just as well.
 */
export function PaymentDetailsPanel({ user }: { user: User }) {
  const [state, action] = useFormState(updatePaymentDetails, INITIAL);
  const payment = user.payment;

  return (
    <Card className="flex flex-col gap-sm">
      <div className="min-w-0">
        <h2 className="font-title-md text-title-md">Payment details</h2>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Shown to housemates when you are the collector. Separate fields so nobody has to guess
          what a half-filled line means — the app never contacts a bank, it only displays these.
        </p>
      </div>

      <form action={action} className="flex flex-col gap-md">
        <label className="flex flex-col gap-xs">
          <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
            Bank or app
          </span>
          <input
            name="bankName"
            defaultValue={payment.bankName ?? ''}
            placeholder="Monzo"
            className={FIELD}
          />
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
          <label className="flex flex-col gap-xs">
            <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
              Sort code
            </span>
            <input
              name="sortCode"
              inputMode="numeric"
              maxLength={8}
              defaultValue={payment.sortCode ?? ''}
              placeholder="04-00-04"
              className={`${FIELD} font-numeric-data tracking-wider`}
            />
          </label>

          <label className="flex flex-col gap-xs">
            <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
              Account number
            </span>
            <input
              name="accountNumber"
              inputMode="numeric"
              maxLength={8}
              defaultValue={payment.accountNumber ?? ''}
              placeholder="12345678"
              className={`${FIELD} font-numeric-data tracking-wider`}
            />
          </label>
        </div>
        <span className="font-body-sm text-[12px] text-on-surface-variant -mt-xs">
          Both or neither — one on its own can&apos;t be paid to.
        </span>

        <label className="flex flex-col gap-xs">
          <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
            Payment link or tag
          </span>
          <input
            name="paymentLink"
            defaultValue={payment.link ?? ''}
            placeholder="monzo.me/yourname  ·  revolut.me/yourtag  ·  @yourtag"
            className={FIELD}
          />
          <span className="font-body-sm text-[12px] text-on-surface-variant">
            Optional, and enough on its own if you never use a bank transfer.
          </span>
        </label>

        <label className="flex flex-col gap-xs">
          <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
            Anything else
          </span>
          <input
            name="note"
            maxLength={300}
            defaultValue={payment.note ?? ''}
            placeholder="e.g. reference your name"
            className={FIELD}
          />
        </label>

        <SaveButton />
        <Status state={state} />
      </form>
    </Card>
  );
}

/** Dietary preferences. The same field the Plan tab writes. */
export function DietaryPanel({ user }: { user: User }) {
  const [state, action] = useFormState(updateDietaryPreferences, INITIAL);
  const custom = user.dietaryPreferences.filter((p) => !COMMON_PREFERENCES.includes(p));

  return (
    <Card className="flex flex-col gap-sm">
      <div className="min-w-0">
        <h2 className="font-title-md text-title-md">Dietary profile</h2>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Visible to the house when planning meals, so nobody cooks something you can&apos;t eat.
        </p>
      </div>

      <form action={action} className="flex flex-col gap-md">
        <div className="flex flex-wrap gap-sm">
          {COMMON_PREFERENCES.map((preference) => (
            <label
              key={preference}
              className={clsx(
                'px-md py-sm rounded-full border flex items-center gap-xs text-[14px] font-semibold cursor-pointer transition-colors',
                'has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:text-primary',
                'border-outline-variant bg-surface text-on-surface-variant hover:bg-surface-container'
              )}
            >
              <input
                type="checkbox"
                name="preference"
                value={preference}
                defaultChecked={user.dietaryPreferences.includes(preference)}
                className="sr-only"
              />
              {preference}
            </label>
          ))}
        </div>

        <label className="flex flex-col gap-xs">
          <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
            Anything else
          </span>
          <input
            name="custom"
            defaultValue={custom.join(', ')}
            placeholder="Comma separated, e.g. no shellfish"
            className={FIELD}
          />
        </label>

        <SaveButton label="Save profile" />
        <Status state={state} />
      </form>
    </Card>
  );
}

/**
 * Leaving the house. Confirms first — it detaches you from every plan and
 * split, and rejoining needs the invite code again.
 */
export function LeaveHousePanel() {
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function leave() {
    startTransition(async () => {
      const result = await leaveHouse();
      // On success the action redirects, so anything returned is a refusal.
      if (result?.status === 'error') {
        setMessage(result.message);
        setConfirming(false);
      }
    });
  }

  return (
    <div className="flex flex-col gap-sm">
      {confirming ? (
        <Card accent="error" className="flex flex-col gap-sm">
          <p className="font-body-sm text-body-sm">
            You&apos;ll be detached from this house&apos;s plans and basket. Money already recorded
            in past splits stays on the ledger — leaving does not settle it. You&apos;d need the
            invite code to come back.
          </p>
          <div className="flex gap-sm">
            <button
              type="button"
              disabled={pending}
              onClick={leave}
              className="flex-1 h-11 rounded-lg bg-error text-on-error font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {pending ? 'Leaving…' : 'Yes, leave'}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="flex-1 h-11 rounded-lg border border-outline-variant text-on-surface-variant font-semibold hover:bg-surface-container transition-colors"
            >
              Cancel
            </button>
          </div>
        </Card>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="w-full h-12 rounded-lg border border-error text-error font-title-md text-title-md flex items-center justify-center gap-sm hover:bg-error-container transition-colors"
        >
          <Icon name="logout" />
          Leave House
        </button>
      )}

      {message && (
        <p role="alert" className="font-body-sm text-body-sm text-error">
          {message}
        </p>
      )}
    </div>
  );
}

/**
 * Deleting your account.
 *
 * Two confirmations deep, and the copy says exactly what goes and what does
 * not. It refuses outright while any money is unsettled — that check lives in
 * the action, because a guard the UI can be routed around is not a guard.
 */
/**
 * Deleting an account, in up to two questions.
 *
 * `idle` → `account` is the ordinary path. `house` is only reached when the
 * server says you are the last member: the house cannot be left standing with
 * nobody able to open it, so it has to go too, and that is a second deletion
 * which gets its own second answer rather than being folded into the first.
 */
type DeleteStage = 'idle' | 'account' | 'house';

/**
 * The `danger` variant is the *outlined* error button — right for the control
 * that opens the question, too quiet for the one that answers it. Filling it
 * keeps the confirm distinct from the Cancel sitting next to it.
 */
const SOLID_ERROR = 'bg-error text-on-error border-error hover:opacity-90';

export function DeleteAccountPanel() {
  const [stage, setStage] = useState<DeleteStage>('idle');
  const [houseWarning, setHouseWarning] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function remove(alsoDeleteHouse: boolean) {
    setMessage(null);
    startTransition(async () => {
      const result = await deleteAccount(alsoDeleteHouse);
      // Success redirects, so anything returned is a refusal or a question.
      if (result?.status === 'confirm-house') {
        setHouseWarning(result.message);
        setStage('house');
        return;
      }
      if (result?.status === 'error') {
        setMessage(result.message);
        setStage('idle');
      }
    });
  }

  return (
    <div className="flex flex-col gap-sm">
      {stage === 'account' && (
        <Card accent="error" className="flex flex-col gap-sm">
          <p className="font-body-sm text-body-sm">
            This removes your profile, your place on every meal, your pantry items and your
            recipes&apos; authorship. It cannot be undone.
          </p>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Your sign-in email itself is held by Supabase and is not deleted from here — using it
            again would start you off with a blank account and no house.
          </p>
          <div className="flex gap-sm">
            <Button
              variant="danger"
              fullWidth
              className={SOLID_ERROR}
              pending={pending}
              pendingLabel="Deleting…"
              onClick={() => remove(false)}
            >
              Yes, delete my account
            </Button>
            <Button variant="outline" fullWidth disabled={pending} onClick={() => setStage('idle')}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {stage === 'house' && (
        <Card accent="error" className="flex flex-col gap-sm">
          <h3 className="font-title-md text-title-md text-error">The house goes with it</h3>
          <p className="font-body-sm text-body-sm">{houseWarning}</p>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Nobody else is in it to hand it to. If you would rather keep it, cancel and invite
            somebody first.
          </p>
          <div className="flex gap-sm">
            <Button
              variant="danger"
              fullWidth
              className={SOLID_ERROR}
              pending={pending}
              pendingLabel="Deleting…"
              onClick={() => remove(true)}
            >
              Delete both
            </Button>
            <Button variant="outline" fullWidth disabled={pending} onClick={() => setStage('idle')}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {stage === 'idle' && (
        <Button variant="danger" size="lg" fullWidth icon="delete_forever" onClick={() => setStage('account')}>
          Delete my account
        </Button>
      )}

      {message && (
        <p role="alert" className="font-body-sm text-body-sm text-error">
          {message}
        </p>
      )}
    </div>
  );
}
