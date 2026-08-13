import { describe, it, expect, vi } from 'vitest';
import { evaluateDependsOn, evaluateFieldVisibility } from '../dependsOn';

describe('evaluateDependsOn', () => {
  it('returns true when there is no expression', () => {
    expect(evaluateDependsOn(undefined, {})).toBe(true);
    expect(evaluateDependsOn('', {})).toBe(true);
  });

  it('treats a bare fieldname as a truthy check', () => {
    expect(evaluateDependsOn('customer', { customer: 'CUST-0001' })).toBe(true);
    expect(evaluateDependsOn('customer', { customer: '' })).toBe(false);
    expect(evaluateDependsOn('customer', {})).toBe(false);
  });

  it('evaluates an eval: expression against doc', () => {
    expect(evaluateDependsOn('eval:doc.status=="Open"', { status: 'Open' })).toBe(true);
    expect(evaluateDependsOn('eval:doc.status=="Open"', { status: 'Closed' })).toBe(false);
    expect(evaluateDependsOn('eval:doc.qty > 10', { qty: 15 })).toBe(true);
    expect(evaluateDependsOn('eval:doc.qty > 10', { qty: 5 })).toBe(false);
  });

  it('evaluates against the ROW passed in, not some other scope (A2 fix)', () => {
    const parentDoc = { customer: 'PARENT-CUST' };
    const childRow = { customer: 'ROW-CUST' };
    expect(evaluateDependsOn('eval:doc.customer=="ROW-CUST"', childRow)).toBe(true);
    expect(evaluateDependsOn('eval:doc.customer=="ROW-CUST"', parentDoc)).toBe(false);
  });

  it('fails open (returns true) and logs when the expression throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(evaluateDependsOn('eval:doc.nonexistent.deep.path', {})).toBe(true);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('evaluateFieldVisibility', () => {
  it('combines hidden/depends_on into a single hidden flag', () => {
    expect(evaluateFieldVisibility({ depends_on: 'customer' }, { customer: 'X' }).hidden).toBe(false);
    expect(evaluateFieldVisibility({ depends_on: 'customer' }, {}).hidden).toBe(true);
    expect(evaluateFieldVisibility({ hidden: true }, { customer: 'X' }).hidden).toBe(true);
  });

  it('mandatory_depends_on overrides the static reqd flag when present', () => {
    const field = { reqd: false, mandatory_depends_on: 'eval:doc.docstatus==0' };
    expect(evaluateFieldVisibility(field, { docstatus: 0 }).reqd).toBe(true);
    expect(evaluateFieldVisibility(field, { docstatus: 1 }).reqd).toBe(false);
  });

  it('falls back to the static reqd/read_only when no depends_on expression exists', () => {
    expect(evaluateFieldVisibility({ reqd: true }, {}).reqd).toBe(true);
    expect(evaluateFieldVisibility({ read_only: true }, {}).readOnly).toBe(true);
  });
});
