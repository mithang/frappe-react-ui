import React, { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { FieldRendererProps, DocField, DocTypeMeta } from '@/core/types';
import { getFrappeApp } from '@/lib/frappe';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { FieldDispatcher } from './FieldDispatcher';
import { Skeleton } from '@/components/ui/skeleton';

export const TableField: React.FC<FieldRendererProps<Record<string, unknown>[]>> = ({
    field,
    value = [],
    onChange,
    disabled,
    doc,
}) => {
    const [columns, setColumns] = useState<DocField[]>([]);
    const [loading, setLoading] = useState(false);
    const childDocType = field.options;

    useEffect(() => {
        if (childDocType) {
            loadMeta();
        }
    }, [childDocType]);

    const loadMeta = async () => {
        setLoading(true);
        try {
            const frappe = getFrappeApp();
            const result = await frappe.getMeta(childDocType!);
            if (result.docs && result.docs[0]) {
                const meta = result.docs[0] as DocTypeMeta;
                // Filter fields for list view
                const listFields = meta.fields.filter(f =>
                    f.in_list_view && !['Section Break', 'Column Break', 'Tab Break'].includes(f.fieldtype)
                );

                // If no list view fields, pick first 5 data fields
                if (listFields.length === 0) {
                    const dataFields = meta.fields.filter(f =>
                        !f.hidden && !['Section Break', 'Column Break', 'Tab Break', 'HTML'].includes(f.fieldtype)
                    ).slice(0, 5);
                    setColumns(dataFields);
                } else {
                    setColumns(listFields);
                }
            }
        } catch (error) {
            console.error(`Failed to load meta for ${childDocType}:`, error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddRow = () => {
        const parentName = doc?.name ? String(doc.name) : '';
        const parentType = doc?.doctype ? String(doc.doctype) : '';

        const newrow: Record<string, unknown> = {
            __islocal: 1,
            docstatus: 0,
            doctype: childDocType,
            parent: parentName,
            parenttype: parentType,
            parentfield: field.fieldname,
            idx: (value || []).length + 1,
        };
        onChange([...(value || []), newrow]);
    };

    const handleDeleteRow = (index: number) => {
        const newValue = [...(value || [])];
        newValue.splice(index, 1);
        onChange(newValue);
    };

    const handleCellChange = (rowIndex: number, fieldname: string, cellValue: unknown) => {
        const newValue = [...(value || [])];
        newValue[rowIndex] = { ...newValue[rowIndex], [fieldname]: cellValue };
        onChange(newValue);
    };

    if (loading) {
        return <Skeleton className="h-40 w-full" />;
    }

    if (!childDocType) {
        return <div className="text-destructive text-sm">Child DocType not defined</div>;
    }

    return (
        <div className="border rounded-md">
            <div className="bg-muted/50 p-2 flex justify-between items-center border-b">
                <span className="text-sm font-medium px-2">{field.label || field.fieldname}</span>
                {!disabled && !field.read_only && (
                    <Button variant="ghost" size="sm" onClick={handleAddRow} className="h-8">
                        <Plus className="h-4 w-4 mr-1" /> Add Row
                    </Button>
                )}
            </div>
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[40px]"></TableHead>
                            {columns.map((col) => (
                                <TableHead key={col.fieldname} className="min-w-[120px] whitespace-nowrap">
                                    {col.label || col.fieldname}
                                    {!!col.reqd && <span className="text-destructive ml-1">*</span>}
                                </TableHead>
                            ))}
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {(value || []).map((row, rowIndex) => (
                            <TableRow key={String(row.name || rowIndex)}>
                                <TableCell className="text-xs text-muted-foreground text-center">
                                    {rowIndex + 1}
                                </TableCell>
                                {columns.map((col) => (
                                    <TableCell key={col.fieldname} className="p-2">
                                        <div className="min-h-[32px]">
                                            <FieldDispatcher
                                                field={col}
                                                value={row[col.fieldname]}
                                                onChange={(val) => handleCellChange(rowIndex, col.fieldname, val)}
                                                doctype={childDocType}
                                                disabled={disabled}
                                                hideLabel={true}
                                                doc={row}
                                            />
                                        </div>
                                    </TableCell>
                                ))}
                                <TableCell>
                                    {!disabled && !field.read_only && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                            onClick={() => handleDeleteRow(rowIndex)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                        {!value?.length && (
                            <TableRow>
                                <TableCell colSpan={columns.length + 2} className="h-24 text-center">
                                    No data
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};

