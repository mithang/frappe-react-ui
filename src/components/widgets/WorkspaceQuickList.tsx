import React from 'react';
import { QuickListWidget } from '@/components/widgets/QuickListWidget';
import type { Workspace, WorkspaceWidget } from '@/hooks/useWorkspaces';

interface WorkspaceQuickListProps {
  workspace: Workspace;
  widget: WorkspaceWidget;
}

/**
 * Workspace-aware binding for a `quick_list` content block.
 *
 * The two halves are deliberately separate components:
 *   - QuickListWidget is presentational + data-fetching for a GIVEN doctype and filter, so it can
 *     be rendered from anywhere (a custom dashboard, an extension) without a Workspace in hand.
 *   - This component owns the one thing that genuinely needs the Workspace: resolving the block's
 *     `quick_list_name` — which is a LABEL, not a doctype — against the workspace's own
 *     `quick_lists` child table to find the real `document_type` and `quick_list_filter`.
 *
 * Keeping that lookup here rather than inline in WorkspaceDashboard's widget switch means the
 * switch stays a pure dispatch table, and the label→config contract lives next to the component
 * that depends on it.
 */
export function WorkspaceQuickList({ workspace, widget }: WorkspaceQuickListProps) {
  const quickListName = widget.data.quick_list_name || '';
  const config = workspace.quickLists?.find((q) => q.label === quickListName);

  return (
    <QuickListWidget
      listName={quickListName}
      documentType={config?.document_type}
      quickListFilter={config?.quick_list_filter}
      col={widget.data.col || 12}
    />
  );
}

export default WorkspaceQuickList;
