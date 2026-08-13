// Document, DocType metadata, and field definition types.

import type { ResolvedDocPermissions } from './permissions';

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

/**
 * Frappe emits 0|1 for boolean-ish fields over the wire, not JS `boolean` — `field.reqd === true`
 * is never true. New types (DocPerm, ResolvedDocPermissions) use this from the start; existing
 * DocField flags below are still typed `boolean` and get normalised at the transport boundary
 * (owned by 1A) rather than changed here, to avoid a big-bang break of every current consumer.
 */
export type FrappeBool = 0 | 1;

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
    /** Field-level permission tier; 0 = accessible per the DocType's base DocPerm rows. */
    permlevel?: number;
    precision?: string;
    /** Dotted `link_field.source_field` this value auto-populates from. */
    fetch_from?: string;
    idx?: number;
    columns?: number;
    allow_on_submit?: 0 | 1;
    collapsible?: 0 | 1;
    /** Seam for 3B's `frm.set_query` shim — carried as a FieldDispatcher-merged override. */
    link_filters?: unknown;
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

/**
 * `getdoc`'s sidebar payload. Shape verified against a live container (frappe 17.0.0-dev), not
 * assumed — see src/test/fixtures/frappe/getdoc-existing-response.json. Richer than the original
 * sketch: Frappe's docinfo carries several log arrays beyond comments/attachments/assignments.
 */
export interface DocInfo {
    /** Per-user RESOLVED permissions for this document — not the DocType's configured DocPerm rows. */
    permissions?: ResolvedDocPermissions;
    comments?: Record<string, unknown>[];
    communications?: unknown[];
    versions?: unknown[];
    attachments?: Record<string, unknown>[];
    assignments?: string[];
    /** Frappe emits a comma-separated STRING, not string[]. */
    tags?: string;
    shared?: unknown[];
    user_info?: Record<string, { fullname?: string; image?: string | null; name?: string; email?: string; time_zone?: string }>;
    assignment_logs?: unknown[];
    attachment_logs?: unknown[];
    info_logs?: unknown[];
    like_logs?: unknown[];
    workflow_logs?: unknown[];
    automated_messages?: unknown[];
    views?: unknown[];
    additional_timeline_content?: unknown[];
    milestones?: unknown[];
    is_document_followed?: boolean | null;
    document_email?: string | null;
}
