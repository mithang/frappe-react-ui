import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { Document, DocTypeMeta } from '@/core/types';

// ============================================================================
// Document Store - Manages document state and caching
// ============================================================================

interface DocumentState {
    // Current document being edited
    currentDoc: Document | null;
    currentMeta: DocTypeMeta | null;
    currentDoctype: string | null;

    // Document cache
    cache: Map<string, Document>;
    metaCache: Map<string, DocTypeMeta>;

    // Form state
    isDirty: boolean;
    isLoading: boolean;
    isSaving: boolean;
    errors: Record<string, string>;

    // Field state overrides (for dynamic field properties)
    fieldOverrides: Map<string, Partial<{
        hidden: boolean;
        read_only: boolean;
        reqd: boolean;
        options: string;
    }>>;
}

interface DocumentActions {
    // Document operations
    setCurrentDoc: (doc: Document | null, meta?: DocTypeMeta | null) => void;
    updateFieldValue: (fieldname: string, value: any) => void;
    setDirty: (isDirty: boolean) => void;

    // Loading states
    setLoading: (isLoading: boolean) => void;
    setSaving: (isSaving: boolean) => void;

    // Error handling
    setFieldError: (fieldname: string, error: string | null) => void;
    clearErrors: () => void;

    // Field overrides
    setFieldOverride: (fieldname: string, property: string, value: any) => void;
    clearFieldOverrides: () => void;

    // Cache operations
    cacheDoc: (doctype: string, name: string, doc: Document) => void;
    getCachedDoc: (doctype: string, name: string) => Document | undefined;
    cacheMeta: (doctype: string, meta: DocTypeMeta) => void;
    getCachedMeta: (doctype: string) => DocTypeMeta | undefined;
    invalidateCache: (doctype?: string, name?: string) => void;

    // Reset
    reset: () => void;
}

const initialState: DocumentState = {
    currentDoc: null,
    currentMeta: null,
    currentDoctype: null,
    cache: new Map(),
    metaCache: new Map(),
    isDirty: false,
    isLoading: false,
    isSaving: false,
    errors: {},
    fieldOverrides: new Map(),
};

export const useDocumentStore = create<DocumentState & DocumentActions>()(
    subscribeWithSelector((set, get) => ({
        ...initialState,

        setCurrentDoc: (doc, meta) => {
            set({
                currentDoc: doc,
                currentMeta: meta ?? get().currentMeta,
                currentDoctype: doc?.doctype ?? null,
                isDirty: false,
                errors: {},
                fieldOverrides: new Map(),
            });
        },

        updateFieldValue: (fieldname, value) => {
            const { currentDoc } = get();
            if (!currentDoc) return;

            set({
                currentDoc: { ...currentDoc, [fieldname]: value },
                isDirty: true,
            });
        },

        setDirty: (isDirty) => set({ isDirty }),
        setLoading: (isLoading) => set({ isLoading }),
        setSaving: (isSaving) => set({ isSaving }),

        setFieldError: (fieldname, error) => {
            const { errors } = get();
            if (error) {
                set({ errors: { ...errors, [fieldname]: error } });
            } else {
                const { [fieldname]: _, ...rest } = errors;
                set({ errors: rest });
            }
        },

        clearErrors: () => set({ errors: {} }),

        setFieldOverride: (fieldname, property, value) => {
            const { fieldOverrides } = get();
            const newOverrides = new Map(fieldOverrides);
            const current = newOverrides.get(fieldname) || {};
            newOverrides.set(fieldname, { ...current, [property]: value });
            set({ fieldOverrides: newOverrides });
        },

        clearFieldOverrides: () => set({ fieldOverrides: new Map() }),

        cacheDoc: (doctype, name, doc) => {
            const { cache } = get();
            const newCache = new Map(cache);
            newCache.set(`${doctype}:${name}`, doc);
            set({ cache: newCache });
        },

        getCachedDoc: (doctype, name) => {
            return get().cache.get(`${doctype}:${name}`);
        },

        cacheMeta: (doctype, meta) => {
            const { metaCache } = get();
            const newCache = new Map(metaCache);
            newCache.set(doctype, meta);
            set({ metaCache: newCache });
        },

        getCachedMeta: (doctype) => {
            return get().metaCache.get(doctype);
        },

        invalidateCache: (doctype, name) => {
            const { cache, metaCache } = get();
            if (doctype && name) {
                const newCache = new Map(cache);
                newCache.delete(`${doctype}:${name}`);
                set({ cache: newCache });
            } else if (doctype) {
                const newCache = new Map(cache);
                for (const key of newCache.keys()) {
                    if (key.startsWith(`${doctype}:`)) {
                        newCache.delete(key);
                    }
                }
                set({ cache: newCache });
            } else {
                set({ cache: new Map(), metaCache: new Map() });
            }
        },

        reset: () => set(initialState),
    }))
);

// ============================================================================
// UI Store - Manages global UI state
// ============================================================================

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
        const id = `toast_${Date.now()}`;
        set({ toasts: [...get().toasts, { ...toast, id }] });
        // Auto-remove after 5 seconds
        setTimeout(() => get().removeToast(id), 5000);
    },

    removeToast: (id) => {
        set({ toasts: get().toasts.filter((t) => t.id !== id) });
    },
}));

// ============================================================================
// Auth Store - Manages authentication state
// ============================================================================

interface User {
    name: string;
    email: string;
    full_name: string;
    user_image?: string;
    roles?: string[];
}

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    erpnextUrl: string;
}

interface AuthActions {
    setUser: (user: User | null) => void;
    setLoading: (isLoading: boolean) => void;
    setErpnextUrl: (url: string) => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState & AuthActions>()((set) => ({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    erpnextUrl: 'https://demo.erpnext.com',

    setUser: (user) => set({ user, isAuthenticated: !!user, isLoading: false }),
    setLoading: (isLoading) => set({ isLoading }),
    setErpnextUrl: (url) => set({ erpnextUrl: url }),
    logout: () => set({ user: null, isAuthenticated: false }),
}));
