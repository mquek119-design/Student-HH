/**
 * Unit Tests for Week and Cutoff Functions
 *
 * Critical path tests covering:
 * - isCutoffPassed(): Planning cutoff boundary conditions
 * - isDayPast(): Past day detection for planning locks
 * - Week arithmetic: week starts, ranges, etc.
 *
 * Run: npm test -- weeks.test.ts
 */

import {
  isCutoffPassed,
  isDayPast,
  weekStartOf,
  currentWeekStart,
  nextWeekStart,
  weekStartFor,
  parseWeekChoice,
  weekRangeLabel,
  isoWeekNumber,
} from '../weeks';

describe('isCutoffPassed()', () => {
  describe('basic cutoff detection', () => {
    it('should return false when current time is before cutoff', () => {
      const cutoffTime = new Date('2026-09-01T17:00:00Z');
      const beforeCutoff = new Date('2026-09-01T16:59:00Z');

      expect(isCutoffPassed(cutoffTime.toISOString(), beforeCutoff)).toBe(false);
    });

    it('should return true when current time equals cutoff', () => {
      const cutoffTime = new Date('2026-09-01T17:00:00Z');

      expect(isCutoffPassed(cutoffTime.toISOString(), cutoffTime)).toBe(true);
    });

    it('should return true when current time is after cutoff', () => {
      const cutoffTime = new Date('2026-09-01T17:00:00Z');
      const afterCutoff = new Date('2026-09-01T17:00:01Z');

      expect(isCutoffPassed(cutoffTime.toISOString(), afterCutoff)).toBe(true);
    });

    it('should return true for far future cutoff passed', () => {
      const cutoffTime = new Date('2026-09-01T17:00:00Z');
      const farFuture = new Date('2026-10-01T00:00:00Z');

      expect(isCutoffPassed(cutoffTime.toISOString(), farFuture)).toBe(true);
    });
  });

  describe('cutoff timing patterns', () => {
    it('should use default current time when not provided', () => {
      const cutoffTime = new Date('2020-01-01T17:00:00Z');
      expect(isCutoffPassed(cutoffTime.toISOString())).toBe(true);
    });

    it('should handle Sunday 17:00 cutoff (typical pattern)', () => {
      const sundayAt17 = new Date('2026-08-30T17:00:00Z');
      const sundayAt1659 = new Date('2026-08-30T16:59:00Z');
      const sundayAt1701 = new Date('2026-08-30T17:01:00Z');

      expect(isCutoffPassed(sundayAt17.toISOString(), sundayAt1659)).toBe(false);
      expect(isCutoffPassed(sundayAt17.toISOString(), sundayAt17)).toBe(true);
      expect(isCutoffPassed(sundayAt17.toISOString(), sundayAt1701)).toBe(true);
    });

    it('should handle pre-cutoff planning window', () => {
      const cutoffTime = new Date('2026-08-30T17:00:00Z');
      const planningTime = new Date('2026-08-30T12:00:00Z');

      expect(isCutoffPassed(cutoffTime.toISOString(), planningTime)).toBe(false);
    });
  });

  describe('timezone handling', () => {
    it('should correctly parse ISO 8601 datetime strings', () => {
      const cutoff = '2026-09-01T17:00:00Z';
      const beforeCutoffTime = new Date('2026-09-01T16:59:59Z');
      const afterCutoffTime = new Date('2026-09-01T17:00:01Z');

      expect(isCutoffPassed(cutoff, beforeCutoffTime)).toBe(false);
      expect(isCutoffPassed(cutoff, afterCutoffTime)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle cutoff at exact millisecond boundary', () => {
      const cutoffMs = new Date('2026-09-01T17:00:00.000Z');
      const cutoffTime = new Date(cutoffMs.getTime());
      const oneMillisBefore = new Date(cutoffMs.getTime() - 1);
      const oneMillisAfter = new Date(cutoffMs.getTime() + 1);

      expect(isCutoffPassed(cutoffTime.toISOString(), oneMillisBefore)).toBe(false);
      expect(isCutoffPassed(cutoffTime.toISOString(), cutoffTime)).toBe(true);
      expect(isCutoffPassed(cutoffTime.toISOString(), oneMillisAfter)).toBe(true);
    });

    it('should handle very old cutoff times', () => {
      const oldCutoff = '1970-01-01T00:00:00Z';
      const modernTime = new Date('2026-08-28T00:00:00Z');

      expect(isCutoffPassed(oldCutoff, modernTime)).toBe(true);
    });

    it('should handle far future cutoffs', () => {
      const farFutureCutoff = '2099-12-31T23:59:59Z';
      const currentTime = new Date('2026-08-28T00:00:00Z');

      expect(isCutoffPassed(farFutureCutoff, currentTime)).toBe(false);
    });
  });
});

describe('isDayPast()', () => {
  describe('using fixed historical dates', () => {
    it('should return false for the current day', () => {
      const testWeekStart = '2020-01-06';
      const testDate = new Date('2020-01-06T12:00:00');

      expect(isDayPast(testWeekStart, 'mon', testDate)).toBe(false);
    });

    it('should return true for past days', () => {
      const testWeekStart = '2020-01-06';
      const testDate = new Date('2020-01-08T12:00:00');

      expect(isDayPast(testWeekStart, 'mon', testDate)).toBe(true);
      expect(isDayPast(testWeekStart, 'tue', testDate)).toBe(true);
      expect(isDayPast(testWeekStart, 'wed', testDate)).toBe(false);
      expect(isDayPast(testWeekStart, 'thu', testDate)).toBe(false);
    });

    it('should return false for future days', () => {
      const testWeekStart = '2020-01-06';
      const testDate = new Date('2020-01-08T12:00:00');

      expect(isDayPast(testWeekStart, 'thu', testDate)).toBe(false);
      expect(isDayPast(testWeekStart, 'fri', testDate)).toBe(false);
      expect(isDayPast(testWeekStart, 'sat', testDate)).toBe(false);
      expect(isDayPast(testWeekStart, 'sun', testDate)).toBe(false);
    });

    it('should handle end of week correctly', () => {
      const testWeekStart = '2020-01-06';
      const testDate = new Date('2020-01-12T12:00:00');

      expect(isDayPast(testWeekStart, 'mon', testDate)).toBe(true);
      expect(isDayPast(testWeekStart, 'sat', testDate)).toBe(true);
      expect(isDayPast(testWeekStart, 'sun', testDate)).toBe(false);
    });

    it('should handle a week fully in the past', () => {
      const testWeekStart = '2020-01-06';
      const testDate = new Date('2020-01-20T12:00:00');

      expect(isDayPast(testWeekStart, 'mon', testDate)).toBe(true);
      expect(isDayPast(testWeekStart, 'sun', testDate)).toBe(true);
    });
  });

  describe('invalid day handling', () => {
    it('should return false for invalid weekday', () => {
      const testDate = new Date('2020-01-08T12:00:00');
      const result = isDayPast('2020-01-06', 'invalid' as any, testDate);
      expect(result).toBe(false);
    });
  });

  describe('realistic planning scenarios', () => {
    it('allows planning when we are in the middle of the week', () => {
      const testWeekStart = '2020-01-06';
      const wednesdayAfternoon = new Date('2020-01-08T18:00:00');

      expect(isDayPast(testWeekStart, 'wed', wednesdayAfternoon)).toBe(false);
      expect(isDayPast(testWeekStart, 'mon', wednesdayAfternoon)).toBe(true);
      expect(isDayPast(testWeekStart, 'tue', wednesdayAfternoon)).toBe(true);
    });

    it('locks past days but keeps current day editable', () => {
      const testWeekStart = '2020-01-06';
      const friday = new Date('2020-01-10T15:00:00');

      expect(isDayPast(testWeekStart, 'mon', friday)).toBe(true);
      expect(isDayPast(testWeekStart, 'thu', friday)).toBe(true);
      expect(isDayPast(testWeekStart, 'fri', friday)).toBe(false);
    });
  });
});

describe('weekStartOf()', () => {
  it('should return Monday of the week containing the date', () => {
    const friday = new Date('2020-01-10T12:00:00');
    expect(weekStartOf(friday)).toBe('2020-01-06');

    const monday = new Date('2020-01-06T12:00:00');
    expect(weekStartOf(monday)).toBe('2020-01-06');

    const sunday = new Date('2020-01-12T12:00:00');
    expect(weekStartOf(sunday)).toBe('2020-01-06');
  });

  it('should use current date when not provided', () => {
    const result = weekStartOf();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('should handle date at year boundary', () => {
    const jan1 = new Date('2027-01-01T00:00:00');
    const result = weekStartOf(jan1);
    expect(result).toBe('2026-12-28');
  });
});

describe('currentWeekStart()', () => {
  it('should return a valid ISO date string', () => {
    const result = currentWeekStart();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('should return a Monday', () => {
    const result = currentWeekStart();
    const date = new Date(`${result}T00:00:00`);
    expect(date.getDay()).toBe(1);
  });
});

describe('nextWeekStart()', () => {
  it('should return the Monday of next week', () => {
    const result = nextWeekStart();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const resultDate = new Date(`${result}T00:00:00`);
    expect(resultDate.getDay()).toBe(1);
  });

  it('should be exactly 7 days after currentWeekStart', () => {
    const current = currentWeekStart();
    const next = nextWeekStart();

    const currentDate = new Date(`${current}T00:00:00`);
    const nextDate = new Date(`${next}T00:00:00`);

    const diff = nextDate.getTime() - currentDate.getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    expect(diff).toBe(sevenDaysMs);
  });
});

describe('weekStartFor()', () => {
  it('should return current week start for "this"', () => {
    const thisWeek = weekStartFor('this');
    const current = currentWeekStart();
    expect(thisWeek).toBe(current);
  });

  it('should return next week start for "next"', () => {
    const nextWeek = weekStartFor('next');
    const next = nextWeekStart();
    expect(nextWeek).toBe(next);
  });
});

describe('parseWeekChoice()', () => {
  it('should return "next" for "next"', () => {
    expect(parseWeekChoice('next')).toBe('next');
  });

  it('should return "this" for "this"', () => {
    expect(parseWeekChoice('this')).toBe('this');
  });

  it('should default to "this" for unexpected values', () => {
    expect(parseWeekChoice('invalid')).toBe('this');
    expect(parseWeekChoice('')).toBe('this');
    expect(parseWeekChoice(undefined)).toBe('this');
    expect(parseWeekChoice('NEXT')).toBe('this');
  });
});

describe('weekRangeLabel()', () => {
  it('should format week range correctly', () => {
    const label = weekRangeLabel('2020-01-06');
    expect(label).toMatch(/^\d+–\d+ \w+$/);
    expect(label).toContain('Jan');
  });

  it('should handle week spanning months', () => {
    const label = weekRangeLabel('2020-08-31');
    expect(label).toContain('Aug');
    expect(label).toContain('Sep');
  });

  it('should format correctly with same month', () => {
    const label = weekRangeLabel('2020-09-07');
    const matches = (label.match(/Sep/g) || []).length;
    expect(matches).toBe(1);
  });
});

describe('isoWeekNumber()', () => {
  it('should return valid ISO week number', () => {
    const date = new Date('2020-01-08T00:00:00');
    const weekNum = isoWeekNumber(date);
    expect(weekNum).toBeGreaterThan(0);
    expect(weekNum).toBeLessThanOrEqual(53);
  });

  it('should return same week number for days in same ISO week', () => {
    const monday = new Date('2020-01-06T00:00:00');
    const friday = new Date('2020-01-10T00:00:00');
    expect(isoWeekNumber(monday)).toBe(isoWeekNumber(friday));
  });

  it('should increment for next ISO week', () => {
    const thisWeekMonday = new Date('2020-01-06T00:00:00');
    const nextWeekMonday = new Date('2020-01-13T00:00:00');
    const thisWeekNum = isoWeekNumber(thisWeekMonday);
    const nextWeekNum = isoWeekNumber(nextWeekMonday);
    expect(nextWeekNum).toBe(thisWeekNum + 1);
  });
});
