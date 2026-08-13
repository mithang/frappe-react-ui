import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { resolveLucideIcon } from '@/lib/icons';
import { FileText } from 'lucide-react';
import { ExtensionErrorBoundary } from '@/core/registry/ExtensionErrorBoundary';
import { useCurrentWorkspace } from '@/hooks/useCurrentWorkspace';
import { useNavSlot, useRailOverride } from '@/hooks/useNavRegistry';

/** Desk's dock is a 50px column (workspace_dock.scss). Exported so the shell can offset the
 *  fixed sidebar pane by exactly this much instead of duplicating the number. */
export const RAIL_WIDTH = '50px';

/**
 * The narrow left rail: every workspace as an icon, mirroring Desk's workspace dock
 * (frappe/public/scss/desk/workspace_dock.scss — 50px column, 28px items, 7px radius).
 *
 * Deliberately a plain <aside>, NOT a second <Sidebar>. All shadcn Sidebars share one
 * SidebarContext, so a second collapsible one would toggle together with the panel and both
 * would render `position: fixed; left-0` on top of each other. Keeping the rail outside that
 * context also gives the Desk behaviour for free: collapsing the sidebar (header button or Cmd+B)
 * hides the panel and leaves the rail in place.
 */
export function WorkspaceRail() {
  const { pathname } = useLocation();
  const { workspace: current, workspaces, isLoading } = useCurrentWorkspace();

  const override = useRailOverride();
  const topSlots = useNavSlot('rail-top');
  const bottomSlots = useNavSlot('rail-bottom');

  if (override) {
    const Override = override.component;
    return (
      <ExtensionErrorBoundary extensionName={override.extensionName}>
        <Override workspace={current?.name} />
      </ExtensionErrorBoundary>
    );
  }

  return (
    <aside
      role="navigation"
      aria-label="Workspaces"
      className="w-[var(--rail-width,50px)] shrink-0 h-screen sticky top-0 z-20 flex flex-col items-center gap-1 py-2 bg-sidebar border-r border-sidebar-border overflow-y-auto"
    >
      {topSlots.map((slot, i) => (
        <ExtensionErrorBoundary key={`top-${i}`} extensionName={slot.extensionName}>
          {slot.node}
        </ExtensionErrorBoundary>
      ))}

      {isLoading
        ? [...Array(8)].map((_, i) => (
            <div key={i} className="h-7 w-7 rounded-[7px] bg-sidebar-accent/40 animate-pulse" />
          ))
        : workspaces.map((ws) => {
            const Icon = resolveLucideIcon(ws.icon, FileText);
            const route = `/workspace/${ws.name}`;
            // Match on the workspace in view rather than the URL, so the rail stays highlighted
            // while the user is on a form or report reached from that workspace.
            const isActive = current?.name === ws.name || pathname === route;

            return (
              <Tooltip key={ws.name}>
                <TooltipTrigger asChild>
                  <Link
                    to={route}
                    aria-label={ws.label}
                    aria-current={isActive ? 'page' : undefined}
                    className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] transition-colors ${
                      isActive
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {isActive && (
                      <span className="absolute -left-[7px] h-4 w-[2px] rounded-full bg-sidebar-primary" />
                    )}
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">{ws.label}</TooltipContent>
              </Tooltip>
            );
          })}

      <div className="flex-1" />

      {bottomSlots.map((slot, i) => (
        <ExtensionErrorBoundary key={`bottom-${i}`} extensionName={slot.extensionName}>
          {slot.node}
        </ExtensionErrorBoundary>
      ))}
    </aside>
  );
}

export default WorkspaceRail;
