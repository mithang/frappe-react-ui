import { useState, useEffect, useCallback, useRef } from 'react';
import type { Document, DocTypeMeta } from '@/core/types';
import { ScriptRegistry } from '@/core/registry/ScriptRegistry';
import { useDocumentStore } from '@/store';
import { DocumentModel } from '@/models/DocumentModel';
import { FormControllerImpl, createFormController } from '@/controllers/FormController';

interface UseFormControllerOptions {
    doctype: string;
    name?: string;
    onSave?: (doc: Document) => void;
    onError?: (error: Error) => void;
}

interface UseFormControllerReturn {
    frm: FormControllerImpl | null;
    doc: Document | null;
    meta: DocTypeMeta | null;
    isLoading: boolean;
    isSaving: boolean;
    isDirty: boolean;
    errors: Record<string, string>;
    fieldOverrides: Map<string, any>;
    save: () => Promise<void>;
    reload: () => Promise<void>;
    getValue: <T = any>(fieldname: string) => T;
    setValue: (fieldname: string, value: any) => Promise<void>;
    setProperty: (fieldname: string, property: string, value: any) => void;
}

/**
 * useFormController - React hook for managing form state with FormController
 * Provides Frappe-like frm object for use in components
 */
export function useFormController(options: UseFormControllerOptions): UseFormControllerReturn {
    const { doctype, name, onSave, onError } = options;
    const isNew = !name || name === 'new';

    const [frm, setFrm] = useState<FormControllerImpl | null>(null);
    const [meta, setMeta] = useState<DocTypeMeta | null>(null);
    const modelRef = useRef<DocumentModel>(new DocumentModel(doctype));

    const {
        currentDoc,
        isLoading,
        isSaving,
        isDirty,
        errors,
        fieldOverrides,
        setCurrentDoc,
        setLoading,
        clearErrors,
        clearFieldOverrides,
    } = useDocumentStore();

    // Initialize form
    useEffect(() => {
        let mounted = true;

        const init = async () => {
            setLoading(true);
            clearErrors();
            clearFieldOverrides();

            try {
                // Load metadata
                const docMeta = await modelRef.current.getMeta();
                if (!mounted) return;
                setMeta(docMeta);

                // Load or create document
                let doc: Document;
                if (isNew) {
                    doc = modelRef.current.createNew(docMeta);
                } else {
                    doc = await modelRef.current.get(name!);
                }
                if (!mounted) return;

                // Create controller
                const controller = createFormController(doc, docMeta, isNew);
                setFrm(controller);
                setCurrentDoc(doc, docMeta);

                // Execute onload hook
                await ScriptRegistry.executeHook(doctype, 'onload', controller);

                // Execute refresh hook
                await ScriptRegistry.executeHook(doctype, 'refresh', controller);

            } catch (error: any) {
                console.error('[useFormController] Init error:', error);
                onError?.(error);
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        };

        init();

        return () => {
            mounted = false;
        };
    }, [doctype, name, isNew]);

    // Save function
    const save = useCallback(async () => {
        if (!frm) return;

        try {
            await frm.save();
            onSave?.(frm.doc);
        } catch (error: any) {
            onError?.(error);
            throw error;
        }
    }, [frm, onSave, onError]);

    // Reload function
    const reload = useCallback(async () => {
        if (!frm) return;

        try {
            await frm.reload();
        } catch (error: any) {
            onError?.(error);
        }
    }, [frm, onError]);

    // Get value function
    const getValue = useCallback(<T = any>(fieldname: string): T => {
        return currentDoc?.[fieldname] as T;
    }, [currentDoc]);

    // Set value function
    const setValue = useCallback(async (fieldname: string, value: any) => {
        if (!frm) return;
        await frm.set_value(fieldname as keyof Document, value);
        // Sync back to store to trigger updates in subscribed components
        if (meta) {
            setCurrentDoc({ ...frm.doc }, meta);
        }
    }, [frm, meta, setCurrentDoc]);

    // Set property function
    const setProperty = useCallback((fieldname: string, property: string, value: any) => {
        if (!frm) return;
        frm.set_df_property(fieldname, property as any, value);
        // Sync back to store if needed
        if (meta) {
            setCurrentDoc({ ...frm.doc }, meta);
        }
    }, [frm, meta, setCurrentDoc]);

    return {
        frm,
        doc: currentDoc,
        meta,
        isLoading,
        isSaving,
        isDirty,
        errors,
        fieldOverrides,
        save,
        reload,
        getValue,
        setValue,
        setProperty,
    };
}
