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
    links?: { label?: string; link_type?: string; link_to?: string }[];
  };
}

export interface WorkspaceLink {
  label: string;
  link_type: string;
  link_to: string;
  type: string;
  dependencies?: string;
  icon?: string;
  hidden?: 0 | 1;
  /** Query Reports route differently from standard (doctype-bound) Reports. */
  is_query_report?: 0 | 1;
}

export interface Workspace {
  name: string;
  label: string;
  icon?: string;
  module?: string;
  shortcuts: WorkspaceShortcut[];
  widgets: WorkspaceWidget[];
  links: WorkspaceLink[];
  cards: WorkspaceCardGroup[];
  quickLists: WorkspaceQuickList[];
}

/** A "Card Break" and the Link rows it owns — the workspace `card` content block renders one. */
export interface WorkspaceCardGroup {
  label: string;
  icon?: string;
  links: WorkspaceLink[];
}

export interface WorkspaceQuickList {
  label: string;
  document_type: string;
  quick_list_filter?: string;
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

/** Row of Workspace's `quick_lists` child table (doctype: "Workspace Quick List", istable=1).
 *  The content block only stores a `quick_list_name`, which is this row's `label` — the actual
 *  target doctype and filters live here. */
interface WorkspaceQuickListRow {
  label?: string;
  document_type?: string;
  /** Stored as a JS array literal, not strict JSON — Frappe evaluates it (process_filter_expression). */
  quick_list_filter?: string;
}

interface WorkspaceLinkRow {
  label?: string;
  link_type?: string;
  link_to?: string;
  type?: string;
  dependencies?: string;
  icon?: string;
  hidden?: 0 | 1;
  is_query_report?: 0 | 1;
  link_count?: number;
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
            const raw = doc as unknown as {
              sidebar_items?: SidebarItemRow[];
              links?: WorkspaceLinkRow[];
              quick_lists?: WorkspaceQuickListRow[];
              content?: string;
            };

            const sidebarLinks = (raw.sidebar_items ?? [])
              .filter((item) => item.type === 'Link' && item.link_type === 'DocType' && item.link_to)
              .sort((a, b) => (a.idx ?? 0) - (b.idx ?? 0));

            const shortcuts: WorkspaceShortcut[] = sidebarLinks.map((item, i) => ({
              name: `${page.name}-${i}`,
              label: item.label || item.link_to || '',
              link_to: item.link_to,
              icon: item.icon,
            }));

            const links: WorkspaceLink[] = (raw.links ?? []).map((link) => ({
              label: link.label || link.link_to || '',
              link_type: link.link_type || '',
              link_to: link.link_to || '',
              type: link.type || '',
              dependencies: link.dependencies || '',
              icon: link.icon,
              hidden: link.hidden,
              is_query_report: link.is_query_report,
            }));

            // `links` is FLAT: a "Card Break" row followed by the "Link" rows it owns, up to the
            // next Card Break. That "until the next Card Break" rule is authoritative — Frappe's
            // own build_links_table_from_card recomputes link_count exactly that way whenever the
            // stored count is 0, which it is for most cards on this bench (all of Buying's, for
            // instance), so the field can't be relied on. Rows before the first Card Break belong
            // to no card and are intentionally dropped.
            const cards: WorkspaceCardGroup[] = [];
            for (const row of raw.links ?? []) {
              if (row.type === 'Card Break') {
                cards.push({ label: row.label || '', icon: row.icon, links: [] });
              } else if (row.type === 'Link' && cards.length > 0 && !row.hidden) {
                cards[cards.length - 1].links.push({
                  label: row.label || row.link_to || '',
                  link_type: row.link_type || '',
                  link_to: row.link_to || '',
                  type: row.type || '',
                  dependencies: row.dependencies || '',
                  icon: row.icon,
                  hidden: row.hidden,
                  is_query_report: row.is_query_report,
                });
              }
            }

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

            const quickLists: WorkspaceQuickList[] = (raw.quick_lists ?? [])
              .filter((q) => q.document_type)
              .map((q) => ({
                label: q.label || q.document_type || '',
                document_type: q.document_type!,
                quick_list_filter: q.quick_list_filter,
              }));

            return { page, shortcuts, widgets, links, cards, quickLists };
          } catch (err) {
            // One workspace failing to load must not blank out every other one.
            console.error(`[useWorkspaces] Failed to load "${page.name}":`, err);
            return {
              page,
              shortcuts: [] as WorkspaceShortcut[],
              widgets: [] as WorkspaceWidget[],
              links: [] as WorkspaceLink[],
              cards: [] as WorkspaceCardGroup[],
              quickLists: [] as WorkspaceQuickList[],
            };
          }
        })
      );

      setWorkspaces(
        resolved.map(({ page, shortcuts, widgets, links, cards, quickLists }) => ({
          name: page.name,
          label: page.title || page.name,
          icon: page.icon,
          module: page.module,
          shortcuts,
          widgets,
          links,
          cards,
          quickLists,
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
