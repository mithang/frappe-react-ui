// NavRegistry (1C) — everything a downstream app can contribute to the navigation shell.
//
// Four levels of control, from least to most invasive:
//   (a) addItem      — inject a link into the rail or a workspace's panel (data only)
//   (b) addSlot      — push a component into a named position inside a pane
//   (c) registerPanelFor / registerRail / registerPanel — replace a pane wholesale
//   (d) registerPanelFor(workspace) — replace ONE workspace's panel, leaving the rest alone
//
// Resolution follows FieldDispatcher's layered precedence (most specific wins):
//     panel:  registerPanelFor(currentWorkspace) -> registerPanel() -> built-in default
//     rail:   registerRail()                     -> built-in default
//
// WHY THIS NEEDS `subscribe`: extensions are discovered and installed asynchronously AFTER login
// (AuthContext -> discoverAndInstallExtensions), which is AFTER the sidebar has already mounted
// and rendered. A consumer reading this registry once in a useMemo would silently miss every
// extension contribution. Consumers use useSyncExternalStore over `subscribe`, so a late
// registration re-renders the nav. Every mutator notifies.

import type { ComponentType, ReactNode } from 'react';

export interface NavItem {
  label: string;
  /** Kebab-case Frappe/lucide icon name — resolveLucideIcon() maps it (src/lib/icons.ts). */
  icon?: string;
  route: string;
  /** Scopes the item to one workspace's panel. Omit to show it in every workspace. */
  workspace?: string;
  /** Places the item inside a named section of the panel; omit for top-level. */
  section?: string;
  /** Declared for future use. NOTE: nothing in this app currently supplies user roles
   *  (AuthContext's User has none), so getItems() is called without them today. */
  roles?: string[];
}

/** Named insertion points inside the two panes. */
export type NavSlot = 'rail-top' | 'rail-bottom' | 'panel-header' | 'panel-footer';

export interface NavPaneProps {
  /** The workspace currently in view, if any. */
  workspace?: string;
}

export type NavPaneComponent = ComponentType<NavPaneProps>;

/** A registered component plus the extension that supplied it, so failures can be attributed. */
export interface RegisteredPane {
  component: NavPaneComponent;
  extensionName: string;
}

export interface RegisteredSlot {
  node: ReactNode;
  extensionName: string;
}

const ANONYMOUS = 'unknown extension';

class NavRegistryImpl {
  private items: NavItem[] = [];
  private slots = new Map<NavSlot, RegisteredSlot[]>();
  private rail: RegisteredPane | null = null;
  private panel: RegisteredPane | null = null;
  private panelByWorkspace = new Map<string, RegisteredPane>();
  private listeners = new Set<() => void>();

  /** Cached array identity for useSyncExternalStore — a fresh array each read would loop. */
  private itemsSnapshot: NavItem[] = [];

  // -- subscription -----------------------------------------------------------------------

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private notify(): void {
    this.itemsSnapshot = [...this.items];
    for (const listener of this.listeners) listener();
  }

  // -- (a) data ---------------------------------------------------------------------------

  addItem(item: NavItem): () => void {
    this.items.push(item);
    this.notify();
    return () => {
      this.items = this.items.filter((i) => i !== item);
      this.notify();
    };
  }

  /**
   * Items for a given workspace: those scoped to it plus the unscoped ones.
   * `userRoles` filters when supplied; see the note on NavItem.roles.
   */
  getItems(workspace?: string, userRoles?: readonly string[]): NavItem[] {
    return this.itemsSnapshot.filter((item) => {
      if (item.workspace && item.workspace !== workspace) return false;
      if (item.roles && userRoles) return item.roles.some((r) => userRoles.includes(r));
      return true;
    });
  }

  /** Stable identity between notifications — required by useSyncExternalStore. */
  getItemsSnapshot = (): NavItem[] => this.itemsSnapshot;

  // -- (b) slots --------------------------------------------------------------------------

  addSlot(slot: NavSlot, node: ReactNode, extensionName = ANONYMOUS): () => void {
    const entry: RegisteredSlot = { node, extensionName };
    const existing = this.slots.get(slot) ?? [];
    this.slots.set(slot, [...existing, entry]);
    this.notify();

    return () => {
      this.slots.set(slot, (this.slots.get(slot) ?? []).filter((e) => e !== entry));
      this.notify();
    };
  }

  getSlot(slot: NavSlot): RegisteredSlot[] {
    return this.slots.get(slot) ?? [];
  }

  // -- (c)/(d) pane overrides --------------------------------------------------------------

  registerRail(component: NavPaneComponent, extensionName = ANONYMOUS): () => void {
    this.rail = { component, extensionName };
    this.notify();
    return () => {
      if (this.rail?.component === component) this.rail = null;
      this.notify();
    };
  }

  registerPanel(component: NavPaneComponent, extensionName = ANONYMOUS): () => void {
    this.panel = { component, extensionName };
    this.notify();
    return () => {
      if (this.panel?.component === component) this.panel = null;
      this.notify();
    };
  }

  registerPanelFor(workspace: string, component: NavPaneComponent, extensionName = ANONYMOUS): () => void {
    this.panelByWorkspace.set(workspace, { component, extensionName });
    this.notify();
    return () => {
      if (this.panelByWorkspace.get(workspace)?.component === component) {
        this.panelByWorkspace.delete(workspace);
      }
      this.notify();
    };
  }

  getRail(): RegisteredPane | null {
    return this.rail;
  }

  /** Per-workspace override beats the global one; null means "render the built-in panel". */
  getPanel(workspace?: string): RegisteredPane | null {
    if (workspace) {
      const specific = this.panelByWorkspace.get(workspace);
      if (specific) return specific;
    }
    return this.panel;
  }

  clear(): void {
    this.items = [];
    this.slots.clear();
    this.rail = null;
    this.panel = null;
    this.panelByWorkspace.clear();
    this.notify();
  }
}

export const NavRegistry = new NavRegistryImpl();
