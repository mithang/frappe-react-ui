// Field renderer contract and doctype-level component registry types.

import type { DocField, Document } from './document';
import type { FormController } from './form';

/**
 * Frozen by 1B (who owns FieldDispatcher) in Wave 1. `doc` is the owning document OR, inside a
 * child table row, that row itself — Dynamic Link and other row-scoped lookups resolve against
 * `doc`, never a global current-document store (that was bug A2).
 */
export interface FieldRendererProps<T = any> {
    /** Overrides already merged by FieldDispatcher (set_df_property, link_filters, etc). */
    field: DocField;
    value: T;
    onChange: (value: T) => void;
    disabled?: boolean;
    error?: string;
    doc?: Document | Record<string, any>;
    frm?: FormController;
}

export type FieldRenderer<T = any> = React.ComponentType<FieldRendererProps<T>>;

export interface DocTypeComponents {
    Form?: React.ComponentType<{ doctype: string; name?: string }>;
    List?: React.ComponentType<{ doctype: string }>;
    Print?: React.ComponentType<{ doctype: string; name: string }>;
    fields?: Record<string, FieldRenderer>;
}
