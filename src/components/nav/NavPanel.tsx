import React, { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { SidebarMenu, SidebarGroup } from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { ExtensionErrorBoundary } from '@/core/registry/ExtensionErrorBoundary';
import { useCurrentWorkspace } from '@/hooks/useCurrentWorkspace';
import { useNavItems, useNavSlot, usePanelOverride } from '@/hooks/useNavRegistry';
import type { SidebarNode, SidebarSectionNode } from '@/lib/frappe/sidebarItems';
import { NavLinkRow } from './NavLinkRow';
import { NavSection } from './NavSection';

function sectionContainsPath(section: SidebarSectionNode, path: string): boolean {
  return section.items.some((item) => item.route === path);
}

/**
 * The wider of the two nav panes: the current workspace's own `sidebar_items`, rendered as
 * top-level entries plus collapsible sections (see lib/frappe/sidebarItems.ts for the grouping
 * rules, which are Desk's, not "everything until the next break").
 *
 * Extension points, resolved most-specific-first:
 *   registerPanelFor(workspace) -> registerPanel() -> this component
 * Plus `panel-header` / `panel-footer` slots and NavRegistry items scoped to this workspace.
 */
export function NavPanel() {
  const { pathname } = useLocation();
  const { workspace, isLoading } = useCurrentWorkspace();

  const override = usePanelOverride(workspace?.name);
  const headerSlots = useNavSlot('panel-header');
  const footerSlots = useNavSlot('panel-footer');
  const extensionItems = useNavItems(workspace?.name);

  const tree: SidebarNode[] = useMemo(() => workspace?.sidebarTree ?? [], [workspace]);

  // A whole-panel override still gets the slots around it, so an app replacing the panel doesn't
  // silently drop other extensions' contributions.
  if (override) {
    const Override = override.component;
    return (
      <ExtensionErrorBoundary extensionName={override.extensionName}>
        <Override workspace={workspace?.name} />
      </ExtensionErrorBoundary>
    );
  }

  if (isLoading) {
    return (
      <SidebarGroup className="gap-2">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-7 w-full" />
        ))}
      </SidebarGroup>
    );
  }

  if (!workspace) {
    return <div className="px-3 py-2 text-xs text-sidebar-foreground/60">No workspace selected</div>;
  }

  return (
    <SidebarGroup className="gap-0.5">
      {headerSlots.map((slot, i) => (
        <ExtensionErrorBoundary key={`header-${i}`} extensionName={slot.extensionName}>
          {slot.node}
        </ExtensionErrorBoundary>
      ))}

      {tree.map((node, i) =>
        node.kind === 'section' ? (
          <NavSection
            key={`section-${node.label}-${i}`}
            section={node}
            containsActiveRoute={sectionContainsPath(node, pathname)}
            currentPath={pathname}
          />
        ) : (
          <SidebarMenu key={`link-${node.label}-${i}`}>
            <NavLinkRow item={node} currentPath={pathname} />
          </SidebarMenu>
        )
      )}

      {extensionItems.length > 0 && (
        <SidebarMenu className="mt-2">
          {extensionItems.map((item, i) => (
            <NavLinkRow
              key={`ext-${item.label}-${i}`}
              item={{
                kind: 'link',
                label: item.label,
                route: item.route,
                icon: item.icon ?? 'list',
                linkType: 'DocType',
                indented: false,
              }}
              currentPath={pathname}
            />
          ))}
        </SidebarMenu>
      )}

      {footerSlots.map((slot, i) => (
        <ExtensionErrorBoundary key={`footer-${i}`} extensionName={slot.extensionName}>
          {slot.node}
        </ExtensionErrorBoundary>
      ))}
    </SidebarGroup>
  );
}

export default NavPanel;
