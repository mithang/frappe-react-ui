// Query key factory (1A, Wave 1 frozen contract) — consumed by 2A/2B/2D. No `boot` key: there is
// no boot RPC (get_bootinfo isn't whitelisted for this client) — see docs/agent-rules/frappe-api.md.

import type { GetListArgs } from '@/core/types';

export const qk = {
  session: () => ['session'] as const, // getLoggedUser probe
  sysSettings: () => ['sysSettings'] as const, // formatting defaults
  meta: (dt: string) => ['meta', dt] as const,
  doc: (dt: string, n: string) => ['doc', dt, n] as const,
  docinfo: (dt: string, n: string) => ['docinfo', dt, n] as const,
  list: (dt: string, p: GetListArgs) => ['list', dt, p] as const,
  linkSearch: (dt: string, txt: string) => ['linkSearch', dt, txt] as const,
};
