// Currency display formatting: reuses `formatNumber`'s grouping/decimal-separator logic (driven
// by System Settings `number_format`) with the precision from `currency_precision`, falling back
// to `float_precision` when `currency_precision` is unset — matching System Settings' own
// description on that field: "If not set, the currency precision will depend on number format"
// (frappe/frappe/core/doctype/system_settings/system_settings.json).
//
// SCOPING DECISION: a Currency-fieldtype value in real Frappe implies its own currency via a
// linked `Currency` field elsewhere on the document (e.g. `price_list_currency`), and System
// Settings only carries a *default display* currency (`currency`, a Link to the Currency
// doctype — no symbol stored inline on System Settings itself). Resolving "what currency does
// this bare number belong to" from just a value is a bigger feature (needs the sibling currency
// field + a Currency doctype lookup for its symbol) that's out of scope here. This module instead
// accepts an explicit `currencySymbol` from the caller, with no default guessing — callers that
// know the currency (e.g. from a resolved Currency link/child-table row) pass it in; callers that
// don't should pass nothing and get an unprefixed formatted number back.

import { formatNumber } from './formatNumber';
import { getCachedSystemSettings, type SystemSettings } from './settings';

export interface FormatCurrencyOptions {
  /** Explicit currency symbol or code to prefix, e.g. "$", "€", "INR". No default is guessed. */
  currencySymbol?: string;
}

/**
 * Formats a raw numeric value as currency using `currency_precision` (falling back to
 * `float_precision`, per System Settings' own documented behavior).
 * - null/undefined/empty-string input -> "-"
 * - non-numeric input -> the raw value stringified (never throws)
 */
export function formatCurrency(
  value: unknown,
  options?: FormatCurrencyOptions,
  settings?: SystemSettings
): string {
  if (value === null || value === undefined || value === '') return '-';

  const resolvedSettings = settings ?? getCachedSystemSettings();
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return String(value);

  const precision = resolvedSettings.currency_precision ?? resolvedSettings.float_precision ?? 2;
  const formatted = formatNumber(num, { decimals: precision }, resolvedSettings);

  return options?.currencySymbol ? `${options.currencySymbol} ${formatted}` : formatted;
}
