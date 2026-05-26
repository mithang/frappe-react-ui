
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    CommandDialog,
    CommandInput,
    CommandList,
    CommandEmpty,
    CommandGroup,
    CommandItem,
    CommandSeparator,
    CommandShortcut,
} from '@/components/ui/command';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { getFrappeApp } from '@/lib/frappe';
import { useCommand } from '@/contexts/CommandContext';
import { useDebounce } from '@/hooks/useDebounce';
import {
    FileText,
    LayoutDashboard,
    Settings,
    Box,
    Search,
    Loader2
} from 'lucide-react';

interface SearchResult {
    value: string;
    description: string;
    route?: string;
    doctype?: string;
    name?: string;
}

export function CommandPalette() {
    const { open, setOpen } = useCommand();
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounce(search, 300);
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);

    // Local cache for DocTypes to show when search is empty
    const [doctypes, setDoctypes] = useState<string[]>([]);

    const navigate = useNavigate();
    const { workspaces } = useWorkspaces();
    const frappe = getFrappeApp();

    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || e.key === '/') {
                if (
                    (e.target instanceof HTMLElement && e.target.isContentEditable) ||
                    e.target instanceof HTMLInputElement ||
                    e.target instanceof HTMLTextAreaElement ||
                    e.target instanceof HTMLSelectElement
                ) {
                    return;
                }

                e.preventDefault();
                setOpen((open: boolean) => !open);
            }
        };

        document.addEventListener('keydown', down);

        // Initial fetch for "recent" or "common" doctypes
        fetchDocTypes();

        return () => document.removeEventListener('keydown', down);
    }, [setOpen]);

    // Perform global search when debounced term changes
    useEffect(() => {
        if (debouncedSearch) {
            performGlobalSearch(debouncedSearch);
        } else {
            setResults([]);
        }
    }, [debouncedSearch]);

    const fetchDocTypes = async () => {
        try {
            const response = await frappe.call('frappe.client.get_list', {
                doctype: 'DocType',
                filters: { istable: 0, issingle: 0 },
                fields: ['name', 'module'],
                limit_page_length: 10,
                order_by: 'modified desc'
            });

            if (response && response.message) {
                setDoctypes(response.message.map((d: any) => d.name));
            }
        } catch (e) {
            console.error('Failed to fetch DocTypes', e);
        }
    };

    const performGlobalSearch = async (txt: string) => {
        setLoading(true);
        console.log('Performing global search for:', txt);
        try {
            // Use Frappe's global search API
            const response = await frappe.call('frappe.search.search', {
                txt: txt,
            });
            console.log('Search response:', response);

            let searchResults: SearchResult[] = [];
            if (response && response.results) {
                searchResults = response.results;
            } else if (Array.isArray(response)) {
                searchResults = response;
            } else if (response.message) {
                searchResults = response.message;
            }

            setResults(searchResults);

            // Fallback: If no results, search DocTypes locally/remotely
            if (searchResults.length === 0) {
                const docTypeResponse = await frappe.call('frappe.client.get_list', {
                    doctype: 'DocType',
                    filters: [['name', 'like', `%${txt}%`], ['istable', '=', 0]],
                    fields: ['name', 'module'],
                    limit_page_length: 5
                });
                if (docTypeResponse && docTypeResponse.message) {
                    const fallbackResults = docTypeResponse.message.map((d: any) => ({
                        value: d.name,
                        description: `DocType in ${d.module}`,
                        route: `app/doctype/${d.name}`,
                        doctype: 'DocType',
                        name: d.name
                    })) as SearchResult[];
                    setResults(prev => [...prev, ...fallbackResults]);
                }
            }

        } catch (e) {
            console.error('Search failed', e);
        } finally {
            setLoading(false);
        }
    };

    const runCommand = (command: () => void) => {
        setOpen(false);
        command();
    };

    const handleSelect = (result: SearchResult) => {
        runCommand(() => {
            if (result.route) {
                // Convert Frappe route to our route
                // e.g. /app/customer/CUST-001 -> /doctype/Customer/CUST-001
                const parts = result.route.split('/');
                if (parts.length >= 3 && parts[1] === 'app') {
                    // parts: ['', 'app', 'doctype', 'name']
                    const doctype = parts[2];
                    const name = parts[3];
                    if (name) {
                        navigate(`/doctype/${doctype}/${name}`);
                    } else {
                        navigate(`/doctype/${doctype}`);
                    }
                } else {
                    // Fallback
                    navigate(result.route);
                }
            } else if (result.doctype && result.name) {
                navigate(`/doctype/${result.doctype}/${result.name}`);
            }
        });
    };

    return (
        <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false}>
            <CommandInput
                placeholder="Search anything..."
                value={search}
                onValueChange={setSearch}
            />
            <CommandList>
                {loading && <div className="p-4 text-center text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Searching...</div>}

                {!loading && search === '' && (
                    <>
                        <CommandGroup heading="Quick Links">
                            <CommandItem onSelect={() => runCommand(() => navigate('/'))}>
                                <LayoutDashboard className="mr-2 h-4 w-4" />
                                <span>Dashboard</span>
                            </CommandItem>
                            <CommandItem onSelect={() => runCommand(() => navigate('/workspace/Settings'))}>
                                <Settings className="mr-2 h-4 w-4" />
                                <span>Settings</span>
                            </CommandItem>
                        </CommandGroup>

                        {workspaces && workspaces.length > 0 && (
                            <CommandGroup heading="Workspaces">
                                {workspaces.map((ws) => (
                                    <CommandItem
                                        key={ws.name}
                                        onSelect={() => runCommand(() => navigate(`/workspace/${ws.name}`))}
                                    >
                                        <Box className="mr-2 h-4 w-4" />
                                        <span>{ws.label}</span>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}

                        <CommandGroup heading="Recent DocTypes">
                            {doctypes.map(dt => (
                                <CommandItem
                                    key={dt}
                                    onSelect={() => runCommand(() => navigate(`/doctype/${dt}`))}
                                >
                                    <FileText className="mr-2 h-4 w-4" />
                                    <span>{dt}</span>
                                    <CommandShortcut>List</CommandShortcut>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </>
                )}

                {!loading && search !== '' && results.length === 0 && (
                    <CommandEmpty>No results found.</CommandEmpty>
                )}

                {!loading && search !== '' && results.length > 0 && (
                    <CommandGroup heading="Global Search Results">
                        {results.map((result, index) => (
                            <CommandItem
                                key={index}
                                onSelect={() => handleSelect(result)}
                                value={result.value}
                            >
                                <Search className="mr-2 h-4 w-4 text-muted-foreground" />
                                <div className="flex flex-col">
                                    <span>{result.value}</span>
                                    {result.description && (
                                        <span className="text-xs text-muted-foreground">{result.description}</span>
                                    )}
                                </div>
                            </CommandItem>
                        ))}
                    </CommandGroup>
                )}

            </CommandList>
        </CommandDialog>
    );
}
