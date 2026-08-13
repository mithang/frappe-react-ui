// Parses Frappe's stored filter strings (Workspace Quick List's `quick_list_filter`, and the
// same shape elsewhere) into the [fieldname, operator, value] tuples our client sends.
//
// These are NOT strict JSON: Desk parses them with `new Function('return ' + filter)()`
// (frappe.utils.process_filter_expression), so a stored filter may legitimately contain a JS
// expression like `frappe.datetime.now_date()`. JSON.parse is tried first because it covers the
// overwhelmingly common literal case without evaluating anything; the Function fallback only runs
// when that fails, under the same trust boundary as depends_on (workspace config authored by a
// System Manager, not end-user input).

import { buildEvalScope } from './evalScope';

type RawFilter = unknown[];

/**
 * Frappe stores filters as either [fieldname, operator, value] or, from the filter-group UI,
 * [doctype, fieldname, operator, value] — and `cleanup_filters` drops a 5th element when present.
 * Our client's FrappeFilter is the 3-element form, so the leading doctype is stripped here.
 */
function normalizeFilter(filter: RawFilter): [string, string, unknown] | null {
  if (!Array.isArray(filter)) return null;

  // 5-element rows carry a trailing UI-only entry — Desk pops it (utils.js#cleanup_filters).
  const row = filter.length === 5 ? filter.slice(0, 4) : filter;

  if (row.length === 4) {
    const [, fieldname, operator, value] = row;
    return typeof fieldname === 'string' && typeof operator === 'string'
      ? [fieldname, operator, value]
      : null;
  }
  if (row.length === 3) {
    const [fieldname, operator, value] = row;
    return typeof fieldname === 'string' && typeof operator === 'string'
      ? [fieldname, operator, value]
      : null;
  }
  if (row.length === 2) {
    const [fieldname, value] = row;
    return typeof fieldname === 'string' ? [fieldname, '=', value] : null;
  }
  return null;
}

export function parseFilterExpression(expression: string | undefined | null): [string, string, unknown][] {
  if (!expression) return [];
  const trimmed = expression.trim();
  if (!trimmed || trimmed === '[]') return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    try {
      const { names, values } = buildEvalScope({}, {});
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const fn = new Function(...names, `"use strict"; return (${trimmed});`);
      parsed = fn(...values);
    } catch (error) {
      console.warn(`[filterExpression] Could not parse filter "${trimmed}" — ignoring it.`, error);
      return [];
    }
  }

  if (!Array.isArray(parsed)) return [];

  // A single un-nested filter (["status","=","Open"]) rather than a list of them.
  if (parsed.length && !Array.isArray(parsed[0])) {
    const single = normalizeFilter(parsed);
    return single ? [single] : [];
  }

  return parsed
    .map((f) => normalizeFilter(f as RawFilter))
    .filter((f): f is [string, string, unknown] => f !== null);
}
