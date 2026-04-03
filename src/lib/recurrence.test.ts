import { describe, it, expect } from 'vitest';
import { nextOccurrence, getOccurrencesBetween, rruleToString } from './recurrence';
import type { RecurrenceRule } from '@/types/types';

function d(dateStr: string): Date {
  // Parse as local date
  const [y, m, day] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, day);
}

function fmt(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

describe('nextOccurrence', () => {
  describe('daily', () => {
    it('returns the next day for interval=1', () => {
      const rule: RecurrenceRule = { freq: 'daily', interval: 1 };
      const anchor = d('2026-01-01');
      const after = d('2026-01-05');
      const result = nextOccurrence(rule, anchor, after);
      expect(result).not.toBeNull();
      expect(fmt(result!)).toBe('2026-01-06');
    });

    it('respects interval=3', () => {
      const rule: RecurrenceRule = { freq: 'daily', interval: 3 };
      const anchor = d('2026-01-01');
      const after = d('2026-01-03');
      const result = nextOccurrence(rule, anchor, after);
      expect(result).not.toBeNull();
      expect(fmt(result!)).toBe('2026-01-04');
    });

    it('returns null when past until', () => {
      const rule: RecurrenceRule = { freq: 'daily', interval: 1, until: '2026-01-03' };
      const anchor = d('2026-01-01');
      const after = d('2026-01-03');
      const result = nextOccurrence(rule, anchor, after);
      expect(result).toBeNull();
    });

    it('returns null when count exhausted', () => {
      const rule: RecurrenceRule = { freq: 'daily', interval: 1, count: 3 };
      const anchor = d('2026-01-01');
      const after = d('2026-01-03');
      // 3 completions already done
      const result = nextOccurrence(rule, anchor, after, 3);
      expect(result).toBeNull();
    });

    it('returns next when count not yet exhausted', () => {
      const rule: RecurrenceRule = { freq: 'daily', interval: 1, count: 5 };
      const anchor = d('2026-01-01');
      const after = d('2026-01-03');
      const result = nextOccurrence(rule, anchor, after, 3);
      expect(result).not.toBeNull();
      expect(fmt(result!)).toBe('2026-01-04');
    });
  });

  describe('weekly without byDay', () => {
    it('returns next week for interval=1', () => {
      const rule: RecurrenceRule = { freq: 'weekly', interval: 1 };
      const anchor = d('2026-01-05'); // Monday
      const after = d('2026-01-05');
      const result = nextOccurrence(rule, anchor, after);
      expect(result).not.toBeNull();
      expect(fmt(result!)).toBe('2026-01-12');
    });

    it('respects interval=2 (biweekly)', () => {
      const rule: RecurrenceRule = { freq: 'weekly', interval: 2 };
      const anchor = d('2026-01-05'); // Monday
      const after = d('2026-01-05');
      const result = nextOccurrence(rule, anchor, after);
      expect(result).not.toBeNull();
      expect(fmt(result!)).toBe('2026-01-19');
    });
  });

  describe('weekly with byDay', () => {
    it('returns next MO/WE/FR occurrence', () => {
      const rule: RecurrenceRule = { freq: 'weekly', interval: 1, byDay: ['MO', 'WE', 'FR'] };
      const anchor = d('2026-01-05'); // Monday
      // after = Tuesday Jan 6 → next is Wednesday Jan 7
      const after = d('2026-01-06');
      const result = nextOccurrence(rule, anchor, after);
      expect(result).not.toBeNull();
      expect(fmt(result!)).toBe('2026-01-07');
    });

    it('wraps to next week when no more days this week', () => {
      const rule: RecurrenceRule = { freq: 'weekly', interval: 1, byDay: ['MO', 'WE', 'FR'] };
      const anchor = d('2026-01-05'); // Monday
      // after = Friday Jan 9 → next is Monday Jan 12
      const after = d('2026-01-09');
      const result = nextOccurrence(rule, anchor, after);
      expect(result).not.toBeNull();
      expect(fmt(result!)).toBe('2026-01-12');
    });

    it('respects interval=2 with byDay', () => {
      // Every 2 weeks on Monday
      const rule: RecurrenceRule = { freq: 'weekly', interval: 2, byDay: ['MO'] };
      const anchor = d('2026-01-05'); // Monday Jan 5 = week 0
      // Jan 12 is week 1 (skip), Jan 19 is week 2 (valid)
      const after = d('2026-01-05');
      const result = nextOccurrence(rule, anchor, after);
      expect(result).not.toBeNull();
      expect(fmt(result!)).toBe('2026-01-19');
    });
  });

  describe('monthly', () => {
    it('returns next month for interval=1', () => {
      const rule: RecurrenceRule = { freq: 'monthly', interval: 1 };
      const anchor = d('2026-01-15');
      const after = d('2026-01-15');
      const result = nextOccurrence(rule, anchor, after);
      expect(result).not.toBeNull();
      expect(fmt(result!)).toBe('2026-02-15');
    });

    it('respects byMonthDay', () => {
      const rule: RecurrenceRule = { freq: 'monthly', interval: 1, byMonthDay: [20] };
      const anchor = d('2026-01-20');
      const after = d('2026-01-20');
      const result = nextOccurrence(rule, anchor, after);
      expect(result).not.toBeNull();
      expect(fmt(result!)).toBe('2026-02-20');
    });

    it('returns null when past until', () => {
      const rule: RecurrenceRule = { freq: 'monthly', interval: 1, until: '2026-02-01' };
      const anchor = d('2026-01-15');
      const after = d('2026-01-15');
      const result = nextOccurrence(rule, anchor, after);
      expect(result).toBeNull();
    });
  });

  describe('yearly', () => {
    it('returns next year for interval=1', () => {
      const rule: RecurrenceRule = { freq: 'yearly', interval: 1 };
      const anchor = d('2026-03-15');
      const after = d('2026-03-15');
      const result = nextOccurrence(rule, anchor, after);
      expect(result).not.toBeNull();
      expect(fmt(result!)).toBe('2027-03-15');
    });

    it('respects interval=2', () => {
      const rule: RecurrenceRule = { freq: 'yearly', interval: 2 };
      const anchor = d('2026-03-15');
      const after = d('2026-03-15');
      const result = nextOccurrence(rule, anchor, after);
      expect(result).not.toBeNull();
      expect(fmt(result!)).toBe('2028-03-15');
    });
  });
});

describe('getOccurrencesBetween', () => {
  it('returns daily occurrences in a 14-day window', () => {
    const rule: RecurrenceRule = { freq: 'daily', interval: 1 };
    const anchor = d('2026-01-01');
    const rangeStart = d('2026-01-05');
    const rangeEnd = d('2026-01-18');
    const results = getOccurrencesBetween(rule, anchor, rangeStart, rangeEnd);
    // Jan 5 to Jan 18 = 14 days inclusive
    expect(results.length).toBe(14);
    expect(fmt(results[0])).toBe('2026-01-05');
    expect(fmt(results[13])).toBe('2026-01-18');
  });

  it('returns weekly occurrences in a 30-day window', () => {
    const rule: RecurrenceRule = { freq: 'weekly', interval: 1 };
    const anchor = d('2026-01-01'); // Thursday
    const rangeStart = d('2026-01-01');
    const rangeEnd = d('2026-01-31');
    const results = getOccurrencesBetween(rule, anchor, rangeStart, rangeEnd);
    // Jan 1, 8, 15, 22, 29 = 5 Thursdays
    // But anchor itself is the first occurrence — note: getOccurrencesBetween starts from anchor
    // and returns dates in [rangeStart, rangeEnd], including anchor if it's in range
    expect(results.length).toBeGreaterThanOrEqual(4);
    results.forEach((r) => {
      const dayOfWeek = r.getDay();
      expect(dayOfWeek).toBe(4); // Thursday
    });
  });

  it('respects until termination', () => {
    const rule: RecurrenceRule = { freq: 'daily', interval: 1, until: '2026-01-10' };
    const anchor = d('2026-01-01');
    const rangeStart = d('2026-01-01');
    const rangeEnd = d('2026-01-20');
    const results = getOccurrencesBetween(rule, anchor, rangeStart, rangeEnd);
    // Should stop at Jan 10
    expect(results.every((r) => r <= d('2026-01-10'))).toBe(true);
    expect(results.length).toBeLessThanOrEqual(10);
  });

  it('returns byDay weekly occurrences in 14-day window', () => {
    const rule: RecurrenceRule = { freq: 'weekly', interval: 1, byDay: ['MO', 'WE', 'FR'] };
    const anchor = d('2026-01-05'); // Monday
    const rangeStart = d('2026-01-05');
    const rangeEnd = d('2026-01-18'); // 14 days
    const results = getOccurrencesBetween(rule, anchor, rangeStart, rangeEnd);
    // Mon Jan 5, Wed Jan 7, Fri Jan 9, Mon Jan 12, Wed Jan 14, Fri Jan 16
    // (Jan 18 is Sunday, not in byDay)
    expect(results.length).toBeGreaterThanOrEqual(5);
    results.forEach((r) => {
      const dow = r.getDay();
      expect([1, 3, 5]).toContain(dow); // Mon, Wed, Fri
    });
  });

  it('returns empty array when anchor is after range', () => {
    const rule: RecurrenceRule = { freq: 'daily', interval: 1 };
    const anchor = d('2026-02-01');
    const rangeStart = d('2026-01-01');
    const rangeEnd = d('2026-01-31');
    const results = getOccurrencesBetween(rule, anchor, rangeStart, rangeEnd);
    expect(results.length).toBe(0);
  });
});

describe('rruleToString', () => {
  it('serializes daily rule', () => {
    const rule: RecurrenceRule = { freq: 'daily', interval: 1 };
    expect(rruleToString(rule)).toBe('FREQ=DAILY');
  });

  it('serializes weekly with byDay', () => {
    const rule: RecurrenceRule = { freq: 'weekly', interval: 1, byDay: ['MO', 'WE', 'FR'] };
    expect(rruleToString(rule)).toBe('FREQ=WEEKLY;BYDAY=MO,WE,FR');
  });

  it('serializes monthly with byMonthDay', () => {
    const rule: RecurrenceRule = { freq: 'monthly', interval: 1, byMonthDay: [15] };
    expect(rruleToString(rule)).toBe('FREQ=MONTHLY;BYMONTHDAY=15');
  });

  it('includes interval when > 1', () => {
    const rule: RecurrenceRule = { freq: 'weekly', interval: 2 };
    expect(rruleToString(rule)).toBe('FREQ=WEEKLY;INTERVAL=2');
  });

  it('includes count', () => {
    const rule: RecurrenceRule = { freq: 'daily', interval: 1, count: 10 };
    expect(rruleToString(rule)).toBe('FREQ=DAILY;COUNT=10');
  });
});
