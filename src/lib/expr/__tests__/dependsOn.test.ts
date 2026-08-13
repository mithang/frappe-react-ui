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
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(evaluateDependsOn('eval:doc.nonexistent.deep.path', {})).toBe(true);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('reports each unevaluatable expression only once', () => {
    // These run on every render of every field; logging per-render buried the console in
    // thousands of identical lines.
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const expr = 'eval:someUnknownGlobal.doThing(doc)';
    evaluateDependsOn(expr, {});
    evaluateDependsOn(expr, {});
    evaluateDependsOn(expr, {});
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('checks arrays by length, matching Desk (an empty child table is falsy)', () => {
    expect(evaluateDependsOn('items', { items: [] })).toBe(false);
    expect(evaluateDependsOn('items', { items: [{ item_code: 'X' }] })).toBe(true);
  });

  describe("Frappe's eval globals", () => {
    it('supports in_list — the single most-used helper in real depends_on expressions', () => {
      const expr = 'eval:in_list(["Material Transfer", "Material Receipt"], doc.purpose)';
      expect(evaluateDependsOn(expr, { purpose: 'Material Receipt' })).toBe(true);
      expect(evaluateDependsOn(expr, { purpose: 'Manufacture' })).toBe(false);
    });

    it('supports cint/flt/cstr with Frappe semantics', () => {
      expect(evaluateDependsOn('eval:cint(doc.flag) === 1', { flag: true })).toBe(true);
      expect(evaluateDependsOn('eval:cint(doc.missing) === 0', {})).toBe(true);
      expect(evaluateDependsOn('eval:flt(doc.amount) > 10.5', { amount: '10.75' })).toBe(true);
      expect(evaluateDependsOn('eval:cstr(doc.missing) === ""', {})).toBe(true);
    });

    it('exposes frappe.boot without throwing on the common developer_mode read', () => {
      expect(evaluateDependsOn('eval:!frappe.boot.developer_mode', {})).toBe(true);
    });

    it('binds parent for child-row expressions', () => {
      expect(
        evaluateDependsOn('eval:parent.company === "ACME"', { qty: 1 }, { company: 'ACME' })
      ).toBe(true);
    });
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
