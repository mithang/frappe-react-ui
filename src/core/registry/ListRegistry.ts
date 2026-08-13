// ListRegistry (1C) — the DATA layer for list row actions and bulk actions. 2B renders these
// inside SmartList (its "+ pluggable list/bulk actions" Wave 2 brief), same split as FormRegistry.

export interface ListBulkAction {
  label: string;
  onClick: (names: string[]) => void;
  condition?: (names: string[]) => boolean;
}

export interface ListRowAction {
  label: string;
  onClick: (name: string) => void;
}

class ListRegistryImpl {
  private bulkActions = new Map<string, ListBulkAction[]>();
  private rowActions = new Map<string, ListRowAction[]>();

  addBulkAction(doctype: string, action: ListBulkAction): () => void {
    const list = this.bulkActions.get(doctype) ?? [];
    list.push(action);
    this.bulkActions.set(doctype, list);
    return () => {
      this.bulkActions.set(doctype, (this.bulkActions.get(doctype) ?? []).filter((a) => a !== action));
    };
  }

  getBulkActions(doctype: string): ListBulkAction[] {
    return this.bulkActions.get(doctype) ?? [];
  }

  addRowAction(doctype: string, action: ListRowAction): () => void {
    const list = this.rowActions.get(doctype) ?? [];
    list.push(action);
    this.rowActions.set(doctype, list);
    return () => {
      this.rowActions.set(doctype, (this.rowActions.get(doctype) ?? []).filter((a) => a !== action));
    };
  }

  getRowActions(doctype: string): ListRowAction[] {
    return this.rowActions.get(doctype) ?? [];
  }

  clear(): void {
    this.bulkActions.clear();
    this.rowActions.clear();
  }
}

export const ListRegistry = new ListRegistryImpl();
