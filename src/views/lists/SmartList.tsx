import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useListController } from '@/hooks/useListController';
import { DocTypeRegistry } from '@/core/registry/DocTypeRegistry';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ChevronLeft, ChevronRight, SlidersHorizontal, PlusCircle, GripVertical, MoreHorizontal, Download, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/format/formatDate';
import { exportList } from '@/lib/export';
import type { Document } from '@/core/types';
import SmartForm from '@/views/forms/SmartForm';

/**
 * SmartList - SMVC-based dynamic list component
 */
const SmartList: React.FC = () => {
    const { doctype } = useParams<{ doctype: string }>();

    const CustomList = doctype ? DocTypeRegistry.getList(doctype) : undefined;
    if (CustomList) {
        return <CustomList doctype={doctype!} />;
    }

    return <DefaultList doctype={doctype!} />;
};

const DocstatusBadge: React.FC<{ docstatus?: 0 | 1 | 2 }> = ({ docstatus }) => {
    switch (docstatus) {
        case 1:
            return <Badge variant="outline" className="font-normal rounded-full px-2.5 py-0.5 text-blue-600 bg-blue-50/50 border-blue-200"><span className="mr-1.5 text-[10px]">✓</span> Submitted</Badge>;
        case 2:
            return <Badge variant="outline" className="font-normal rounded-full px-2.5 py-0.5 text-red-600 bg-red-50/50 border-red-200"><span className="mr-1.5 text-[10px]">×</span> Cancelled</Badge>;
        default:
            return <Badge variant="outline" className="font-normal rounded-full px-2.5 py-0.5 text-muted-foreground bg-white"><span className="mr-1.5 text-[10px]">☼</span> Draft</Badge>;
    }
};

interface DefaultListProps {
    doctype: string;
}

const DefaultList: React.FC<DefaultListProps> = ({ doctype }) => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    
    // Sheet State (JIRA-style split view)
    const [selectedDocName, setSelectedDocName] = useState<string | null>(null);

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

    React.useEffect(() => {
        // Reset selected document (close sheet) when navigating between different list views
        setSelectedDocName(null);
        
        if (meta && meta.issingle) {
            navigate(`/doctype/${doctype}/${doctype}`, { replace: true });
        }
    }, [meta, doctype, navigate]);

    if (error) {
        const isSingleError = error.includes('TableMissingError') || error.includes('issingle');
        return (
            <div className="p-6">
                <Card>
                    <CardContent className="pt-6 text-center">
                        {isSingleError ? (
                            <>
                                <p className="text-lg font-medium mb-2">{doctype} is a Single DocType</p>
                                <Button onClick={() => navigate(`/doctype/${doctype}/${doctype}`)}>
                                    Open {doctype}
                                </Button>
                            </>
                        ) : (
                            <>
                                <p className="text-destructive mb-2">Error loading {doctype} list</p>
                                <p className="text-sm text-muted-foreground mb-4">{error}</p>
                                <Button onClick={refresh}>Retry</Button>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        );
    }

    const filteredData = data.filter((item) =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleRowClick = (name: string) => {
        setSelectedDocName(name); // Open in sheet instead of navigating
    };

    const handleNewDoc = () => {
        setSelectedDocName('new'); // Open 'new' form in sheet
    };

    const handleDelete = async (name: string) => {
        try {
            await deleteItem(name);
            toast({ title: 'Deleted', description: `${doctype} "${name}" deleted.` });
            if (selectedDocName === name) setSelectedDocName(null);
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' });
        }
    };

    const toggleSelectItem = (name: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const newSelected = new Set(selectedItems);
        if (newSelected.has(name)) newSelected.delete(name);
        else newSelected.add(name);
        setSelectedItems(newSelected);
    };

    const handleBulkDelete = async () => {
        try {
            await deleteItems(Array.from(selectedItems));
            setSelectedItems(new Set());
            toast({ title: 'Deleted', description: `${selectedItems.size} items deleted.` });
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to delete items', variant: 'destructive' });
        }
    };

    const handleExport = async (fileFormatType: 'CSV' | 'Excel') => {
        if (!meta) return;
        try {
            await exportList({
                doctype,
                meta,
                fileFormatType,
                selectedNames: selectedItems.size > 0 ? Array.from(selectedItems) : undefined,
            });
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to export records', variant: 'destructive' });
        }
    };

    const listFields = meta?.fields?.filter((f) => f.in_list_view) || [];
    const columns = listFields.length > 0 ? listFields.map(f => f.fieldname) : ['modified'];
    
    // Customize columns UI state
    const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(columns.slice(0, 4)));

    const totalPages = total !== null ? Math.ceil(total / pageSize) : null;
    const isSheetOpen = selectedDocName !== null;

    return (
        <div className="flex-1 space-y-4 p-8 pt-6 bg-background">
            {/* Header */}
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">{doctype}</h2>
                    <p className="text-muted-foreground">Manage your {doctype.toLowerCase()} records here.</p>
                </div>
                <div className="flex items-center space-x-2">
                    {selectedItems.size > 0 && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive">
                                    Delete ({selectedItems.size})
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This action cannot be undone. This will permanently delete the selected records.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleBulkDelete}>Delete</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="h-9" disabled={!meta}>
                                <Download className="mr-2 h-4 w-4" />
                                Export{selectedItems.size > 0 ? ` (${selectedItems.size})` : ''}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleExport('CSV')}>Export as CSV</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExport('Excel')}>Export as Excel</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    {meta?.allow_import ? (
                        <Button
                            variant="outline"
                            className="h-9"
                            onClick={() => navigate('/doctype/Data Import/new', { state: { referenceDoctype: doctype } })}
                        >
                            <Upload className="mr-2 h-4 w-4" />
                            Import
                        </Button>
                    ) : null}
                    <Button onClick={handleNewDoc} className="h-9">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        New {doctype}
                    </Button>
                </div>
            </div>

            {/* List Layout with Tabs and Toolbar */}
            <Tabs defaultValue="all" className="space-y-4">
                <div className="flex items-center justify-between">
                    <TabsList>
                        <TabsTrigger value="all">All Records</TabsTrigger>
                        <TabsTrigger value="drafts" disabled>Drafts</TabsTrigger>
                        <TabsTrigger value="submitted" disabled>Submitted</TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="all" className="space-y-4 border-none p-0 outline-none">
                    <Card>
                        <CardHeader className="px-7">
                            <CardTitle>{doctype} List</CardTitle>
                            <CardDescription>View and manage your {doctype.toLowerCase()} records.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {/* Toolbar */}
                            <div className="flex items-center justify-between mb-4">
                                <Input
                                    placeholder={`Filter ${doctype.toLowerCase()}...`}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="h-8 w-[150px] lg:w-[250px]"
                                />
                                <div className="flex items-center space-x-2">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" size="sm" className="ml-auto hidden h-8 lg:flex">
                                                <SlidersHorizontal className="mr-2 h-4 w-4" />
                                                View
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-[150px]">
                                            {columns.map((col) => (
                                                <DropdownMenuCheckboxItem
                                                    key={col}
                                                    className="capitalize"
                                                    checked={visibleColumns.has(col)}
                                                    onCheckedChange={(checked) => {
                                                        const newVis = new Set(visibleColumns);
                                                        checked ? newVis.add(col) : newVis.delete(col);
                                                        setVisibleColumns(newVis);
                                                    }}
                                                >
                                                    {col.replace(/_/g, ' ')}
                                                </DropdownMenuCheckboxItem>
                                            ))}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                    <Button variant="outline" size="sm" className="h-8" onClick={refresh} disabled={isLoading}>
                                        ↻ Refresh
                                    </Button>
                                </div>
                            </div>

                            {/* Table */}
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/50 hover:bg-muted/50 border-b">
                                            <TableHead className="w-[30px]"></TableHead>
                                            <TableHead className="w-[40px] px-0">
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-input text-primary focus:ring-primary"
                                                    checked={selectedItems.size === filteredData.length && filteredData.length > 0}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setSelectedItems(new Set(filteredData.map(d => d.name)));
                                                        else setSelectedItems(new Set());
                                                    }}
                                                />
                                            </TableHead>
                                            <TableHead className="text-sm font-medium text-muted-foreground">Name</TableHead>
                                            {columns.filter(c => visibleColumns.has(c) && c !== 'name' && c !== 'docstatus').map((col) => (
                                                <TableHead key={col} className="capitalize text-sm font-medium text-muted-foreground">
                                                    {col.replace(/_/g, ' ')}
                                                </TableHead>
                                            ))}
                                            <TableHead className="text-sm font-medium text-muted-foreground">Status</TableHead>
                                            <TableHead className="w-[50px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {isLoading ? (
                                            <TableRow>
                                                <TableCell colSpan={visibleColumns.size + 4} className="h-24 text-center">
                                                    Loading...
                                                </TableCell>
                                            </TableRow>
                                        ) : filteredData.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={visibleColumns.size + 4} className="h-24 text-center">
                                                    No results.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            filteredData.map((item) => (
                                                <TableRow
                                                    key={item.name}
                                                    className="cursor-pointer transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted group"
                                                    onClick={() => handleRowClick(item.name)}
                                                >
                                                    <TableCell className="w-[30px] pl-3 pr-1 py-3 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors">
                                                        <GripVertical className="h-4 w-4" />
                                                    </TableCell>
                                                    <TableCell className="px-0 py-3" onClick={(e) => e.stopPropagation()}>
                                                        <input
                                                            type="checkbox"
                                                            className="rounded border-input text-primary focus:ring-primary"
                                                            checked={selectedItems.has(item.name)}
                                                            onChange={() => {}}
                                                            onClick={(e) => toggleSelectItem(item.name, e)}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="font-medium text-foreground py-3">{item.name}</TableCell>
                                                    {columns.filter(c => visibleColumns.has(c) && c !== 'name' && c !== 'docstatus').map((col) => (
                                                        <TableCell key={col} className="py-3">
                                                            {formatCellValue(item[col], col)}
                                                        </TableCell>
                                                    ))}
                                                    <TableCell className="py-3">
                                                        <DocstatusBadge docstatus={item.docstatus} />
                                                    </TableCell>
                                                    <TableCell className="py-3" onClick={(e) => e.stopPropagation()}>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <AlertDialog>
                                                                    <AlertDialogTrigger asChild>
                                                                        <DropdownMenuCheckboxItem className="text-destructive focus:bg-destructive/10 focus:text-destructive" onSelect={(e) => e.preventDefault()}>
                                                                            Delete
                                                                        </DropdownMenuCheckboxItem>
                                                                    </AlertDialogTrigger>
                                                                    <AlertDialogContent>
                                                                        <AlertDialogHeader>
                                                                            <AlertDialogTitle>Delete {item.name}?</AlertDialogTitle>
                                                                        </AlertDialogHeader>
                                                                        <AlertDialogFooter>
                                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                            <AlertDialogAction onClick={() => handleDelete(item.name)}>Delete</AlertDialogAction>
                                                                        </AlertDialogFooter>
                                                                    </AlertDialogContent>
                                                                </AlertDialog>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Pagination Footer */}
                            <div className="flex items-center justify-between pt-4">
                                <div className="flex-1 text-sm text-muted-foreground">
                                    {selectedItems.size} of {filteredData.length} row(s) selected.
                                </div>
                                <div className="flex items-center space-x-6 lg:space-x-8">
                                    <div className="flex items-center space-x-2">
                                        <p className="text-sm font-medium">Rows per page</p>
                                        <span className="text-sm font-medium border rounded-md px-2 py-1 bg-muted/50">{pageSize}</span>
                                    </div>
                                    <div className="flex w-[100px] items-center justify-center text-sm font-medium">
                                        Page {page} of {totalPages || 1}
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Button
                                            variant="outline"
                                            className="h-8 w-8 p-0"
                                            onClick={() => goToPage(page - 1)}
                                            disabled={page <= 1}
                                        >
                                            <span className="sr-only">Go to previous page</span>
                                            <ChevronLeft className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="h-8 w-8 p-0"
                                            onClick={() => goToPage(page + 1)}
                                            disabled={totalPages !== null ? page >= totalPages : data.length < pageSize}
                                        >
                                            <span className="sr-only">Go to next page</span>
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Split View Sheet for Forms */}
            <Sheet open={isSheetOpen} onOpenChange={(open) => !open && setSelectedDocName(null)}>
                <SheetContent side="right" className="w-full sm:max-w-[800px] p-0 overflow-y-auto">
                    <SheetHeader className="px-6 py-4 border-b sticky top-0 bg-background z-10">
                        <SheetTitle className="text-xl">
                            {selectedDocName === 'new' ? `New ${doctype}` : selectedDocName}
                        </SheetTitle>
                    </SheetHeader>
                    <div className="h-full">
                        {selectedDocName && (
                            <SmartForm 
                                doctype={doctype} 
                                name={selectedDocName === 'new' ? undefined : selectedDocName} 
                                onClose={() => setSelectedDocName(null)}
                            />
                        )}
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
};

// ============================================================================
// Helper Functions
// ============================================================================

function formatCellValue(value: Document[string], column: string): string {
    if (value === null || value === undefined) return '-';
    if (column === 'creation' || column === 'modified') return formatDate(value);
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value);
}

export default SmartList;
