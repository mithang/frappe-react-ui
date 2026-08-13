// The one interface all network access goes through (1A, Wave 1 frozen contract). Every RPC
// shape here was verified against a live container, not assumed — see
// src/test/fixtures/frappe/ and docs/agent-rules/frappe-api.md for the corrections this caught.

import type {
  Document,
  DocInfo,
  DocPerm,
  DocTypeMeta,
  GetListArgs,
  LinkOption,
  UploadedFile,
  UploadFileArgs,
} from '@/core/types';
import { FrappeApiError, buildApiError, parseServerMessages, type ServerMessage } from './errors';
import { withCsrfHeader, setCsrfToken as setCsrfTokenState } from './csrf';

export interface FrappeClient {
  call<T>(method: string, args?: Record<string, unknown>): Promise<T>;
  getDoc(doctype: string, name: string): Promise<{ doc: Document; docinfo: DocInfo }>;
  saveDoc(
    doc: Document & { __islocal?: 0 | 1 },
    action: 'Save' | 'Submit' | 'Cancel' | 'Update'
  ): Promise<{ doc: Document; docinfo: DocInfo; messages: ServerMessage[]; localname?: string }>;
  getList<TRow = Record<string, unknown>>(
    args: GetListArgs
  ): Promise<{ rows: TRow[]; keys: readonly string[]; totalCount: number | null; hasMore: boolean }>;
  getCount(args: { doctype: string; filters?: GetListArgs['filters']; limit?: number }): Promise<number | null>;
  getMeta(doctype: string): Promise<{ meta: DocTypeMeta; childMetas: Record<string, DocTypeMeta>; docperms: DocPerm[] }>;
  deleteDoc(doctype: string, name: string): Promise<void>;
  uploadFile(args: UploadFileArgs): Promise<UploadedFile>;
  /** The session probe — a 401/403 here means "not logged in", not "permission denied on this doc". */
  getLoggedUser(): Promise<string>;
  searchLink(args: { doctype: string; txt: string; filters?: unknown }): Promise<LinkOption[]>;
  setCsrfToken(token: string | null): void;
  onAuthFailure(cb: (e: FrappeApiError) => void): () => void;
}

class FrappeClientImpl implements FrappeClient {
  private baseUrl: string;
  private authFailureHandlers = new Set<(e: FrappeApiError) => void>();

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/$/, '');
  }

  setCsrfToken(token: string | null): void {
    setCsrfTokenState(token);
  }

  onAuthFailure(cb: (e: FrappeApiError) => void): () => void {
    this.authFailureHandlers.add(cb);
    return () => this.authFailureHandlers.delete(cb);
  }

  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      credentials: 'include',
      headers: withCsrfHeader({
        Accept: 'application/json',
        ...(init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      }),
    });

    if (!res.ok) {
      const error = await buildApiError(res);
      if (error.isAuthFailure) {
        for (const handler of this.authFailureHandlers) handler(error);
      }
      throw error;
    }

    // 204/empty-body responses (e.g. frappe.client.delete) — nothing to parse.
    const text = await res.text();
    if (!text) return {};
    return JSON.parse(text);
  }

  async call<T>(method: string, args: Record<string, unknown> = {}): Promise<T> {
    const body = await this.request(`/api/method/${method}`, {
      method: 'POST',
      body: JSON.stringify(args),
    });
    return (body as { message: T }).message;
  }

  async getDoc(doctype: string, name: string): Promise<{ doc: Document; docinfo: DocInfo }> {
    const params = new URLSearchParams({ doctype, name });
    const body = (await this.request(`/api/method/frappe.desk.form.load.getdoc?${params}`)) as {
      docs?: Document[];
      docinfo?: DocInfo;
    };
    const doc = body.docs?.[0];
    if (!doc) {
      // getdoc returns `{ docs: [] }` on a missing record — never an HTTP 404 (verified).
      throw new FrappeApiError(`${doctype} ${name} not found`, { httpStatus: 404 });
    }
    return { doc, docinfo: body.docinfo ?? {} };
  }

  async saveDoc(
    doc: Document & { __islocal?: 0 | 1 },
    action: 'Save' | 'Submit' | 'Cancel' | 'Update'
  ): Promise<{ doc: Document; docinfo: DocInfo; messages: ServerMessage[]; localname?: string }> {
    const params = new URLSearchParams({ doc: JSON.stringify(doc), action });
    const body = (await this.request('/api/method/frappe.desk.form.save.savedocs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })) as { docs?: (Document & { localname?: string })[]; docinfo?: DocInfo; _server_messages?: string };

    const saved = body.docs?.[0];
    if (!saved) throw new FrappeApiError('savedocs returned no document', { httpStatus: 500 });

    const { localname, ...savedDoc } = saved;
    return {
      doc: savedDoc,
      docinfo: body.docinfo ?? {},
      messages: parseServerMessages(body._server_messages),
      localname,
    };
  }

  async getList<TRow = Record<string, unknown>>(
    args: GetListArgs
  ): Promise<{ rows: TRow[]; keys: readonly string[]; totalCount: number | null; hasMore: boolean }> {
    const pageLength = args.pageLength ?? 20;
    const start = args.start ?? 0;

    const [listResult, totalCount] = await Promise.all([
      this.call<{ keys?: string[]; values?: unknown[][] }>('frappe.desk.reportview.get', {
        doctype: args.doctype,
        fields: args.fields,
        filters: args.filters,
        order_by: args.orderBy,
        start,
        page_length: pageLength,
      }),
      this.getCount({ doctype: args.doctype, filters: args.filters }),
    ]);

    // compress() early-returns the bare input when the result set is empty, so `keys`/`values`
    // may simply be absent rather than present-but-empty — guard it (verified crash source).
    const isEmptyResult = Array.isArray(listResult);
    const keys = isEmptyResult ? [] : (listResult?.keys ?? []);
    const values = isEmptyResult ? [] : (listResult?.values ?? []);
    const rows = values.map((row) => {
      const record: Record<string, unknown> = {};
      keys.forEach((key, i) => (record[key] = row[i]));
      return record as TRow;
    });

    return {
      rows,
      keys,
      totalCount,
      hasMore: totalCount === null ? rows.length === pageLength : start + rows.length < totalCount,
    };
  }

  async getCount(args: { doctype: string; filters?: GetListArgs['filters']; limit?: number }): Promise<number | null> {
    const result = await this.call<number | null>('frappe.desk.reportview.get_count', {
      doctype: args.doctype,
      filters: args.filters,
    });
    // null means the backend hit its 1-second statement timeout — genuinely unknown, not zero.
    return result ?? null;
  }

  async getMeta(doctype: string): Promise<{ meta: DocTypeMeta; childMetas: Record<string, DocTypeMeta>; docperms: DocPerm[] }> {
    const params = new URLSearchParams({ doctype, with_parent: '1', save_user_settings: '0' });
    const body = (await this.request(`/api/method/frappe.desk.form.load.getdoctype?${params}`)) as {
      docs?: (DocTypeMeta & { permissions?: DocPerm[] })[];
    };
    const [meta, ...children] = body.docs ?? [];
    if (!meta) throw new FrappeApiError(`No meta returned for ${doctype}`, { httpStatus: 404 });

    const childMetas: Record<string, DocTypeMeta> = {};
    for (const child of children) childMetas[child.name] = child;

    return { meta, childMetas, docperms: meta.permissions ?? [] };
  }

  async deleteDoc(doctype: string, name: string): Promise<void> {
    await this.call('frappe.client.delete', { doctype, name });
  }

  async uploadFile(args: UploadFileArgs): Promise<UploadedFile> {
    const form = new FormData();
    form.append('file', args.file, args.file.name);
    form.append('is_private', args.isPrivate ? '1' : '0');
    if (args.doctype) form.append('doctype', args.doctype);
    if (args.docname) form.append('docname', args.docname);
    if (args.fieldname) form.append('fieldname', args.fieldname);
    form.append('folder', args.folder ?? 'Home');

    const body = (await this.request('/api/method/upload_file', {
      method: 'POST',
      body: form,
    })) as { message: UploadedFile };
    return body.message;
  }

  async getLoggedUser(): Promise<string> {
    return this.call<string>('frappe.auth.get_logged_user');
  }

  async searchLink(args: { doctype: string; txt: string; filters?: unknown }): Promise<LinkOption[]> {
    return this.call<LinkOption[]>('frappe.desk.search.search_link', {
      doctype: args.doctype,
      txt: args.txt,
      filters: args.filters,
    });
  }
}

let clientInstance: FrappeClientImpl | null = null;

export function createFrappeClient(baseUrl: string): FrappeClient {
  clientInstance = new FrappeClientImpl(baseUrl);
  return clientInstance;
}

export function getFrappeClient(): FrappeClient {
  if (!clientInstance) {
    throw new Error('FrappeClient not initialized — call createFrappeClient(baseUrl) first.');
  }
  return clientInstance;
}
