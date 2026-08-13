// NavRegistry (1C) — sidebar/menu entries a downstream app can add without touching AppSidebar.
// See the Extensibility table: today this is hardcoded; 2D wires AppSidebar to read from here.

export interface NavItem {
  label: string;
  icon?: string;
  route: string;
  workspace?: string;
  roles?: string[];
}

class NavRegistryImpl {
  private items: NavItem[] = [];

  addItem(item: NavItem): () => void {
    this.items.push(item);
    return () => {
      this.items = this.items.filter((i) => i !== item);
    };
  }

  getItems(userRoles?: readonly string[]): NavItem[] {
    if (!userRoles) return [...this.items];
    return this.items.filter((item) => !item.roles || item.roles.some((r) => userRoles.includes(r)));
  }

  clear(): void {
    this.items = [];
  }
}

export const NavRegistry = new NavRegistryImpl();
