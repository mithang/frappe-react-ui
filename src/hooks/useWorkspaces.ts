import { useState, useEffect } from 'react';
import { getFrappeApp } from '@/lib/frappe';

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
  is_workspace: boolean;
  public: boolean;
  shortcuts: WorkspaceShortcut[];
  widgets: WorkspaceWidget[];
  content: string;
}

export const useWorkspaces = () => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadWorkspaces();
  }, []);

  const loadWorkspaces = async () => {
    try {
      const frappe = getFrappeApp();
      const response = await frappe.call('frappe.desk.desktop.get_workspace_sidebar_items');

      // Transform the API response to match our expected structure
      const pages = response.message?.pages || [];
      let widgetCounter = 0;
      const transformedWorkspaces = pages.map((page: Record<string, unknown>) => {
        let widgets: WorkspaceWidget[] = [];
        let shortcuts: WorkspaceShortcut[] = [];

        try {
          // Parse the content JSON to extract widgets
          const contentData = JSON.parse(String(page.content || '[]'));
          widgets = contentData.map((item: Record<string, unknown>) => ({
            id: String(item.id || `widget-${++widgetCounter}`),
            type: item.type as WorkspaceWidget['type'],
            data: item.data as WorkspaceWidget['data'],
          }));

          // Extract shortcuts from widgets
          shortcuts = widgets
            .filter(widget => widget.type === 'shortcut')
            .map(widget => ({
              name: widget.data.shortcut_name || '',
              label: widget.data.shortcut_name || '',
              link_to: widget.data.shortcut_name,
              icon: 'file'
            }));
        } catch (error) {
          console.error(`Failed to parse content for workspace ${page.name}:`, error);
        }

        return {
          name: String(page.name || ''),
          label: String(page.label || page.title || ''),
          icon: page.icon ? String(page.icon) : undefined,
          is_workspace: true,
          public: Boolean(page.public),
          shortcuts,
          widgets,
          content: String(page.content || '')
        };
      });

      setWorkspaces(transformedWorkspaces);
    } catch (err: unknown) {
      console.error('Failed to load workspaces:', err);
      const errMsg = err instanceof Error ? err.message : 'Failed to load workspaces';
      setError(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return { workspaces, isLoading, error, refresh: loadWorkspaces };
};