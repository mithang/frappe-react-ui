import type { Document, DocTypeMeta, DocField, FormController as IFormController } from '@/core/types';
import { ScriptRegistry } from '@/core/registry/ScriptRegistry';
import { EventBus } from '@/core/eventbus/EventBus';
import { useDocumentStore } from '@/store';
import { DocumentModel } from '@/models/DocumentModel';

/**
 * FormControllerImpl - Implementation of Frappe-like form controller
 * Provides API similar to Frappe's frm object for client scripts
 */
export class FormControllerImpl implements IFormController {
    private _doc: Document;
    private _meta: DocTypeMeta;
    private _isNew: boolean;
    private _isDirty: boolean = false;
    private model: DocumentModel;
    private store: typeof useDocumentStore;

    constructor(
        doc: Document,
        meta: DocTypeMeta,
        isNew: boolean = false
    ) {
        this._doc = doc;
        this._meta = meta;
        this._isNew = isNew;
        this.model = new DocumentModel(meta.name);
        this.store = useDocumentStore;
    }

    // ============================================================================
    // Properties
    // ============================================================================

    get doc(): Document {
        return this._doc;
    }

    get doctype(): string {
        return this._meta.name;
    }

    get docname(): string {
        return this._doc.name;
    }

    get meta(): DocTypeMeta {
        return this._meta;
    }

    get is_new(): boolean {
        return this._isNew;
    }

    get is_dirty(): boolean {
        return this._isDirty;
    }

    // ============================================================================
    // Value Operations
    // ============================================================================

    get_value<K extends keyof Document>(fieldname: K): Document[K] {
        return this._doc[fieldname];
    }

    async set_value<K extends keyof Document>(fieldname: K, value: Document[K]): Promise<void> {
        const oldValue = this._doc[fieldname];
        if (oldValue === value) return;

        this._doc = { ...this._doc, [fieldname]: value };
        this._isDirty = true;

        // Update store
        this.store.getState().updateFieldValue(fieldname as string, value);

        // Emit field change event
        EventBus.emit('field:changed', {
            doctype: this.doctype,
            name: this.docname,
            fieldname: fieldname as string,
            value,
            oldValue,
        });

        // Execute field change scripts
        await ScriptRegistry.executeFieldChange(
            this.doctype,
            fieldname as string,
            this
        );
    }

    // ============================================================================
    // Field Property Operations
    // ============================================================================

    set_df_property(fieldname: string, property: keyof DocField, value: any): void {
        this.store.getState().setFieldOverride(fieldname, property as string, value);
    }

    toggle_display(fieldname: string, show: boolean): void {
        this.set_df_property(fieldname, 'hidden', !show);
    }

    toggle_reqd(fieldname: string, reqd: boolean): void {
        this.set_df_property(fieldname, 'reqd', reqd);
    }

    toggle_read_only(fieldname: string, read_only: boolean): void {
        this.set_df_property(fieldname, 'read_only', read_only);
    }

    // ============================================================================
    // Form Operations
    // ============================================================================

    async save(): Promise<void> {
        const store = this.store.getState();

        try {
            store.setSaving(true);
            store.clearErrors();

            // Execute validate hook
            const validateResult = await ScriptRegistry.executeHook(
                this.doctype,
                'validate',
                this
            );

            if (!validateResult) {
                throw new Error('Validation failed');
            }

            // Execute before_save hook
            await ScriptRegistry.executeHook(this.doctype, 'before_save', this);

            // Validate required fields
            const errors = this.model.validate(this._doc, this._meta);
            if (Object.keys(errors).length > 0) {
                for (const [fieldname, error] of Object.entries(errors)) {
                    store.setFieldError(fieldname, error);
                }
                throw new Error('Required fields missing');
            }

            // Save document
            let savedDoc: Document;
            if (this._isNew) {
                savedDoc = await this.model.create(this._doc);
                this._isNew = false;
            } else {
                savedDoc = await this.model.update(this.docname, this._doc);
            }

            this._doc = savedDoc;
            this._isDirty = false;
            store.setCurrentDoc(savedDoc, this._meta);

            // Execute after_save hook
            await ScriptRegistry.executeHook(this.doctype, 'after_save', this);

            // Emit save event
            EventBus.emit('doc:saved', {
                doctype: this.doctype,
                name: savedDoc.name,
                doc: savedDoc,
            });

        } finally {
            store.setSaving(false);
        }
    }

    async reload(): Promise<void> {
        const store = this.store.getState();

        try {
            store.setLoading(true);

            if (!this._isNew) {
                const doc = await this.model.get(this.docname);
                this._doc = doc;
                store.setCurrentDoc(doc, this._meta);
            }

            this._isDirty = false;
            store.clearErrors();
            store.clearFieldOverrides();

            // Execute refresh hook
            await ScriptRegistry.executeHook(this.doctype, 'refresh', this);

        } finally {
            store.setLoading(false);
        }
    }

    refresh_fields(): void {
        // Trigger a re-render by updating the store
        this.store.getState().setCurrentDoc(this._doc, this._meta);
    }

    // ============================================================================
    // Event Triggering
    // ============================================================================

    trigger(event: string, ...args: any[]): void {
        ScriptRegistry.executeHook(this.doctype, event, this, ...args);
    }
}

/**
 * Hook to create and manage a FormController
 */
export function createFormController(
    doc: Document,
    meta: DocTypeMeta,
    isNew: boolean = false
): FormControllerImpl {
    return new FormControllerImpl(doc, meta, isNew);
}
