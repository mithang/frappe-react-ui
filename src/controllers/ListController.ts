import type { Document, DocTypeMeta, FrappeFilter } from '@/core/types';
import { EventBus } from '@/core/eventbus/EventBus';
import { getFrappeClient } from '@/lib/api/client';

export interface ListFilter {
    fieldname: string;
    operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'like' | 'not like' | 'in' | 'not in';
    value: unknown;
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
    /** null means the backend hit its statement timeout — genuinely unknown, not zero (C3). */
    total: number | null;
    hasMore: boolean;
    page: number;
    pageSize: number;
    isLoading: boolean;
    error: string | null;
}

/**
 * ListController — real `reportview.get` + separate `get_count` (closes C3: pagination could
 * never advance past page 1 because `total` was `data.length`), fetching every `in_list_view`
 * column instead of just name/creation/modified (closes C4).
 */
export class ListController {
    private doctype: string;
    private meta: DocTypeMeta | null = null;
    private state: ListState;
    private subscribers: Set<(state: ListState) => void> = new Set();

    constructor(doctype: string) {
        this.doctype = doctype;
        this.state = {
            data: [],
            total: null,
            hasMore: false,
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
        callback(this.state);
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
            const { meta } = await getFrappeClient().getMeta(this.doctype);
            this.meta = meta;
        }
        return this.meta;
    }

    /** Every `in_list_view` field, plus `name`/`docstatus`, which the list UI always needs
     *  (row key, and the real docstatus-based status badge — C8) regardless of DocType config,
     *  plus `title_field` — the list renders it as the leading human-readable column (Desk's
     *  "Subject"), and it is frequently NOT flagged in_list_view (Sales Invoice's customer_name,
     *  Item's item_name), so omitting it here left that column fetching nothing and showing "-". */
    private defaultListFields(): string[] {
        const inListView = (this.meta?.fields ?? []).filter((f) => f.in_list_view).map((f) => f.fieldname);
        const titleField = this.meta?.title_field;
        return Array.from(
            new Set(['name', 'docstatus', 'modified', ...(titleField ? [titleField] : []), ...inListView])
        );
    }

    async load(options: ListOptions = {}): Promise<void> {
        const { page = 1, pageSize = 20, fields, filters, orderBy, orderDir } = options;

        this.setState({ isLoading: true, error: null });

        try {
            await this.loadMeta();

            const frappeFilters: FrappeFilter[] | undefined = filters?.map((f) => [f.fieldname, f.operator, f.value]);

            const { rows, totalCount, hasMore } = await getFrappeClient().getList<Document>({
                doctype: this.doctype,
                fields: fields || this.defaultListFields(),
                filters: frappeFilters,
                orderBy: orderBy ? `${orderBy} ${orderDir || 'desc'}` : undefined,
                start: (page - 1) * pageSize,
                pageLength: pageSize,
            });

            this.setState({
                data: rows.map((row) => ({ ...row, doctype: this.doctype })),
                page,
                pageSize,
                total: totalCount,
                hasMore,
                isLoading: false,
            });
        } catch (error) {
            this.setState({
                error: error instanceof Error ? error.message : 'Failed to load data',
                isLoading: false,
            });
        }
    }

    async refresh(): Promise<void> {
        await this.load({ page: this.state.page, pageSize: this.state.pageSize });
    }

    async goToPage(page: number): Promise<void> {
        await this.load({ page, pageSize: this.state.pageSize });
    }

    async setPageSize(pageSize: number): Promise<void> {
        await this.load({ page: 1, pageSize });
    }

    // ============================================================================
    // Document Operations
    // ============================================================================

    async delete(name: string): Promise<void> {
        await getFrappeClient().deleteDoc(this.doctype, name);
        EventBus.emit('doc:deleted', { doctype: this.doctype, name });
        await this.refresh();
    }

    /** One batch of parallel requests, not N sequential round trips (closes half of C10). */
    async deleteMultiple(names: string[]): Promise<void> {
        const client = getFrappeClient();
        await Promise.all(names.map((name) => client.deleteDoc(this.doctype, name)));
        for (const name of names) {
            EventBus.emit('doc:deleted', { doctype: this.doctype, name });
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

export function createListController(doctype: string): ListController {
    return new ListController(doctype);
}
