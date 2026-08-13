import { describe, it, expect } from 'vitest';
import { evaluatePermlevelAccess, isFieldEditable, isFieldVisible } from '../evaluate';
import type { DocPerm } from '@/core/types';

function perm(overrides: Partial<DocPerm>): DocPerm {
  return {
    role: 'Sales User',
    permlevel: 0,
    read: 0,
    write: 0,
    create: 0,
    delete: 0,
    submit: 0,
    cancel: 0,
    amend: 0,
    report: 0,
    export: 0,
    import: 0,
    share: 0,
    print: 0,
    email: 0,
    if_owner: 0,
    select: 0,
    ...overrides,
  };
}

describe('evaluatePermlevelAccess', () => {
  const docperms: DocPerm[] = [
    perm({ role: 'Sales User', permlevel: 1, read: 1, write: 0 }),
    perm({ role: 'Sales Manager', permlevel: 1, read: 1, write: 1 }),
    perm({ role: 'Accounts User', permlevel: 2, read: 1, write: 1 }),
  ];

  it('grants read but not write to a role with read-only access at that permlevel', () => {
    const access = evaluatePermlevelAccess(docperms, ['Sales User'], 1);
    expect(access).toEqual({ read: true, write: false });
  });

  it('grants write when the role has write:1 at that permlevel', () => {
    const access = evaluatePermlevelAccess(docperms, ['Sales Manager'], 1);
    expect(access).toEqual({ read: true, write: true });
  });

  it('grants write if ANY held role grants it, even if others do not', () => {
    const access = evaluatePermlevelAccess(docperms, ['Sales User', 'Sales Manager'], 1);
    expect(access).toEqual({ read: true, write: true });
  });

  it('denies both when the user holds no role with a row at that permlevel', () => {
    const access = evaluatePermlevelAccess(docperms, ['Accounts User'], 1);
    expect(access).toEqual({ read: false, write: false });
  });
});

describe('isFieldEditable / isFieldVisible', () => {
  const docperms: DocPerm[] = [perm({ role: 'Accounts User', permlevel: 1, read: 1, write: 0 })];

  it('permlevel 0 (or undefined) is always visible/editable here — governed by docinfo.permissions instead', () => {
    expect(isFieldVisible(docperms, [], 0)).toBe(true);
    expect(isFieldEditable(docperms, [], undefined)).toBe(true);
  });

  it('a field at permlevel 1 is visible but not editable for a read-only role', () => {
    expect(isFieldVisible(docperms, ['Accounts User'], 1)).toBe(true);
    expect(isFieldEditable(docperms, ['Accounts User'], 1)).toBe(false);
  });

  it('a field at permlevel 1 is neither visible nor editable for a role with no row there', () => {
    expect(isFieldVisible(docperms, ['Sales User'], 1)).toBe(false);
    expect(isFieldEditable(docperms, ['Sales User'], 1)).toBe(false);
  });
});
