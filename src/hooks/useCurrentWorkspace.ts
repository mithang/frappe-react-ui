// Which workspace is on screen, for the nav panes and active-item highlighting.
//
// Two routes imply a workspace:
//   /workspace/:workspaceName   — explicit
//   everything else             — fall back to the default (Home, else the first workspace),
//                                 mirroring HomeRedirect so the panel is never blank while the
//                                 user is on a form, list or report reached from that workspace.

import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useWorkspaces, type Workspace } from '@/hooks/useWorkspaces';

/**
 * Parsed from the pathname rather than useParams(), deliberately: the nav panes render in the
 * app SHELL (App.tsx), outside the route tree, where useParams() always returns {} — which made
 * every workspace show Home's items.
 */
function workspaceNameFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/workspace\/([^/]+)/);
  // Workspace names contain spaces ("Financial Reports"), so they arrive percent-encoded.
  return match ? decodeURIComponent(match[1]) : null;
}

export interface CurrentWorkspace {
  workspace: Workspace | null;
  workspaces: Workspace[];
  isLoading: boolean;
}

export function useCurrentWorkspace(): CurrentWorkspace {
  const { pathname } = useLocation();
  const { workspaces, isLoading } = useWorkspaces();

  const workspace = useMemo(() => {
    if (!workspaces.length) return null;

    const wanted = workspaceNameFromPath(pathname);
    if (wanted) return workspaces.find((w) => w.name === wanted) ?? null;

    // Off a workspace route (a form, list or report): fall back to the default so the panel keeps
    // showing navigation rather than emptying out. Mirrors HomeRedirect's choice.
    return workspaces.find((w) => w.name === 'Home') ?? workspaces[0] ?? null;
  }, [workspaces, pathname]);

  return { workspace, workspaces, isLoading };
}
