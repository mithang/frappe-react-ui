import React from 'react';
import { Link } from 'react-router-dom';
import { SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { resolveLucideIcon } from '@/lib/icons';
import { FileText } from 'lucide-react';
import type { SidebarLinkNode } from '@/lib/frappe/sidebarItems';

interface NavLinkRowProps {
  item: SidebarLinkNode;
  currentPath: string;
}

/**
 * A single nav link.
 *
 * Items with no route (`link_type: "Page"` — Desk-only JS pages like POS, Shop Floor, Permission
 * Manager, Backups; 8 of them on this bench) render as dimmed, non-interactive text rather than
 * links to a 404. Hiding them instead would misrepresent what the workspace contains, which is
 * why they're shown but visibly unavailable.
 */
export function NavLinkRow({ item, currentPath }: NavLinkRowProps) {
  const Icon = item.icon ? resolveLucideIcon(item.icon, FileText) : null;

  if (!item.route) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          disabled
          aria-disabled="true"
          title={`${item.label} — not available in this app`}
          className="opacity-50 cursor-default"
        >
          {Icon && <Icon className="h-4 w-4 shrink-0" />}
          <span className="truncate">{item.label}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  // Exact match only: /doctype/Item must not light up while on /doctype/Item Group.
  const isActive = currentPath === item.route;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
        <Link to={item.route}>
          {Icon && <Icon className="h-4 w-4 shrink-0" />}
          <span className="truncate">{item.label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export default NavLinkRow;
