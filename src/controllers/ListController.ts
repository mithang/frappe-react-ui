import type { Document, DocTypeMeta } from '@/core/types';
import { EventBus } from '@/core/eventbus/EventBus';
import { DocumentModel } from '@/models/DocumentModel';

export interface ListFilter {
    fieldname: string;
    operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'like' | 'not like' | 'in' | 'not in';
    value: any;
}

export interface ListOptions {
    fields?: string[];
    filters?: ListFilter[];
    page?: number;
    pageSize?: number;
    orderBy?: string;
    orderDir?: 'asc' | 'desc';
}

export interface ListState {
    data: Document[];
    total: number;
    page: number;
    pageSize: number;
    isLoading: boolean;
    error: string | null;
}

/**
 * ListController - Controller for list views
 * Manages list data, pagination, filtering, and sorting
 */
export class ListController {
    private doctype: string;
    private meta: DocTypeMeta | null = null;
    private model: DocumentModel;
    private state: ListState;
    private subscribers: Set<(state: ListState) => void> = new Set();

    constructor(doctype: string) {
        this.doctype = doctype;
        this.model = new DocumentModel(doctype);
        this.state = {
            data: [],
            total: 0,
            page: 1,
            pageSize: 20,
            isLoading: false,
            error: null,
        };
    }

    // ============================================================================
    // State Management
    // ============================================================================

    private setState(partial: Partial<ListState>): void {
        this.state = { ...this.state, ...partial };
        this.notifySubscribers();
    }

    private notifySubscribers(): void {
        for (const subscriber of this.subscribers) {
            subscriber(this.state);
        }
    }

    subscribe(callback: (state: ListState) => void): () => void {
        this.subscribers.add(callback);
        // Immediately call with current state
        callback(this.state);
        // Return unsubscribe function
        return () => this.subscribers.delete(callback);
    }

    getState(): ListState {
        return this.state;
    }

    // ============================================================================
    // Data Operations
    // ============================================================================

    async loadMeta(): Promise<DocTypeMeta> {
        if (!this.meta) {
            this.meta = await this.model.getMeta();
        }
        return this.meta;
    }

    async load(options: ListOptions = {}): Promise<void> {
        const { page = 1, pageSize = 20, fields, filters, orderBy, orderDir } = options;

        this.setState({ isLoading: true, error: null });

        try {
            // Ensure meta is loaded
            await this.loadMeta();

            // Build default fields from meta
            const defaultFields = ['name', 'creation', 'modified'];
            if (this.meta?.title_field) {
                defaultFields.push(this.meta.title_field);
            }

            // Convert filters to Frappe format
            const frappeFilters = filters?.map((f) => [f.fieldname, f.operator, f.value]);

            const data = await this.model.list({
                fields: fields || defaultFields,
                filters: frappeFilters,
                limit_start: (page - 1) * pageSize,
                limit_page_length: pageSize,
                order_by: orderBy ? `${orderBy} ${orderDir || 'desc'}` : undefined,
            });

            this.setState({
                data,
                page,
                pageSize,
                total: data.length, // Note: Frappe doesn't return total in basic API
                isLoading: false,
            });

        } catch (error: any) {
            this.setState({
                error: error.message || 'Failed to load data',
                isLoading: false,
            });
        }
    }

    async refresh(): Promise<void> {
        await this.load({
            page: this.state.page,
            pageSize: this.state.pageSize,
        });
    }

    async goToPage(page: number): Promise<void> {
        await this.load({
            page,
            pageSize: this.state.pageSize,
        });
    }

    async setPageSize(pageSize: number): Promise<void> {
        await this.load({
            page: 1,
            pageSize,
        });
    }

    // ============================================================================
    // Document Operations
    // ============================================================================

    async delete(name: string): Promise<void> {
        await this.model.delete(name);

        // Emit delete event
        EventBus.emit('doc:deleted', {
            doctype: this.doctype,
            name,
        });

        // Refresh list
        await this.refresh();
    }

    async deleteMultiple(names: string[]): Promise<void> {
        for (const name of names) {
            await this.model.delete(name);
            EventBus.emit('doc:deleted', {
                doctype: this.doctype,
                name,
            });
        }
        await this.refresh();
    }

    // ============================================================================
    // Getters
    // ============================================================================

    getMeta(): DocTypeMeta | null {
        return this.meta;
    }

    getDoctype(): string {
        return this.doctype;
    }
}

/**
 * Factory function to create ListController instances
 */
export function createListController(doctype: string): ListController {
    return new ListController(doctype);
}
