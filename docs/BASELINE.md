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

## What this baseline does NOT cover

Everything Wave 1+ is responsible for is untouched: no `FrappeClient`, no per-form store, no
`depends_on`/permission evaluation, no docstatus lifecycle, no real save/list correctness (C1–C10
mostly still open — Wave 0 fixed the *foundation*, not the *defects*). Don't read a green Wave 0
gate as "the app works."
