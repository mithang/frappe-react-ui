// DEPRECATED — this is a strangler shim, not the place to add new functionality.
//
// New code should use `getFrappeClient()` / `createFrappeClient()` from `@/lib/api/client`
// (the frozen FrappeClient contract) plus the TanStack Query hooks in `@/lib/query/*`, which
// have correct `getdoc`/`savedocs`/`reportview.get` shapes — see docs/agent-rules/frappe-api.md.
//
// This file exists only so the 13 existing call sites (`getFrappeApp().call(...)`, `.getDoc(...)`,
// etc.) keep compiling and working while each is migrated individually — a big-bang rewrite here
// would force every consumer to change at once. What it DOES fix, transport-wide, without
// changing any method's signature or return shape: the missing `X-Frappe-CSRF-Token` header (C2)
// and proper `_server_messages`/`exc_type` error parsing. Migrate a call site by switching it to
// `@/lib/api/client` + `@/lib/query/*` and deleting its `@/lib/frappe` import — once nothing
// imports this file, delete it.

import { buildApiError } from './api/errors';
import { withCsrfHeader } from './api/csrf';

export interface FrappeConfig {
  url: string;
  token?: string;
}

// Storage keys
const STORAGE_KEY_URL = 'frappe_canvas_erpnext_url';
const STORAGE_KEY_SESSION = 'frappe_canvas_session';

class FrappeAPI {
  private config: FrappeConfig;
  private baseUrl: string;

  constructor(config: FrappeConfig) {
    this.config = config;
    this.baseUrl = config.url.replace(/\/$/, ''); // Remove trailing slash
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  setBaseUrl(url: string): void {
    this.baseUrl = url.replace(/\/$/, '');
    this.config.url = this.baseUrl;
    // Persist URL to localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_URL, this.baseUrl);
    }
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;

    const defaultHeaders: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    // Add auth headers if we have a token
    if (this.config.token) {
      defaultHeaders['Authorization'] = `Bearer ${this.config.token}`;
    }

    const response = await fetch(url, {
      ...options,
      credentials: 'include', // Important for session-based auth
      headers: withCsrfHeader({
        ...defaultHeaders,
        ...options.headers,
      }),
    });

    if (!response.ok) {
      const error = await buildApiError(response);
      if (error.isAuthFailure) {
        this.clearSession();
      }
      throw error;
    }

    const data = await response.json();
    return data;
  }

  async call(method: string, args: any = {}): Promise<any> {
    return this.makeRequest('/api/method/' + method, {
      method: 'POST',
      body: JSON.stringify(args),
    });
  }

  async login(username: string, password: string): Promise<boolean> {
    try {
      const response = await this.makeRequest('/api/method/login', {
        method: 'POST',
        body: JSON.stringify({
          usr: username,
          pwd: password,
        }),
      });

      if (response.message === 'Logged In') {
        // Store session info
        this.saveSession(username);
        return true;
      }
      throw new Error('Login failed');
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async logout(): Promise<void> {
    try {
      await this.makeRequest('/api/method/logout', {
        method: 'POST',
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Always clear local session
      this.clearSession();
    }
  }

  async getCurrentUser(): Promise<any> {
    try {
      const response = await this.call('frappe.auth.get_logged_user');
      return response.message;
    } catch {
      return null;
    }
  }

  async getDoc(doctype: string, name: string): Promise<any> {
    return this.makeRequest(`/api/resource/${doctype}/${name}`);
  }

  async getDocList(doctype: string, options: any = {}): Promise<any[]> {
    const params = new URLSearchParams();

    if (options.fields) {
      params.append('fields', JSON.stringify(options.fields));
    }
    if (options.filters) {
      params.append('filters', JSON.stringify(options.filters));
    }
    if (options.limit_start) {
      params.append('limit_start', options.limit_start.toString());
    }
    if (options.limit_page_length) {
      params.append('limit_page_length', options.limit_page_length.toString());
    }
    if (options.order_by) {
      params.append('order_by', options.order_by);
    }

    const queryString = params.toString();
    const endpoint = `/api/resource/${doctype}${queryString ? '?' + queryString : ''}`;

    const response = await this.makeRequest(endpoint);
    return response.data || [];
  }

  async getMeta(doctype: string): Promise<any> {
    // Use the correct ERPNext API for getting doctype metadata
    const response = await this.call('frappe.desk.form.load.getdoctype', {
      doctype: doctype
    });
    return response;
  }

  async createDoc(doctype: string, doc: any): Promise<any> {
    return this.makeRequest(`/api/resource/${doctype}`, {
      method: 'POST',
      body: JSON.stringify(doc),
    });
  }

  async updateDoc(doctype: string, name: string, doc: any): Promise<any> {
    return this.makeRequest(`/api/resource/${doctype}/${name}`, {
      method: 'PUT',
      body: JSON.stringify(doc),
    });
  }

  async deleteDoc(doctype: string, name: string): Promise<void> {
    await this.makeRequest(`/api/resource/${doctype}/${name}`, {
      method: 'DELETE',
    });
  }

  // Session management
  private saveSession(username: string): void {
    if (typeof window !== 'undefined') {
      const session = {
        username,
        url: this.baseUrl,
        timestamp: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(session));
    }
  }

  private clearSession(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_SESSION);
    }
  }

  hasStoredSession(): boolean {
    if (typeof window === 'undefined') return false;
    const session = localStorage.getItem(STORAGE_KEY_SESSION);
    if (!session) return false;

    try {
      const parsed = JSON.parse(session);
      // Session expires after 24 hours
      const isExpired = Date.now() - parsed.timestamp > 24 * 60 * 60 * 1000;
      return !isExpired;
    } catch {
      return false;
    }
  }

  getStoredSession(): { username: string; url: string } | null {
    if (typeof window === 'undefined') return null;
    const session = localStorage.getItem(STORAGE_KEY_SESSION);
    if (!session) return null;

    try {
      return JSON.parse(session);
    } catch {
      return null;
    }
  }
}

// NOTE: previously defaulted to 'https://demo.erpnext.com' — deleted deliberately (see the
// plan's Auth & transport section). A misconfigured build with no stored URL now fails closed
// (the login form requires the user to type one) instead of silently posting credentials to a
// public demo server.
export const DEFAULT_ERPNEXT_URL = '';

// Get stored URL or use default
function getStoredUrl(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(STORAGE_KEY_URL) || DEFAULT_ERPNEXT_URL;
  }
  return DEFAULT_ERPNEXT_URL;
}

// Initialize Frappe app instance
export let frappeAPI: FrappeAPI | null = null;

export const initializeFrappe = (url?: string) => {
  const targetUrl = url || getStoredUrl();
  frappeAPI = new FrappeAPI({ url: targetUrl });

  // Store the URL for later use
  if (typeof window !== 'undefined' && url) {
    localStorage.setItem(STORAGE_KEY_URL, targetUrl);
  }

  return frappeAPI;
};

export const getFrappeApp = () => {
  if (!frappeAPI) {
    frappeAPI = initializeFrappe();
  }
  return frappeAPI;
};

// Export storage key for external use
export { STORAGE_KEY_URL, STORAGE_KEY_SESSION };
