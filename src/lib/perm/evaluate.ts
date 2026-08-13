// Pure permission evaluator (1B, closes A4 — "no permission model, docperms discarded, permlevel
// not even in the types"). Two DIFFERENT permission questions, don't conflate them:
//
//  1. "Can this user do X (read/write/submit/...) on THIS document at all?" — already answered by
//     `docinfo.permissions` (ResolvedDocPermissions) from `getDoc`. Don't recompute that here.
//  2. "Given the user has base document access, can they see/edit a field gated behind a higher
//     permlevel?" — Frappe's field-level permlevel gating, which docinfo.permissions does NOT
//     express (it's a single resolved object, not broken down per permlevel). THIS is what this
//     module computes, from the DocType's configured DocPerm rows + the user's roles.

import type { DocPerm } from '@/core/types';

export interface PermlevelAccess {
  read: boolean;
  write: boolean;
}

/**
 * Whether any of `userRoles` has a DocPerm row for `permlevel` granting read/write. Permlevel 0
 * is governed by the document-level resolved permissions instead (see module doc) — this is for
 * permlevel >= 1 field gating specifically, though it's safe to call for any level.
 */
export function evaluatePermlevelAccess(
  docperms: DocPerm[],
  userRoles: readonly string[],
  permlevel: number
): PermlevelAccess {
  const roleSet = new Set(userRoles);
  const applicable = docperms.filter((p) => p.permlevel === permlevel && roleSet.has(p.role));

  return {
    read: applicable.some((p) => p.read === 1),
    write: applicable.some((p) => p.write === 1),
  };
}

/**
 * A field is effectively read-only if its permlevel's rows grant read but not write for every
 * role the user holds that has read at that level — i.e. write access requires at least one
 * matching role with write:1, not just any role with read:1.
 */
export function isFieldEditable(
  docperms: DocPerm[],
  userRoles: readonly string[],
  fieldPermlevel: number | undefined
): boolean {
  const level = fieldPermlevel ?? 0;
  if (level === 0) return true; // base level — governed by docinfo.permissions, not this module
  return evaluatePermlevelAccess(docperms, userRoles, level).write;
}

export function isFieldVisible(
  docperms: DocPerm[],
  userRoles: readonly string[],
  fieldPermlevel: number | undefined
): boolean {
  const level = fieldPermlevel ?? 0;
  if (level === 0) return true;
  return evaluatePermlevelAccess(docperms, userRoles, level).read;
}
