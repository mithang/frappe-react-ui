/**
 * Example Extension for Sales Order
 * 
 * This demonstrates how to create a custom extension with:
 * - Custom client scripts (Frappe-like hooks)
 * - Custom field renderers
 * - Custom DocType components (optional)
 */

import type { ClientScript, Extension, FieldRendererProps } from '@/core/types';
import { registerClientScript } from '@/core/registry/ScriptRegistry';
import { FieldRegistry } from '@/core/registry/FieldRegistry';
import { DocTypeRegistry } from '@/core/registry/DocTypeRegistry';
import React from 'react';

// ============================================================================
// Example 1: Client Script Registration
// Similar to Frappe's client scripts but in React
// ============================================================================

export const salesOrderClientScript: ClientScript = {
    doctype: 'Sales Order',
    name: 'sales_order_custom_script',
    hooks: {
        // Called when form loads
        onload(frm) {
            console.log('[SalesOrder] Form loaded:', frm.docname);

            // Example: Hide a field based on condition
            if (frm.is_new) {
                frm.toggle_display('amended_from', false);
            }
        },

        // Called on form refresh
        refresh(frm) {
            console.log('[SalesOrder] Form refreshed');

            // Example: Make field read-only after submission
            if (frm.doc.docstatus === 1) {
                frm.toggle_read_only('customer', true);
                frm.toggle_read_only('delivery_date', true);
            }
        },

        // Validate before save
        validate(frm) {
            console.log('[SalesOrder] Validating...');

            // Example: Custom validation
            const deliveryDate = frm.get_value('delivery_date');
            if (deliveryDate && new Date(deliveryDate) < new Date()) {
                // Return false to prevent save
                console.error('Delivery date cannot be in the past');
                return false;
            }

            return true;
        },

        // Called before save
        before_save(frm) {
            console.log('[SalesOrder] Before save');

            // Example: Set a computed field
            const grandTotal = frm.get_value('grand_total') || 0;
            if (grandTotal > 10000) {
                frm.set_df_property('notes', 'reqd', true);
            }
        },

        // Called after save
        after_save(frm) {
            console.log('[SalesOrder] After save - Document saved:', frm.docname);
        },

        // Field change handler - triggered when 'customer' field changes
        customer_change(frm) {
            console.log('[SalesOrder] Customer changed to:', frm.get_value('customer'));

            // Example: Fetch and set related data
            // In real implementation, this would call an API
            frm.set_value('customer_name', `Customer: ${frm.get_value('customer')}`);
        },

        // Field change handler for delivery_date
        delivery_date_change(frm) {
            const date = frm.get_value('delivery_date');
            console.log('[SalesOrder] Delivery date changed to:', date);
        },
    },
};

// ============================================================================
// Example 2: Custom Field Renderer
// Create a custom priority status field
// ============================================================================

interface PriorityFieldProps extends FieldRendererProps<string> { }

const PriorityField: React.FC<PriorityFieldProps> = ({
    field,
    value,
    onChange,
    disabled,
}) => {
    const priorities = [
        { value: 'Low', color: 'bg-green-100 text-green-800 border-green-200' },
        { value: 'Medium', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
        { value: 'High', color: 'bg-orange-100 text-orange-800 border-orange-200' },
        { value: 'Urgent', color: 'bg-red-100 text-red-800 border-red-200' },
    ];

    return (
        <div className="flex gap-2 flex-wrap">
            {priorities.map((priority) => (
                <button
                    key={priority.value}
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange(priority.value)}
                    className={`
            px-3 py-1.5 rounded-full text-sm font-medium border transition-all
            ${priority.color}
            ${value === priority.value ? 'ring-2 ring-offset-2 ring-primary' : 'opacity-60 hover:opacity-100'}
            ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
          `}
                >
                    {priority.value}
                </button>
            ))}
        </div>
    );
};

// ============================================================================
// Example 3: Custom Progress Field
// ============================================================================

interface ProgressFieldProps extends FieldRendererProps<number> { }

const ProgressField: React.FC<ProgressFieldProps> = ({
    field,
    value,
    onChange,
    disabled,
}) => {
    const progress = Math.min(100, Math.max(0, value || 0));

    return (
        <div className="space-y-2">
            <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{progress}%</span>
            </div>
            <div className="relative h-3 bg-muted rounded-full overflow-hidden">
                <div
                    className="absolute left-0 top-0 h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                />
            </div>
            <input
                type="range"
                min="0"
                max="100"
                value={progress}
                onChange={(e) => onChange(parseInt(e.target.value, 10))}
                disabled={disabled}
                className="w-full"
            />
        </div>
    );
};

// ============================================================================
// Register the example extension
// ============================================================================

export function registerSalesOrderExtension(): void {
    console.log('[Example] Registering Sales Order extension...');

    // Register client script
    registerClientScript(salesOrderClientScript);

    // Register custom field renderers
    FieldRegistry.register('Priority', PriorityField);
    FieldRegistry.register('Progress', ProgressField);

    // Register field override for specific doctype+field
    FieldRegistry.registerOverride('Sales Order', 'priority', PriorityField);
    FieldRegistry.registerOverride('Sales Order', 'per_delivered', ProgressField);

    console.log('[Example] Sales Order extension registered');
}

// ============================================================================
// Full Extension Definition (for Module Federation)
// ============================================================================

export const SalesOrderExtension: Extension = {
    manifest: {
        name: 'sales-order-extension',
        version: '1.0.0',
        description: 'Custom handling for Sales Order DocType',
        author: 'Frappe Canvas',
        doctypes: ['Sales Order'],
    },
    clientScripts: [salesOrderClientScript],
    fieldRenderers: {
        Priority: PriorityField,
        Progress: ProgressField,
    },
    init: () => {
        console.log('[SalesOrderExtension] Initializing...');
    },
};

export default SalesOrderExtension;
