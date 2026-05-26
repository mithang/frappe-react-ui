import type { FieldRenderer, FrappeFieldType } from '../types';

/**
 * FieldRegistry - Registry for custom field renderers
 * Allows extensions to register custom field types or override defaults
 */
class FieldRegistryImpl {
    private renderers: Map<FrappeFieldType | string, FieldRenderer> = new Map();
    private overrides: Map<string, Map<string, FieldRenderer>> = new Map();

    /**
     * Register a field renderer for a field type
     */
    register<T = any>(fieldType: FrappeFieldType | string, renderer: FieldRenderer<T>): void {
        this.renderers.set(fieldType, renderer as FieldRenderer);
        console.log(`[FieldRegistry] Registered renderer for: ${fieldType}`);
    }

    /**
     * Register a field renderer override for a specific doctype + fieldname
     */
    registerOverride<T = any>(
        doctype: string,
        fieldname: string,
        renderer: FieldRenderer<T>
    ): void {
        if (!this.overrides.has(doctype)) {
            this.overrides.set(doctype, new Map());
        }
        this.overrides.get(doctype)!.set(fieldname, renderer as FieldRenderer);
        console.log(`[FieldRegistry] Registered override for: ${doctype}.${fieldname}`);
    }

    /**
     * Get renderer for a field type
     * First checks for doctype-specific override, then falls back to type renderer
     */
    get(fieldType: FrappeFieldType | string, doctype?: string, fieldname?: string): FieldRenderer | undefined {
        // Check for specific override first
        if (doctype && fieldname) {
            const doctypeOverrides = this.overrides.get(doctype);
            if (doctypeOverrides?.has(fieldname)) {
                return doctypeOverrides.get(fieldname);
            }
        }

        // Fall back to type-based renderer
        return this.renderers.get(fieldType);
    }

    /**
     * Check if a renderer exists for a field type
     */
    has(fieldType: FrappeFieldType | string): boolean {
        return this.renderers.has(fieldType);
    }

    /**
     * Unregister a field renderer
     */
    unregister(fieldType: FrappeFieldType | string): void {
        this.renderers.delete(fieldType);
    }

    /**
     * Clear an override
     */
    clearOverride(doctype: string, fieldname?: string): void {
        if (fieldname) {
            this.overrides.get(doctype)?.delete(fieldname);
        } else {
            this.overrides.delete(doctype);
        }
    }

    /**
     * Get all registered field types
     */
    getRegisteredTypes(): string[] {
        return Array.from(this.renderers.keys());
    }

    /**
     * Clear all registrations
     */
    clear(): void {
        this.renderers.clear();
        this.overrides.clear();
    }
}

// Singleton instance
export const FieldRegistry = new FieldRegistryImpl();
