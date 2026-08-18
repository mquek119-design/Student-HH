'use client';

import { useState, useTransition } from 'react';
import { Icon } from '@/components/media/Icon';
import { notifyPaymentSent, undoPaymentNotification } from '@/app/split/actions';
import type { User } from '@/lib/types';

/**
 * Payment details display + "I've Paid".
 *
 * The app never holds funds and cannot verify a transfer — marking as paid only
 * notifies the collector, who confirms or disputes. See CLAUDE.md, "No custody
 * of funds".
 *
 * Each detail is a separate row with its own copy button, because that is how
 * they are used: a housemate types the sort code into one box of their banking
 * app and the account number into the next. One combined blob meant copying it
 * and then hand-picking the digits back out, which is exactly where a transfer
 * goes to the wrong account.
 */
export function PayPanel({
  collectorName,
  payment,
  splitId,
  isNotified = false,
  isPosted = true,
}: {
  collectorName: string;
  payment: User['payment'];
  splitId?: string;
  isNotified?: boolean;
  /** False while the figure is still a live estimate rather than a debt. */
  isPosted?: boolean;
}) {
  const [notified, setNotified] = useState(isNotified);
  const [isPending, startTransition] = useTransition();

  const rows: { label: string; value: string; mono: boolean }[] = [];
  if (payment.bankName) rows.push({ label: 'Bank', value: payment.bankName, mono: false });
  if (payment.sortCode) rows.push({ label: 'Sort code', value: payment.sortCode, mono: true });
  if (payment.accountNumber) {
    rows.push({ label: 'Account number', value: payment.accountNumber, mono: true });
  }
  if (payment.link) rows.push({ label: 'Link or tag', value: payment.link, mono: false });
  if (payment.note) rows.push({ label: 'Note', value: payment.note, mono: false });

  async function handleMarkPaid() {
    setNotified(true);
    if (splitId) {
      startTransition(async () => {
        await notifyPaymentSent(splitId);
      });
    }
  }

  async function handleUndoPaid() {
    setNotified(false);
    if (splitId) {
      startTransition(async () => {
        await undoPaymentNotification(splitId);
      });
    }
  }

  return (
    <div className="flex flex-col gap-md">
      <div className="bg-surface-container-lowest rounded-xl border border-surface-container-highest shadow-ambient-card p-lg flex flex-col gap-lg relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute -top-10 -right-10 w-32 h-32 bg-primary-fixed/20 rounded-full blur-2xl pointer-events-none"
        />
        <h3 className="font-title-md text-title-md text-on-background relative z-10">
          Pay {collectorName}
        </h3>

        {rows.length > 0 ? (
          <div className="bg-surface-bright rounded-lg border border-surface-container-highest divide-y divide-surface-container-highest">
            {rows.map((row) => (
              <DetailRow key={row.label} label={row.label} value={row.value} mono={row.mono} />
            ))}
          </div>
        ) : (
          <div className="bg-surface-container-low rounded-lg p-md border border-dashed border-outline-variant flex items-start gap-sm">
            <Icon name="info" className="text-on-surface-variant mt-0.5" />
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              {collectorName} hasn&apos;t added payment details yet. Ask them to fill them in under
              My Account — you&apos;ll need to settle up another way this week.
            </p>
          </div>
        )}

        {!isPosted ? (
          <p className="font-body-sm text-body-sm text-on-surface-variant text-center">
            Nothing to pay yet — the collector posts this week&apos;s split once the order is in.
          </p>
        ) : notified ? (
          <div className="flex flex-col gap-2 text-center">
            <p className="font-body-sm text-body-sm text-primary font-bold">
              Payment notification sent.
            </p>
            <p className="font-body-sm text-body-sm text-tertiary">
              Waiting for {collectorName} to confirm.
            </p>
            <button
              type="button"
              disabled={isPending}
              onClick={handleUndoPaid}
              className="font-label-caps text-label-caps text-error underline mt-2 disabled:opacity-50"
            >
              Undo
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={isPending}
            onClick={handleMarkPaid}
            className="w-full h-12 rounded-lg font-title-md text-title-md flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 bg-secondary-container hover:bg-secondary text-on-secondary disabled:opacity-50"
          >
            <Icon name="check_circle" />
            I&apos;ve Paid
          </button>
        )}
      </div>

      <p className="text-center font-body-sm text-body-sm text-tertiary">
        Payments happen outside the app. Marking as paid notifies {collectorName} to confirm.
      </p>
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono: boolean }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked by permissions; the value is on screen anyway.
    }
  }

  return (
    <div className="flex items-center justify-between gap-sm p-md">
      <div className="min-w-0">
        <p className="font-label-caps text-label-caps text-on-surface-variant mb-1">{label}</p>
        <p
          className={
            mono
              ? 'font-numeric-data text-numeric-data tracking-wider text-on-background break-words'
              : 'font-body-md text-body-md text-on-background break-words'
          }
        >
          {value}
        </p>
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${label.toLowerCase()}`}
        className="p-2 shrink-0 text-primary hover:bg-primary-container/20 rounded-full transition-colors active:scale-95"
      >
        <Icon name={copied ? 'check' : 'content_copy'} className="text-[20px]" />
      </button>
    </div>
  );
}
