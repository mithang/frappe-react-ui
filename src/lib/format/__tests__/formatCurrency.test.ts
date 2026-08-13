import { describe, it, expect } from 'vitest';
import { formatCurrency } from '../formatCurrency';
import { DEFAULT_SYSTEM_SETTINGS, type SystemSettings } from '../settings';

function withSettings(overrides: Partial<SystemSettings>): SystemSettings {
  return { ...DEFAULT_SYSTEM_SETTINGS, ...overrides };
}

describe('formatCurrency', () => {
  it('formats with currency_precision when set', () => {
    expect(
      formatCurrency(1234.5, undefined, withSettings({ currency_precision: 3, float_precision: 2 }))
    ).toBe('1,234.500');
  });

  it('falls back to float_precision when currency_precision is unset (per System Settings description)', () => {
    expect(
      formatCurrency(1234.5, undefined, withSettings({ currency_precision: null, float_precision: 4 }))
    ).toBe('1,234.5000');
  });

  it('defaults to 2 decimal places when neither precision is set', () => {
    expect(
      formatCurrency(1234.5, undefined, withSettings({ currency_precision: null, float_precision: null }))
    ).toBe('1,234.50');
  });

  it('prefixes an explicit currency symbol when provided', () => {
    expect(
      formatCurrency(1234.5, { currencySymbol: '$' }, withSettings({ currency_precision: 2 }))
    ).toBe('$ 1,234.50');
  });

  it('does not guess a currency symbol when none is provided', () => {
    expect(formatCurrency(1234.5, undefined, withSettings({ currency_precision: 2 }))).toBe('1,234.50');
  });

  it('respects number_format grouping style', () => {
    expect(
      formatCurrency(1234.5, undefined, withSettings({ currency_precision: 2, number_format: '#.###,##' }))
    ).toBe('1.234,50');
  });

  it('returns "-" for null, undefined, and empty string', () => {
    expect(formatCurrency(null)).toBe('-');
    expect(formatCurrency(undefined)).toBe('-');
    expect(formatCurrency('')).toBe('-');
  });

  it('returns the raw value stringified for non-numeric input, without throwing', () => {
    expect(formatCurrency('not-a-number')).toBe('not-a-number');
  });
});
