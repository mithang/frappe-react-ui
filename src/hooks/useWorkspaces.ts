import { useState, useEffect, useCallback } from 'react';
import { getFrappeClient } from '@/lib/api/client';

export interface WorkspaceShortcut {
  name: string;
  label: string;
  link_to?: string;
  icon?: string;
}

export interface WorkspaceWidget {
  id: string;
  type: 'shortcut' | 'chart' | 'number_card' | 'quick_list' | 'card' | 'header' | 'spacer' | 'onboarding';
  data: {
    shortcut_name?: string;
    chart_name?: string;
    number_card_name?: string;
    quick_list_name?: string;
    card_name?: string;
    text?: string;
    onboarding_name?: string;
    label?: string;
    col: number;
  };
}

export interface Workspace {
  name: string;
  label: string;
  icon?: string;
  module?: string;
  shortcuts: WorkspaceShortcut[];
  widgets: WorkspaceWidget[];
}

interface WorkspaceListRow {
  name: string;
  title?: string;
  icon?: string;
  module?: string;
  parent_page?: string | null;
  public?: 0 | 1;
  sequence_id?: number;
}

interface SidebarItemRow {
  idx?: number;
  type?: string;
  label?: string;
  link_type?: string;
  link_to?: string;
  icon?: string;
}

/**
 * Real Workspace navigation + dashboard content (per user request: "reuse Workspace and
 * Dashboards from Frappe"), replacing a call to `frappe.desk.desktop.get_workspace_sidebar_items`
 * — a method that does not exist on this (or any) Frappe version, confirmed live
 * (ValidationError: "module 'frappe.desk.desktop' has no attribute
 * 'get_workspace_sidebar_items'"). It failed silently into an empty sidebar because the catch
 * block only logged, never surfaced the error.
 *
 * There is no boot RPC (see docs/agent-rules/frappe-api.md), so this app can't read
 * `frappe.boot.sidebar_pages` the way real Desk does — it has to ask for the same data directly:
 * `Workspace` (top-level ones: `parent_page` falsy) via `frappe.client.get_list`, then each
 * workspace's full doc via `getDoc` (verified live: `frappe.client.get_list` queried directly
 * against the `Workspace Sidebar Item` child doctype silently drops fields and returns garbage
 * in this Frappe build — `getDoc`, which fetches the whole parent document, does not have that
 * problem). `sidebar_items` (a child table) drives the sidebar's shortcut links; `content` (a
 * plain field, free in the same request) is the existing widget-driven dashboard body that
 * WorkspaceDashboard.tsx already renders — both come from one round trip per workspace.
 *
 * Scope: public, top-level workspaces only, and only `Link` sidebar items pointing at a
 * `DocType` (the actual navigable list links) — not yet nested workspace hierarchy, private
 * per-user workspaces, Section Break grouping, or Dashboard/Report/Page/URL link types.
 */
export const useWorkspaces = () => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadWorkspaces = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const client = getFrappeClient();

      const pages = await client.call<WorkspaceListRow[]>('frappe.client.get_list', {
        doctype: 'Workspace',
        fields: ['name', 'title', 'icon', 'module', 'parent_page', 'public', 'sequence_id'],
        filters: { public: 1 },
        order_by: 'sequence_id asc',
        limit_page_length: 0,
      });

      const topLevel = pages.filter((p) => !p.parent_page);

      const resolved = await Promise.all(
        topLevel.map(async (page) => {
          try {
            const { doc } = await client.getDoc('Workspace', page.name);
            const raw = doc as unknown as { sidebar_items?: SidebarItemRow[]; content?: string };

            const sidebarLinks = (raw.sidebar_items ?? [])
              .filter((item) => item.type === 'Link' && item.link_type === 'DocType' && item.link_to)
              .sort((a, b) => (a.idx ?? 0) - (b.idx ?? 0));

            const shortcuts: WorkspaceShortcut[] = sidebarLinks.map((item, i) => ({
              name: `${page.name}-${i}`,
              label: item.label || item.link_to || '',
              link_to: item.link_to,
              icon: item.icon,
            }));

            let widgets: WorkspaceWidget[] = [];
            let widgetCounter = 0;
            try {
              const contentData = JSON.parse(raw.content || '[]') as Record<string, unknown>[];
              widgets = contentData.map((item) => ({
                id: String(item.id || `widget-${++widgetCounter}`),
                type: item.type as WorkspaceWidget['type'],
                data: item.data as WorkspaceWidget['data'],
              }));
            } catch (err) {
              console.error(`[useWorkspaces] Failed to parse content for "${page.name}":`, err);
            }

            return { page, shortcuts, widgets };
          } catch (err) {
            // One workspace failing to load must not blank out every other one.
            console.error(`[useWorkspaces] Failed to load "${page.name}":`, err);
            return { page, shortcuts: [] as WorkspaceShortcut[], widgets: [] as WorkspaceWidget[] };
          }
        })
      );

      setWorkspaces(
        resolved.map(({ page, shortcuts, widgets }) => ({
          name: page.name,
          label: page.title || page.name,
          icon: page.icon,
          module: page.module,
          shortcuts,
          widgets,
        }))
      );
    } catch (err) {
      console.error('[useWorkspaces] Failed to load workspaces:', err);
      setError(err instanceof Error ? err.message : 'Failed to load workspaces');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  return { workspaces, isLoading, error, refresh: loadWorkspaces };
};
