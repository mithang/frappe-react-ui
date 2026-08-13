import { describe, it, expect } from 'vitest';
import { formatDate } from '../formatDate';
import { DEFAULT_SYSTEM_SETTINGS, type SystemSettings } from '../settings';

function withFormat(date_format: string): SystemSettings {
  return { ...DEFAULT_SYSTEM_SETTINGS, date_format };
}

describe('formatDate', () => {
  it('formats yyyy-mm-dd (the System Settings default)', () => {
    expect(formatDate('2026-08-13', withFormat('yyyy-mm-dd'))).toBe('2026-08-13');
  });

  it('formats dd-mm-yyyy', () => {
    expect(formatDate('2026-08-13', withFormat('dd-mm-yyyy'))).toBe('13-08-2026');
  });

  it('formats dd/mm/yyyy', () => {
    expect(formatDate('2026-08-13', withFormat('dd/mm/yyyy'))).toBe('13/08/2026');
  });

  it('formats mm/dd/yyyy', () => {
    expect(formatDate('2026-08-13', withFormat('mm/dd/yyyy'))).toBe('08/13/2026');
  });

  it('formats mm-dd-yyyy', () => {
    expect(formatDate('2026-08-13', withFormat('mm-dd-yyyy'))).toBe('08-13-2026');
  });

  it('formats dd.mm.yyyy', () => {
    expect(formatDate('2026-08-13', withFormat('dd.mm.yyyy'))).toBe('13.08.2026');
  });

  it('handles a datetime value (date part only)', () => {
    expect(formatDate('2026-08-13 14:30:00', withFormat('yyyy-mm-dd'))).toBe('2026-08-13');
  });

  it('pads single-digit day/month', () => {
    expect(formatDate('2026-01-05', withFormat('dd-mm-yyyy'))).toBe('05-01-2026');
  });

  it('returns "-" for null, undefined, and empty string', () => {
    expect(formatDate(null)).toBe('-');
    expect(formatDate(undefined)).toBe('-');
    expect(formatDate('')).toBe('-');
  });

  it('returns the raw value stringified for an unparseable date, without throwing', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });

  it('falls back to the default format when no settings are passed (cached defaults)', () => {
    expect(formatDate('2026-08-13')).toBe('2026-08-13');
  });
});
