import type { RecurrenceRule } from '@/types/types';

// RFC 5545 weekday codes → JS Date.getDay() values
const WEEKDAY_MAP: Record<string, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDaysLocal(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonthsLocal(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function addYearsLocal(date: Date, years: number): Date {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

function parseUntil(until: string): Date {
  // Handle both compact CalDAV format (20251231T235959Z) and ISO-8601 (2025-12-31)
  return new Date(until);
}

/**
 * Given a recurrence rule, an anchor (the original due date), and a reference
 * date (`after`), returns the next occurrence date strictly AFTER `after`.
 *
 * Returns `null` if the series has terminated (until/count exceeded).
 *
 * @param rule          The recurrence rule
 * @param anchor        The original task due date (series start)
 * @param after         Find the next occurrence strictly after this date
 * @param completedCount Number of already-completed instances (for count enforcement)
 */
export function nextOccurrence(
  rule: RecurrenceRule,
  anchor: Date,
  after: Date,
  completedCount = 0
): Date | null {
  const interval = rule.interval ?? 1;
  const anchorDay = startOfDay(anchor);
  const afterDay = startOfDay(after);

  // count enforcement: if we've already completed `count` instances, no more
  if (rule.count !== undefined && completedCount >= rule.count) {
    return null;
  }

  let next: Date | null = null;

  switch (rule.freq) {
    case 'daily': {
      // Advance from anchor by multiples of interval days until past afterDay
      let candidate = anchorDay;
      while (candidate <= afterDay) {
        candidate = addDaysLocal(candidate, interval);
      }
      next = candidate;
      break;
    }

    case 'weekly': {
      if (!rule.byDay || rule.byDay.length === 0) {
        // Simple weekly: advance by interval * 7 days
        let candidate = anchorDay;
        while (candidate <= afterDay) {
          candidate = addDaysLocal(candidate, interval * 7);
        }
        next = candidate;
      } else {
        // Find the week number of anchor (used for interval-week skipping)
        const anchorMs = anchorDay.getTime();
        const weekMs = 7 * 24 * 60 * 60 * 1000;

        // Collect the valid weekdays from byDay
        const validDays = rule.byDay.map((d) => WEEKDAY_MAP[d]).filter((d) => d !== undefined);

        // Start searching from afterDay + 1
        let searchDate = addDaysLocal(afterDay, 1);

        // Cap search to avoid infinite loops
        const limit = addDaysLocal(afterDay, 365 * 2);

        while (searchDate <= limit) {
          const dayOfWeek = searchDate.getDay();
          if (validDays.includes(dayOfWeek)) {
            // Check interval: number of full weeks from anchor
            const weeksSinceAnchor = Math.floor(
              (searchDate.getTime() - anchorMs) / weekMs
            );
            // The week containing the anchor is week 0
            // We want weeks that are multiples of interval (week 0, interval, 2*interval, …)
            // But we need to find which "interval-week" searchDate is in
            const weekOfInterval = Math.floor(weeksSinceAnchor / interval);
            const startOfIntervalWeek = addDaysLocal(
              anchorDay,
              weekOfInterval * interval * 7
            );
            const endOfIntervalWeek = addDaysLocal(startOfIntervalWeek, 7);

            if (searchDate >= startOfIntervalWeek && searchDate < endOfIntervalWeek) {
              next = searchDate;
              break;
            }
          }
          searchDate = addDaysLocal(searchDate, 1);
        }
      }
      break;
    }

    case 'monthly': {
      // Advance by interval months from anchor until past afterDay
      let candidate = anchorDay;
      while (candidate <= afterDay) {
        candidate = addMonthsLocal(candidate, interval);
      }
      // Apply byMonthDay if specified
      if (rule.byMonthDay && rule.byMonthDay.length > 0) {
        const day = rule.byMonthDay[0];
        candidate = new Date(candidate.getFullYear(), candidate.getMonth(), day);
        // If the resulting date is still <= afterDay, advance another interval
        if (candidate <= afterDay) {
          candidate = addMonthsLocal(candidate, interval);
          candidate = new Date(candidate.getFullYear(), candidate.getMonth(), day);
        }
      }
      next = candidate;
      break;
    }

    case 'yearly': {
      let candidate = anchorDay;
      while (candidate <= afterDay) {
        candidate = addYearsLocal(candidate, interval);
      }
      next = candidate;
      break;
    }

    default:
      return null;
  }

  if (!next) return null;

  // Enforce until
  if (rule.until) {
    const untilDate = parseUntil(rule.until);
    if (next > untilDate) return null;
  }

  return next;
}

/**
 * Returns all occurrence dates of a recurring rule that fall within
 * [rangeStart, rangeEnd] (inclusive).
 *
 * @param rule          The recurrence rule
 * @param anchor        The original task due date (series start)
 * @param rangeStart    Start of the window (inclusive)
 * @param rangeEnd      End of the window (inclusive)
 * @param completedCount Number of already-completed instances (for count enforcement)
 */
export function getOccurrencesBetween(
  rule: RecurrenceRule,
  anchor: Date,
  rangeStart: Date,
  rangeEnd: Date,
  completedCount = 0
): Date[] {
  const MAX_ITERATIONS = 500;
  const results: Date[] = [];
  let iterations = 0;
  let instanceCount = completedCount; // track for count enforcement

  // Start stepping from the anchor or from a day before rangeStart — whichever is earlier
  // We step forward from anchor, so begin from the anchor itself
  let current = startOfDay(anchor);
  const rangeStartDay = startOfDay(rangeStart);
  const rangeEndDay = startOfDay(rangeEnd);

  // Fast-forward: if anchor is much earlier than rangeStart, skip ahead
  // by stepping from just before rangeStart
  const stepBefore = addDaysLocal(rangeStartDay, -1);
  if (current < stepBefore) {
    // Find first occurrence at or after (rangeStart - 1 day)
    const first = nextOccurrence(rule, anchor, stepBefore, instanceCount);
    if (!first) return results;
    // If that first is before rangeStart, we'll include it only if it's in range
    current = addDaysLocal(first, -1); // set current so that next call gives first
    // But we need to re-derive by tracking: set current to the occurrence before first
    // Simpler: just use first if it's in range, otherwise use nextOccurrence from first
    if (first >= rangeStartDay && first <= rangeEndDay) {
      results.push(first);
      instanceCount++;
    }
    current = first;
  }

  while (iterations < MAX_ITERATIONS) {
    iterations++;
    const occ = nextOccurrence(rule, anchor, current, instanceCount);
    if (!occ) break;
    if (occ > rangeEndDay) break;
    if (occ >= rangeStartDay) {
      results.push(occ);
      instanceCount++;
    }
    current = occ;
  }

  return results;
}

/**
 * Convert a RecurrenceRule to an RRULE string (without DTSTART prefix).
 * Used for CalDAV serialization and FullCalendar rrule plugin.
 */
export function rruleToString(rule: RecurrenceRule): string {
  const parts: string[] = [`FREQ=${rule.freq.toUpperCase()}`];

  if (rule.interval && rule.interval > 1) {
    parts.push(`INTERVAL=${rule.interval}`);
  }
  if (rule.byDay && rule.byDay.length > 0) {
    parts.push(`BYDAY=${rule.byDay.join(',')}`);
  }
  if (rule.byMonthDay && rule.byMonthDay.length > 0) {
    parts.push(`BYMONTHDAY=${rule.byMonthDay.join(',')}`);
  }
  if (rule.until) {
    // Normalize to compact CalDAV format if it's an ISO date
    const d = new Date(rule.until);
    if (!isNaN(d.getTime())) {
      const y = d.getUTCFullYear();
      const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dy = String(d.getUTCDate()).padStart(2, '0');
      parts.push(`UNTIL=${y}${mo}${dy}T235959Z`);
    } else {
      parts.push(`UNTIL=${rule.until}`);
    }
  }
  if (rule.count) {
    parts.push(`COUNT=${rule.count}`);
  }

  return parts.join(';');
}
