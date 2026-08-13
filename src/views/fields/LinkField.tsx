import React, { useState, useEffect } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    Command,
    CommandEmpty,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { useDocumentStore } from '@/store';
import { FieldRendererProps } from '@/core/types';
import { getFrappeApp } from '@/lib/frappe';
import { useDebounce } from '@/hooks/useDebounce';

interface LinkOption {
    value: string;
    description?: string;
}

export const LinkField: React.FC<FieldRendererProps<string>> = ({
    field,
    value,
    onChange,
    disabled,
    doc,
}) => {
    const { currentDoc } = useDocumentStore();
    const [open, setOpen] = useState(false);
    const [options, setOptions] = useState<LinkOption[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);

    // Debounce search term to avoid too many API calls
    const debouncedSearch = useDebounce(search, 300);

    const getTargetDocType = () => {
        if (field.fieldtype === 'Dynamic Link') {
            const docContext = doc || currentDoc;
            if (!field.options || !docContext) return null;
            return docContext[field.options];
        }
        return field.options;
    };

    useEffect(() => {
        if (open) {
            fetchOptions(debouncedSearch);
        }
    }, [open, debouncedSearch, field.options, currentDoc, doc]);

    const fetchOptions = async (txt: string) => {
        const targetDocType = getTargetDocType();

        if (!targetDocType) {
            console.warn('Target DocType not found for link field:', field.fieldname);
            return;
        }

        setLoading(true);
        try {
            const frappe = getFrappeApp();
            const result = await frappe.call('frappe.desk.search.search_link', {
                doctype: targetDocType,
                txt: txt,
                page_length: 10,
            });

            const rawOptions = result.results || result.message || [];
            const parsedOptions: LinkOption[] = rawOptions.map((item: Record<string, unknown>) => ({
                value: String(item.value || ''),
                description: item.description ? String(item.description) : undefined,
            }));
            setOptions(parsedOptions);
        } catch (error) {
            console.error('Failed to fetch link options:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between font-normal"
                    disabled={disabled || field.read_only}
                >
                    {value ? (
                        <span className="truncate">{value}</span>
                    ) : (
                        <span className="text-muted-foreground">Select {field.label || field.fieldname}...</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder={`Search ${field.options}...`}
                        value={search}
                        onValueChange={setSearch}
                    />
                    <CommandList>
                        {loading && (
                            <div className="py-6 text-center text-sm text-muted-foreground">
                                Loading...
                            </div>
                        )}
                        {!loading && options.length === 0 && (
                            <CommandEmpty>No results found.</CommandEmpty>
                        )}
                        {!loading && options.map((option) => (
                            <CommandItem
                                key={option.value}
                                value={option.value.toLowerCase()}
                                onSelect={() => {
                                    // Always set — clicking the already-selected option must not
                                    // clear it. It previously toggled to "" here, which silently
                                    // wiped fields that arrive pre-filled (e.g. Company, set by a
                                    // doctype's own client script on load) the moment a user
                                    // clicked the one visible/highlighted option to confirm it.
                                    onChange(option.value);
                                    setOpen(false);
                                }}
                            >
                                <Check
                                    className={cn(
                                        "mr-2 h-4 w-4",
                                        value === option.value ? "opacity-100" : "opacity-0"
                                    )}
                                />
                                <div className="flex flex-col">
                                    <span>{option.value}</span>
                                    {option.description && (
                                        <span className="text-xs text-muted-foreground">{option.description}</span>
                                    )}
                                </div>
                            </CommandItem>
                        ))}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
};

