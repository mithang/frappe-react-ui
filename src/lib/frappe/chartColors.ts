// Resolves the series colours for a Dashboard Chart from what Frappe already stores.
//
// Frappe keeps chart colour in THREE places, most specific first:
//   1. the `y_axis` child table (Dashboard Chart Field: y_field + color) — per-series
//   2. `custom_options` JSON -> `colors: [...]`                          — per-series
//   3. the `color` field (Color)                                        — one colour
// Verified on this bench: 4 of 49 charts set `color` (Delivery Trends -> #4d4da8) and 2 declare a
// `colors` array in custom_options (Project Summary -> ["#fc4f51","#78d6ff","#7575ff"]).
//
// Charts that store nothing fall back to frappe-charts' own DEFAULT_CHART_COLORS, so an
// unconfigured chart looks the way it does in Desk rather than picking up this app's theme.

/** frappe-charts PRESET_COLOR_MAP — `color` fields may hold a NAME ("blue") rather than a hex. */
const PRESET_COLOR_MAP: Record<string, string> = {
  pink: '#F683AE',
  blue: '#318AD8',
  green: '#48BB74',
  grey: '#A6B1B9',
  red: '#F56B6B',
  yellow: '#FACF7A',
  purple: '#44427B',
  teal: '#5FD8C4',
  cyan: '#15CCEF',
  orange: '#F8814F',
  'light-pink': '#FED7E5',
  'light-blue': '#BFDDF7',
  'light-green': '#48BB74',
  'light-grey': '#F4F5F6',
  'light-red': '#F6DFDF',
  'light-yellow': '#FEE9BF',
  'light-purple': '#E8E8F7',
  'light-teal': '#D3FDF6',
  'light-cyan': '#DDF8FD',
  'light-orange': '#FECDB8',
};

/** frappe-charts DEFAULT_CHART_COLORS (constants.js), resolved to hex. */
export const FRAPPE_DEFAULT_COLORS = [
  'pink',
  'blue',
  'green',
  'grey',
  'red',
  'yellow',
  'purple',
  'teal',
  'cyan',
  'orange',
].map((name) => PRESET_COLOR_MAP[name]);

/** frappe-charts' getColor: a preset name resolves to hex, anything else passes through. */
function normalizeColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return PRESET_COLOR_MAP[trimmed] ?? trimmed;
}

function parseCustomOptionColors(customOptions: unknown): (string | null)[] {
  if (typeof customOptions !== 'string' || !customOptions.trim()) return [];
  try {
    const colors = JSON.parse(customOptions)?.colors;
    return Array.isArray(colors) ? colors.map(normalizeColor) : [];
  } catch {
    return [];
  }
}

export interface ChartColorSources {
  color?: unknown;
  custom_options?: unknown;
  /** Dashboard Chart Field rows, each optionally carrying its own `color`. */
  y_axis?: unknown;
}

/**
 * Colours for a chart's series. Each index is resolved independently so a chart that colours only
 * its second y-axis still gets a sensible colour for the first, rather than falling off the
 * configured list entirely.
 */
export function resolveSeriesColors(
  chartDoc: ChartColorSources | null | undefined,
  seriesCount: number,
  reportColors?: unknown
): string[] {
  const yAxisColors = Array.isArray(chartDoc?.y_axis)
    ? (chartDoc.y_axis as { color?: unknown }[]).map((row) => normalizeColor(row?.color))
    : [];
  const optionColors = parseCustomOptionColors(chartDoc?.custom_options);
  const docColor = normalizeColor(chartDoc?.color);
  const fromReport = Array.isArray(reportColors) ? reportColors.map(normalizeColor) : [];

  return Array.from({ length: Math.max(seriesCount, 0) }, (_, i) => {
    return (
      yAxisColors[i] ||
      optionColors[i] ||
      // A single `color` describes the chart as a whole — apply it to the first series only, the
      // way frappe-charts does, and let the rest continue through the default palette.
      (i === 0 ? docColor : null) ||
      fromReport[i] ||
      FRAPPE_DEFAULT_COLORS[i % FRAPPE_DEFAULT_COLORS.length]
    );
  });
}
