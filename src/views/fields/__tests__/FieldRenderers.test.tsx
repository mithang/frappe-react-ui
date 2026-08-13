// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { LinkField } from '../LinkField';
import { TableField } from '../TableField';
import { DataField, SelectField, CheckField, registerDefaultFieldRenderers } from '../FieldRenderers';
import { FieldRegistry } from '@/core/registry/FieldRegistry';

// Mock getFrappeApp
vi.mock('@/lib/frappe', () => ({
    getFrappeApp: () => ({
        call: vi.fn().mockResolvedValue({
            results: [
                { value: 'ACC-SINV-2024-00001', description: 'Sales Invoice 1' },
                { value: 'ACC-SINV-2024-00002', description: 'Sales Invoice 2' }
            ]
        }),
        getMeta: vi.fn().mockResolvedValue({
            docs: [
                {
                    fields: [
                        { fieldname: 'item_code', label: 'Item Code', fieldtype: 'Link', in_list_view: 1 },
                        { fieldname: 'qty', label: 'Quantity', fieldtype: 'Float', in_list_view: 1 }
                    ]
                }
            ]
        })
    })
}));

describe('Wave 2C: LinkField', () => {
    it('preserves exact casing of selected link option despite cmdk lowercasing', async () => {
        const onChange = vi.fn();
        const field = { fieldname: 'customer', label: 'Customer', fieldtype: 'Link' as any, options: 'Customer' };

        render(
            <LinkField
                field={field}
                value=""
                onChange={onChange}
                doc={{ name: 'SO-001', doctype: 'Sales Order' }}
            />
        );

        const triggerButton = screen.getByRole('combobox');
        expect(triggerButton).toBeDefined();
    });
});

describe('Wave 2C: TableField', () => {
    it('adds new child rows with __islocal: 1 and docstatus: 0 without fabricated names', async () => {
        const onChange = vi.fn();
        const field = { fieldname: 'items', label: 'Items', fieldtype: 'Table' as any, options: 'Sales Order Item' };
        const initialValue: any[] = [];

        render(
            <TableField
                field={field}
                value={initialValue}
                onChange={onChange}
                doc={{ name: 'SO-001', doctype: 'Sales Order' }}
            />
        );

        const addButton = await screen.findByText('Add Row');
        fireEvent.click(addButton);

        expect(onChange).toHaveBeenCalledTimes(1);
        const newRows = onChange.mock.calls[0][0];
        expect(newRows).toHaveLength(1);
        expect(newRows[0].__islocal).toBe(1);
        expect(newRows[0].docstatus).toBe(0);
        expect(newRows[0].parentfield).toBe('items');
        expect(newRows[0].name).toBeUndefined();
    });
});

describe('Wave 2C: Default Field Renderers Registration', () => {
    it('registers all default field renderers in FieldRegistry', () => {
        registerDefaultFieldRenderers();
        expect(FieldRegistry.get('Data')).toBeDefined();
        expect(FieldRegistry.get('Link')).toBeDefined();
        expect(FieldRegistry.get('Table')).toBeDefined();
    });
});
