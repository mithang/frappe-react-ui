import { describe, it, expect } from 'vitest';
import { createFormStore } from '../formStore';
import type { Document } from '@/core/types';

const baseDoc: Document = { name: 'SO-0001', doctype: 'Sales Order', customer: 'CUST-0001' };

describe('formStore (1B) — the C1 fix', () => {
  it('setValue marks dirty but does NOT clear errors or overrides', () => {
    const store = createFormStore(baseDoc);
    store.getState().setError('customer', 'Customer is required');
    store.getState().setOverride('customer', 'read_only', true);

    store.getState().setValue('delivery_date', '2026-01-01');

    const state = store.getState();
    expect(state.isDirty).toBe(true);
    expect(state.errors.customer).toBe('Customer is required');
    expect(state.overrides.get('customer')).toEqual({ read_only: true });
  });

  it('setValue does not mutate the original document object', () => {
    const store = createFormStore(baseDoc);
    store.getState().setValue('customer', 'CUST-0002');
    expect(baseDoc.customer).toBe('CUST-0001');
    expect(store.getState().draft.customer).toBe('CUST-0002');
  });

  it('resetTo is the ONLY thing that clears dirty/errors/overrides', () => {
    const store = createFormStore(baseDoc);
    store.getState().setValue('customer', 'CUST-0002');
    store.getState().setError('customer', 'bad value');
    store.getState().setOverride('customer', 'hidden', true);

    store.getState().resetTo({ ...baseDoc, customer: 'CUST-0003' });

    const state = store.getState();
    expect(state.isDirty).toBe(false);
    expect(state.errors).toEqual({});
    expect(state.overrides.size).toBe(0);
    expect(state.draft.customer).toBe('CUST-0003');
  });

  it('setError(fieldname, null) clears just that one field error', () => {
    const store = createFormStore(baseDoc);
    store.getState().setError('customer', 'required');
    store.getState().setError('delivery_date', 'invalid');

    store.getState().setError('customer', null);

    expect(store.getState().errors).toEqual({ delivery_date: 'invalid' });
  });

  it('two form stores are fully independent (fixes A1 — no shared global doc)', () => {
    const storeA = createFormStore({ ...baseDoc, name: 'SO-0001' });
    const storeB = createFormStore({ ...baseDoc, name: 'SO-0002' });

    storeA.getState().setValue('customer', 'CUST-A');
    storeB.getState().setValue('customer', 'CUST-B');

    expect(storeA.getState().draft.customer).toBe('CUST-A');
    expect(storeB.getState().draft.customer).toBe('CUST-B');
    expect(storeA.getState().isDirty).toBe(true);
    expect(storeB.getState().isDirty).toBe(true);

    // Resetting one must not affect the other.
    storeA.getState().resetTo(baseDoc);
    expect(storeA.getState().isDirty).toBe(false);
    expect(storeB.getState().isDirty).toBe(true);
    expect(storeB.getState().draft.customer).toBe('CUST-B');
  });
});
