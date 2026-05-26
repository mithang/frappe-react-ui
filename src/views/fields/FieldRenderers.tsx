import React from 'react';
import type { FieldRendererProps, FrappeFieldType } from '@/core/types';
import { FieldRegistry } from '@/core/registry/FieldRegistry';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { LinkField } from './LinkField';
import { TableField } from './TableField';

// ============================================================================
// Data Field - Basic text input
// ============================================================================

export const DataField: React.FC<FieldRendererProps<string>> = ({
    field,
    value,
    onChange,
    disabled,
    error,
}) => {
    return (
        <Input
            type="text"
            placeholder={`Enter ${field.label?.toLowerCase() || field.fieldname}`}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled || field.read_only}
            className={error ? 'border-destructive' : ''}
        />
    );
};

// ============================================================================
// Password Field
// ============================================================================

export const PasswordField: React.FC<FieldRendererProps<string>> = ({
    field,
    value,
    onChange,
    disabled,
    error,
}) => {
    return (
        <Input
            type="password"
            placeholder={`Enter ${field.label?.toLowerCase() || 'password'}`}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled || field.read_only}
            className={error ? 'border-destructive' : ''}
        />
    );
};

// ============================================================================
// Text Fields - Textarea variants
// ============================================================================

export const TextField: React.FC<FieldRendererProps<string>> = ({
    field,
    value,
    onChange,
    disabled,
    error,
}) => {
    return (
        <Textarea
            placeholder={`Enter ${field.label?.toLowerCase() || field.fieldname}`}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled || field.read_only}
            className={`min-h-[80px] ${error ? 'border-destructive' : ''}`}
        />
    );
};

export const SmallTextField: React.FC<FieldRendererProps<string>> = TextField;
export const LongTextField: React.FC<FieldRendererProps<string>> = (props) => (
    <TextField {...props} />
);

// ============================================================================
// Numeric Fields
// ============================================================================

export const IntField: React.FC<FieldRendererProps<number>> = ({
    field,
    value,
    onChange,
    disabled,
    error,
}) => {
    return (
        <Input
            type="number"
            step="1"
            placeholder={`Enter ${field.label?.toLowerCase() || 'number'}`}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value ? parseInt(e.target.value, 10) : 0)}
            disabled={disabled || field.read_only}
            className={error ? 'border-destructive' : ''}
        />
    );
};

export const FloatField: React.FC<FieldRendererProps<number>> = ({
    field,
    value,
    onChange,
    disabled,
    error,
}) => {
    return (
        <Input
            type="number"
            step="0.01"
            placeholder={`Enter ${field.label?.toLowerCase() || 'number'}`}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value ? parseFloat(e.target.value) : 0)}
            disabled={disabled || field.read_only}
            className={error ? 'border-destructive' : ''}
        />
    );
};

export const CurrencyField: React.FC<FieldRendererProps<number>> = ({
    field,
    value,
    onChange,
    disabled,
    error,
}) => {
    return (
        <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={value ?? ''}
                onChange={(e) => onChange(e.target.value ? parseFloat(e.target.value) : 0)}
                disabled={disabled || field.read_only}
                className={`pl-7 ${error ? 'border-destructive' : ''}`}
            />
        </div>
    );
};

export const PercentField: React.FC<FieldRendererProps<number>> = ({
    field,
    value,
    onChange,
    disabled,
    error,
}) => {
    return (
        <div className="relative">
            <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                placeholder="0"
                value={value ?? ''}
                onChange={(e) => onChange(e.target.value ? parseFloat(e.target.value) : 0)}
                disabled={disabled || field.read_only}
                className={`pr-7 ${error ? 'border-destructive' : ''}`}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
        </div>
    );
};

// ============================================================================
// Select Field
// ============================================================================

export const SelectField: React.FC<FieldRendererProps<string>> = ({
    field,
    value,
    onChange,
    disabled,
    error,
}) => {
    const options = (field.options || '').split('\n').filter(Boolean);

    return (
        <Select
            value={value || ''}
            onValueChange={onChange}
            disabled={disabled || field.read_only}
        >
            <SelectTrigger className={error ? 'border-destructive' : ''}>
                <SelectValue placeholder={`Select ${field.label?.toLowerCase() || 'option'}`} />
            </SelectTrigger>
            <SelectContent>
                {options.map((option) => (
                    <SelectItem key={option} value={option}>
                        {option}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
};

// ============================================================================
// Checkbox Field
// ============================================================================

export const CheckField: React.FC<FieldRendererProps<boolean>> = ({
    field,
    value,
    onChange,
    disabled,
}) => {
    return (
        <div className="flex items-center space-x-2">
            <Checkbox
                id={field.fieldname}
                checked={value || false}
                onCheckedChange={(checked) => onChange(checked === true)}
                disabled={disabled || field.read_only}
            />
            <label
                htmlFor={field.fieldname}
                className="text-sm text-muted-foreground cursor-pointer"
            >
                {field.label || field.fieldname}
            </label>
        </div>
    );
};

// ============================================================================
// Date/Time Fields
// ============================================================================

export const DateField: React.FC<FieldRendererProps<string>> = ({
    field,
    value,
    onChange,
    disabled,
    error,
}) => {
    return (
        <Input
            type="date"
            value={value ? value.split(' ')[0] : ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled || field.read_only}
            className={error ? 'border-destructive' : ''}
        />
    );
};

export const DatetimeField: React.FC<FieldRendererProps<string>> = ({
    field,
    value,
    onChange,
    disabled,
    error,
}) => {
    return (
        <Input
            type="datetime-local"
            value={value ? value.replace(' ', 'T').substring(0, 16) : ''}
            onChange={(e) => onChange(e.target.value.replace('T', ' '))}
            disabled={disabled || field.read_only}
            className={error ? 'border-destructive' : ''}
        />
    );
};

export const TimeField: React.FC<FieldRendererProps<string>> = ({
    field,
    value,
    onChange,
    disabled,
    error,
}) => {
    return (
        <Input
            type="time"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled || field.read_only}
            className={error ? 'border-destructive' : ''}
        />
    );
};

// ============================================================================
// Link Field - Reference to another DocType
// ============================================================================

// LinkField is now imported from ./LinkField.tsx

// ============================================================================
// Color Field
// ============================================================================

export const ColorField: React.FC<FieldRendererProps<string>> = ({
    field,
    value,
    onChange,
    disabled,
}) => {
    return (
        <div className="flex items-center gap-2">
            <Input
                type="color"
                value={value || '#000000'}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled || field.read_only}
                className="w-12 h-10 p-1 cursor-pointer"
            />
            <Input
                type="text"
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled || field.read_only}
                className="flex-1"
                placeholder="#000000"
            />
        </div>
    );
};

// ============================================================================
// Rating Field
// ============================================================================

export const RatingField: React.FC<FieldRendererProps<number>> = ({
    field,
    value,
    onChange,
    disabled,
}) => {
    const rating = Math.round(value || 0);
    const maxRating = 5;

    return (
        <div className="flex items-center gap-1">
            {Array.from({ length: maxRating }, (_, i) => (
                <button
                    key={i}
                    type="button"
                    className={`text-2xl ${i < rating ? 'text-yellow-500' : 'text-gray-300'}`}
                    onClick={() => !disabled && onChange(i + 1)}
                    disabled={disabled || field.read_only}
                >
                    ★
                </button>
            ))}
            <span className="ml-2 text-sm text-muted-foreground">({rating}/{maxRating})</span>
        </div>
    );
};

// ============================================================================
// Read Only Field
// ============================================================================

export const ReadOnlyField: React.FC<FieldRendererProps<any>> = ({
    field,
    value,
}) => {
    return (
        <div className="py-2 px-3 bg-muted rounded-md text-sm">
            {value ?? '-'}
        </div>
    );
};

// ============================================================================
// Register all default field renderers
// ============================================================================

export function registerDefaultFieldRenderers(): void {
    const renderers: Record<FrappeFieldType, React.ComponentType<FieldRendererProps<any>>> = {
        'Data': DataField,
        'Password': PasswordField,
        'Text': TextField,
        'Small Text': SmallTextField,
        'Long Text': LongTextField,
        'Text Editor': TextField,
        'Code': TextField,
        'HTML Editor': TextField,
        'Markdown Editor': TextField,
        'Int': IntField,
        'Float': FloatField,
        'Currency': CurrencyField,
        'Percent': PercentField,
        'Select': SelectField,
        'Check': CheckField,
        'Date': DateField,
        'Datetime': DatetimeField,
        'Time': TimeField,
        'Duration': DataField,
        'Link': LinkField,
        'Dynamic Link': LinkField,
        'Color': ColorField,
        'Rating': RatingField,
        'Read Only': ReadOnlyField,
        'Attach': DataField,
        'Attach Image': DataField,
        'Table': TableField,
        'Table MultiSelect': TableField,
        'Signature': DataField,
        'Geolocation': DataField,
        'Barcode': DataField,
        'JSON': TextField,
        'Section Break': DataField,
        'Column Break': DataField,
        'Tab Break': DataField,
        'HTML': DataField,
        'Image': DataField,
        'Button': DataField,
        'Heading': DataField,
    };

    for (const [fieldType, renderer] of Object.entries(renderers)) {
        FieldRegistry.register(fieldType as FrappeFieldType, renderer);
    }

    console.log('[FieldRenderers] Registered default renderers for', Object.keys(renderers).length, 'field types');
}
