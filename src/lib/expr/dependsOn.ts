// Pure evaluator for Frappe's `depends_on` / `mandatory_depends_on` / `read_only_depends_on`
// (1B, closes A6 — these were declared on DocField but never evaluated anywhere).
//
// Critical scoping rule (also A2): evaluate against the ROW's own data when the field is inside
// a child table, never the top-level document. Callers pass whichever `doc` is the correct scope
// for the field being evaluated — this module has no opinion on where that doc comes from.

import type { Document } from '@/core/types';

/**
 * Frappe's two supported forms:
 *  - a bare fieldname (e.g. "customer") — truthy check on doc[fieldname]
 *  - "eval:<js-expression>" — evaluated with `doc` bound in scope, e.g. `eval:doc.status=="Open"`
 */
export function evaluateDependsOn(expression: string | undefined, doc: Document | Record<string, unknown>): boolean {
  if (!expression) return true; // no expression means "always show/required/editable"

  const trimmed = expression.trim();
  if (!trimmed) return true;

  if (trimmed.startsWith('eval:')) {
    return evaluateExpr(trimmed.slice('eval:'.length), doc);
  }

  // Bare fieldname form.
  return Boolean((doc as Record<string, unknown>)[trimmed]);
}

function evaluateExpr(expr: string, doc: Document | Record<string, unknown>): boolean {
  try {
    // `new Function` rather than `eval()` — scopes the expression to exactly `doc`, not the
    // caller's full closure. Not a true sandbox (the expression can still reach globals like
    // `window`), but depends_on strings come from DocType definitions a System Manager
    // authored, not untrusted user input — same trust boundary as Desk's own client evaluates
    // these under today.
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const fn = new Function('doc', `"use strict"; return (${expr});`);
    return Boolean(fn(doc));
  } catch (error) {
    console.error(`[dependsOn] Failed to evaluate "eval:${expr}":`, error);
    return true; // fail open — a broken expression must not silently hide/disable a field forever
  }
}

export interface FieldVisibilityState {
  hidden: boolean;
  reqd: boolean;
  readOnly: boolean;
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
