// Form controller (mirrors Frappe's `frm`) and client-script hook types.

import type { Document, DocField, DocTypeMeta } from './document';

export interface FormController<T extends Document = Document> {
    doc: T;
    doctype: string;
    docname: string;
    meta: DocTypeMeta;
    is_new: boolean;
    is_dirty: boolean;

    // Value operations
    get_value<K extends keyof T>(fieldname: K): T[K];
    set_value<K extends keyof T>(fieldname: K, value: T[K]): Promise<void>;

    // Field property operations
    set_df_property(fieldname: string, property: keyof DocField, value: any): void;
    toggle_display(fieldname: string, show: boolean): void;
    toggle_reqd(fieldname: string, reqd: boolean): void;
    toggle_read_only(fieldname: string, read_only: boolean): void;

    // Form operations
    save(): Promise<void>;
    reload(): Promise<void>;
    refresh_fields(): void;

    // Events
    trigger(event: string, ...args: any[]): void;
}

export type FormHook = (frm: FormController) => void | boolean | Promise<void | boolean>;
export type FieldHook = (frm: FormController, cdt: string, cdn: string) => void | Promise<void>;

export interface ClientScriptHooks {
    onload?: FormHook;
    refresh?: FormHook;
    validate?: FormHook;
    before_save?: FormHook;
    after_save?: FormHook;
    before_submit?: FormHook;
    after_submit?: FormHook;
    before_cancel?: FormHook;
    after_cancel?: FormHook;
    [fieldChangeHook: string]: FormHook | FieldHook | undefined;
}

export interface ClientScript {
    doctype: string;
    name?: string;
    enabled?: boolean;
    hooks: ClientScriptHooks;
}
