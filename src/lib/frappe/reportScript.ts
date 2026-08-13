// Extracts a query report's filter definitions.
//
// `frappe.desk.query_report.get_script` returns a `filters` key, but for script reports it comes
// back EMPTY — the filters are declared inside the returned JavaScript:
//
//     frappe.query_reports["Accounts Payable"] = {
//       filters: [ { fieldname: "company", fieldtype: "Link", reqd: 1,
//                    default: frappe.defaults.get_user_default("Company") }, ... ] }
//
// Desk evals that script and reads frappe.query_reports[name].filters (query_report.js). Without
// doing the same, a report runs with NO filters at all — and a report whose mandatory filters are
// missing quietly returns zero rows, which is exactly how "Accounts Payable" appeared broken.
//
// The script is executed in a scope holding only a small `frappe`/`erpnext` stub. These scripts
// are app-authored (same trust boundary as Client Scripts and depends_on, both already evaluated
// in this codebase), and only their declarative `filters` array is read back.

import { getFrappeClient } from '@/lib/api/client';
import { getFrappeEvalContext } from '@/lib/frappe/dynamicFilters';

export interface ReportFilter {
  fieldname: string;
  label?: string;
  fieldtype?: string;
  options?: string | string[];
  reqd?: 0 | 1 | boolean;
  default?: unknown;
  hidden?: 0 | 1 | boolean;
  /** Present on some filters; not honoured here (it needs live form state to be meaningful). */
  get_query?: unknown;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * A deep, self-stubbing stand-in for a Frappe global.
 *
 * Report scripts touch far more of the client than their filter declarations need — this one
 * report alone reaches frappe.db.get_link_options, frappe.query_report.*, frappe.model.can_create,
 * frappe.utils.escape_html and erpnext.utils.add_dimensions, and calls
 * `frappe.db.get_list(...).then(...)` at load time. Enumerating those is a losing game: any
 * missing one throws and costs the WHOLE filter list. So unknown property reads resolve to a
 * callable stub instead, while the values supplied in `base` (query_reports, real defaults, real
 * dates) still win. Assignments write through to `base`, which is how
 * `frappe.query_reports["X"] = {...}` is captured.
 */
// `any` is the honest type here: the returned proxy stands in for arbitrary Frappe globals and is
// read, called and indexed in ways no narrower type can describe.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function autoStub(base: Record<string, unknown> = {}): any {
  const target = function () {};
  return new Proxy(target, {
    get(_t, prop) {
      if (prop === Symbol.toPrimitive) return () => '';
      // Scripts chain off async calls. Return a chainable no-op and deliberately DON'T invoke the
      // callback — it would run report logic against stub data. Filters added asynchronously are
      // simply absent, which is a smaller loss than the script throwing.
      if (prop === 'then' || prop === 'catch' || prop === 'finally') return () => autoStub();
      if (Object.prototype.hasOwnProperty.call(base, prop)) {
        const value = base[prop as string];
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          return autoStub(value as Record<string, unknown>);
        }
        return value;
      }
      return autoStub();
    },
    set(_t, prop, value) {
      base[prop as string] = value;
      return true;
    },
    apply() {
      return autoStub();
    },
    has() {
      return true;
    },
  });
}

function buildScope(ctx: { defaultCompany: string | null; currentFiscalYear: string | null }) {
  const queryReports: Record<string, { filters?: ReportFilter[] }> = {};

  const frappeBase: Record<string, unknown> = {
    query_reports: queryReports,
    defaults: {
      get_user_default: (key?: string) =>
        typeof key === 'string' && key.toLowerCase() === 'company' ? ctx.defaultCompany ?? undefined : undefined,
      get_default: (key?: string) =>
        typeof key === 'string' && key.toLowerCase() === 'company' ? ctx.defaultCompany ?? undefined : undefined,
    },
    sys_defaults: { fiscal_year: ctx.currentFiscalYear, company: ctx.defaultCompany },
    boot: { sysdefaults: { fiscal_year: ctx.currentFiscalYear, company: ctx.defaultCompany }, developer_mode: 0 },
    datetime: {
      get_today: today,
      now_date: today,
      nowdate: today,
      month_start: () => `${today().slice(0, 7)}-01`,
      month_end: () => today(),
      year_start: () => `${today().slice(0, 4)}-01-01`,
      year_end: () => `${today().slice(0, 4)}-12-31`,
      add_months: (date: string, months: number) => {
        const d = new Date(date || today());
        d.setMonth(d.getMonth() + (Number(months) || 0));
        return d.toISOString().slice(0, 10);
      },
      add_days: (date: string, days: number) => {
        const d = new Date(date || today());
        d.setDate(d.getDate() + (Number(days) || 0));
        return d.toISOString().slice(0, 10);
      },
    },
  };

  const erpnextBase: Record<string, unknown> = {
    utils: { get_fiscal_year: () => ctx.currentFiscalYear },
    get_fiscal_year: () => ctx.currentFiscalYear,
  };

  return {
    queryReports,
    names: ['frappe', 'erpnext', '__', 'locals'],
    values: [autoStub(frappeBase), autoStub(erpnextBase), (s: string) => s, autoStub({})],
  };
}

const cache = new Map<string, Promise<ReportFilter[]>>();

/** Test seam. */
export function resetReportFilterCache(): void {
  cache.clear();
}

/**
 * The report's filter definitions, with their `default` expressions already evaluated.
 * Returns [] when the script can't be executed — the report still runs, just unfiltered.
 */
export function getReportFilterDefs(reportName: string): Promise<ReportFilter[]> {
  const cached = cache.get(reportName);
  if (cached) return cached;

  const promise = (async () => {
    const client = getFrappeClient();
    const res = await client.call<{ script?: string; filters?: ReportFilter[] }>(
      'frappe.desk.query_report.get_script',
      { report_name: reportName }
    );

    // Server-parsed filters win when present (some reports do return them).
    if (Array.isArray(res?.filters) && res.filters.length > 0) return res.filters;
    if (!res?.script) return [];

    const ctx = await getFrappeEvalContext();
    const { queryReports, names, values } = buildScope(ctx);

    try {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const fn = new Function(...names, res.script);
      fn(...values);
    } catch (error) {
      console.warn(`[reportScript] Could not evaluate the script for "${reportName}".`, error);
      return [];
    }

    const registered = queryReports[reportName]?.filters;
    return Array.isArray(registered) ? registered.filter((f) => f && f.fieldname) : [];
  })();

  cache.set(reportName, promise);
  // A failed lookup shouldn't be cached forever.
  promise.catch(() => cache.delete(reportName));
  return promise;
}

/** Seed values from the filter defaults, then let URL params override them. */
export function buildInitialFilterValues(
  defs: ReportFilter[],
  urlParams: URLSearchParams
): Record<string, unknown> {
  const values: Record<string, unknown> = {};

  for (const def of defs) {
    if (def.default !== undefined && def.default !== null && def.default !== '') {
      values[def.fieldname] = def.default;
    }
  }

  urlParams.forEach((value, key) => {
    // Desk links can carry literal "undefined" for an unset filter; sending that as a value makes
    // the report filter on the string "undefined" and return nothing.
    if (value === '' || value === 'undefined' || value === 'null') return;
    values[key] = value;
  });

  return values;
}
