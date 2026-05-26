import { useState, useEffect, useCallback, useRef } from 'react';
import { ListController, createListController, ListState } from '@/controllers/ListController';
import type { DocTypeMeta } from '@/core/types';

interface UseListControllerOptions {
    doctype: string;
    pageSize?: number;
    autoLoad?: boolean;
}

interface UseListControllerReturn extends ListState {
    controller: ListController | null;
    meta: DocTypeMeta | null;
    refresh: () => Promise<void>;
    goToPage: (page: number) => Promise<void>;
    setPageSize: (size: number) => Promise<void>;
    deleteItem: (name: string) => Promise<void>;
    deleteItems: (names: string[]) => Promise<void>;
}

/**
 * useListController - React hook for managing list views
 */
export function useListController(options: UseListControllerOptions): UseListControllerReturn {
    const { doctype, pageSize = 20, autoLoad = true } = options;

    const controllerRef = useRef<ListController | null>(null);
    const [state, setState] = useState<ListState>({
        data: [],
        total: 0,
        page: 1,
        pageSize,
        isLoading: false,
        error: null,
    });
    const [meta, setMeta] = useState<DocTypeMeta | null>(null);

    // Initialize controller
    useEffect(() => {
        const controller = createListController(doctype);
        controllerRef.current = controller;

        // Subscribe to state changes
        const unsubscribe = controller.subscribe(setState);

        // Load meta and data
        const init = async () => {
            const docMeta = await controller.loadMeta();
            setMeta(docMeta);

            if (autoLoad) {
                await controller.load({ pageSize });
            }
        };

        init();

        return () => {
            unsubscribe();
        };
    }, [doctype, pageSize, autoLoad]);

    const refresh = useCallback(async () => {
        await controllerRef.current?.refresh();
    }, []);

    const goToPage = useCallback(async (page: number) => {
        await controllerRef.current?.goToPage(page);
    }, []);

    const setPageSizeFn = useCallback(async (size: number) => {
        await controllerRef.current?.setPageSize(size);
    }, []);

    const deleteItem = useCallback(async (name: string) => {
        await controllerRef.current?.delete(name);
    }, []);

    const deleteItems = useCallback(async (names: string[]) => {
        await controllerRef.current?.deleteMultiple(names);
    }, []);

    return {
        controller: controllerRef.current,
        meta,
        ...state,
        refresh,
        goToPage,
        setPageSize: setPageSizeFn,
        deleteItem,
        deleteItems,
    };
}
