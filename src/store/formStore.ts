// Per-form store (1B, Wave 1 frozen contract) — the fix for C1/A1. One store PER FORM INSTANCE,
// created by a factory and supplied through context, never a single app-wide document store.
// Two forms open at once (a quick-entry dialog on top of a list, a linked-doc preview) must not
// share this state.
//
// The critical invariant: `setValue` and `resetTo` are DIFFERENT operations. `setValue` marks
// dirty and must NEVER clear errors/overrides; only `resetTo` clears them. Conflating the two —
// which is exactly what the old global `useDocumentStore.setCurrentDoc` did on every keystroke —
// is bug C1, the subtlest and worst bug in this codebase.

import { createContext, useContext } from 'react';
import { createStore, useStore, type StoreApi } from 'zustand';
import type { Document, DocField } from '@/core/types';

export interface FormState {
  draft: Document;
  isDirty: boolean;
  errors: Record<string, string>;
  /** set_df_property targets — also the seam for 3B's `frm.set_query` shim (link_filters). */
  overrides: Map<string, Partial<DocField>>;
  setValue<K extends string>(fieldname: K, value: unknown): void;
  setError(fieldname: string, msg: string | null): void;
  setOverride(fieldname: string, prop: keyof DocField, value: unknown): void;
  /** The ONLY thing that clears dirty/errors/overrides — a fresh load or a completed save. */
  resetTo(doc: Document): void;
}

export function createFormStore(initial: Document): StoreApi<FormState> {
  return createStore<FormState>((set, get) => ({
    draft: initial,
    isDirty: false,
    errors: {},
    overrides: new Map(),

    setValue(fieldname, value) {
      set({
        draft: { ...get().draft, [fieldname]: value },
        isDirty: true,
      });
    },

    setError(fieldname, msg) {
      const errors = { ...get().errors };
      if (msg) {
        errors[fieldname] = msg;
      } else {
        delete errors[fieldname];
      }
      set({ errors });
    },

    setOverride(fieldname, prop, value) {
      const overrides = new Map(get().overrides);
      const current = overrides.get(fieldname) ?? {};
      overrides.set(fieldname, { ...current, [prop]: value });
      set({ overrides });
    },

    resetTo(doc) {
      set({ draft: doc, isDirty: false, errors: {}, overrides: new Map() });
    },
  }));
}

const FormStoreContext = createContext<StoreApi<FormState> | null>(null);

export const FormStoreProvider = FormStoreContext.Provider;

export function useFormStore<T>(selector: (state: FormState) => T): T {
  const store = useContext(FormStoreContext);
  if (!store) {
    throw new Error('useFormStore must be used within a <FormStoreProvider>');
  }
  return useStore(store, selector);
}
