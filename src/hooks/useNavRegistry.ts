// Reactive reads of NavRegistry.
//
// This has to be a subscription, not a one-off read: extensions are discovered and installed
// asynchronously AFTER login (AuthContext -> discoverAndInstallExtensions), which is after the
// nav has already mounted. A plain `NavRegistry.getItems()` in a useMemo would render once,
// before any extension has registered anything, and never update.
//
// useSyncExternalStore is React's built-in contract for exactly this and gives correct behaviour
// under concurrent rendering. It requires a STABLE snapshot reference between notifications —
// NavRegistry caches `itemsSnapshot` for that reason; returning a fresh array per read would
// re-render forever.

import { useSyncExternalStore } from 'react';
import { NavRegistry, type NavItem, type NavSlot, type RegisteredPane, type RegisteredSlot } from '@/core/registry/NavRegistry';

/** Re-renders whenever anything in the registry changes. */
function useNavVersion(): NavItem[] {
  return useSyncExternalStore(NavRegistry.subscribe, NavRegistry.getItemsSnapshot, NavRegistry.getItemsSnapshot);
}

/** Extension-contributed links for a workspace (plus the unscoped ones). */
export function useNavItems(workspace?: string): NavItem[] {
  useNavVersion();
  return NavRegistry.getItems(workspace);
}

/** Components an extension pushed into a named position. */
export function useNavSlot(slot: NavSlot): RegisteredSlot[] {
  useNavVersion();
  return NavRegistry.getSlot(slot);
}

/** An extension's replacement rail, or null to render the built-in one. */
export function useRailOverride(): RegisteredPane | null {
  useNavVersion();
  return NavRegistry.getRail();
}

/** Per-workspace override beats the global one; null means render the built-in panel. */
export function usePanelOverride(workspace?: string): RegisteredPane | null {
  useNavVersion();
  return NavRegistry.getPanel(workspace);
}
