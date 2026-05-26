// Real ERPNext/Frappe API integration

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
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    });

    if (!response.ok) {
      // Check for auth errors
      if (response.status === 401 || response.status === 403) {
        // Clear session on auth failure
        this.clearSession();
        throw new Error('Session expired. Please login again.');
      }
      const errorText = await response.text();
      let errorMessage = `HTTP ${response.status}`;

      try {
        const errorJson = JSON.parse(errorText);

        // Handle _server_messages (Frappe's typical error wrapper)
        if (errorJson._server_messages) {
          try {
            const messages = JSON.parse(errorJson._server_messages);
            const combinedMessage = messages
              .map((m: any) => JSON.parse(m).message)
              .join('\n');
            if (combinedMessage) errorMessage = combinedMessage;
          } catch {
            // Fallback if message parsing fails
          }
        }

        // Handle standard exception messages
        if (!errorMessage.includes(errorJson.exception) && errorJson.exception) {
          errorMessage = errorJson.exception;
        }
      } catch {
        // Not JSON or parsing failed, use raw text if short, else generic
        if (errorText.length < 200) errorMessage += `: ${errorText}`;
      }

      throw new Error(errorMessage);
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
    } catch (error) {
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

// Default ERPNext instance (users can configure this)
export const DEFAULT_ERPNEXT_URL = 'https://demo.erpnext.com';

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