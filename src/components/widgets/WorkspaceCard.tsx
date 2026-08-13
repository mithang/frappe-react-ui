import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowUpRight } from 'lucide-react';
import type { Workspace, WorkspaceWidget, WorkspaceLink } from '@/hooks/useWorkspaces';

interface WorkspaceCardProps {
  workspace: Workspace;
  widget: WorkspaceWidget;
}

/**
 * Resolves a link row to this app's route, mirroring frappe.utils.generate_route's branches for
 * the link types that actually occur in workspaces (verified across this bench: DocType, Report —
 * both query and standard — and Page).
 *
 * Page links return null: Desk routes them to a bundled JS page (`/app/<page>`), which is a
 * server-rendered Desk view this SPA has no equivalent of. Rendering one as a link would navigate
 * to a 404, so the row is shown as plain, non-clickable text instead.
 */
function routeForLink(link: WorkspaceLink): string | null {
  const target = link.link_to;
  if (!target) return null;

  switch (link.link_type) {
    case 'DocType':
      return `/doctype/${target}`;
    case 'Report':
      return `/reports/${target}`;
    default:
      return null;
  }
}

/**
 * A workspace `card` content block: a "Card Break" heading plus the Link rows it owns.
 *
 * The block stores only a `card_name`, which matches the LABEL of a Card Break row in the
 * workspace's flat `links` child table — the links themselves are the rows that follow it, up to
 * the next Card Break (see useWorkspaces, where the grouping happens). They are NOT selected by
 * matching a link's `dependencies` field: `dependencies` names the doctypes a link needs in order
 * to be usable, and is empty on most rows, so filtering on it produced cards with no links at all.
 */
export function WorkspaceCard({ workspace, widget }: WorkspaceCardProps) {
  const cardName = widget.data.card_name || '';
  const group = workspace.cards?.find((c) => c.label === cardName);
  const links = group?.links ?? [];

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">{cardName}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {links.length === 0 ? (
          <div className="text-sm text-muted-foreground">No links</div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {links.map((link, idx) => {
              const route = routeForLink(link);
              const key = `${link.link_to || link.label}-${idx}`;

              if (!route) {
                return (
                  <span key={key} className="text-sm text-muted-foreground/70 truncate" title={link.label}>
                    {link.label}
                  </span>
                );
              }

              return (
                <Link
                  key={key}
                  to={route}
                  title={link.label}
                  className="group inline-flex items-center text-sm text-foreground/80 hover:text-primary transition-colors"
                >
                  <span className="truncate">{link.label}</span>
                  <ArrowUpRight className="ml-1.5 h-3.5 w-3.5 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" />
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default WorkspaceCard;
