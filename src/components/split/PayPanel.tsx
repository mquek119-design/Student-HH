'use client';

import { useState } from 'react';
import { Icon } from '@/components/media/Icon';

/**
 * Payment details display + "I've Paid".
 *
 * The app never holds funds and cannot verify a transfer — marking as paid only
 * notifies the collector, who confirms or disputes. See CLAUDE.md, "No custody
 * of funds".
 *
 * Details are whatever the collector typed into their profile, shown verbatim.
 * We deliberately do not parse them into sort code / account number fields: the
 * app has no business validating bank details it never uses, and a housemate
 * paying by Revolut or Monzo link should be able to put that here instead.
 */
export function PayPanel({
  collectorName,
  paymentDetails,
}: {
  collectorName: string;
  paymentDetails: string | null;
}) {
  const [notified, setNotified] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyDetails() {
    if (!paymentDetails) return;
    try {
      await navigator.clipboard.writeText(paymentDetails);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked by permissions; the value is on screen anyway.
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

        {paymentDetails ? (
          <div className="bg-surface-bright rounded-lg p-md border border-surface-container-highest flex items-start justify-between gap-sm">
            <div className="min-w-0">
              <p className="font-label-caps text-label-caps text-on-surface-variant mb-1">
                Payment details
              </p>
              <p className="font-numeric-data text-numeric-data text-on-background break-words">
                {paymentDetails}
              </p>
            </div>
            <button
              type="button"
              onClick={copyDetails}
              aria-label="Copy payment details"
              className="p-2 shrink-0 text-primary hover:bg-primary-container/20 rounded-full transition-colors active:scale-95"
            >
              <Icon name={copied ? 'check' : 'content_copy'} className="text-[20px]" />
            </button>
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

        {notified ? (
          <div className="flex flex-col gap-2 text-center">
            <p className="font-body-sm text-body-sm text-primary font-bold">
              Payment notification sent.
            </p>
            <p className="font-body-sm text-body-sm text-tertiary">
              Waiting for {collectorName} to confirm.
            </p>
            <button
              type="button"
              onClick={() => setNotified(false)}
              className="font-label-caps text-label-caps text-error underline mt-2"
            >
              Undo
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setNotified(true)}
            className="w-full h-12 rounded-lg font-title-md text-title-md flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 bg-secondary-container hover:bg-secondary text-on-secondary"
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
