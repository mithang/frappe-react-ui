// Permission model (A4) — previously absent entirely. Field sets verified against a live
// container (frappe 17.0.0-dev), not guessed — see src/test/fixtures/frappe/
// getdoctype-with-children-structure.json (DocPerm) and getdoc-existing-response.json
// (ResolvedDocPermissions).

import type { FrappeBool } from './document';

/**
 * A DocType's CONFIGURED permission row (one per role x permlevel), as returned inside a
 * DocType's own `permissions` child table (e.g. via `getMeta().docperms`). This is policy, not
 * "can the current user do X on this document" — that's ResolvedDocPermissions below.
 */
export interface DocPerm {
    role: string;
    permlevel: number;
    read: FrappeBool;
    write: FrappeBool;
    create: FrappeBool;
    delete: FrappeBool;
    submit: FrappeBool;
    cancel: FrappeBool;
    amend: FrappeBool;
    report: FrappeBool;
    export: FrappeBool;
    import: FrappeBool;
    share: FrappeBool;
    print: FrappeBool;
    email: FrappeBool;
    if_owner: FrappeBool;
    select: FrappeBool;
    mask?: FrappeBool;
    impersonate?: FrappeBool;
}

/**
 * The per-document, per-current-user RESOLVED permission set from `getdoc`'s `docinfo.permissions`
 * — a different shape from DocPerm, not a filtered list of it. This is the ONLY per-document
 * permission source; `getMeta().docperms` are the configured rows, not resolved for this user.
 */
export interface ResolvedDocPermissions {
    select: FrappeBool;
    read: FrappeBool;
    write: FrappeBool;
    create: FrappeBool;
    delete: FrappeBool;
    submit: FrappeBool;
    cancel: FrappeBool;
    amend: FrappeBool;
    print: FrappeBool;
    email: FrappeBool;
    report: FrappeBool;
    import: FrappeBool;
    export: FrappeBool;
    share: FrappeBool;
}
