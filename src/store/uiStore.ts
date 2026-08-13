// Global UI state (1B) — sidebar/theme/workspace/toasts. Deliberately app-wide (unlike
// formStore, which is per-instance): there's only one sidebar, one theme, one current workspace.
// Replaces the UI slice that lived in store/index.ts.

import { create } from 'zustand';

interface UIState {
  sidebarCollapsed: boolean;
  currentWorkspace: string | null;
  theme: 'light' | 'dark' | 'system';
  toasts: Array<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message?: string;
  }>;
}

interface UIActions {
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setCurrentWorkspace: (workspace: string | null) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  addToast: (toast: Omit<UIState['toasts'][0], 'id'>) => void;
  removeToast: (id: string) => void;
}

export const useUIStore = create<UIState & UIActions>()((set, get) => ({
  sidebarCollapsed: false,
  currentWorkspace: null,
  theme: 'system',
  toasts: [],

  toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setCurrentWorkspace: (workspace) => set({ currentWorkspace: workspace }),
  setTheme: (theme) => set({ theme }),

  addToast: (toast) => {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `toast_${Math.random().toString(36).slice(2)}`;
    set({ toasts: [...get().toasts, { ...toast, id }] });
    setTimeout(() => get().removeToast(id), 5000);
  },

  removeToast: (id) => {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
}));
