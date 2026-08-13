// Barrel + entry point for the server Client Script compatibility layer (closes A7: "Client
// scripts only run if bundled; server-defined Client Scripts never fetched"). Everything under
// src/lib/scripts/ is re-exported here; `loadAndRunClientScripts` is the single call site
// useFormController.ts's init flow needs.

export type { FrmProxy } from './frmProxy';
export { createFrmProxy } from './frmProxy';
export type { FrappeProxy } from './frappeProxy';
export { createFrappeProxy } from './frappeProxy';
export type { ExecuteScriptResult } from './executeClientScript';
export { executeClientScript } from './executeClientScript';
export type { ClientScriptRecord } from './fetchClientScripts';
export { fetchClientScripts } from './fetchClientScripts';

import { fetchClientScripts } from './fetchClientScripts';
import { executeClientScript } from './executeClientScript';

// Registration is per-doctype and global (ScriptRegistry has no per-form-instance scoping) — the
// wrapped hooks stored via frappe.ui.form.on close over nothing but scriptName, and translate
// whatever real FormControllerImpl they're invoked with into a frmProxy at call time (see
// frappeProxy.ts's wrapClassicHooks). That means registering the same doctype's scripts twice
// would run every hook twice for every form instance from then on — so this module remembers
// which doctypes it has already fetched+registered and only does the work once per doctype per
// page session, matching how Frappe itself loads Client Scripts once per boot, not once per form.
const loadedDoctypes = new Set<string>();
const inFlight = new Map<string, Promise<void>>();

/**
 * Fetches enabled Form-view Client Scripts for `doctype` and executes each one, registering its
 * hooks into ScriptRegistry. Safe to call multiple times for the same doctype (across repeated
 * form mounts) — after the first successful run it's a no-op. If the fetch itself fails, the
 * doctype is NOT marked loaded, so a later retry (e.g. reopening the form) can succeed once
 * connectivity/permissions are fixed.
 */
export async function loadAndRunClientScripts(doctype: string): Promise<void> {
  if (loadedDoctypes.has(doctype)) return;

  const pending = inFlight.get(doctype);
  if (pending) return pending;

  const run = (async () => {
    try {
      const records = await fetchClientScripts(doctype);
      for (const record of records) {
        executeClientScript(record.script, record.name);
      }
      loadedDoctypes.add(doctype);
    } catch (error) {
      console.error(`[loadAndRunClientScripts] Failed to load Client Scripts for "${doctype}":`, error);
      // Not marked loaded — a later call can retry.
    } finally {
      inFlight.delete(doctype);
    }
  })();

  inFlight.set(doctype, run);
  return run;
}
