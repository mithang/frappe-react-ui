import type { HttpHandler } from 'msw';

/**
 * Default MSW handlers shared across unit tests. Empty by design — each
 * workstream's tests add the endpoints they need via `server.use(...)`
 * rather than growing a single global fixture file.
 */
export const handlers: HttpHandler[] = [];
