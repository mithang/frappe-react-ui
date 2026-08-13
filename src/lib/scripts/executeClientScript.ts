// executeClientScript — runs a raw Client Script body (exactly what Frappe stores in the
// `Client Script` doctype's `script` field: top-level `frappe.ui.form.on('DocType', {...})`
// calls, no `frm` in scope at that top level — `frm` only exists inside the hook callbacks,
// supplied later by ScriptRegistry whenever a real FormControllerImpl invokes them).

import { createFrappeProxy } from './frappeProxy';

export interface ExecuteScriptResult {
  ok: boolean;
  error?: Error;
}

/**
 * Executes `scriptBody` via `new Function('frappe', scriptBody)` — deliberately NOT `eval()`,
 * which would run in the caller's own lexical scope and could observe/mutate local variables in
 * this module. `new Function` only closes over the global scope, matching how Frappe itself
 * evaluates Client Script bodies.
 *
 * Design choice on failure: this returns a result object rather than re-throwing. Client Scripts
 * are fetched and executed in a batch (see fetchClientScripts.ts / index.ts) — one script with a
 * syntax error or a top-level `frappe.throw()` must not prevent every OTHER script for the same
 * doctype from registering. The failure is still "loud": it's logged to console.error with the
 * script attributed by name, and the caller gets `{ ok: false, error }` to act on (e.g. surface a
 * toast, skip just that script). This differs from frmProxy/frappeProxy's unsupported-member
 * errors, which throw synchronously from deep inside a hook callback where there's no batching
 * concern — the caller there is whatever invoked the hook (ScriptRegistry.executeHook), which
 * already catches and logs per-hook errors.
 */
export function executeClientScript(scriptBody: string, scriptName: string): ExecuteScriptResult {
  try {
    const frappeProxy = createFrappeProxy(scriptName);
    // eslint-disable-next-line no-new-func -- this IS the sandboxed evaluator; eval() is what
    // we're avoiding, not Function construction.
    const run = new Function('frappe', scriptBody);
    run(frappeProxy);
    return { ok: true };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(`[executeClientScript] Client Script "${scriptName}" failed to execute:`, err);
    return { ok: false, error: err };
  }
}
