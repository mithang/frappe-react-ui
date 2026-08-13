import { BENCH_ORIGIN } from '../playwright.config';

/**
 * Verifies the bench is reachable before the suite runs, rather than letting every spec fail
 * with an opaque connection-refused. This does NOT boot the container — see
 * docs/agent-rules/run-against-bench.md for that — because CI and local runs may point at
 * different long-lived containers and re-provisioning per test run is slow and unnecessary
 * (the SNE image ships a pre-provisioned site).
 *
 * It also does not push allow_cors/allowed_referrers into the bench's site_config.json —
 * that's bench configuration living outside this repo (see W0.15 / the Auth & transport
 * section of the plan), not something a test run should mutate. Fails loudly if it's missing.
 */
export default async function globalSetup() {
  let res: Response;
  try {
    res = await fetch(`${BENCH_ORIGIN}/api/method/frappe.auth.get_logged_user`, {
      headers: { Origin: 'http://app.localtest.me:5173' },
    });
  } catch (err) {
    throw new Error(
      `E2E setup: bench at ${BENCH_ORIGIN} is unreachable. Boot it per ` +
        `docs/agent-rules/run-against-bench.md, and confirm '${new URL(BENCH_ORIGIN).host}' ` +
        `resolves to 127.0.0.1 (it should via *.localtest.me with no /etc/hosts entry needed).\n` +
        `Underlying error: ${(err as Error).message}`
    );
  }

  const corsHeader = res.headers.get('access-control-allow-origin');
  if (corsHeader !== 'http://app.localtest.me:5173') {
    throw new Error(
      `E2E setup: bench at ${BENCH_ORIGIN} did not echo the SPA origin in ` +
        `Access-Control-Allow-Origin (got ${corsHeader ?? 'nothing'}). The bench's ` +
        `site_config.json needs:\n` +
        `  "allow_cors": ["http://app.localtest.me:5173"],\n` +
        `  "allowed_referrers": ["http://app.localtest.me:5173"]\n` +
        `then 'bench --site <site> clear-cache' (config is read through a cache).`
    );
  }
}
