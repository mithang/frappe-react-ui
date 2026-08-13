# Recorded Frappe fixtures

JSON captures of real responses from `frappe.desk.*` / `frappe.client.*` RPCs, taken against a
live container (`my-postgres-erp`, `frappe 17.0.0-dev`, `dev.localhost`) rather than guessed from
docs. Unit/component tests should mock `src/lib/api` (or `fetch`) with these via MSW instead of
depending on a live backend — fast, deterministic, no container required to run `npm test`.

The live container is still authoritative and still gets exercised, just narrowly: the Playwright
E2E suite (`e2e/`) runs the small set of specs that specifically need to prove real cookie/CORS/
CSRF behavior (login → read → write), and any workstream introducing a new RPC shape should record
a fresh fixture here rather than trust the shape from memory — this project has already been bitten
twice by assumed RPC shapes that turned out wrong (`reportview.get`'s count, `savedocs`'s
`localname`).

## How to add one

```bash
# authenticate, keeping cookies
curl -s -i -c cookies.txt -X POST http://localhost:8000/api/method/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "usr=Administrator" --data-urlencode "pwd=admin"

# call the RPC, save the body
curl -s -b cookies.txt http://localhost:8000/api/method/<...> | python3 -m json.tool > <name>.json
```

Redact nothing except secrets that don't belong in git (there shouldn't be any on a disposable dev
site) — the point is fidelity to what the server actually sends, including the fields that look
redundant or wrong.

## Files

- `csrf-error.json` — `frappe.client.insert` rejected with `CSRFTokenError`: HTTP 400 (not 417),
  `exc_type: "CSRFTokenError"`, `_server_messages` populated. Origin not in `allowed_referrers`,
  no `X-Frappe-CSRF-Token` header, session already has an issued token (this only triggers once a
  token exists — see the note below).
- `todo-insert-success.json` — `frappe.client.insert` succeeding via the `allowed_referrers`
  bypass: Origin matching the bench's `allowed_referrers` entry, still no CSRF header, still 200.
  Response carries `Access-Control-Allow-Origin` / `Access-Control-Allow-Credentials: true`.
- `doctype-create-response.json` — `frappe.client.insert` creating a custom `DocType`, including
  an embedded `permissions` (DocPerm) row created in the same call. Full shape of a `DocType` doc
  as the server returns it (defaults for every unset field).
- `getdoctype-with-children-structure.json` — structural excerpt (not the full ~625KB payload) of
  `frappe.desk.form.load.getdoctype?doctype=Sales Order&with_parent=1`. Confirms `docs[0]` is the
  parent meta and `docs[1:]` are full metas for every child-table doctype the parent references —
  this is what `getMeta()` should split into `{ meta, childMetas }`. Also confirms a resolved
  `DocPerm` row's real field set (`select`, `impersonate`, `mask`, etc. beyond the plan's `DocPerm`
  sketch).
- `getdoc-existing-response.json` — `frappe.desk.form.load.getdoc` for a real record. Note
  `docs` is an **array** (`docs: [doc]`), not a bare `doc` — the client wrapper unwraps `docs[0]`.
  `docinfo.tags` is `""` confirming the string-not-array note. `docinfo.permissions` is the
  *resolved* per-document permission set for the current user (`select/read/write/create/delete/
  submit/cancel/amend/print/email/report/import/export/share`, each `0|1`) — richer than
  `DocPerm` and a different shape from it; don't conflate the two. `docinfo` also carries several
  fields the plan's sketch omitted: `assignment_logs`, `attachment_logs`, `info_logs`,
  `like_logs`, `workflow_logs`, `automated_messages`, `views`, `additional_timeline_content`,
  `milestones`, `is_document_followed`, `document_email`, `user_info`.
- `getdoc-missing-response.json` — `{"message":[]}` for a nonexistent record. Confirms: treat an
  empty `docs`/`message` array as not-found, never expect an HTTP 404.
- `savedocs-new-doc-response.json` — `frappe.desk.form.save.savedocs` for a new doc
  (`__islocal: 1`, client-chosen placeholder name `"new-widget-1"`, doctype uses
  `autoname: "field:widget_name"`). The server assigned the real name from the autoname field
  (`"gizmo-new-1"`) and returned the client's placeholder back as `localname` — confirms the
  client must re-key its local record by matching `localname`, not assume `name` gets nulled.
  **Nuance beyond the plan's claim:** whether `name` arrives nulled or already resolved depends on
  the doctype's naming rule (field-based vs. hash-based `autoname`); always trust the returned
  `name` as authoritative and use `localname` only to find which local optimistic record to
  replace. `_server_messages` carries the green "Saved" alert on this success path, confirming
  presence-on-success is real, not just on error.

All of the above were captured against a disposable custom `DocType`/`Role`/`User`
(`ZTest Widget` / `ZTest Role` / `ztest.user@example.com`) created and fully deleted in the same
session — the container was left exactly as it was found.

**Verified, not assumed:** a fresh login session has no CSRF token yet, and CSRF validation
no-ops entirely until one is issued (Frappe issues it the first time the session renders a
Frappe-served HTML page, e.g. `/app`, embedding `frappe.csrf_token = "..."` — note this is a
top-level `frappe.csrf_token` assignment in the page script, not a field inside the
`frappe.boot` JSON object). A test session that only ever calls the JSON API never gets a token
and CSRF-related bugs will silently not reproduce. Both fixtures here were captured *after*
forcing token issuance by requesting `/app` once — don't drop that step when recording new ones,
or you'll record a false-positive "it worked" that has nothing to do with `allowed_referrers`.
