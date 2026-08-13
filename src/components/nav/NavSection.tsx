import React, { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import type { SidebarSectionNode } from '@/lib/frappe/sidebarItems';
import { NavLinkRow } from './NavLinkRow';

interface NavSectionProps {
  section: SidebarSectionNode;
  /** Expanded regardless of keep_closed when it contains the active route. */
  containsActiveRoute: boolean;
  currentPath: string;
}

/**
 * One collapsible group (Desk's "Section Break" with indent=1 — a clickable row with a chevron,
 * children indented beneath).
 *
 * Initial state comes from Frappe's `keep_closed`, which is set on 29 of 32 sections on this
 * bench, so most groups start collapsed exactly as they do in Desk. The one override: a section
 * holding the active route opens, otherwise navigating to a page would leave its own nav entry
 * hidden.
 */
export function NavSection({ section, containsActiveRoute, currentPath }: NavSectionProps) {
  const [open, setOpen] = useState(() => containsActiveRoute || !section.keepClosed);

  // A non-collapsible section renders as a plain heading with its items always visible.
  if (!section.collapsible) {
    return (
      <div className="mt-2">
        <div className="px-2 py-1 text-xs font-medium text-sidebar-foreground/60">{section.label}</div>
        <SidebarMenu>
          {section.items.map((item, i) => (
            <NavLinkRow key={`${item.label}-${i}`} item={item} currentPath={currentPath} />
          ))}
        </SidebarMenu>
      </div>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="group/section">
      <SidebarMenu>
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton className="font-medium">
              <span className="flex-1 text-left truncate">{section.label}</span>
              <ChevronRight
                className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
              />
            </SidebarMenuButton>
          </CollapsibleTrigger>
        </SidebarMenuItem>
      </SidebarMenu>

      <CollapsibleContent>
        <SidebarMenu className="ml-3 border-l border-sidebar-border pl-1">
          {section.items.map((item, i) => (
            <NavLinkRow key={`${item.label}-${i}`} item={item} currentPath={currentPath} />
          ))}
        </SidebarMenu>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default NavSection;
