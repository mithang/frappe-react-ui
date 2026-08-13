// Date display formatting driven by System Settings' `date_format`, instead of
// `new Date(...).toLocaleDateString()` (browser-locale-dependent, ignores the bench's configured
// format entirely — see src/views/lists/SmartList.tsx's old `formatCellValue`).
//
// The token vocabulary below is exactly the `options` list of the `date_format` Select field on
// System Settings (frappe/frappe/core/doctype/system_settings/system_settings.json):
//   "yyyy-mm-dd\ndd-mm-yyyy\ndd/mm/yyyy\ndd.mm.yyyy\nmm/dd/yyyy\nmm-dd-yyyy"
// i.e. only `yyyy`, `mm`, `dd` tokens ever appear, combined with `-`, `/`, or `.` separators.
// No other tokens (no `d`, `m`, `yy`, month names, etc.) are part of the real vocabulary, so the
// replacer below only needs to handle those three.

import { getCachedSystemSettings, type SystemSettings } from './settings';

const EMPTY = '-';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Parses a Frappe date/datetime string ("YYYY-MM-DD" or "YYYY-MM-DD HH:mm:ss") without going
 * through `Date` parsing ambiguity for the date-only part — we only need Y/M/D components. */
function parseFrappeDate(value: unknown): { y: number; m: number; d: number } | null {
  if (value === null || value === undefined || value === '') return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return { y: value.getFullYear(), m: value.getMonth() + 1, d: value.getDate() };
  }

  const str = String(value).trim();
  if (!str) return null;

  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return { y: Number(isoMatch[1]), m: Number(isoMatch[2]), d: Number(isoMatch[3]) };
  }

  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) return null;
  return { y: parsed.getFullYear(), m: parsed.getMonth() + 1, d: parsed.getDate() };
}

/**
 * Formats a raw date value per the given (or cached) System Settings `date_format`.
 * - null/undefined/empty input -> "-"
 * - unparseable input -> the raw value stringified (never throws)
 */
export function formatDate(value: unknown, settings?: SystemSettings): string {
  if (value === null || value === undefined || value === '') return EMPTY;

  const parts = parseFrappeDate(value);
  if (!parts) return String(value);

  const fmt = (settings ?? getCachedSystemSettings()).date_format || 'yyyy-mm-dd';
  const yyyy = String(parts.y).padStart(4, '0');
  const mm = pad2(parts.m);
  const dd = pad2(parts.d);

  // Token vocabulary is exactly {yyyy, mm, dd} — replace longest-first isn't needed since the
  // tokens don't overlap as substrings of each other.
  return fmt.replace(/yyyy|mm|dd/g, (token) => {
    if (token === 'yyyy') return yyyy;
    if (token === 'mm') return mm;
    return dd;
  });
}
