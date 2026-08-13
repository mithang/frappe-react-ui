import { describe, it, expect } from 'vitest';
import { formatNumber } from '../formatNumber';
import { DEFAULT_SYSTEM_SETTINGS, type SystemSettings } from '../settings';

function withFormat(number_format: string): SystemSettings {
  return { ...DEFAULT_SYSTEM_SETTINGS, number_format };
}

describe('formatNumber', () => {
  it('formats #,###.## (the System Settings default)', () => {
    expect(formatNumber(1234567.5, undefined, withFormat('#,###.##'))).toBe('1,234,567.50');
  });

  it('formats #.###,## (European style)', () => {
    expect(formatNumber(1234567.5, undefined, withFormat('#.###,##'))).toBe('1.234.567,50');
  });

  it('formats # ###.## (space grouping)', () => {
    expect(formatNumber(1234567.5, undefined, withFormat('# ###.##'))).toBe('1 234 567.50');
  });

  it("formats #'###.## (apostrophe grouping)", () => {
    expect(formatNumber(1234567.5, undefined, withFormat("#'###.##"))).toBe("1'234'567.50");
  });

  it('formats #,##,###.## (Indian grouping)', () => {
    expect(formatNumber(1234567.5, undefined, withFormat('#,##,###.##'))).toBe('12,34,567.50');
    expect(formatNumber(12345, undefined, withFormat('#,##,###.##'))).toBe('12,345.00');
    expect(formatNumber(123, undefined, withFormat('#,##,###.##'))).toBe('123.00');
  });

  it('formats #,###.### (3 decimal places)', () => {
    expect(formatNumber(1234.5, undefined, withFormat('#,###.###'))).toBe('1,234.500');
  });

  it('formats #.### (grouping only, no decimals)', () => {
    expect(formatNumber(1234567, undefined, withFormat('#.###'))).toBe('1.234.567');
  });

  it('formats #,### (grouping only, no decimals)', () => {
    expect(formatNumber(1234567, undefined, withFormat('#,###'))).toBe('1,234,567');
  });

  it('handles negative numbers', () => {
    expect(formatNumber(-1234.5, undefined, withFormat('#,###.##'))).toBe('-1,234.50');
  });

  it('respects an explicit decimals override', () => {
    expect(formatNumber(1234.5, { decimals: 0 }, withFormat('#,###.##'))).toBe('1,235');
  });

  it('returns "-" for null, undefined, and empty string', () => {
    expect(formatNumber(null)).toBe('-');
    expect(formatNumber(undefined)).toBe('-');
    expect(formatNumber('')).toBe('-');
  });

  it('returns the raw value stringified for non-numeric input, without throwing', () => {
    expect(formatNumber('not-a-number')).toBe('not-a-number');
  });

  it('accepts numeric strings', () => {
    expect(formatNumber('1234.5', undefined, withFormat('#,###.##'))).toBe('1,234.50');
  });
});
