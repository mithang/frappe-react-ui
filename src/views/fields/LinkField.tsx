import React, { useState, useEffect } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
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
            if (!field.options || !currentDoc) return null;
            return currentDoc[field.options];
        }
        return field.options;
    };

    useEffect(() => {
        if (open) {
            fetchOptions(debouncedSearch);
        }
    }, [open, debouncedSearch, field.options, currentDoc]);

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

            if (result.results) {
                // Parse results - Frappe returns array of objects or array of arrays
                const parsedOptions = result.results.map((item: any) => ({
                    value: item.value,
                    description: item.description
                }));
                setOptions(parsedOptions);
            } else if (result.message) {
                // Some versions return 'message'
                const parsedOptions = result.message.map((item: any) => ({
                    value: item.value,
                    description: item.description
                }));
                setOptions(parsedOptions);
            }
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
                                value={option.value}
                                onSelect={(currentValue) => {
                                    onChange(currentValue === value ? "" : currentValue);
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
