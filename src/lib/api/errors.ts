// Error taxonomy for the Frappe API client (1A). Verified against a live container — see
// src/test/fixtures/frappe/csrf-error.json and docs/agent-rules/frappe-api.md.

export interface ServerMessage {
  message: string;
  title?: string;
  indicator?: 'red' | 'green' | 'orange' | 'blue' | string;
  raise_exception?: 0 | 1;
  as_table?: boolean;
  __frappe_exc_id?: string;
  [key: string]: unknown;
}

/**
 * `_server_messages` is double-JSON-encoded: a JSON array of JSON-encoded objects. Present on
 * BOTH success (e.g. the "Saved" alert) and error paths — presence alone is not an error signal.
 * Malformed entries are skipped rather than throwing, since a parse failure here must never mask
 * the real response.
 */
export function parseServerMessages(raw: unknown): ServerMessage[] {
  if (typeof raw !== 'string' || !raw) return [];
  let outer: unknown[];
  try {
    outer = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(outer)) return [];

  const messages: ServerMessage[] = [];
  for (const entry of outer) {
    if (typeof entry === 'string') {
      try {
        const parsed = JSON.parse(entry);
        if (parsed && typeof parsed === 'object') messages.push(parsed as ServerMessage);
      } catch {
        // skip malformed entry
      }
    } else if (entry && typeof entry === 'object') {
      messages.push(entry as ServerMessage);
    }
  }
  return messages;
}

export class FrappeApiError extends Error {
  /** e.g. 'CSRFTokenError' | 'PermissionError' | 'TimestampMismatchError' | 'LinkValidationError'.
   *  Only present on API v1 (/api/method/*) — don't expect it on v2 REST paths. */
  excType?: string;
  messages: ServerMessage[];
  httpStatus: number;

  constructor(message: string, opts: { excType?: string; messages?: ServerMessage[]; httpStatus: number }) {
    super(message);
    this.name = 'FrappeApiError';
    this.excType = opts.excType;
    this.messages = opts.messages ?? [];
    this.httpStatus = opts.httpStatus;
  }

  /** True for the 401/403 shape that means "not logged in", not a permission-on-this-doc error. */
  get isAuthFailure(): boolean {
    return this.httpStatus === 401 || this.httpStatus === 403;
  }
}

/** Builds a FrappeApiError from a non-OK fetch Response, parsing both message layers. */
export async function buildApiError(response: Response): Promise<FrappeApiError> {
  const httpStatus = response.status;
  let body: Record<string, unknown> = {};
  try {
    body = await response.json();
  } catch {
    // non-JSON error body (e.g. a proxy error page) — fall through with an empty body
  }

  const messages = parseServerMessages(body._server_messages);
  const excType = typeof body.exc_type === 'string' ? body.exc_type : undefined;

  const primary =
    messages.find((m) => m.message)?.message ??
    (typeof body.exception === 'string' ? body.exception : undefined) ??
    `HTTP ${httpStatus}`;

  return new FrappeApiError(primary, { excType, messages, httpStatus });
}
