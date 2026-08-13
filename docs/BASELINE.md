# Baselines

Measured state at each point that matters, so later waves regress against a number, not a
feeling. Update this file when a baseline legitimately changes (a script's own `BASELINE`
constant is the enforced source of truth for the any-ratchet; this file is the human-readable
record and the reason each number is what it is).

## Pre-Wave-0 (recorded in the execution plan before any change)

- `npx tsc -p tsconfig.app.json --noEmit`: 1 error (`ScriptRegistry.ts:65`, TS2556)
- `npx eslint .`: 122 errors, 26 warnings across 39 files (113 `no-explicit-any`)
- `strict`: false. Tests: none. Lockfiles: two (`bun.lock` + `package-lock.json`, only npm's current).
- `npm ci`: **fails** (`react-day-picker@8.10.1` peer conflict with React 19; `sonner`/`input-otp`
  declared-vs-installed drift).

## Post-Wave-0 (2026-08-13)

- `npm ci`: **succeeds** — dependency drift reconciled (W0.9), React-19-incompatible packages
  bumped to versions that actually support it (W0.1): `react-day-picker` v8→v9, `recharts` stayed
  v2 (not v3 — see note below), `vaul` v0.9→v1.1, `react-resizable-panels` v2→v3 (not v4 — see
  note below).
- `npx tsc -p tsconfig.app.json --noEmit`: **0 errors**, with `strict: true` (W0.10) — the one
  pre-existing error was in `DynamicForm.tsx`, deleted as verified-dead code (W0.2) before strict
  ever had to deal with it.
- `npx eslint .`: **77 errors, 19 warnings** (down from 122/26 — entirely from deleting dead code
  that was full of `any`, not from fixing anything yet). `@typescript-eslint/no-explicit-any`:
  **71** (down from 113) — enforced as a ceiling by `scripts/check-any-ratchet.mjs` /
  `npm run lint:any-ratchet`, wired into CI. Lower this number when you fix an `any`; raising it
  requires editing the script's `BASELINE` constant, which is a deliberate speed bump.
- Unit tests: **16 passing**, 3 files (Vitest + Testing Library + MSW scaffold; jsdom environment).
- E2E: **1 passing** (`e2e/auth-crud.spec.ts`) — login → read → write, same-site cross-origin
  against a live container (`*.localtest.me`), verifying the real cookie/CORS/CSRF path per the
  plan's Wave 0 exit criterion. The write succeeds via the bench's `allowed_referrers` CSRF
  bypass — confirmed robust (not just "fresh session has no token yet" luck) via a separate curl
  check with a token already issued; see `src/test/fixtures/frappe/`.
- Single lockfile (`bun.lock` deleted, W0.5). `React.StrictMode` wraps the app (W0.8).

**Deviations from the plan's guessed dependency targets, both verified against the real shadcn
CLI / npm registry rather than assumed:**
- `recharts` stayed on v2 (`^2.15.4`), not bumped to v3. The `shadcn add chart` CLI itself
  resolved `recharts@2.15.4` for the current `chart.tsx` registry component — that component's
  Tooltip/Legend prop shapes are still v2-shaped upstream. Bumping to v3 first produced exactly
  the TS errors you'd expect from that mismatch; trusting the CLI's own resolution fixed it.
- `react-resizable-panels` went to v3 (`^3.0.6`), not v4. v4 renamed the whole API
  (`PanelGroup`→`Group`, `PanelResizeHandle`→`Separator`); the current shadcn `resizable.tsx`
  registry component still imports the pre-rename names, and doesn't work against v4 as of this
  writing. v3.0.6 supports React 19 and predates the rename.
- `react-day-picker` went to `^9.14.0` per the plan (not the CLI's initial `^10.0.1`) — v10 also
  works, but the plan named v9 explicitly and v9's component-override API (`Chevron`, `DayButton`,
  `Root`, `WeekNumber`) is what the regenerated `calendar.tsx` actually uses, so there was no
  reason to go further than necessary.

## Post-Wave-1 (2026-08-13) — 1A/1B/1C, Claude

- `npx tsc -p tsconfig.app.json --noEmit`: **0 errors**. `npx eslint .`: **77 errors, 19 warnings**
  — unchanged from Wave 0 despite ~20 new files; `no-explicit-any` also unchanged at **71**
  (4 new violations were introduced and fixed during this wave, not left as new debt).
  Unit tests: **39 passing**, 7 files (16 carried over + 23 new: `formStore` C1/A1 proof,
  `dependsOn`/`evaluate` pure-evaluator coverage, `installExtension` exit-criteria proof). E2E:
  still 1 passing, re-verified after every Wave 1 change that touched the transport/auth path.
- **1A** shipped `src/lib/api/{errors,csrf,config,client}.ts` and `src/lib/query/{keys,queries,
  mutations}.ts` — the frozen `FrappeClient` contract, all RPC shapes matching the fixtures
  recorded in Wave 0, not the plan's original guesses (`getDoc`'s `docs: [doc]` unwrap, `getMeta`'s
  `docs[0]`/`docs[1:]` split, `savedocs`'s form-encoded `doc` + `localname` re-keying,
  `reportview.get`'s columnar zip + missing-array guard, `search_link`'s real
  `{value,description,label?}` shape verified against Frappe source — not the `{results:[...]}`
  shape an earlier test mock had guessed). `src/lib/frappe.ts` is now the strangler shim: same 13
  call sites, same method signatures, but transport-level CSRF header injection and proper
  `_server_messages`/`exc_type` parsing fixed underneath for all of them at once. The dangerous
  `https://demo.erpnext.com` default is gone from `lib/frappe.ts`, `AuthContext.tsx`, and
  `LoginForm.tsx`.
- **1B** shipped `src/store/formStore.ts` (per-instance factory + `FormStoreProvider`/
  `useFormStore`, tested proving `setValue`/`resetTo` don't conflate and two instances stay
  independent — the actual C1/A1 fix), `src/store/uiStore.ts` (replacing a same-named, zero-import
  slice that was dead in `store/index.ts`), and pure evaluators `src/lib/expr/dependsOn.ts` /
  `src/lib/perm/evaluate.ts` (both tested).
  **Deliberately NOT done:** migrating `FieldDispatcher.tsx`'s read side onto the new `formStore`.
  `FormController.ts` (`set_df_property`/`toggle_*`) still WRITES field overrides to the old
  global `useDocumentStore` — switching only `FieldDispatcher`'s read side would make client-script
  field toggling silently stop working. `FormController.ts`/`useFormController.ts`/`LinkField.tsx`
  are Wave 2A/2C-owned files; the real migration has to move the write side and the read side
  together, which is that wave's work, not something to force apart now.
- **1C** shipped `NavRegistry`, `RouteRegistry`, `CommandRegistry`, `WidgetRegistry`,
  `FormRegistry` (toolbar buttons + named slots), `ListRegistry` (bulk/row actions) — the last two
  weren't in the plan's literal Owns list for 1C, but its own exit criterion ("add a form toolbar
  button... with no change to core files") needs them; 2A/2B still own actually *rendering* what
  these store. `ExtensionHost` + `src/sdk/` (`defineExtension`) + `installExtension` (apiVersion
  gate, setup()-time isolation) + `ExtensionErrorBoundary` (render-time isolation) together satisfy
  1C's exit criterion exactly, proven in
  `src/core/registry/__tests__/installExtension.test.ts`. Also shipped
  `scripts/client-script-inventory.mjs` (must run against a real customer bench, not the vanilla
  SNE container — an empty result from the vanilla one is misleading, not reassuring).
  `DocTypeRegistry.registerFieldRenderer()` was added — the older skill text referenced it as if
  it already existed; it didn't, until now.
- **Explicitly deferred, not forgotten:** `src/models/DocumentModel.ts` deletion (plan says 1A
  deletes it, but it has 3 real consumers — `FormController.ts`, `useFormController.ts`,
  `ListController.ts` — none yet migrated to the new client; deleting it now would break the app
  for no gain until those are rewritten in Wave 2A/2B).

## Post-Wave-2A (2026-08-13) — Form engine, Claude

- `npx tsc -p tsconfig.app.json --noEmit`: **0 errors**. Lint: **70 errors, `no-explicit-any` 63**
  — both *dropped* from Wave 1 (77/71), not just held steady: `SmartForm.tsx` was properly typed
  (`Document`, `FormControllerImpl | null`, `unknown` for field values) rather than carrying
  forward its pre-existing `any` props while I was already rewriting the file around them.
  Baselines lowered to lock this in. Unit tests still 39/39 (form-engine changes are covered by
  the live E2E below, not new unit tests — there's no meaningful way to unit-test `savedocs`
  round-tripping without a server). E2E: extended to cover the UPDATE path, not just create —
  create a ToDo, then edit and save it again, both verified against the live container.
- `FormController.ts` rewritten onto the real `FrappeClient`/`formStore` (closing **A8**): `save()`
  now calls `saveDoc()` → real `frappe.desk.form.save.savedocs`, not the old `DocumentModel`'s
  plain REST `PUT`/`POST` — conflict detection, `_server_messages`, and `exc_type` all survive
  now, live-verified end to end (create AND update) against the container, not just typechecked.
  `useFormController.ts` creates a fresh `formStore` per `(doctype, name)` pair.
- `FieldDispatcher.tsx` migrated onto the new `formStore` (closing the Wave 1 deferral) — safe
  now because `FormController.set_df_property` writes to the SAME store `FieldDispatcher` reads
  from `SmartForm`'s `<FormStoreProvider>`. Also newly wired: `evaluateFieldVisibility`
  (`depends_on`/`mandatory_depends_on`/`read_only_depends_on`, closing **A6**) — built in Wave 1B
  but nothing consumed it until now.
- **C6 fixed**: fields declared before the first Tab/Section Break used to be silently dropped
  whenever the doctype also had tabs or sections later (`FormContent` rendered exactly one of
  {tabs, sections, leading-fields} instead of leading-fields-plus-whichever-branch-matched).
  `SmartForm.tsx` now always renders leading fields alongside tabs/sections.
- **A5 (docstatus lifecycle)** and **C10 (delete confirmation)** added to `SmartForm.tsx`: Save/
  Submit/Cancel-document/Amend buttons gated by `meta.is_submittable` + `doc.docstatus`, fields
  become read-only post-submit (except `allow_on_submit` ones), and delete now requires an
  `AlertDialog` confirmation instead of firing immediately.
- `src/models/DocumentModel.ts` is now used by exactly one remaining file
  (`ListController.ts`, Wave 2B's territory) — no longer 3.

## Post-Wave-2B (2026-08-13) — List engine, Claude

- `npx tsc -p tsconfig.app.json --noEmit`: **0 errors**. Lint: **62 errors, `no-explicit-any` 55**
  — dropped again from 2A's 70/63 (`ListController.ts`, `useListController.ts`, `SmartList.tsx`
  all came out properly typed rather than carrying forward `any`). Baselines lowered again.
  Unit tests still 39/39. E2E: new `e2e/list-pagination.spec.ts`, the plan's literal Wave 2B exit
  criterion verified live — navigates `/doctype/DocType` (800+ rows on a stock bench), confirms
  page 1 shows a real non-blank column value (not `-`), advances to page 2, and asserts the rows
  actually changed. `npx playwright test` (both specs) green together.
- `ListController.ts` rewritten onto `FrappeClient.getList()` (real `reportview.get` + separate
  `get_count`, closing **C3** — `total` was `data.length`, which made "Next" either a no-op or
  wrong past page 1; `total` is now `number | null`, `null` meaning "of many" per a genuine
  backend statement timeout, not zero) and fetching every `in_list_view` field plus `name`/
  `docstatus`/`modified` (closing **C4** — it previously only ever requested
  name/creation/modified regardless of what the list claimed to show, so every other column
  rendered as `-`). `deleteMultiple` is now `Promise.all` over one batch, not N sequential
  round trips (half of **C10**).
- `SmartList.tsx`: **C8** fixed — status badge now reads real `docstatus` (Draft/Submitted/
  Cancelled) instead of a hardcoded `<Badge>Active</Badge>` on every row regardless of state.
  **C10**'s other half: both single-row and bulk delete now require an `AlertDialog`
  confirmation instead of firing immediately on click. Pagination UI reads the real
  `total`/`hasMore` from the controller instead of comparing against `data.length`.
- `src/models/DocumentModel.ts` had zero remaining consumers once `ListController.ts` moved off
  it — **deleted** (this was originally 1A's job in the plan; deferred in Wave 1 because it still
  had 3 real consumers then, now genuinely safe).

## Post-Wave-3B/3C/4E (2026-08-13) — Claude, 3 parallel subagents + integration

Built as three parallel, file-disjoint subagents (Client Script layer / extension discovery /
formatting), each required to verify RPC shapes against the Frappe source checkout rather than
guess, then integrated and gated together by hand.

- `npx tsc -p tsconfig.app.json --noEmit`: **0 errors**. Lint: **59 errors, `no-explicit-any` 55**
  — total dropped again (62→59), `no-explicit-any` held steady. Baselines lowered. Unit tests:
  **94/94** across 15 files (55 new: 15 for the Client Script layer, 5 for extension discovery,
  35 for formatting incl. edge cases). E2E: both specs still green after integration — this
  matters because 3B's client-script loading and 3C's extension discovery now run on *every*
  form load / app boot respectively, so a live re-run was the real test, not just a typecheck.
  Also live-verified directly: the `frappe.utils.change_log.get_versions` RPC (extension
  discovery) and the System Settings `get_value` call (formatting) both succeed against the
  container with real data (`date_format: "dd-mm-yyyy"`, `number_format: "# ###.##"` — an
  unusual space-grouped format that happened to already exist on this bench, a good incidental
  proof the token replacer isn't just handling the common case); the `/assets/<app>/ui/
  extension.manifest.json` probe 404s gracefully for both installed apps, as expected on a bench
  shipping no UI extensions.
- **A7 (Client Script compatibility) closed**: `src/lib/scripts/` — `frmProxy.ts`/`frappeProxy.ts`
  wrap `FormControllerImpl`/the `FrappeClient` in the classic `frappe.ui.form.on('DocType', {...})`
  surface (`frm.doc/set_value/get_value/set_df_property/toggle_*/add_custom_button/set_query/
  refresh_field/save/call/add_child/clear_table`, `frappe.call/db.get_value/msgprint/throw/
  ui.form.on`) via a `Proxy` whose `get`/`set` traps throw a named, attributed error for anything
  outside that list — fail loudly, never silently no-op, per the plan's explicit requirement.
  `fetchClientScripts.ts` queries the real `Client Script` doctype — verified fields from source
  are `dt` (not `doctype`) and no `script_type` field exists in this Frappe version, both
  corrections to what was assumed when the task was scoped. Wired into `useFormController.ts`:
  server-defined scripts now load and run before `onload`/`refresh` fire, closing "Client scripts
  only run if bundled; server-defined Client Scripts never fetched."
- **A9 (broken module federation) closed**: `discoverExtensions.ts` replaces
  `ExtensionRegistry.loadRemote`'s dead `__webpack_init_sharing__`/`__webpack_share_scopes__` code
  (deleted outright, confirmed zero remaining `__webpack_` references anywhere in `src/`) with
  real per-app manifest discovery (`frappe.utils.change_log.get_versions` for the installed-app
  list — verified against source, not `frappe.apps.get_apps`, which is filtered by
  desk-visibility hooks and wouldn't return a complete list) + `/assets/<app>/ui/
  extension.manifest.json` probing + dynamic `import()` of the referenced ESM bundle, each app
  isolated so one bad manifest/module never blocks another. Wired into `init.ts`'s existing
  registration-list pattern as one more entry, not a structural change.
- **4E (i18n/formatting) closed**: `src/lib/format/` sources date/number/currency formatting from
  a real System Settings read (there is no boot RPC — see Wave 0's finding) with verified token
  vocabularies pulled directly from `system_settings.json` in source (`date_format`'s only tokens
  are `yyyy`/`mm`/`dd`; `number_format` has 10 concrete formats including Indian-style grouping)
  rather than invented ones, with hardcoded safe fallback defaults so a slow/failed fetch never
  breaks rendering. Currency formatting deliberately takes an explicit, optional symbol parameter
  with no default guessing — a bare number's currency isn't derivable from System Settings alone
  in real Frappe (it lives on a sibling Currency link field per-document), and guessing would be
  exactly the kind of fabrication this project is trying to eliminate. Applied at 9 read sites
  across `SmartList.tsx`, `CalendarView.tsx`, `DocInfoSidebar.tsx`, `FileManager.tsx`,
  `KanbanView.tsx`, `QuickListWidget.tsx`, `NumberCardWidget.tsx`, `ChartWidget.tsx`, and
  `Dashboard.tsx` — all replacing raw `toLocaleDateString()`/`toLocaleString()` calls that ignored
  System Settings and were browser-locale-dependent.

## 4A (realtime) — BLOCKED, not built, needs a decision

The realtime subagent correctly stopped rather than work around its constraints. Two separate
findings, both real:

1. **No `socket.io-client` dependency exists** in this project (confirmed three ways: `require.
   resolve` fails, absent from `package-lock.json`, and `frappe-js-sdk` — nominally installed —
   doesn't pull it in transitively and isn't imported anywhere in `src/`, i.e. it's dead weight).
   Adding it is a one-line `package.json` change but is a decision outside a subagent's remit
   under this project's "don't add dependencies without asking" norm.
2. **A likely architecture conflict, found by reading `frappe/realtime/auth.py`**: the socket.io
   handshake's `_validate_origin` does an *exact* Host/Origin hostname match. This project's
   documented deployment (see the Auth & transport section above) is deliberately cross-*origin*
   same-*site* (`app.acme.com` SPA → `erp.acme.com` bench) — under that model a direct browser
   socket connection would send `Origin: app.acme.com` against `Host: erp.acme.com` and get
   rejected. There is no `allowed_referrers`-equivalent escape hatch for the realtime handshake
   the way there is for the REST/CSRF path. Also unresolved: the socket namespace needs
   `frappe.boot.sitename`, and there is no boot RPC to source it from client-side.

Real RPC-level findings recorded for whoever picks this up: the verified subscribe/unsubscribe
events are `doc_subscribe`/`doc_unsubscribe(doctype, docname)` joining room `doc:{doctype}/
{docname}`; the server emits `doc_update` with `{modified, doctype, name}` (a refetch signal, not
the full doc) via `Document.notify_update()`; real presence (`doc_open`/`doc_close` →
`doc_viewers`) exists server-side but was out of scope for this pass. This needs a decision on
(a) whether to add `socket.io-client`, and (b) how — or whether — to resolve the origin-validation
conflict before building against it; building the client code without resolving (b) risks shipping
a feature that fails silently in the exact production topology this plan committed to.

## What this baseline does NOT cover

`LinkField.tsx`'s own read of the old global `useDocumentStore` (for Dynamic Link resolution, bug
A2's other half) is still not migrated — it's a Wave 2C-owned file (AntiGravity's). List search is
still client-side over just the current page, not a real server-side search — that's later Wave
territory, not one of C1–C10. Realtime (4A) is unbuilt, blocked on the decision above. Don't read
a green gate here as "the app works" in full; it means forms and lists save/load/submit/cancel/
amend/delete/paginate for real against a real bench, server Client Scripts and downstream-app
extensions actually load, and dates/numbers respect the bench's own System Settings.
