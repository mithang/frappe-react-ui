// Evaluates a Dashboard Chart's `dynamic_filters_json`.
//
// Frappe stores these as a map of filter name -> JavaScript SOURCE, e.g.
//   {"company": "frappe.defaults.get_user_default(\"Company\")",
//    "from_fiscal_year": "erpnext.utils.get_fiscal_year()"}
// Desk evaluates each string against its live globals (dashboard_chart.js / chart_widget.js).
//
// They are not optional decoration: several standard charts put a MANDATORY filter here and leave
// `filters_json` holding only stale literals from whenever the chart was authored. Skipping them
// makes the report throw outright — verified on this bench, where "Profit and Loss" answered
// "Start Year and End Year are mandatory" and "Budget Variance" raised KeyError 'from_fiscal_year'.
//
// A standalone SPA has no `erpnext` bundle and no boot payload, so the two values these
// expressions actually reach for are fetched from the server once and injected into the eval
// scope. Anything referencing something we can't supply fails closed for that ONE filter (it is
// dropped, with a warning) rather than taking down the whole chart.

import { getFrappeClient } from '@/lib/api/client';

interface DynamicFilterContext {
  defaultCompany: string | null;
  currentFiscalYear: string | null;
}

let contextPromise: Promise<DynamicFilterContext> | null = null;

/** Fetched once per session — these change rarely and every chart on a page wants the same two. */
function loadContext(): Promise<DynamicFilterContext> {
  if (contextPromise) return contextPromise;

  contextPromise = (async () => {
    const client = getFrappeClient();

    const [company, fiscalYear] = await Promise.all([
      client
        .call<{ default_company?: string }>('frappe.client.get_value', {
          doctype: 'Global Defaults',
          fieldname: 'default_company',
        })
        .then((r) => r?.default_company ?? null)
        .catch(() => null),
      // erpnext.utils.get_fiscal_year() resolves to the fiscal year containing today.
      client
        .call<{ name: string }[]>('frappe.client.get_list', {
          doctype: 'Fiscal Year',
          fields: ['name'],
          filters: [
            ['year_start_date', '<=', new Date().toISOString().slice(0, 10)],
            ['year_end_date', '>=', new Date().toISOString().slice(0, 10)],
          ],
          order_by: 'year_start_date desc',
          limit_page_length: 1,
        })
        .then((rows) => rows?.[0]?.name ?? null)
        .catch(() => null),
    ]);

    return { defaultCompany: company, currentFiscalYear: fiscalYear };
  })();

  return contextPromise;
}

/**
 * The default Company's own defaults, shaped like Frappe's `locals[":Company"][name]` entry.
 * Chart Source configs read filter defaults straight out of that cache (Account Balance Timeline
 * takes its required `account` from `default_bank_account`), and the server rejects the call when
 * such a filter is missing.
 */
export async function getDefaultCompanyDefaults(): Promise<{ name: string; defaults: Record<string, unknown> } | null> {
  const ctx = await loadContext();
  if (!ctx.defaultCompany) return null;

  try {
    const row = await getFrappeClient().call<Record<string, unknown>>('frappe.client.get_value', {
      doctype: 'Company',
      filters: { name: ctx.defaultCompany },
      fieldname: ['default_bank_account', 'default_cash_account', 'default_receivable_account', 'cost_center'],
    });
    return { name: ctx.defaultCompany, defaults: row ?? {} };
  } catch {
    return { name: ctx.defaultCompany, defaults: {} };
  }
}

/** The resolved values other evaluators need (report scripts, chart source configs). */
export async function getFrappeEvalContext(): Promise<{ defaultCompany: string | null; currentFiscalYear: string | null }> {
  return loadContext();
}

/** Test seam — clears the memoised context. */
export function resetDynamicFilterContext(): void {
  contextPromise = null;
}

function buildScope(ctx: DynamicFilterContext) {
  const fiscalYear = ctx.currentFiscalYear;
  const frappe = {
    defaults: {
      get_user_default: (key?: string) =>
        typeof key === 'string' && key.toLowerCase() === 'company' ? ctx.defaultCompany : undefined,
      get_default: (key?: string) =>
        typeof key === 'string' && key.toLowerCase() === 'company' ? ctx.defaultCompany : undefined,
    },
    sys_defaults: { fiscal_year: fiscalYear, company: ctx.defaultCompany },
    boot: { sysdefaults: { fiscal_year: fiscalYear, company: ctx.defaultCompany } },
    datetime: {
      now_date: () => new Date().toISOString().slice(0, 10),
      get_today: () => new Date().toISOString().slice(0, 10),
    },
  };

  // erpnext.utils.get_fiscal_year() returns the fiscal year NAME in the contexts these filters
  // use it (from_fiscal_year / to_fiscal_year are Link fields to Fiscal Year).
  const erpnext = { utils: { get_fiscal_year: () => fiscalYear } };

  return { names: ['frappe', 'erpnext'], values: [frappe, erpnext] };
}

/**
 * Returns the resolved dynamic filters. Filters whose expression can't be evaluated are omitted,
 * so the caller merges only what genuinely resolved.
 */
export async function resolveDynamicFilters(
  dynamicFiltersJson: string | undefined | null
): Promise<Record<string, unknown>> {
  if (!dynamicFiltersJson) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(dynamicFiltersJson);
  } catch {
    return {};
  }
  // Charts with no dynamic filters store "[]" rather than "{}".
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

  const entries = Object.entries(parsed as Record<string, unknown>);
  if (entries.length === 0) return {};

  const ctx = await loadContext();
  const { names, values } = buildScope(ctx);
  const resolved: Record<string, unknown> = {};

  for (const [fieldname, expression] of entries) {
    if (typeof expression !== 'string' || !expression.trim()) continue;
    try {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const fn = new Function(...names, `"use strict"; return (${expression});`);
      const value = fn(...values);
      if (value !== undefined && value !== null && value !== '') {
        resolved[fieldname] = value;
      }
    } catch (error) {
      console.warn(`[dynamicFilters] Could not resolve "${fieldname}" (${expression}) — skipping.`, error);
    }
  }

  return resolved;
}
