import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function minutesToHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function hhmmToMinutes(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10);
  const [hPart, mPart] = trimmed.split(':');
  const h = parseInt(hPart ?? '0', 10);
  const m = parseInt(mPart ?? '0', 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

/**
 * Construct a local-time Date from a YYYY-MM-DD string, avoiding the UTC
 * midnight shift that `new Date('YYYY-MM-DD')` produces.
 */
export function localDateFromString(dateStr: string, hours = 0, minutes = 0): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, hours, minutes, 0, 0);
}

/**
 * Parse any date string in local time.
 * - Plain YYYY-MM-DD → local midnight via localDateFromString.
 * - ISO datetime strings (contain 'T') → standard Date constructor.
 */
function parseDate(date: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? localDateFromString(date) : new Date(date);
}

export function formatDate(date: string | null, format: 'short' | 'long' = 'short'): string {
  if (!date) return '';
  const d = parseDate(date);
  if (format === 'short') {
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

export function isToday(date: string | null): boolean {
  if (!date) return false;
  const d = parseDate(date);
  const today = new Date();
  return d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
}

export function isOverdue(date: string | null): boolean {
  if (!date) return false;
  const d = parseDate(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}
