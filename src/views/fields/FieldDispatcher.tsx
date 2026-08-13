import React from 'react';
import type { DocField, FieldRendererProps } from '@/core/types';
import { FieldRegistry } from '@/core/registry/FieldRegistry';
import { DocTypeRegistry } from '@/core/registry/DocTypeRegistry';
import { useDocumentStore } from '@/store';

// Fallback component if no renderer is found
const FallbackField: React.FC<FieldRendererProps<any>> = ({ field, value, onChange, disabled, error }) => (
    <input
        className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        type="text"
        placeholder={field.label || field.fieldname}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
    />
);

interface FieldDispatcherProps {
    field: DocField;
    value: any;
    onChange: (value: any) => void;
    doctype: string;
    disabled?: boolean;
    error?: string;
    frm?: any;
    doc?: any;
    hideLabel?: boolean;
}

/**
 * FieldDispatcher - Resolves and renders the appropriate field component
 * Checks for overrides before falling back to defaults
 */
export const FieldDispatcher: React.FC<FieldDispatcherProps> = ({
    field,
    value,
    onChange,
    doctype,
    disabled,
    error,
    frm,
    doc,
    hideLabel,
}) => {
    const { fieldOverrides } = useDocumentStore();

    // Apply field overrides from store
    const overrides = fieldOverrides.get(field.fieldname) || {};
    const effectiveField = { ...field, ...overrides };

    // Skip hidden fields
    if (effectiveField.hidden) {
        return null;
    }

    // 1. Check for DocType-specific field override
    let FieldComponent = DocTypeRegistry.getFieldRenderer(doctype, field.fieldname);

    // 2. Check for global field override
    if (!FieldComponent) {
        FieldComponent = FieldRegistry.get(field.fieldtype, doctype, field.fieldname);
    }

    // 3. Fall back to default Data field
    if (!FieldComponent) {
        FieldComponent = FallbackField;
    }

    const props: FieldRendererProps = {
        field: effectiveField,
        value,
        onChange,
        disabled: disabled || effectiveField.read_only,
        error,
        frm,
        doc,
    };

    return (
        <div className="space-y-1">
            {!hideLabel && (
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    {effectiveField.label || effectiveField.fieldname}
                    {!!effectiveField.reqd && <span className="text-destructive ml-1">*</span>}
                </label>
            )}
            <FieldComponent {...props} />
            {effectiveField.description && (
                <p className="text-xs text-muted-foreground">{effectiveField.description}</p>
            )}
            {error && (
                <p className="text-xs text-destructive">{error}</p>
            )}
        </div>
    );
};

export default FieldDispatcher;
