// Lazy singleton socket.io connection to the bench (4A). Connects to the SAME origin the
// FrappeClient talks to, so the `sid` cookie rides along with the handshake automatically —
// see docs/BASELINE.md's "4A — BLOCKED" note for the real constraint this runs into: Frappe's
// `_validate_origin` (frappe/realtime/auth.py) does an EXACT Host/Origin hostname match, which
// only holds when the SPA and bench are genuinely same-origin (e.g. through the Vite dev proxy,
// which doesn't rewrite the Host header by default) — the plan's documented production
// same-site-cross-origin subdomain deployment will fail this check. Not a frontend-fixable
// problem; flagged, not silently worked around.

import { io, type Socket } from 'socket.io-client';
import { loadRuntimeConfig } from '@/lib/api/config';

let socketPromise: Promise<Socket> | null = null;

/** Resolves to the shared socket, connecting on first call. Never reconnects redundantly —
 *  every caller in the same session gets the same instance. */
export function getSocket(): Promise<Socket> {
  if (!socketPromise) {
    socketPromise = loadRuntimeConfig().then(({ benchUrl }) => {
      const socket = io(benchUrl || undefined, {
        withCredentials: true,
        // Frappe's realtime server namespaces by site; without a boot RPC to source
        // `frappe.boot.sitename` from, we connect to the default namespace and rely on the
        // bench routing single-tenant dev/most-deployments correctly. Multi-tenant benches may
        // need this revisited once there's a verified way to learn the site name client-side.
      });
      return socket;
    });
  }
  return socketPromise;
}

/** Fully tears down the shared connection — call on logout so a later login doesn't inherit a
 *  stale authenticated socket. */
export function disconnectSocket(): void {
  if (socketPromise) {
    socketPromise.then((socket) => socket.disconnect());
    socketPromise = null;
  }
}

/** Test-only escape hatch. */
export function __setSocketForTests(socket: Socket | null): void {
  socketPromise = socket ? Promise.resolve(socket) : null;
}
