import type { Document, DocTypeMeta, DocField } from '@/core/types';
import { getFrappeApp } from '@/lib/frappe';

/**
 * DocumentModel - Base model for Frappe documents
 * Handles CRUD operations and data transformation
 */
export class DocumentModel {
    private doctype: string;

    constructor(doctype: string) {
        this.doctype = doctype;
    }

    /**
     * Fetch document metadata
     */
    async getMeta(): Promise<DocTypeMeta> {
        const frappe = getFrappeApp();
        const response = await frappe.getMeta(this.doctype);
        return response.docs?.[0] || response;
    }

    /**
     * Fetch a single document
     */
    async get(name: string): Promise<Document> {
        const frappe = getFrappeApp();
        const response = await frappe.getDoc(this.doctype, name);
        return {
            ...response.data || response,
            doctype: this.doctype,
        };
    }

    /**
     * Fetch a list of documents
     */
    async list(options: {
        fields?: string[];
        filters?: any[];
        limit_start?: number;
        limit_page_length?: number;
        order_by?: string;
    } = {}): Promise<Document[]> {
        const frappe = getFrappeApp();
        const response = await frappe.getDocList(this.doctype, {
            fields: options.fields || ['name', 'creation', 'modified'],
            ...options,
        });
        return response.map((doc: any) => ({
            ...doc,
            doctype: this.doctype,
        }));
    }

    /**
     * Create a new document
     */
    async create(doc: Partial<Document>): Promise<Document> {
        const frappe = getFrappeApp();
        const response = await frappe.createDoc(this.doctype, doc);
        return {
            ...response.data || response,
            doctype: this.doctype,
        };
    }

    /**
     * Update an existing document
     */
    async update(name: string, doc: Partial<Document>): Promise<Document> {
        const frappe = getFrappeApp();
        const response = await frappe.updateDoc(this.doctype, name, doc);
        return {
            ...response.data || response,
            doctype: this.doctype,
        };
    }

    /**
     * Delete a document
     */
    async delete(name: string): Promise<void> {
        const frappe = getFrappeApp();
        await frappe.deleteDoc(this.doctype, name);
    }

    /**
     * Create a new empty document with defaults
     */
    createNew(meta: DocTypeMeta): Document {
        const doc: Document = {
            name: '',
            doctype: this.doctype,
            docstatus: 0,
        };

        // Apply default values from meta
        for (const field of meta.fields) {
            if (field.default !== undefined) {
                doc[field.fieldname] = this.parseDefault(field);
            }
        }

        return doc;
    }

    /**
     * Parse default value based on field type
     */
    private parseDefault(field: DocField): any {
        const { fieldtype, default: defaultValue } = field;

        if (defaultValue === undefined || defaultValue === null) {
            return undefined;
        }

        switch (fieldtype) {
            case 'Int':
                return parseInt(defaultValue, 10) || 0;
            case 'Float':
            case 'Currency':
            case 'Percent':
                return parseFloat(defaultValue) || 0;
            case 'Check':
                return defaultValue === '1' || defaultValue === 1 || defaultValue === true;
            case 'Table':
                return [];
            default:
                return defaultValue;
        }
    }

    /**
     * Validate document against meta
     */
    validate(doc: Document, meta: DocTypeMeta): Record<string, string> {
        const errors: Record<string, string> = {};

        for (const field of meta.fields) {
            if (field.reqd && !field.hidden) {
                const value = doc[field.fieldname];
                if (value === undefined || value === null || value === '') {
                    errors[field.fieldname] = `${field.label || field.fieldname} is required`;
                }
            }
        }

        return errors;
    }
}

/**
 * Factory function to create DocumentModel instances
 */
export function createDocumentModel(doctype: string): DocumentModel {
    return new DocumentModel(doctype);
}
