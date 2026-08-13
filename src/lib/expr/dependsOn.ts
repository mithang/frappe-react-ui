// Pure evaluator for Frappe's `depends_on` / `mandatory_depends_on` / `read_only_depends_on`
// (1B, closes A6 — these were declared on DocField but never evaluated anywhere).
//
// Critical scoping rule (also A2): evaluate against the ROW's own data when the field is inside
// a child table, never the top-level document. Callers pass whichever `doc` is the correct scope
// for the field being evaluated — this module has no opinion on where that doc comes from.

import type { DocField, Document } from '@/core/types';
import { buildEvalScope } from './evalScope';

/**
 * Frappe's two supported forms:
 *  - a bare fieldname (e.g. "customer") — truthy check on doc[fieldname]
 *  - "eval:<js-expression>" — evaluated with `doc`/`parent` plus Frappe's global helpers in
 *    scope, e.g. `eval:doc.status=="Open"` or `eval:in_list(["A","B"], doc.type)`
 */
export function evaluateDependsOn(
  expression: string | undefined,
  doc: Document | Record<string, unknown>,
  parent?: Document | Record<string, unknown>
): boolean {
  if (!expression) return true; // no expression means "always show/required/editable"

  const trimmed = expression.trim();
  if (!trimmed) return true;

  if (trimmed.startsWith('eval:')) {
    return evaluateExpr(trimmed.slice('eval:'.length), doc, parent);
  }

  // Bare fieldname form. Frappe checks arrays by LENGTH, not truthiness (layout.js's
  // evaluate_depends_on_value) — an empty child table is `[]`, which is truthy in plain JS and
  // would otherwise make "show when this table has rows" always true.
  const value = (doc as Record<string, unknown>)[trimmed];
  return Array.isArray(value) ? value.length > 0 : Boolean(value);
}

/** Compiled-expression cache, keyed by source — mirrors frappe.utils.eval's own cache. These are
 *  re-evaluated on every render of every field, so recompiling each time is pure waste. */
const compiledCache = new Map<string, (...args: unknown[]) => unknown>();
/** Expressions already reported as unevaluatable. Without this, a single unresolvable helper
 *  (e.g. erpnext.*) logs on every render of every affected field — thousands of identical lines. */
const reportedFailures = new Set<string>();

function evaluateExpr(
  expr: string,
  doc: Document | Record<string, unknown>,
  parent?: Document | Record<string, unknown>
): boolean {
  const { names, values } = buildEvalScope(doc, parent ?? doc);

  try {
    let fn = compiledCache.get(expr);
    if (!fn) {
      // `new Function` rather than `eval()` — scopes the expression to exactly the names above,
      // not the caller's full closure. Not a true sandbox (the expression can still reach globals
      // like `window`), but depends_on strings come from DocType definitions a System Manager
      // authored, not untrusted user input — the same trust boundary Desk evaluates these under.
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      fn = new Function(...names, `"use strict"; return (${expr});`) as (...args: unknown[]) => unknown;
      compiledCache.set(expr, fn);
    }
    return Boolean(fn(...values));
  } catch (error) {
    // Fail OPEN — a field whose condition can't be resolved must stay visible/editable rather
    // than disappear with no way to reach it. Under-hiding is recoverable; silently hiding a
    // required field is not (that produced unsatisfiable saves, see FormController.validate).
    if (!reportedFailures.has(expr)) {
      reportedFailures.add(expr);
      console.warn(
        `[dependsOn] Could not evaluate "eval:${expr}" — treating the field as visible/editable. ` +
          `Expressions calling into app bundles (e.g. erpnext.*) aren't available to this client.`,
        error
      );
    }
    return true;
  }
}

export interface FieldVisibilityState {
  hidden: boolean;
  reqd: boolean;
  readOnly: boolean;
}

/**
 * Fieldnames that render nowhere because the Tab Break or Section Break they sit under is itself
 * hidden — a break's `hidden`/`depends_on` governs everything up to the next break of its kind,
 * not just its own heading.
 *
 * Callers deciding "can the user actually reach this field" need this ON TOP of the field's own
 * `evaluateFieldVisibility`: a *required* field inside a hidden section is unreachable, and
 * validating it produces exactly the unsatisfiable "Required fields missing" save that
 * FormController.validate exists to avoid.
 */
export function collectLayoutHiddenFields(
  fields: DocField[],
  doc: Document | Record<string, unknown>
): Set<string> {
  const hidden = new Set<string>();
  let tabHidden = false;
  let sectionHidden = false;

  for (const field of fields) {
    if (field.fieldtype === 'Tab Break') {
      tabHidden = evaluateFieldVisibility(field, doc).hidden;
      sectionHidden = false; // a Tab Break also closes whatever section was open
    } else if (field.fieldtype === 'Section Break') {
      sectionHidden = evaluateFieldVisibility(field, doc).hidden;
    } else if (field.fieldtype !== 'Column Break' && (tabHidden || sectionHidden)) {
      hidden.add(field.fieldname);
    }
  }

  return hidden;
}

/** Convenience wrapper resolving all three depends_on-family properties for one field at once. */
export function evaluateFieldVisibility(
  field: { hidden?: boolean; depends_on?: string; mandatory_depends_on?: string; read_only_depends_on?: string; reqd?: boolean; read_only?: boolean },
  doc: Document | Record<string, unknown>
): FieldVisibilityState {
  return {
    hidden: field.hidden || !evaluateDependsOn(field.depends_on, doc),
    reqd: field.mandatory_depends_on ? evaluateDependsOn(field.mandatory_depends_on, doc) : !!field.reqd,
    readOnly: field.read_only_depends_on ? evaluateDependsOn(field.read_only_depends_on, doc) : !!field.read_only,
  };
}
