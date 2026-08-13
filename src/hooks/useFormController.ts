import { useState, useEffect, useCallback, useRef } from 'react';
import { useStore, type StoreApi } from 'zustand';
import type { Document, DocTypeMeta } from '@/core/types';
import { ScriptRegistry } from '@/core/registry/ScriptRegistry';
import { loadAndRunClientScripts } from '@/lib/scripts';
import { getFrappeClient } from '@/lib/api/client';
import { useDocRealtime } from '@/lib/realtime/useDocRealtime';
import { toast } from '@/hooks/use-toast';
import { createFormStore, type FormState } from '@/store/formStore';
import { FormControllerImpl, createFormController, createNewDocument, type DocstatusAction } from '@/controllers/FormController';

interface UseFormControllerOptions {
    doctype: string;
    name?: string;
    prefill?: Record<string, any>;
    onSave?: (doc: Document) => void;
    onError?: (error: Error) => void;
}

interface UseFormControllerReturn {
    frm: FormControllerImpl | null;
    /** The store instance backing `frm` — pass to <FormStoreProvider> so FieldDispatcher (and
     *  anything else rendered inside this form) reads/writes the SAME state as `frm` does. */
    store: StoreApi<FormState> | null;
    doc: Document | null;
    meta: DocTypeMeta | null;
    isLoading: boolean;
    isSaving: boolean;
    isDirty: boolean;
    errors: Record<string, string>;
    fieldOverrides: Map<string, any>;
    save: (action?: DocstatusAction) => Promise<void>;
    reload: () => Promise<void>;
    getValue: <T = any>(fieldname: string) => T;
    setValue: (fieldname: string, value: any) => Promise<void>;
    setProperty: (fieldname: string, property: string, value: any) => void;
}

/**
 * useFormController — React hook wiring a FormController to a per-instance formStore (1B) and
 * the real FrappeClient (1A). Each call creates its OWN store, so two forms mounted at once
 * (e.g. a quick-entry dialog over a list) have fully independent state — the A1 fix.
 */
export function useFormController(options: UseFormControllerOptions): UseFormControllerReturn {
    const { doctype, name, prefill, onSave, onError } = options;
    const isNew = !name || name === 'new';

    const [frm, setFrm] = useState<FormControllerImpl | null>(null);
    const [meta, setMeta] = useState<DocTypeMeta | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const storeRef = useRef<StoreApi<FormState> | null>(null);

    // A fresh store per (doctype, name) — never reused across a doctype/record switch.
    if (!storeRef.current) {
        storeRef.current = createFormStore({ name: name ?? '', doctype, docstatus: 0 });
    }
    const store = storeRef.current;
    const { draft, isDirty, errors, overrides } = useStore(store, (s) => s);

    useEffect(() => {
        // A new (doctype, name) pair needs its own store — swap it before loading.
        storeRef.current = createFormStore({ name: name ?? '', doctype, docstatus: 0 });
        let mounted = true;

        const init = async () => {
            setIsLoading(true);
            const client = getFrappeClient();

            try {
                const { meta: docMeta } = await client.getMeta(doctype);
                if (!mounted) return;
                setMeta(docMeta);

                let initialDoc: Document;
                if (isNew) {
                    initialDoc = createNewDocument(doctype, docMeta);
                    if (prefill) {
                        initialDoc = { ...initialDoc, ...prefill };
                    }
                } else {
                    initialDoc = (await client.getDoc(doctype, name!)).doc;
                }

                if (!mounted) return;

                storeRef.current!.getState().resetTo(initialDoc);
                const controller = createFormController(storeRef.current!, docMeta, isNew, client);
                setFrm(controller);

                // Server-defined Client Scripts (A7) must be registered before onload/refresh
                // fire, or their hooks simply won't exist yet to run.
                await loadAndRunClientScripts(doctype);

                await ScriptRegistry.executeHook(doctype, 'onload', controller);
                await ScriptRegistry.executeHook(doctype, 'refresh', controller);
            } catch (error: any) {
                console.error('[useFormController] Init error:', error);
                onError?.(error);
            } finally {
                if (mounted) setIsLoading(false);
            }
        };

        init();

        return () => {
            mounted = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [doctype, name, isNew]);

    const save = useCallback(
        async (action: DocstatusAction = 'Save') => {
            if (!frm) return;
            setIsSaving(true);
            try {
                await frm.save(action);
                onSave?.(frm.doc);
            } catch (error: any) {
                onError?.(error);
                throw error;
            } finally {
                setIsSaving(false);
            }
        },
        [frm, onSave, onError]
    );

    const reload = useCallback(async () => {
        if (!frm) return;
        try {
            await frm.reload();
        } catch (error: any) {
            onError?.(error);
        }
    }, [frm, onError]);

    // 4A: if someone else saves this document while it's open here, a clean form silently picks
    // up their change; a dirty form is left alone and just told — auto-overwriting in-progress
    // edits would be worse than doing nothing. See docs/BASELINE.md's "4A" note for the
    // same-origin constraint this currently requires (Frappe's socket auth rejects genuinely
    // cross-origin connections — this works via the dev proxy / any same-origin deployment).
    useDocRealtime(doctype, isNew ? undefined : name, {
        onRemoteChange: () => {
            if (!isDirty) {
                reload();
            } else {
                toast({
                    title: 'Document changed elsewhere',
                    description: `${doctype} ${name} was updated by someone else. Your unsaved changes were not overwritten — reload manually to see their changes.`,
                    variant: 'destructive',
                });
            }
        },
    });

    const getValue = useCallback(<T = any>(fieldname: string): T => draft?.[fieldname] as T, [draft]);

    const setValue = useCallback(
        async (fieldname: string, value: any) => {
            if (!frm) return;
            await frm.set_value(fieldname as keyof Document, value);
        },
        [frm]
    );

    const setProperty = useCallback(
        (fieldname: string, property: string, value: any) => {
            if (!frm) return;
            frm.set_df_property(fieldname, property as any, value);
        },
        [frm]
    );

    return {
        frm,
        store,
        doc: draft,
        meta,
        isLoading,
        isSaving,
        isDirty,
        errors,
        fieldOverrides: overrides,
        save,
        reload,
        getValue,
        setValue,
        setProperty,
    };
}
