// The globals a Frappe `eval:` expression expects to find.
//
// Real Desk evaluates these with `new Function('doc', 'parent', code)` (frappe.utils.eval) and
// relies on everything else — in_list, cint, flt, frappe, erpnext — resolving off `window`, where
// its bundles have already installed them. A standalone SPA has no such globals, so every
// expression using one died with a ReferenceError. Measured against this bench's own DocFields:
// of 1752 `eval:` expressions, in_list appears 52×, frappe.* 15×, cint 8×, flt 2× — so the small
// set below is not a guess at what "might" be used, it's what actually is.
//
// Deliberately NOT stubbed: app namespaces like `erpnext.*` (13 uses here, e.g.
// erpnext.stock.is_subcontracting_or_return_transfer). Those are real functions with real logic
// living in an app bundle this client doesn't load; inventing a return value would silently show
// or hide the wrong fields. They stay undefined and the caller fails open — see dependsOn.ts.

/** Frappe's `in_list(list, item)` — frappe/public/js/frappe/utils/number_format.js. */
function in_list(list: unknown, item: unknown): boolean {
  return Array.isArray(list) ? list.includes(item) : false;
}

/** Frappe's `cstr` — frappe/public/js/frappe/utils/datatype.js. */
function cstr(s: unknown): string {
  if (s === null || s === undefined) return '';
  return String(s);
}

/** Frappe's `cint` — same file; note `true`→1, `false`→0, and a NaN fallback of `def ?? 0`. */
function cint(v: unknown, def?: number): number {
  if (v === true) return 1;
  if (v === false) return 0;
  const parsed = parseInt(String(v), 10);
  return Number.isNaN(parsed) ? def ?? 0 : parsed;
}

/** Frappe's `flt`. The real one also applies number-format/rounding options driven by System
 *  Settings; `depends_on` only ever needs the numeric coercion, so precision is applied but the
 *  locale-format arguments are not. */
function flt(v: unknown, decimals?: number): number {
  if (v === null || v === undefined || v === '') return 0;
  const parsed = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
  if (Number.isNaN(parsed)) return 0;
  return decimals === undefined ? parsed : parseFloat(parsed.toFixed(decimals));
}

function is_null(v: unknown): boolean {
  return v === null || v === undefined || cstr(v).trim() === '';
}

/** Populated at login so `eval:doc.name == frappe.session.user` resolves correctly. */
let sessionUser: string | null = null;

export function setEvalSessionUser(user: string | null): void {
  sessionUser = user;
}

/**
 * A deliberately shallow `frappe`. `boot` is present-but-empty rather than absent so the common
 * `frappe.boot.developer_mode` reads as falsy instead of throwing — correct for a deployment that
 * is not the developer-mode bench. Nested reads one level deeper (frappe.boot.versions.payments)
 * still throw and fail open, which is the honest outcome: this client genuinely does not know.
 */
function buildFrappeGlobal() {
  return {
    session: { user: sessionUser },
    boot: { developer_mode: 0, versions: {}, sysdefaults: {} },
    datetime: {
      now_date: () => new Date().toISOString().slice(0, 10),
      now_datetime: () => new Date().toISOString().slice(0, 19).replace('T', ' '),
      get_today: () => new Date().toISOString().slice(0, 10),
    },
  };
}

export interface EvalScope {
  names: string[];
  values: unknown[];
}

/** Builds the (name, value) pairs bound as parameters of the compiled expression function. */
export function buildEvalScope(doc: unknown, parent: unknown): EvalScope {
  const scope: Record<string, unknown> = {
    doc,
    parent,
    in_list,
    cstr,
    cint,
    flt,
    is_null,
    frappe: buildFrappeGlobal(),
  };
  return { names: Object.keys(scope), values: Object.values(scope) };
}
