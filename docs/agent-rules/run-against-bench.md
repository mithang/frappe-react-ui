# Running against a live bench

Most of what's actually broken in this app (CSRF rejection, pagination math, list columns,
cookie/session behavior) is invisible without a real Frappe backend — `npm run dev` alone proves
nothing. Use one of the images below instead of a hand-rolled `bench` setup.

> **Corrected 2026-08-13 (W0.14).** The previous version of this file said *"don't work around
> [same-origin] with a different auth scheme; proxy instead."* That predates the standalone-SPA
> decision — see `frappe-api.md` for the actual strategy (same-site subdomain + `allowed_referrers`
> CSRF bypass). The Vite dev proxy below is still useful, but **only for local dev ergonomics — it
> hides CORS bugs** (one origin, no preflight, no `allowed_referrers` exercise) and must never be
> what E2E or CI runs against. E2E always runs same-site cross-origin against `*.localtest.me`.

## The image(s)

Two SNE ("Single Node Environment") images have been used successfully — a Red Hat S2I/UBI9-based
image, one container, no docker-compose, with `frappe` + `erpnext` already installed and a site
already created:

| Image | DB | Notes |
|---|---|---|
| `docker.io/vyogo/erpnext:sne-version-16` | MariaDB | The plan's reference image; used by CI (ubuntu-latest, x86_64). |
| `docker.io/vyogo/erpnext:sne-postgres-develop` | PostgreSQL | Verified working locally (podman, Apple Silicon) 2026-08-13; `frappe 17.0.0-dev`, `erpnext 17.x.x-develop`. |

Both expose the same shape:

| Fact | Value |
|---|---|
| Web port | `8000/tcp` |
| Default site | `dev.localhost` (`serve_default_site: true` — any `Host` header routes here) |
| Installed apps | `frappe`, `erpnext` |
| Admin login | `Administrator` / `admin` |
| Session cookie | `sid`, `SameSite=Lax`, `HttpOnly` (verified via `Set-Cookie` on login) |

**Known local issue (arm64 + podman):** `docker run -d` on `sne-version-16` was observed exiting
immediately with `ERROR: Redis process started but died immediately` on Apple Silicon under
podman, even though `redis-server` with the exact same flags runs fine standalone in the same
image — looked timing/environment-specific to the podman container lifecycle, not an
architecture mismatch (the redis binary itself is native arm64 and starts cleanly in isolation).
Not yet root-caused. If you hit this, try `sne-postgres-develop` or an already-running container
instead of re-debugging from scratch; CI runs on x86_64 and hasn't reproduced it.

## Booting it

```bash
docker run -d --name frappe-sne -p 8000:8000 docker.io/vyogo/erpnext:sne-version-16
# ready when: curl -s -o /dev/null -w '%{http_code}' http://localhost:8000/ → 200
# (usually well under a minute — site and DB are already provisioned)
```

## Pointing this app at it

**For local click-around dev (not E2E, not CI):** the Vite proxy in `vite.config.ts` makes the SPA
and bench same-origin from the browser's point of view. This is a deliberate ergonomics shortcut,
not the deployment model — see the warning above.

```ts
server: {
  proxy: {
    '/api': 'http://localhost:8000',
    '/assets': 'http://localhost:8000',
    '/files': 'http://localhost:8000',
    '/socket.io': { target: 'http://localhost:8000', ws: true },
  },
},
```

**For E2E / anything verifying real CORS+CSRF behavior:** run same-site cross-origin instead. `*.
localtest.me` resolves to `127.0.0.1` with no `/etc/hosts` changes needed:

1. Serve the SPA at `http://app.localtest.me:5173` (`npm run dev` — `vite.config.ts` already
   binds `0.0.0.0` with `allowedHosts: true`, so this works with no extra flags).
2. Point requests at `http://erp.localtest.me:8000` (same container, different Host header — 
   `serve_default_site: true` handles the routing).
3. Add to the bench's `sites/dev.localhost/site_config.json`:
   ```json
   { "allow_cors": ["http://app.localtest.me:5173"], "allowed_referrers": ["http://app.localtest.me:5173"] }
   ```
   then `bench --site dev.localhost clear-cache` (config is read through a cache — edits without
   this step silently don't take effect).
4. Log in through the app's own login form, entering `http://erp.localtest.me:8000` as the
   instance URL, with `Administrator` / `admin`.

This is exactly what `playwright.config.ts` + `e2e/global-setup.ts` automate — read those before
hand-rolling the same setup.

## Recorded fixtures instead of hitting the container every time

For anything that isn't specifically testing live cookie/CORS/session behavior, don't depend on a
live container at all — `src/test/fixtures/frappe/` has real recorded responses (login, CSRF
rejection/bypass, `getdoc` existing/missing, `getdoctype` with child metas, `savedocs` for a new
doc) for MSW to replay in unit/component tests. Add a new fixture the same way rather than
guessing a shape from memory — see that directory's `README.md`.

## Cleaning up

```bash
docker stop frappe-sne && docker rm frappe-sne
```

State doesn't persist unless you mount a volume for `/home/frappe/frappe-bench/sites` — for quick
verification loops, treat the container as disposable and re-run it fresh. If you create test
DocTypes/Roles/Users/records for a spot-check, delete them before you're done — don't leave
throwaway state on a container other agents or the user's session are also using.
