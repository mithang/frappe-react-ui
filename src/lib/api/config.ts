// Runtime bench configuration. Prefers a same-origin `/config.json` fetched at boot (one SPA
// build, many deployments) over a build-time VITE_ variable, per the plan's Auth & transport
// section — the bench/SPA origin pairing is a deployment property, not a user preference.
//
// This app also lets a user type an instance URL at login (see LoginForm) for the
// multi-instance/demo use case; that's preserved and takes precedence once set, but the
// dangerous `https://demo.erpnext.com` default is gone — a misconfigured build with no
// `/config.json` and no user input now fails closed (empty string) instead of silently posting
// credentials to a public demo server.

export interface RuntimeConfig {
  /** Default bench origin, e.g. "https://erp.acme.com". Empty if unset — never a public default. */
  benchUrl: string;
}

let cached: RuntimeConfig | null = null;

export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  if (cached) return cached;

  try {
    const res = await fetch('/config.json', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      cached = { benchUrl: typeof data.benchUrl === 'string' ? data.benchUrl : '' };
      return cached;
    }
  } catch {
    // /config.json is optional — a deployment without one just has no default, not an error.
  }

  cached = { benchUrl: '' };
  return cached;
}

/** Test-only escape hatch — production code should always go through loadRuntimeConfig(). */
export function __resetRuntimeConfigCache(): void {
  cached = null;
}
