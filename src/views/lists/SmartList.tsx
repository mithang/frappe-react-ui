import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useListController } from '@/hooks/useListController';
import { DocTypeRegistry } from '@/core/registry/DocTypeRegistry';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

/**
 * SmartList - SMVC-based dynamic list component
 * Automatically uses custom DocType lists if registered
 */
const SmartList: React.FC = () => {
    const { doctype } = useParams<{ doctype: string }>();

    // Check for custom list component
    const CustomList = doctype ? DocTypeRegistry.getList(doctype) : undefined;
    if (CustomList) {
        return <CustomList doctype={doctype!} />;
    }

    // Use default dynamic list
    return <DefaultList doctype={doctype!} />;
};

interface DefaultListProps {
    doctype: string;
}

const DefaultList: React.FC<DefaultListProps> = ({ doctype }) => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

    const {
        data,
        total,
        page,
        pageSize,
        isLoading,
        error,
        meta,
        refresh,
        goToPage,
        deleteItem,
        deleteItems,
    } = useListController({ doctype });

    // Check if this is a Single DocType and redirect to form
    React.useEffect(() => {
        if (meta && meta.issingle) {
            // Single DocTypes don't have lists, redirect to the form
            navigate(`/doctype/${doctype}/${doctype}`, { replace: true });
        }
    }, [meta, doctype, navigate]);

    if (error) {
        // Check if error is due to Single DocType
        const isSingleError = error.includes('TableMissingError') || error.includes('issingle');

        return (
            <div className="p-6">
                <Card>
                    <CardContent className="pt-6">
                        <div className="text-center">
                            {isSingleError ? (
                                <>
                                    <p className="text-lg font-medium mb-2">{doctype} is a Single DocType</p>
                                    <p className="text-sm text-muted-foreground mb-4">
                                        Single DocTypes don't have list views. Redirecting to form...
                                    </p>
                                    <Button onClick={() => navigate(`/doctype/${doctype}/${doctype}`)}>
                                        Open {doctype}
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <p className="text-destructive mb-2">Error loading {doctype} list</p>
                                    <p className="text-sm text-muted-foreground mb-4">{error}</p>
                                    <Button onClick={refresh}>
                                        Retry
                                    </Button>
                                </>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const filteredData = data.filter((item) =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleRowClick = (name: string) => {
        navigate(`/doctype/${doctype}/${name}`);
    };

    const handleNewDoc = () => {
        navigate(`/doctype/${doctype}/new`);
    };

    const handleDelete = async (name: string) => {
        try {
            await deleteItem(name);
            toast({
                title: 'Deleted',
                description: `${doctype} "${name}" deleted successfully`,
            });
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.message || 'Failed to delete',
                variant: 'destructive',
            });
        }
    };

    const toggleSelectItem = (name: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const newSelected = new Set(selectedItems);
        if (newSelected.has(name)) {
            newSelected.delete(name);
        } else {
            newSelected.add(name);
        }
        setSelectedItems(newSelected);
    };

    const handleBulkDelete = async () => {
        try {
            await deleteItems(Array.from(selectedItems));
            setSelectedItems(new Set());
            toast({
                title: 'Deleted',
                description: `${selectedItems.size} items deleted successfully`,
            });
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.message || 'Failed to delete items',
                variant: 'destructive',
            });
        }
    };

    // Get list columns from meta
    const listFields = meta?.fields?.filter((f) => f.in_list_view) || [];
    const columns = listFields.length > 0
        ? listFields.map(f => f.fieldname)
        : ['name', 'creation', 'modified'];

    return (
        <div className="p-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold">{doctype} List</h1>
                    <p className="text-muted-foreground">
                        Manage your {doctype.toLowerCase()} records
                    </p>
                </div>
                <div className="flex gap-2">
                    {selectedItems.size > 0 && (
                        <Button variant="destructive" onClick={handleBulkDelete}>
                            Delete ({selectedItems.size})
                        </Button>
                    )}
                    <Button onClick={handleNewDoc}>
                        New {doctype}
                    </Button>
                </div>
            </div>

            {/* List Card */}
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>All {doctype}s</CardTitle>
                            <CardDescription>
                                {filteredData.length} of {data.length} records
                            </CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <Input
                                placeholder={`Search ${doctype}...`}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="max-w-sm"
                            />
                            <Button variant="outline" onClick={refresh} disabled={isLoading}>
                                ↻
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <ListSkeleton />
                    ) : (
                        <>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-12">
                                            <input
                                                type="checkbox"
                                                checked={selectedItems.size === filteredData.length && filteredData.length > 0}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedItems(new Set(filteredData.map(d => d.name)));
                                                    } else {
                                                        setSelectedItems(new Set());
                                                    }
                                                }}
                                            />
                                        </TableHead>
                                        <TableHead>Name</TableHead>
                                        {columns.filter(c => c !== 'name').slice(0, 3).map((col) => (
                                            <TableHead key={col} className="capitalize">
                                                {col.replace(/_/g, ' ')}
                                            </TableHead>
                                        ))}
                                        <TableHead>Status</TableHead>
                                        <TableHead className="w-20">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredData.map((item) => (
                                        <TableRow
                                            key={item.name}
                                            className="cursor-pointer hover:bg-muted/50"
                                            onClick={() => handleRowClick(item.name)}
                                        >
                                            <TableCell onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedItems.has(item.name)}
                                                    onChange={() => { }}
                                                    onClick={(e) => toggleSelectItem(item.name, e)}
                                                />
                                            </TableCell>
                                            <TableCell className="font-medium">{item.name}</TableCell>
                                            {columns.filter(c => c !== 'name').slice(0, 3).map((col) => (
                                                <TableCell key={col}>
                                                    {formatCellValue(item[col], col)}
                                                </TableCell>
                                            ))}
                                            <TableCell>
                                                <Badge variant="secondary">Active</Badge>
                                            </TableCell>
                                            <TableCell onClick={(e) => e.stopPropagation()}>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-destructive hover:text-destructive"
                                                    onClick={() => handleDelete(item.name)}
                                                >
                                                    ×
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>

                            {/* Empty State */}
                            {!isLoading && filteredData.length === 0 && (
                                <div className="text-center py-8">
                                    <p className="text-muted-foreground">
                                        {searchTerm ? 'No records match your search' : `No ${doctype} records found`}
                                    </p>
                                    {!searchTerm && (
                                        <Button onClick={handleNewDoc} className="mt-4">
                                            Create your first {doctype}
                                        </Button>
                                    )}
                                </div>
                            )}

                            {/* Pagination */}
                            {total > pageSize && (
                                <div className="flex justify-between items-center mt-4 pt-4 border-t">
                                    <span className="text-sm text-muted-foreground">
                                        Page {page} of {Math.ceil(total / pageSize)}
                                    </span>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={page <= 1}
                                            onClick={() => goToPage(page - 1)}
                                        >
                                            Previous
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={page >= Math.ceil(total / pageSize)}
                                            onClick={() => goToPage(page + 1)}
                                        >
                                            Next
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

// ============================================================================
// Helper Functions
// ============================================================================

function formatCellValue(value: any, column: string): string {
    if (value === null || value === undefined) return '-';

    if (column === 'creation' || column === 'modified') {
        return new Date(value).toLocaleDateString();
    }

    if (typeof value === 'boolean') {
        return value ? 'Yes' : 'No';
    }

    return String(value);
}

// ============================================================================
// Loading Skeleton
// ============================================================================

const ListSkeleton: React.FC = () => (
    <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-muted rounded animate-pulse" />
        ))}
    </div>
);

export default SmartList;
