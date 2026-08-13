# Frappe API patterns for frappe-react-ui

This project talks to a real Frappe/ERPNext backend. The patterns below exist because the
original hand-rolled client (`src/lib/frappe.ts`) got each of these wrong in ways that only
surface against a production bench, not in local dev — see the defect inventory (C1–C10, A1–A10)
in the execution plan. Follow these so those bugs don't come back in a different form.

> **Corrected 2026-08-13 (W0.14).** The previous version of this file asserted a same-origin
> deployment and a `reportview.get` total count. Both were wrong and are fixed below — **treat any
> older cached copy of this file's auth/CORS/count guidance as void.** The RPC shapes, error
> parsing, and state-boundary guidance were already correct and are unchanged. Everything below
> auth/CORS/count was independently re-verified against a live container (frappe 17.0.0-dev,
> `dev.localhost`) on 2026-08-13 — see `src/test/fixtures/frappe/` for the recorded responses.

## 1. Use the Desk RPCs, not bare REST

Frappe's `/api/resource/*` REST endpoints work but are a thin, lossy wrapper. Desk itself uses
richer RPCs that return everything a form/list actually needs in one round trip — use the same
ones:

| Need | Call | Why not REST |
|---|---|---|
| Load a document for editing | `frappe.desk.form.load.getdoc` | Also returns `docinfo` (comments, attachments, assignments, shares, resolved permissions) in the same call — REST `getDoc` gets you none of that. **Response shape:** `{ docs: [doc], docinfo, _link_titles }` — `docs` is an array, unwrap `docs[0]`. A missing record returns `{"message": []}` (verified), never an HTTP 404 — treat an empty array as not-found. |
| Save a document | `frappe.desk.form.save.savedocs` | Handles `_server_messages`, submit/cancel semantics, and returns updated docinfo. `doc` is passed as a **JSON string** (form-encoded field, not a JSON body), with `__islocal: 1` for new docs. The server assigns the real `name`; the client's placeholder comes back as `localname` — re-key your local record by matching on `localname`, not on an assumption that `name` was nulled (whether it's nulled or immediately resolved depends on the doctype's `autoname` rule). **Every successful save carries `_server_messages`** (a green "Saved"/"Submitted" alert) — presence is not itself an error signal. |
| List/report rows | `frappe.desk.reportview.get` | **Returns NO total count.** Response is columnar: `{ keys: string[], values: unknown[][], user_info }` — not rows, and `compress()` early-returns the bare input when the result is empty, so `message` may be `[]` instead of `{keys, values}` on an empty list (guard this, it's a real crash source). Pagination params are `start` / `page_length` — **not** `limit_start` / `limit_page_length`. For a count, call the **separate** `frappe.desk.reportview.get_count` RPC, which returns `int \| null` (`null` means a 1-second statement timeout — render "of many", not "of 0"). |
| Metadata | `frappe.desk.form.load.getdoctype` | `docs[0]` is the parent DocType meta; `docs[1:]` are full metas for every child-table doctype the parent references (verified: `Sales Order` returns 8 docs — the parent plus 7 child tables). Split into `{meta: docs[0], childMetas: keyBy(docs.slice(1), 'name')}` and seed the meta cache from `childMetas` — don't let `TableField` re-fetch child metas per mount (that's the A3 defect). Pass `save_user_settings=false`; it **defaults to true** server-side, meaning a plain read silently persists user list-view settings if you don't. |

**No boot RPC.** `frappe.desk.desktop.get_bootinfo` (or equivalent) is not whitelisted for this
kind of client. Source the logged-in user from `frappe.auth.get_logged_user` (also doubles as the
session probe — 403 means not logged in) and per-document permissions from `docinfo.permissions`
(see below), not from a boot payload that doesn't exist.

## 2. Auth & CSRF — standalone SPA, same-site subdomain

This app is a **standalone SPA**, not served same-origin from a Frappe app — but it must share a
**registrable domain** with the bench (e.g. `app.acme.com` SPA → `erp.acme.com` bench). That's
cross-*origin* but same-*site*, which is what makes `SameSite=Lax` cookies work at all:
`samesite="Lax"` is hardcoded in Frappe's `auth.py` with no site-config override, so genuinely
cross-site cookie auth is impossible without patching Frappe — don't attempt it. A fully
cross-site deployment needs OAuth2 authorization-code + PKCE instead (Frappe supports it for
public clients); that is a materially different, larger undertaking, not a config tweak.

**CSRF: there is no `window.csrf_token` to read.** `get_csrf_token()` is not whitelisted for
non-Desk callers, and `frappe.csrf_token` only ever appears embedded in Frappe-served HTML
(`/app`) — a standalone SPA never renders that page, so it never sees it. The supported mechanism
is **`allowed_referrers`**: an exact-`Origin`-match allowlist in the bench's `site_config.json`
that bypasses CSRF validation entirely for matching requests, verified end-to-end:

```json
{ "allow_cors": ["https://app.acme.com"], "allowed_referrers": ["https://app.acme.com"] }
```

(`bench clear-cache` after editing — it's read through a cache.) Verified against a live
container: a `frappe.client.insert` with no `X-Frappe-CSRF-Token` header and `Origin` matching
`allowed_referrers` returns 200 with `Access-Control-Allow-Origin` echoing the exact origin; the
same call with a non-matching `Origin` returns **HTTP 400** (not 417),
`exc_type: "CSRFTokenError"`. Fixtures: `src/test/fixtures/frappe/todo-insert-success.json` and
`csrf-error.json`.

Do **not** rely on the fact that CSRF also no-ops when a session has no token issued yet — that's
real but fragile: it breaks the moment the same account opens `/app` in another tab. Still send
`X-Frappe-CSRF-Token` whenever a token has been set (via `setCsrfToken()`), so a future same-origin
embed needs one line changed, not a redesign.

**Never set `allow_cors` to `"*"`.** Combined with `Access-Control-Allow-Credentials: true` (which
Frappe always sends alongside an echoed CORS origin), a wildcard lets any site call the API as the
logged-in user. Use an explicit origin list.

The reverse proxy in front of the bench must set `X-Forwarded-Proto: https`, or `secure` (derived
from `request.scheme == "https"`) never gets set on the `sid` cookie.

## 3. Parsing responses and errors

- On error, Frappe wraps human-readable text in `_server_messages` — a JSON-encoded array of
  JSON-encoded objects. Parse both layers; don't just show `HTTP 417`.
- Preserve `exc_type` from the error payload (`PermissionError`, `ValidationError`,
  `TimestampMismatchError`, `LinkValidationError`, `DuplicateEntryError`, `CSRFTokenError`, ...) so
  callers can branch on it — e.g. `TimestampMismatchError` means someone else saved first and the
  UI should offer reload-and-reapply, not just show a generic toast. **`exc_type` is only present
  on API v1 (`/api/method/*`)** — don't migrate save/error paths to v2 REST paths and expect it.
- On a *successful* save, `_server_messages` is **always** present (verified — every `savedocs`
  success ends in a `msgprint(..., alert=True)`). Presence is not an error signal by itself;
  surface it on both paths.
- Booleans over the wire are `0 | 1`, not JS `boolean` — `field.reqd === true` is never true.
  Normalise at the transport boundary rather than scattering `!!field.reqd` casts through views.

## 4. Server state vs. UI state — keep them on separate sides of the line

This is the single biggest source of bugs in the original implementation (store `setCurrentDoc`
resetting `isDirty`/`errors`/`fieldOverrides` on every keystroke because a doc write and a UI
reset were conflated into one action). Apply the `react-state-mgmt` skill's Pattern 5 concretely:

- **Server state** (the document, its meta, list rows, docinfo) lives in TanStack Query.
  Query keys: `['doc', doctype, name]`, `['meta', doctype]`, `['list', doctype, filterHash]`,
  `['docinfo', doctype, name]`. Give `meta` a long `staleTime` — it rarely changes — and never
  refetch it per-mount the way `TableField` currently does for child doctypes.
  **`queryClient.clear()` on logout is non-negotiable**, or the next user sees the previous user's
  cached documents.
- **UI state** (is this specific form dirty, which fields have script-driven overrides, which
  fields currently have a validation error, which row of a grid is being edited) lives in a
  Zustand store scoped to **one form instance**, created by a factory and provided via context —
  never the single app-wide store. Two forms open at once (a quick-entry dialog on top of a list,
  a linked-doc preview) must not share this state.
- A field edit is a UI-state action (`isDirty = true`, update the local doc draft) and is
  *independent* from anything that clears errors or overrides. Don't route "user typed a
  character" and "form was just reloaded/saved" through the same setter. `setValue` and `resetTo`
  are different operations — conflating them is bug C1.

## 5. Dynamic Link resolution scope

A `Dynamic Link` field's target doctype comes from another field named in `field.options` —
**on the same row**, not necessarily the top-level document. Inside a child table, resolve against
the row's own data, not a global "current document." Reaching into a single global `currentDoc`
for this (as the original `LinkField` did) silently breaks every Dynamic Link inside a grid.

## 6. Don't trust third-party picker callback args blindly

If a combobox/command-palette library (e.g. cmdk) hands back a value in its `onSelect` callback,
check whether that library normalizes it (cmdk lowercases item values). For anything
case-sensitive — Frappe document names are — take the value from your own closure/option object,
not the library's callback argument.

## 7. Permissions — two different things share the word "permission"

- `getMeta().docperms` (the DocType's `permissions` child table, `DocPerm[]`) are the
  **configured** rows — per role, per permlevel. Not resolved for any particular user.
- `getdoc(...).docinfo.permissions` (`ResolvedDocPermissions`) is the **resolved**, per-document,
  per-current-user permission set — a differently-shaped object
  (`select/read/write/create/delete/submit/cancel/amend/print/email/report/import/export/share`,
  each `0|1`). This is the only per-document permission source; don't compute it client-side from
  `docperms` + role list.

Both real shapes are recorded in `src/test/fixtures/frappe/` — read those before guessing a field
name.
