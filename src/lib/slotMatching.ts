/**
 * Scoring a house's optional slot preference against real availability.
 *
 * Pure and dependency-free so the ranking can be tested without a Tesco
 * session. The output is only ever a *suggestion*: the collector still selects
 * the slot themselves, so a mediocre match is never worse than no match.
 */

import { WEEKDAYS, type Weekday } from './types';

export interface SlotPreference {
  method: 'delivery' | 'collect' | null;
  day: Weekday | null;
  /** "HH:MM", inclusive start of the wanted window. */
  windowStart: string | null;
  /** "HH:MM", exclusive end of the wanted window. */
  windowEnd: string | null;
}

export interface MatchableSlot {
  slotId: string;
  /** ISO date, "YYYY-MM-DD". */
  date: string;
  /** "HH:MM" in Europe/London. */
  startTime: string;
  endTime: string;
  charge: number;
}

/** True when the house has expressed anything at all. */
export function hasPreference(preference: SlotPreference): boolean {
  return Boolean(
    preference.method || preference.day || (preference.windowStart && preference.windowEnd)
  );
}

/**
 * Scoring weights. The invariant that matters:
 *   IN_WINDOW > NEAR_WINDOW_MAX + PRICE_BONUS_MAX
 * so no amount of cheapness can promote an out-of-window slot above one that
 * actually falls inside the household's window.
 */
const IN_WINDOW = 50;
const NEAR_WINDOW_MAX = 40;
const PRICE_BONUS_MAX = 5;

function minutes(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function weekdayOf(isoDate: string): Weekday | null {
  const date = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  // getUTCDay is 0=Sunday; WEEKDAYS is 0=Monday.
  return WEEKDAYS[(date.getUTCDay() + 6) % 7] ?? null;
}

/**
 * How well one slot fits the preference. Higher is better; null means the
 * preference is empty so nothing should be suggested.
 *
 * Weighting reflects what a household actually cares about: landing on the
 * right *day* matters more than the exact hour, and among equally good fits the
 * cheaper slot wins — this is a budget app.
 */
export function scoreSlot(slot: MatchableSlot, preference: SlotPreference): number | null {
  if (!hasPreference(preference)) return null;

  let score = 0;

  if (preference.day) {
    score += weekdayOf(slot.date) === preference.day ? 100 : 0;
  }

  if (preference.windowStart && preference.windowEnd) {
    const start = minutes(slot.startTime);
    const wantFrom = minutes(preference.windowStart);
    const wantTo = minutes(preference.windowEnd);

    if (start !== null && wantFrom !== null && wantTo !== null) {
      if (start >= wantFrom && start < wantTo) {
        score += IN_WINDOW;
      } else {
        // Partial credit decaying with distance, so "an hour late" ranks above
        // "nine hours early". Capped strictly below IN_WINDOW: a slot starting
        // exactly at the window's end is outside it, and must never tie with
        // one inside — otherwise a cheaper out-of-window slot wins on the
        // price tie-break, which is precisely the wrong answer.
        const distance = start < wantFrom ? wantFrom - start : start - wantTo;
        score += Math.max(0, NEAR_WINDOW_MAX - distance / 6);
      }
    }
  }

  // Cheapness only ever breaks ties. Its ceiling is below the gap between
  // in-window and out-of-window, so price can never override a real match.
  score += Math.max(0, PRICE_BONUS_MAX - slot.charge / 100);

  return score;
}

/**
 * The slot to suggest, or null when there is no preference or nothing to rank.
 *
 * Earlier slots win ties so the shop arrives sooner.
 */
export function suggestSlot<T extends MatchableSlot>(
  slots: T[],
  preference: SlotPreference
): T | null {
  if (!hasPreference(preference) || slots.length === 0) return null;

  let best: { slot: T; score: number } | null = null;

  for (const slot of slots) {
    const score = scoreSlot(slot, preference);
    if (score === null) continue;
    if (!best || score > best.score) best = { slot, score };
  }

  return best?.slot ?? null;
}

/** Plain-English reason a slot was suggested, for the UI to show. */
export function describeMatch(slot: MatchableSlot, preference: SlotPreference): string {
  const reasons: string[] = [];

  if (preference.day && weekdayOf(slot.date) === preference.day) {
    reasons.push('your preferred day');
  }
  if (preference.windowStart && preference.windowEnd) {
    const start = minutes(slot.startTime);
    const from = minutes(preference.windowStart);
    const to = minutes(preference.windowEnd);
    if (start !== null && from !== null && to !== null && start >= from && start < to) {
      reasons.push('your preferred time');
    }
  }

  if (reasons.length === 0) return 'Closest available to your preference';
  return `Matches ${reasons.join(' and ')}`;
}
