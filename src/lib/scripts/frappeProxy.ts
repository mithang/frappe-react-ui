// frappeProxy — the `frappe.*` surface classic Client Scripts call at the top level (outside any
// `frm` hook), scoped to exactly: frappe.call, frappe.db.get_value, frappe.msgprint, frappe.throw,
// and frappe.ui.form.on. Same fail-loudly Proxy pattern as frmProxy.ts: anything else throws,
// naming the script and the missing member, rather than silently returning `undefined`.

import type { ClientScriptHooks, FormController } from '@/core/types';
import { registerClientScript } from '@/core/registry/ScriptRegistry';
import { getFrappeClient } from '@/lib/api/client';
import { toast } from '@/hooks/use-toast';
import { createFrmProxy } from './frmProxy';

export interface FrappeProxy {
  call(method: string, args?: Record<string, unknown>): Promise<unknown>;
  db: {
    get_value(doctype: string, name: string, fieldname: string): Promise<unknown>;
  };
  msgprint(msg: string): void;
  throw(msg: string): never;
  ui: {
    form: {
      on(doctype: string, hooks: Record<string, unknown>): () => void;
    };
  };
}

/**
 * `frappe.ui.form.on('DocType', { validate(frm) {...} })` registers hooks the SAME way this
 * codebase's own bundled scripts do (`registerClientScript` from ScriptRegistry.ts). The wrinkle:
 * ScriptRegistry.executeHook / executeFieldChange (called from FormController.ts, which is frozen
 * and NOT touched here) invoke stored hooks with a raw `FormControllerImpl` as `frm` — never with
 * a frmProxy. So instead of storing the classic script's hook functions directly, we store a THIN
 * WRAPPER per hook: `(realFrm: FormController) => userHookFn(createFrmProxy(realFrm, scriptName))`.
 * ScriptRegistry never needs to know a compatibility layer exists; it just calls a FormHook like
 * any other, and the wrapper does the frm -> frmProxy translation right before the user's classic
 * code ever sees it. This is what makes `frappe.ui.form.on` a drop-in for the bundled-script path.
 */
function wrapClassicHooks(hooks: Record<string, unknown>, scriptName: string): ClientScriptHooks {
  const wrapped: ClientScriptHooks = {};
  for (const [hookName, fn] of Object.entries(hooks)) {
    if (typeof fn !== 'function') continue;
    wrapped[hookName] = (realFrm: FormController, ...rest: unknown[]) => {
      const frmProxy = createFrmProxy(realFrm, scriptName);
      return fn(frmProxy, ...rest);
    };
  }
  return wrapped;
}

/**
 * Builds the `frappe` global a classic Client Script body executes against. `scriptName` is
 * threaded through for error attribution (unsupported members) and passed down into every
 * `frmProxy` created for this script's hooks (see wrapClassicHooks above).
 */
export function createFrappeProxy(scriptName: string): FrappeProxy {
  const db = {
    // Classic `frappe.db.get_value(doctype, name, fieldname)` returns the bare field value, not a
    // wrapped dict — verified against frappe.client.get_value's server signature
    // (frappe/client.py): `get_value(doctype, fieldname, filters, ...)`, called client-side with
    // `filters` set to the docname and `as_dict` defaulting true, so the RPC result is
    // `{ [fieldname]: value }` and we unwrap it here to match the classic single-value return.
    get_value: async (doctype: string, name: string, fieldname: string): Promise<unknown> => {
      const result = await getFrappeClient().call<Record<string, unknown> | undefined>(
        'frappe.client.get_value',
        { doctype, filters: name, fieldname }
      );
      return result ? result[fieldname] : undefined;
    },
  };

  const proxy = new Proxy({} as FrappeProxy, {
    get(_target, prop) {
      switch (prop) {
        case 'call':
          return async (method: string, args: Record<string, unknown> = {}) => getFrappeClient().call(method, args);
        case 'db':
          return db;
        case 'msgprint':
          return (msg: string) => toast({ title: 'Message', description: msg });
        case 'throw':
          return (msg: string): never => {
            toast({ title: 'Error', description: msg, variant: 'destructive' });
            // Real Frappe semantics: frappe.throw() halts execution. A toast alone would let the
            // calling script keep running past the "error" — this must actually throw.
            throw new Error(msg);
          };
        case 'ui':
          return {
            form: {
              on: (doctype: string, hooks: Record<string, unknown>) =>
                registerClientScript({ doctype, hooks: wrapClassicHooks(hooks, scriptName) }),
            },
          };
        default:
          throw new Error(
            `[Client Script "${scriptName}"] frappe.${String(prop)} is not supported by the ` +
              `compatibility layer. Supported members: call, db.get_value, msgprint, throw, ui.form.on.`
          );
      }
    },
    set(_target, prop) {
      throw new Error(`[Client Script "${scriptName}"] frappe.${String(prop)} cannot be assigned directly.`);
    },
  });

  return proxy;
}
