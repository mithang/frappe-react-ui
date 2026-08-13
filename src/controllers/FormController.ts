import type { Document, DocTypeMeta, DocField, FormController as IFormController } from '@/core/types';
import type { StoreApi } from 'zustand';
import type { FormState } from '@/store/formStore';
import type { FrappeClient } from '@/lib/api/client';
import { ScriptRegistry } from '@/core/registry/ScriptRegistry';
import { EventBus } from '@/core/eventbus/EventBus';
import { evaluateFieldVisibility } from '@/lib/expr/dependsOn';

export type DocstatusAction = 'Save' | 'Submit' | 'Cancel' | 'Update';

/** Structural/presentational fieldtypes — they hold no value, so they can never be "missing". */
const LAYOUT_FIELDTYPES = new Set<DocField['fieldtype']>([
    'Section Break',
    'Column Break',
    'Tab Break',
    'HTML',
    'Button',
    'Heading',
]);

/**
 * FormControllerImpl — Frappe-like `frm` object for client scripts, now backed by a per-instance
 * formStore (1B) instead of the old app-wide store, and the real FrappeClient (1A) instead of
 * DocumentModel's REST calls — closing A8 (save now goes through `savedocs`: conflict detection,
 * _server_messages, exc_type all survive) and A1 (two forms no longer share state).
 */
export class FormControllerImpl implements IFormController {
    private _meta: DocTypeMeta;
    private _isNew: boolean;
    private store: StoreApi<FormState>;
    private client: FrappeClient;

    constructor(store: StoreApi<FormState>, meta: DocTypeMeta, isNew: boolean, client: FrappeClient) {
        this.store = store;
        this._meta = meta;
        this._isNew = isNew;
        this.client = client;
    }

    // ============================================================================
    // Properties
    // ============================================================================

    get doc(): Document {
        return this.store.getState().draft;
    }

    get doctype(): string {
        return this._meta.name;
    }

    get docname(): string {
        return this.doc.name;
    }

    get meta(): DocTypeMeta {
        return this._meta;
    }

    get is_new(): boolean {
        return this._isNew;
    }

    get is_dirty(): boolean {
        return this.store.getState().isDirty;
    }

    get docstatus(): 0 | 1 | 2 {
        return this.doc.docstatus ?? 0;
    }

    // ============================================================================
    // Value Operations
    // ============================================================================

    get_value<K extends keyof Document>(fieldname: K): Document[K] {
        return this.doc[fieldname];
    }

    async set_value<K extends keyof Document>(fieldname: K, value: Document[K]): Promise<void> {
        const oldValue = this.doc[fieldname];
        if (oldValue === value) return;

        // setValue, never resetTo — marks dirty without touching errors/overrides (the C1 fix).
        this.store.getState().setValue(fieldname as string, value);

        EventBus.emit('field:changed', {
            doctype: this.doctype,
            name: this.docname,
            fieldname: fieldname as string,
            value,
            oldValue,
        });

        await ScriptRegistry.executeFieldChange(this.doctype, fieldname as string, this);
    }

    // ============================================================================
    // Field Property Operations
    // ============================================================================

    set_df_property(fieldname: string, property: keyof DocField, value: any): void {
        this.store.getState().setOverride(fieldname, property, value);
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

    /**
     * Mirrors FieldDispatcher's own visibility/mandatory resolution exactly — same overrides, same
     * evaluateFieldVisibility — so validation can never disagree with what's on screen. Reading
     * the STATIC `field.reqd`/`field.hidden` here (as this used to) produced unfixable saves: a
     * field hidden by `depends_on` but carrying `reqd: 1` blocked the save with an error attached
     * to a control that is not rendered anywhere, so the user saw a bare "Required fields missing"
     * with nothing highlighted and no way to satisfy it. It also missed the inverse — fields made
     * mandatory only via `mandatory_depends_on` were never checked at all, so the server rejected
     * them later with a much worse message.
     */
    validate(): Record<string, string> {
        const errors: Record<string, string> = {};
        const doc = this.doc;
        const overrides = this.store.getState().overrides;

        for (const field of this._meta.fields) {
            if (LAYOUT_FIELDTYPES.has(field.fieldtype)) continue;

            const effectiveField = { ...field, ...(overrides.get(field.fieldname) ?? {}) };
            const { hidden, reqd } = evaluateFieldVisibility(effectiveField, doc);
            if (!reqd || hidden) continue;

            const value = doc[field.fieldname];
            if (value === undefined || value === null || value === '') {
                errors[field.fieldname] = `${effectiveField.label || field.fieldname} is required`;
            }
        }
        return errors;
    }

    async save(action: DocstatusAction = 'Save'): Promise<void> {
        try {
            const validateResult = await ScriptRegistry.executeHook(this.doctype, 'validate', this);
            if (!validateResult) {
                throw new Error('Validation failed');
            }

            await ScriptRegistry.executeHook(this.doctype, 'before_save', this);

            const errors = this.validate();
            if (Object.keys(errors).length > 0) {
                for (const [fieldname, error] of Object.entries(errors)) {
                    this.store.getState().setError(fieldname, error);
                }
                // Name the fields — a required field can sit on a collapsed section or an
                // inactive tab, where its inline error is invisible, so "Required fields missing"
                // alone left nothing to act on.
                const labels = this._meta.fields
                    .filter((f) => errors[f.fieldname])
                    .map((f) => f.label || f.fieldname);
                throw new Error(`Required: ${labels.join(', ')}`);
            }

            const docToSave: Document & { __islocal?: 0 | 1 } = this._isNew
                ? { ...this.doc, __islocal: 1 }
                : this.doc;

            const { doc: savedDoc } = await this.client.saveDoc(docToSave, action);

            this._isNew = false;
            // resetTo is the ONLY thing that clears dirty/errors/overrides — a completed save
            // qualifies (a fresh, authoritative copy of the document just arrived from the server).
            this.store.getState().resetTo(savedDoc);

            await ScriptRegistry.executeHook(this.doctype, action === 'Submit' ? 'after_submit' : 'after_save', this);

            EventBus.emit('doc:saved', { doctype: this.doctype, name: savedDoc.name, doc: savedDoc });
        } catch (error) {
            throw error;
        }
    }

    async submit(): Promise<void> {
        await ScriptRegistry.executeHook(this.doctype, 'before_submit', this);
        await this.save('Submit');
    }

    async cancel(): Promise<void> {
        await ScriptRegistry.executeHook(this.doctype, 'before_cancel', this);
        const { doc: cancelledDoc } = await this.client.saveDoc(this.doc, 'Cancel');
        this.store.getState().resetTo(cancelledDoc);
        await ScriptRegistry.executeHook(this.doctype, 'after_cancel', this);
        EventBus.emit('doc:saved', { doctype: this.doctype, name: cancelledDoc.name, doc: cancelledDoc });
    }

    async reload(): Promise<void> {
        if (this._isNew) return;

        const { doc } = await this.client.getDoc(this.doctype, this.docname);
        this.store.getState().resetTo(doc);

        await ScriptRegistry.executeHook(this.doctype, 'refresh', this);
    }

    refresh_fields(): void {
        // No-op: zustand subscribers (useFormStore selectors) re-render on their own when the
        // store changes — there is no separate "trigger a re-render" step needed anymore.
    }

    // ============================================================================
    // Event Triggering
    // ============================================================================

    trigger(event: string, ...args: any[]): void {
        ScriptRegistry.executeHook(this.doctype, event, this, ...args);
    }
}

/** Builds a new, empty document with meta-declared defaults applied (was DocumentModel.createNew). */
export function createNewDocument(doctype: string, meta: DocTypeMeta): Document {
    const doc: Document = { name: '', doctype, docstatus: 0 };
    for (const field of meta.fields) {
        if (field.default !== undefined) {
            doc[field.fieldname] = parseFieldDefault(field);
        }
    }
    return doc;
}

function parseFieldDefault(field: DocField): any {
    const { fieldtype, default: defaultValue } = field;
    if (defaultValue === undefined || defaultValue === null) return undefined;

    switch (fieldtype) {
        case 'Int':
            return parseInt(defaultValue, 10) || 0;
        case 'Float':
        case 'Currency':
        case 'Percent':
            return parseFloat(defaultValue) || 0;
        case 'Check':
            return defaultValue === '1' || defaultValue === 1 || defaultValue === true;
        case 'Table':
            return [];
        default:
            return defaultValue;
    }
}

export function createFormController(
    store: StoreApi<FormState>,
    meta: DocTypeMeta,
    isNew: boolean,
    client: FrappeClient
): FormControllerImpl {
    return new FormControllerImpl(store, meta, isNew, client);
}
