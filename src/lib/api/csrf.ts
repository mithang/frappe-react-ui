// CSRF token plumbing. There is no `window.csrf_token` to read in a standalone SPA — see
// docs/agent-rules/frappe-api.md. The bench's `allowed_referrers` allowlist is the real bypass
// mechanism; this module exists so a token CAN be sent when one is available (a future
// same-origin embed, or a value obtained out-of-band), not because this deployment currently has
// a way to fetch one itself.

let currentToken: string | null = null;

export function setCsrfToken(token: string | null): void {
  currentToken = token;
}

export function getCsrfToken(): string | null {
  return currentToken;
}

/** Merges the CSRF header into a headers object only when a token has actually been set. */
export function withCsrfHeader(headers: HeadersInit = {}): HeadersInit {
  if (!currentToken) return headers;
  return { ...headers, 'X-Frappe-CSRF-Token': currentToken };
}
