// Number display formatting driven by System Settings' `number_format`, instead of
// `Number.prototype.toLocaleString()` (browser-locale-dependent, ignores the bench's configured
// grouping/decimal style entirely).
//
// The format vocabulary below is exactly the `options` list of the `number_format` Select field
// on System Settings (frappe/frappe/core/doctype/system_settings/system_settings.json):
//   "#,###.##\n#.###,##\n# ###.##\n# ###,##\n#'###.##\n#, ###.##\n#,##,###.##\n#,###.###\n#.###\n#,###"
// Ten concrete formats — western 3-digit grouping with comma/dot/space/apostrophe/", " group
// separators and either "." or "," (or no) decimal separator, one Indian-style grouping
// (first group of 3 from the decimal point, then groups of 2), and two grouping-only (no
// decimal places) formats.

import { getCachedSystemSettings, type SystemSettings } from './settings';

interface NumberFormatSpec {
  groupSep: string;
  decimalSep: string | null;
  decimals: number;
  indian: boolean;
}

const FORMAT_TABLE: Record<string, NumberFormatSpec> = {
  '#,###.##': { groupSep: ',', decimalSep: '.', decimals: 2, indian: false },
  '#.###,##': { groupSep: '.', decimalSep: ',', decimals: 2, indian: false },
  '# ###.##': { groupSep: ' ', decimalSep: '.', decimals: 2, indian: false },
  '# ###,##': { groupSep: ' ', decimalSep: ',', decimals: 2, indian: false },
  "#'###.##": { groupSep: "'", decimalSep: '.', decimals: 2, indian: false },
  '#, ###.##': { groupSep: ', ', decimalSep: '.', decimals: 2, indian: false },
  '#,##,###.##': { groupSep: ',', decimalSep: '.', decimals: 2, indian: true },
  '#,###.###': { groupSep: ',', decimalSep: '.', decimals: 3, indian: false },
  '#.###': { groupSep: '.', decimalSep: null, decimals: 0, indian: false },
  '#,###': { groupSep: ',', decimalSep: null, decimals: 0, indian: false },
};

const DEFAULT_SPEC = FORMAT_TABLE['#,###.##'];

function specFor(format: string): NumberFormatSpec {
  return FORMAT_TABLE[format] ?? DEFAULT_SPEC;
}

/** Groups a non-negative integer-part digit string per the format's grouping rule. */
function groupIntegerPart(digits: string, spec: NumberFormatSpec): string {
  if (digits.length <= 3) return digits;

  if (spec.indian) {
    // Indian grouping: last 3 digits form one group, then groups of 2 to the left.
    const lastThree = digits.slice(-3);
    let rest = digits.slice(0, -3);
    const groups: string[] = [];
    while (rest.length > 2) {
      groups.unshift(rest.slice(-2));
      rest = rest.slice(0, -2);
    }
    if (rest) groups.unshift(rest);
    return [...groups, lastThree].join(spec.groupSep);
  }

  // Regular grouping: 3 digits per group from the right.
  const groups: string[] = [];
  let rest = digits;
  while (rest.length > 3) {
    groups.unshift(rest.slice(-3));
    rest = rest.slice(0, -3);
  }
  if (rest) groups.unshift(rest);
  return groups.join(spec.groupSep);
}

export interface FormatNumberOptions {
  /** Overrides the decimal-place count baked into the `number_format` string (e.g. currency
   * precision). Leave unset to use the format's own decimal count. */
  decimals?: number;
}

/**
 * Formats a raw numeric value per the given (or cached) System Settings `number_format`.
 * - null/undefined/empty-string input -> "-"
 * - non-numeric input -> the raw value stringified (never throws)
 */
export function formatNumber(
  value: unknown,
  options?: FormatNumberOptions,
  settings?: SystemSettings
): string {
  if (value === null || value === undefined || value === '') return '-';

  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return String(value);

  const spec = specFor((settings ?? getCachedSystemSettings()).number_format);
  const decimals = options?.decimals ?? spec.decimals;

  const negative = num < 0;
  const fixed = Math.abs(num).toFixed(decimals);
  const [intPart, decPart] = fixed.split('.');

  const groupedInt = groupIntegerPart(intPart, spec);
  const decimalSep = spec.decimalSep ?? '.';
  const withDecimals = decPart ? `${groupedInt}${decimalSep}${decPart}` : groupedInt;

  return negative ? `-${withDecimals}` : withDecimals;
}
