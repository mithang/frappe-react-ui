// Core type definitions for Frappe Canvas framework

// ============================================================================
// Field Types
// ============================================================================

export type FrappeFieldType =
    | 'Data'
    | 'Link'
    | 'Dynamic Link'
    | 'Select'
    | 'Table'
    | 'Table MultiSelect'
    | 'Attach'
    | 'Attach Image'
    | 'Text'
    | 'Text Editor'
    | 'Code'
    | 'HTML Editor'
    | 'Markdown Editor'
    | 'Small Text'
    | 'Long Text'
    | 'Int'
    | 'Float'
    | 'Currency'
    | 'Percent'
    | 'Check'
    | 'Date'
    | 'Datetime'
    | 'Time'
    | 'Duration'
    | 'Rating'
    | 'Color'
    | 'Signature'
    | 'Geolocation'
    | 'Password'
    | 'Read Only'
    | 'Section Break'
    | 'Column Break'
    | 'Tab Break'
    | 'HTML'
    | 'Image'
    | 'Button'
    | 'Heading'
    | 'Barcode'
    | 'JSON';

// ============================================================================
// Document & DocType Types
// ============================================================================

export interface DocField {
    fieldname: string;
    fieldtype: FrappeFieldType;
    label?: string;
    options?: string;
    reqd?: boolean;
    read_only?: boolean;
    hidden?: boolean;
    default?: any;
    description?: string;
    in_list_view?: boolean;
    in_standard_filter?: boolean;
    depends_on?: string;
    mandatory_depends_on?: string;
    read_only_depends_on?: string;
}

export interface DocTypeMeta {
    name: string;
    module: string;
    fields: DocField[];
    title_field?: string;
    search_fields?: string[];
    sort_field?: string;
    sort_order?: 'ASC' | 'DESC';
    is_submittable?: boolean;
    is_tree?: boolean;
    issingle?: boolean;
    track_changes?: boolean;
}

export interface Document {
    name: string;
    doctype: string;
    docstatus?: 0 | 1 | 2;
    creation?: string;
    modified?: string;
    modified_by?: string;
    owner?: string;
    [key: string]: any;
}

// ============================================================================
// Form Controller Types (similar to Frappe's frm)
// ============================================================================

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

// ============================================================================
// Hook System Types
// ============================================================================

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

// ============================================================================
// Component Registry Types
// ============================================================================

export interface FieldRendererProps<T = any> {
    field: DocField;
    value: T;
    onChange: (value: T) => void;
    disabled?: boolean;
    error?: string;
    frm?: FormController;
}

export type FieldRenderer<T = any> = React.ComponentType<FieldRendererProps<T>>;

export interface DocTypeComponents {
    Form?: React.ComponentType<{ doctype: string; name?: string }>;
    List?: React.ComponentType<{ doctype: string }>;
    Print?: React.ComponentType<{ doctype: string; name: string }>;
    fields?: Record<string, FieldRenderer>;
}

// ============================================================================
// Extension Types
// ============================================================================

export interface ExtensionManifest {
    name: string;
    version: string;
    description?: string;
    author?: string;
    doctypes?: string[];
    remoteEntry?: string;
    exposedModules?: string[];
}

export interface Extension {
    manifest: ExtensionManifest;
    doctypeComponents?: Record<string, DocTypeComponents>;
    clientScripts?: ClientScript[];
    fieldRenderers?: Record<string, FieldRenderer>;
    init?: () => void | Promise<void>;
}

// ============================================================================
// Event Bus Types
// ============================================================================

export type EventHandler<T = any> = (payload: T) => void;

export interface EventBusEvents {
    'doc:saved': { doctype: string; name: string; doc: Document };
    'doc:deleted': { doctype: string; name: string };
    'doc:loaded': { doctype: string; name: string; doc: Document };
    'field:changed': { doctype: string; name: string; fieldname: string; value: any; oldValue: any };
    'form:dirty': { doctype: string; name: string; isDirty: boolean };
    'extension:loaded': { name: string };
    [key: string]: any;
}
