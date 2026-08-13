// Turns a Workspace's flat `sidebar_items` child table into the tree the nav panel renders.
//
// This is a direct port of two pieces of Desk, because getting either subtly wrong silently
// misplaces or hides navigation:
//
//   1. frappe/public/js/frappe/ui/sidebar/sidebar.js -> find_nested_items()
//   2. frappe/public/js/frappe/ui/sidebar/sidebar_item.js -> frappe.ui.sidebar_item.get_route()
//
// THE NESTING RULE IS NOT "everything until the next Section Break".
// An item nests under the current section ONLY when its own `child` flag is set; otherwise it
// stays top-level even though a Section Break preceded it. Desk:
//
//     if (item.type === "Section Break")      { currentSection = item; push(item); }
//     else if (currentSection && item.child)  { currentSection.nested_items.push(item); }
//     else                                    { push(item); }
//
// That distinction is load-bearing on this bench: Selling, Buying, Projects, Support, Assets,
// Manufacturing and Build each end with a top-level `child: 0` link (usually "Settings") sitting
// after their last Section Break. The proximity rule wrongly swallows it into that group.

/** One row of the `Workspace Sidebar Item` child table (istable=1). */
export interface SidebarItemRow {
  idx?: number;
  type?: string;
  label?: string;
  link_type?: string;
  link_to?: string;
  icon?: string;
  url?: string;
  /** Set => this row belongs to the Section Break above it. */
  child?: 0 | 1;
  /** Set on a Section Break => its children render indented (and icon-less). */
  indent?: 0 | 1;
  collapsible?: 0 | 1;
  /** Set => the section starts collapsed. True for 29 of 32 sections on this bench. */
  keep_closed?: 0 | 1;
  hidden?: 0 | 1;
}

export interface SidebarLinkNode {
  kind: 'link';
  label: string;
  /** null => there is no destination for this link in this app; render it inert, not clickable. */
  route: string | null;
  icon?: string;
  linkType: string;
  /** Children of an indented section render without an icon, matching Desk. */
  indented: boolean;
}

export interface SidebarSectionNode {
  kind: 'section';
  label: string;
  icon?: string;
  collapsible: boolean;
  /** Desk's `keep_closed` — the section's initial collapsed state. */
  keepClosed: boolean;
  items: SidebarLinkNode[];
}

export type SidebarNode = SidebarLinkNode | SidebarSectionNode;

/** Desk falls back to the "list" icon for any item that doesn't specify one. */
const DEFAULT_ICON = 'list';

/**
 * Maps a row to this app's route.
 *
 * Returns null when we genuinely cannot navigate there, which the caller renders as inert text.
 * That is deliberate: a link to nowhere is worse than a visibly-disabled one, and silently
 * dropping the row would misrepresent what the workspace contains.
 *
 * `Page` is the real gap — Desk routes those to bundled Desk JS pages (POS, Shop Floor,
 * Permission Manager, Backups) that this SPA has no equivalent of.
 */
export function routeForSidebarItem(row: SidebarItemRow): string | null {
  if (row.type !== 'Link') return null;

  const target = row.link_to?.trim();

  switch (row.link_type) {
    case 'DocType':
      return target ? `/doctype/${target}` : null;
    case 'Report':
      return target ? `/reports/${target}` : null;
    case 'Workspace':
      return target ? `/workspace/${target}` : null;
    case 'Dashboard':
      // SmartForm special-cases the Dashboard doctype and renders the record's charts and number
      // cards (DashboardPreview), so this is a real destination rather than a consolation prize.
      return target ? `/doctype/Dashboard/${target}` : null;
    case 'URL':
      return row.url?.trim() || null;
    default:
      return null;
  }
}

function toLinkNode(row: SidebarItemRow, indented: boolean): SidebarLinkNode {
  return {
    kind: 'link',
    label: row.label || row.link_to || '',
    route: routeForSidebarItem(row),
    // An indented child gets no icon in Desk — the indent already conveys the nesting.
    icon: indented ? undefined : row.icon || DEFAULT_ICON,
    linkType: row.link_type || '',
    indented,
  };
}

/**
 * Builds the render tree, preserving the table's own order (`idx`).
 *
 * Section Breaks always survive even when empty, because Desk renders the heading regardless;
 * `Spacer` rows are layout-only and dropped.
 */
export function buildSidebarTree(rows: readonly SidebarItemRow[]): SidebarNode[] {
  const ordered = [...(rows ?? [])].sort((a, b) => (a.idx ?? 0) - (b.idx ?? 0));

  const tree: SidebarNode[] = [];
  let currentSection: SidebarSectionNode | null = null;
  let currentSectionIndents = false;

  for (const row of ordered) {
    if (row.hidden) continue;

    if (row.type === 'Section Break') {
      currentSection = {
        kind: 'section',
        label: row.label || '',
        icon: row.icon,
        collapsible: !!row.collapsible,
        keepClosed: !!row.keep_closed,
        items: [],
      };
      currentSectionIndents = !!row.indent;
      tree.push(currentSection);
      continue;
    }

    // Spacers exist only to add vertical gaps in Desk's own layout.
    if (row.type === 'Spacer') continue;
    if (row.type !== 'Link') continue;

    if (currentSection && row.child) {
      currentSection.items.push(toLinkNode(row, currentSectionIndents));
    } else {
      // No `child` flag => top-level, even if a Section Break came before it.
      tree.push(toLinkNode(row, false));
    }
  }

  return tree;
}
