// TanStack Query read hooks (1A) — the only place server state for docs/lists/meta should live,
// per docs/agent-rules/frappe-api.md's server-state-vs-UI-state rule. `meta`/`session` get a long
// staleTime since they rarely change; `doc`/`list` are left at defaults so they refetch/invalidate
// normally around saves.

import { useQuery } from '@tanstack/react-query';
import type { GetListArgs } from '@/core/types';
import { getFrappeClient } from '@/lib/api/client';
import { qk } from './keys';

const STABLE_STALE_TIME = 5 * 60 * 1000; // 5 minutes — meta/session rarely change mid-session

export function useSession() {
  return useQuery({
    queryKey: qk.session(),
    queryFn: () => getFrappeClient().getLoggedUser(),
    staleTime: STABLE_STALE_TIME,
    retry: false, // a 401 here is a normal "not logged in" state, not a transient failure
  });
}

export function useMeta(doctype: string | undefined) {
  return useQuery({
    queryKey: qk.meta(doctype ?? ''),
    queryFn: () => getFrappeClient().getMeta(doctype!),
    enabled: !!doctype,
    staleTime: STABLE_STALE_TIME,
  });
}

export function useDoc(doctype: string | undefined, name: string | undefined) {
  return useQuery({
    queryKey: qk.doc(doctype ?? '', name ?? ''),
    queryFn: () => getFrappeClient().getDoc(doctype!, name!),
    enabled: !!doctype && !!name && name !== 'new',
  });
}

export function useList<TRow = Record<string, unknown>>(args: GetListArgs | undefined) {
  return useQuery({
    queryKey: qk.list(args?.doctype ?? '', args ?? { doctype: '' }),
    queryFn: () => getFrappeClient().getList<TRow>(args!),
    enabled: !!args?.doctype,
  });
}

export function useLinkSearch(doctype: string | undefined, txt: string) {
  return useQuery({
    queryKey: qk.linkSearch(doctype ?? '', txt),
    queryFn: () => getFrappeClient().searchLink({ doctype: doctype!, txt }),
    enabled: !!doctype,
  });
}
