// Event bus types.

import type { Document } from './document';

export type EventHandler<T = any> = (payload: T) => void;

export interface EventBusEvents {
    'doc:saved': { doctype: string; name: string; doc: Document };
    'doc:deleted': { doctype: string; name: string };
    'doc:loaded': { doctype: string; name: string; doc: Document };
    'field:changed': { doctype: string; name: string; fieldname: string; value: any; oldValue: any };
    'form:dirty': { doctype: string; name: string; isDirty: boolean };
    'extension:loaded': { name: string };
    [key: string]: any;
}
