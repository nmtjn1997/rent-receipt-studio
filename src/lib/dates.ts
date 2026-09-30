import type { DateFormat } from './types';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October',
  'November', 'December',
];

const pad = (n: number) => String(n).padStart(2, '0');

export function parseISO(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d };
}

export function toISO(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function isValidISO(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const { y, m, d } = parseISO(iso);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

export function formatDate(iso: string, style: DateFormat): string {
  const { y, m, d } = parseISO(iso);
  if (style === 'dmy') return `${pad(d)}/${pad(m)}/${y}`;
  if (style === 'long') return `${d} ${MONTHS_LONG[m - 1]} ${y}`;
  return `${MONTHS_SHORT[m - 1]} ${d}, ${y}`;
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS_SHORT[m - 1]} ${y}`;
}

export function fyLabel(fyStart: number): string {
  return `${fyStart}-${String((fyStart + 1) % 100).padStart(2, '0')}`;
}

export function fyBounds(fyStart: number): { from: string; to: string } {
  return { from: toISO(fyStart, 4, 1), to: toISO(fyStart + 1, 3, 31) };
}

/** Financial year (India) that contains the given ISO date. */
export function fyOf(iso: string): number {
  const { y, m } = parseISO(iso);
  return m >= 4 ? y : y - 1;
}

export function todayISO(now = new Date()): string {
  return toISO(now.getFullYear(), now.getMonth() + 1, now.getDate());
}
