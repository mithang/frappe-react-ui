import type { DocTypeComponents, FieldRenderer } from '../types';

/**
 * DocTypeRegistry - Registry for custom DocType components
 * Allows extensions to register custom Form, List, and Print components per DocType
 */
class DocTypeRegistryImpl {
    private components: Map<string, DocTypeComponents> = new Map();

    /**
     * Register components for a DocType
     */
    register(doctype: string, components: DocTypeComponents): void {
        const existing = this.components.get(doctype) || {};
        this.components.set(doctype, {
            ...existing,
            ...components,
            // Merge field renderers if both exist
            fields: {
                ...existing.fields,
                ...components.fields,
            },
        });
        console.log(`[DocTypeRegistry] Registered components for: ${doctype}`, Object.keys(components));
    }

    /**
     * Get registered components for a DocType
     */
    get(doctype: string): DocTypeComponents | undefined {
        return this.components.get(doctype);
    }

    /**
     * Get Form component for a DocType
     */
    getForm(doctype: string): DocTypeComponents['Form'] | undefined {
        return this.components.get(doctype)?.Form;
    }

    /**
     * Get List component for a DocType
     */
    getList(doctype: string): DocTypeComponents['List'] | undefined {
        return this.components.get(doctype)?.List;
    }

    /**
     * Get Print component for a DocType
     */
    getPrint(doctype: string): DocTypeComponents['Print'] | undefined {
        return this.components.get(doctype)?.Print;
    }

    /**
     * Get field renderer for a specific field in a DocType
     */
    getFieldRenderer(doctype: string, fieldname: string) {
        return this.components.get(doctype)?.fields?.[fieldname];
    }

    /**
     * Convenience wrapper around register() for the single-field-override case — this is the
     * method referenced by docs/agent-rules/add-field-renderer.md.
     */
    registerFieldRenderer(doctype: string, fieldname: string, renderer: FieldRenderer): void {
        this.register(doctype, { fields: { [fieldname]: renderer } });
    }

    /**
     * Check if a DocType has custom components
     */
    has(doctype: string): boolean {
        return this.components.has(doctype);
    }

    /**
     * Unregister components for a DocType
     */
    unregister(doctype: string): void {
        this.components.delete(doctype);
    }

    /**
     * Get all registered DocTypes
     */
    getRegisteredDocTypes(): string[] {
        return Array.from(this.components.keys());
    }

    /**
     * Clear all registrations
     */
    clear(): void {
        this.components.clear();
    }
}

// Singleton instance
export const DocTypeRegistry = new DocTypeRegistryImpl();
