/**
 * Which week is which.
 *
 * A house holds two plans at once: the one it is eating and the one it is
 * arguing about. They are different objects with different rules — this week is
 * a record once the shop is placed, next week is still a decision — so the code
 * needs a name for each rather than "the latest row".
 *
 * Dates are formatted from LOCAL parts, never `toISOString()`. Local midnight
 * Monday is Sunday 17:00 UTC for anyone east of Greenwich, and the ISO string
 * named the day before — which stored and dated an entire week one day out.
 */

import { WEEKDAYS, type Weekday } from './types';

export type WeekChoice = 'this' | 'next';

export const WEEK_CHOICES: WeekChoice[] = ['this', 'next'];

function isoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Monday of the week containing `from`. */
export function weekStartOf(from: Date = new Date()): string {
  const monday = new Date(from);
  monday.setDate(from.getDate() - ((from.getDay() + 6) % 7));
  return isoDate(monday);
}

export function currentWeekStart(): string {
  return weekStartOf();
}

export function nextWeekStart(): string {
  const monday = new Date(`${currentWeekStart()}T00:00:00`);
  monday.setDate(monday.getDate() + 7);
  return isoDate(monday);
}

export function weekStartFor(choice: WeekChoice): string {
  return choice === 'next' ? nextWeekStart() : currentWeekStart();
}

/** Reads a `?week=` param, defaulting to this week for anything unexpected. */
export function parseWeekChoice(value: string | undefined): WeekChoice {
  return value === 'next' ? 'next' : 'this';
}

/** "11–17 Aug", for the switcher. */
export function weekRangeLabel(weekStartDate: string): string {
  const start = new Date(`${weekStartDate}T00:00:00Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);

  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  const startLabel = start.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: sameMonth ? undefined : 'short',
    timeZone: 'UTC',
  });
  const endLabel = end.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
  return `${startLabel}–${endLabel}`;
}

/**
 * Has this day of this week already happened?
 *
 * Today is not past — the day is still running, and somebody deciding at 6pm
 * what they are cooking at 8pm is the ordinary case, not an edge one.
 *
 * Takes the week's own start date rather than a `'this' | 'next'`, so it
 * answers for any plan, including one left open from a fortnight ago. That
 * matters: a stale tab does not get to plan a day in March.
 */
export function isDayPast(weekStartDate: string, day: Weekday, now: Date = new Date()): boolean {
  const index = WEEKDAYS.indexOf(day);
  if (index < 0) return false;

  // Local parts throughout, for the reason in the file header.
  const dayDate = new Date(`${weekStartDate}T00:00:00`);
  dayDate.setDate(dayDate.getDate() + index);

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return dayDate.getTime() < startOfToday.getTime();
}

export function isoWeekNumber(date: Date): number {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNumber + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNumber = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNumber + 3);
  return 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
}

/**
 * Has the cutoff time for planning passed?
 *
 * Takes an ISO 8601 datetime string (e.g., from `weeklyPlans.cutoffAt`) and
 * returns true if the current time is at or past that moment.
 */
export function isCutoffPassed(cutoffAtIso: string, now: Date = new Date()): boolean {
  const cutoffTime = new Date(cutoffAtIso).getTime();
  return now.getTime() >= cutoffTime;
}
