/**
 * When a household staple is due again.
 *
 * Pure so it can be reasoned about without a database: the same function
 * decides what the settings page labels "due now" and what the basket build
 * actually adds, and those two must never disagree.
 *
 * Intervals are in days rather than calendar months because the shop is
 * weekly. "Monthly" bin bags means every fourth shop, not the 1st of the month.
 */

import type { StapleFrequency } from './types';

export const STAPLE_INTERVAL_DAYS: Record<StapleFrequency, number> = {
  weekly: 7,
  fortnightly: 14,
  monthly: 28,
};

export const STAPLE_FREQUENCY_LABELS: Record<StapleFrequency, string> = {
  weekly: 'Every week',
  fortnightly: 'Every 2 weeks',
  monthly: 'Every 4 weeks',
};

/**
 * Never added = due. Anything else is due once its interval has elapsed.
 *
 * The comparison is `>=` on purpose: a weekly staple added last Sunday is due
 * again this Sunday, which is the shop it is meant to be in.
 */
export function isStapleDue(
  frequency: StapleFrequency,
  lastAddedOn: string | null,
  today: Date = new Date()
): boolean {
  if (!lastAddedOn) return true;

  const last = new Date(`${lastAddedOn}T00:00:00Z`);
  if (Number.isNaN(last.getTime())) return true;

  const midnightToday = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate()
  );
  const elapsedDays = Math.floor((midnightToday - last.getTime()) / 86_400_000);
  return elapsedDays >= STAPLE_INTERVAL_DAYS[frequency];
}

/** How many days until it comes back, for the "next in N days" label. */
export function daysUntilStapleDue(
  frequency: StapleFrequency,
  lastAddedOn: string | null,
  today: Date = new Date()
): number {
  if (isStapleDue(frequency, lastAddedOn, today)) return 0;

  const last = new Date(`${lastAddedOn}T00:00:00Z`);
  const midnightToday = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate()
  );
  const elapsedDays = Math.floor((midnightToday - last.getTime()) / 86_400_000);
  return STAPLE_INTERVAL_DAYS[frequency] - elapsedDays;
}
