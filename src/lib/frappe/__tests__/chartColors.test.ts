import { describe, it, expect } from 'vitest';
import { resolveSeriesColors, FRAPPE_DEFAULT_COLORS } from '../chartColors';

describe('resolveSeriesColors', () => {
  it('falls back to frappe-charts defaults when the chart stores no colour', () => {
    // "Stock Value by Item Group" is this shape — no color, no colors[], no y_axis.
    expect(resolveSeriesColors({}, 2)).toEqual([FRAPPE_DEFAULT_COLORS[0], FRAPPE_DEFAULT_COLORS[1]]);
  });

  it('cycles the default palette rather than running out', () => {
    const colors = resolveSeriesColors({}, FRAPPE_DEFAULT_COLORS.length + 1);
    expect(colors[FRAPPE_DEFAULT_COLORS.length]).toBe(FRAPPE_DEFAULT_COLORS[0]);
  });

  it('uses the chart `color` field for the first series only', () => {
    // Real: "Delivery Trends" -> #4d4da8.
    const colors = resolveSeriesColors({ color: '#4d4da8' }, 2);
    expect(colors[0]).toBe('#4d4da8');
    expect(colors[1]).toBe(FRAPPE_DEFAULT_COLORS[1]);
  });

  it('uses custom_options.colors per series', () => {
    // Real: "Project Summary".
    const colors = resolveSeriesColors(
      { custom_options: '{"type":"bar","colors":["#fc4f51","#78d6ff","#7575ff"]}' },
      3
    );
    expect(colors).toEqual(['#fc4f51', '#78d6ff', '#7575ff']);
  });

  it('prefers y_axis row colours over custom_options and color', () => {
    const colors = resolveSeriesColors(
      {
        color: '#111111',
        custom_options: '{"colors":["#222222","#333333"]}',
        y_axis: [{ y_field: 'a', color: '#aaaaaa' }, { y_field: 'b', color: '#bbbbbb' }],
      },
      2
    );
    expect(colors).toEqual(['#aaaaaa', '#bbbbbb']);
  });

  it('resolves each index independently when y_axis colours are partial', () => {
    const colors = resolveSeriesColors(
      { custom_options: '{"colors":["#222222","#333333"]}', y_axis: [{ y_field: 'a' }, { y_field: 'b', color: '#bbbbbb' }] },
      2
    );
    expect(colors).toEqual(['#222222', '#bbbbbb']);
  });

  it('translates frappe-charts preset colour NAMES to hex', () => {
    // A Color field may hold "blue" rather than a hex value.
    expect(resolveSeriesColors({ color: 'blue' }, 1)).toEqual(['#318AD8']);
  });

  it('uses a report-supplied palette when the chart itself stores none', () => {
    expect(resolveSeriesColors({}, 2, ['#123456', '#654321'])).toEqual(['#123456', '#654321']);
  });

  it("lets the chart's own config beat the report's palette", () => {
    const colors = resolveSeriesColors({ custom_options: '{"colors":["#aaaaaa"]}' }, 1, ['#123456']);
    expect(colors).toEqual(['#aaaaaa']);
  });

  it('ignores malformed custom_options instead of throwing', () => {
    expect(resolveSeriesColors({ custom_options: '{not json' }, 1)).toEqual([FRAPPE_DEFAULT_COLORS[0]]);
  });

  it('ignores blank colour values', () => {
    expect(resolveSeriesColors({ color: '   ' }, 1)).toEqual([FRAPPE_DEFAULT_COLORS[0]]);
  });

  it('returns an empty list for a chart with no series', () => {
    expect(resolveSeriesColors({ color: '#4d4da8' }, 0)).toEqual([]);
  });
});
