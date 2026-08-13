/**
 * frappeReportUtils.ts
 *
 * TypeScript port of key Frappe UI methods from:
 *   - frappe/public/js/frappe/views/reports/report_utils.js  → get_report_filters
 *   - frappe/public/js/frappe/widgets/chart_widget.js        → update_default_date_filters, set_chart_filters
 *   - frappe/public/js/frappe/utils/dashboard_utils.js       → get_filters_for_chart_type, get_all_filters
 *
 * Instead of using frappe.xcall / frappe.dom.eval / frappe.query_reports globals,
 * we call the same backend APIs directly via our Frappe client.
 */

import { getFrappeClient } from '@/lib/api/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReportFilterDef {
  fieldname: string;
  label?: string;
  fieldtype?: string;
  default?: any;
  reqd?: number | boolean;
  options?: any;
  depends_on?: string;
}

// ---------------------------------------------------------------------------
// Equivalent of frappe.report_utils.get_report_filters(report_name)
//
// Frappe Desk does:
//   frappe.xcall("frappe.desk.query_report.get_script", { report_name })
//     .then(r => { frappe.dom.eval(r.script); ... return r.filters })
//
// We skip the eval (we don't have frappe globals), and directly use r.filters
// which the backend already pre-computes with server-side defaults.
// ---------------------------------------------------------------------------
export async function getReportFilters(reportName: string): Promise<ReportFilterDef[]> {
  const client = getFrappeClient();
  try {
    const r = await client.call<any>('frappe.desk.query_report.get_script', {
      report_name: reportName,
    });
    // r.filters is the pre-parsed filter array with default values from the server
    return r?.filters || [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Equivalent of frappe dashboard_utils.get_all_filters(chart_doc)
//
// Frappe Desk does:
//   frappe.utils.parse_array(this.chart_doc.filters_json)
//
// We just parse filters_json directly.
// ---------------------------------------------------------------------------
export function getAllFilters(chartDoc: any): Record<string, any> {
  try {
    const raw = chartDoc.filters_json;
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    // filters_json can be an array of [doctype, fieldname, op, value] tuples
    // OR a plain object dict. Normalise to object.
    if (Array.isArray(parsed)) {
      return Object.fromEntries(parsed.map((f: any[]) => [f[1], f[3]]));
    }
    return parsed;
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Equivalent of chart_widget.js → update_default_date_filters(report_filters, chart_filters)
//
// For each Date/DateRange filter that has a server-evaluated `default` and is
// either required OR already present in saved filters, we overwrite the saved
// value with the fresh default.
// ---------------------------------------------------------------------------
export function updateDefaultDateFilters(
  reportFilterDefs: ReportFilterDef[],
  chartFilters: Record<string, any>
): Record<string, any> {
  const result = { ...chartFilters };
  for (const f of reportFilterDefs) {
    if (['Date', 'DateRange'].includes(f.fieldtype || '') && f.default !== undefined) {
      // Overwrite if field is required OR if the chart had a saved value (to refresh stale dates)
      if (f.reqd || result[f.fieldname] !== undefined) {
        result[f.fieldname] = f.default;
      }
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Equivalent of chart_widget.js → set_chart_filters() for Report charts
//
// Frappe Desk flow:
//   1. get_filters_for_chart_type(chart_doc) → calls get_report_filters(report_name)
//   2. chart_filters = update_default_date_filters(report_filters, chart_saved_filters)
//   3. this.filters = user_saved_filters || this.filters || chart_filters
//
// Returns the final merged filter object ready to pass to query_report.run.
// ---------------------------------------------------------------------------
export async function buildReportChartFilters(chartDoc: any): Promise<Record<string, any>> {
  const reportFilterDefs = await getReportFilters(chartDoc.report_name);
  const chartSavedFilters = getAllFilters(chartDoc); // from filters_json

  // Apply Frappe's update_default_date_filters: fresh server defaults override stale saved dates
  const mergedFilters = updateDefaultDateFilters(reportFilterDefs, chartSavedFilters);

  // Fill in any required filters that still have no value from their script defaults
  for (const f of reportFilterDefs) {
    if (f.fieldname && mergedFilters[f.fieldname] === undefined && f.default !== undefined) {
      mergedFilters[f.fieldname] = f.default;
    }
  }

  return mergedFilters;
}
