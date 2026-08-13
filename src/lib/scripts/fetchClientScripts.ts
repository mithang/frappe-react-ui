// fetchClientScripts — fetches enabled, Form-view "Client Script" doctype records scoped to a
// given doctype. Field names verified against the real DocType definition in the Frappe checkout:
// frappe/frappe/custom/doctype/client_script/client_script.json (NOT core/doctype — Client Script
// lives under frappe.custom, a detail worth getting right since a guess would plausibly land on
// the wrong module path). Confirmed fields: `dt` (Link -> DocType, the doctype this script targets
// — NOT `doctype`), `view` (Select: "List" | "Form", default "Form"), `script` (Code/JS, the raw
// body), `enabled` (Check, default "0"). There is no `script_type` field on this doctype in this
// Frappe version — that was a plausible-but-wrong guess the task's own instructions flagged as a
// risk, and JSON inspection ruled it out.

import { getFrappeClient } from '@/lib/api/client';

export interface ClientScriptRecord {
  name: string;
  dt: string;
  view: 'List' | 'Form' | string;
  script: string;
  enabled: 0 | 1;
}

/**
 * Fetches enabled Form-view Client Scripts for `doctype` via `frappe.client.get_list` (the same
 * generic list RPC the rest of this client uses elsewhere). Scoped to `view: 'Form'` because this
 * compatibility layer only implements the `frm.*`/`frappe.ui.form.on` surface — a "List" view
 * Client Script targets the list controller, which is out of scope here and would only fail
 * loudly (uselessly) if executed through this path.
 */
export async function fetchClientScripts(doctype: string): Promise<ClientScriptRecord[]> {
  const records = await getFrappeClient().call<ClientScriptRecord[]>('frappe.client.get_list', {
    doctype: 'Client Script',
    filters: { dt: doctype, enabled: 1, view: 'Form' },
    fields: ['name', 'dt', 'view', 'script', 'enabled'],
  });
  return records ?? [];
}
