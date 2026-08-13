import { describe, it, expect, vi, afterEach } from 'vitest';
import { prettyDate } from '../prettyDate';

/** Frappe's wire format: "YYYY-MM-DD HH:mm:ss.ffffff", local time, space-separated. */
function frappeStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.000000`;
}

function agoBy(ms: number): string {
  return frappeStamp(new Date(Date.now() - ms));
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe('prettyDate', () => {
  afterEach(() => vi.useRealTimers());

  it('returns empty string for absent input', () => {
    expect(prettyDate(undefined)).toBe('');
    expect(prettyDate(null)).toBe('');
    expect(prettyDate('')).toBe('');
  });

  it('returns empty string for unparseable input rather than "Invalid Date"', () => {
    expect(prettyDate('not a date')).toBe('');
  });

  it('handles same-day buckets', () => {
    expect(prettyDate(agoBy(10_000))).toBe('just now');
    expect(prettyDate(agoBy(90 * 1000))).toBe('1 minute ago');
    expect(prettyDate(agoBy(30 * MIN))).toBe('30 minutes ago');
    expect(prettyDate(agoBy(90 * MIN))).toBe('1 hour ago');
  });

  it('uses calendar-day boundaries, not elapsed 24h windows', () => {
    // Fixed midday "now" so "yesterday" can't be ambiguous.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 20, 12, 0, 0));
    expect(prettyDate('2026-05-19 23:30:00')).toBe('yesterday');
    expect(prettyDate('2026-05-18 01:00:00')).toBe('2 days ago');
  });

  it('handles week/month/year buckets', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 20, 12, 0, 0));
    expect(prettyDate(frappeStamp(new Date(2026, 4, 10, 12, 0, 0)))).toBe('1 week ago');
    // Frappe's week bucket runs to day 30 inclusive, so a 30-day gap is "4 weeks ago", NOT
    // "1 month ago" — the month bucket only starts at day 31.
    expect(prettyDate(frappeStamp(new Date(2026, 3, 20, 12, 0, 0)))).toBe('4 weeks ago');
    expect(prettyDate(frappeStamp(new Date(2026, 3, 10, 12, 0, 0)))).toBe('1 month ago');
    expect(prettyDate(frappeStamp(new Date(2025, 4, 20, 12, 0, 0)))).toBe('1 year ago');
  });

  it('renders nothing for future dates, matching Desk', () => {
    expect(prettyDate(frappeStamp(new Date(Date.now() + 2 * DAY)))).toBe('');
  });

  it('supports the compact form used where space is tight', () => {
    expect(prettyDate(agoBy(10_000), true)).toBe('now');
    expect(prettyDate(agoBy(30 * MIN), true)).toBe('30 m');
    expect(prettyDate(agoBy(5 * HOUR), true)).toBe('5 h');
  });

  it('accepts an ISO string with T/Z separators', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 20, 12, 0, 0));
    expect(prettyDate('2026-05-19T23:30:00')).toBe('yesterday');
  });
});
