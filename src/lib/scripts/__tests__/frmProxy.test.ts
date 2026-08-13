import { describe, it, expect } from 'vitest';
import { createFormStore, type FormState } from '@/store/formStore';
import type { StoreApi } from 'zustand';
import { FormControllerImpl } from '@/controllers/FormController';
import { createFrmProxy } from '../frmProxy';
import type { DocTypeMeta, Document } from '@/core/types';
import type { FrappeClient } from '@/lib/api/client';

function makeController(
  doctype: string,
  doc: Document,
  fields: DocTypeMeta['fields'] = []
): { controller: FormControllerImpl; store: StoreApi<FormState> } {
  const meta: DocTypeMeta = { name: doctype, module: 'Test', fields };
  const store = createFormStore(doc);
  return { controller: new FormControllerImpl(store, meta, false, {} as FrappeClient), store };
}

describe('createFrmProxy', () => {
  it('frm.doc reflects live state across separate set_value calls, not a stale snapshot', async () => {
    const { controller } = makeController('Test DocType', { name: 'X', doctype: 'Test DocType', qty: 1 });
    const frm = createFrmProxy(controller, 'live-test');

    expect(frm.doc.qty).toBe(1);

    await frm.set_value('qty', 2);
    expect(frm.doc.qty).toBe(2);

    await frm.set_value('qty', 3);
    expect(frm.doc.qty).toBe(3);
  });

  it('get_value/set_value delegate directly to the controller', async () => {
    const { controller } = makeController('Test DocType', { name: 'X', doctype: 'Test DocType', status: 'Draft' });
    const frm = createFrmProxy(controller, 'delegate-test');

    expect(frm.get_value('status')).toBe('Draft');
    await frm.set_value('status', 'Approved');
    expect(controller.get_value('status')).toBe('Approved');
    expect(frm.get_value('status')).toBe('Approved');
  });

  it('set_query writes link_filters into the store override via set_df_property (the reserved DocField seam)', () => {
    const { controller, store } = makeController('Test DocType', { name: 'X', doctype: 'Test DocType' });
    const frm = createFrmProxy(controller, 'query-test');

    const filterFn = () => ({ status: 'Active' });
    frm.set_query('customer', filterFn);

    expect(store.getState().overrides.get('customer')?.link_filters).toBe(filterFn);
  });

  it('toggle_display/toggle_reqd/toggle_read_only write through set_df_property overrides', () => {
    const { controller, store } = makeController('Test DocType', { name: 'X', doctype: 'Test DocType' });
    const frm = createFrmProxy(controller, 'toggle-test');

    frm.toggle_display('secret_field', false);
    frm.toggle_reqd('secret_field', true);
    frm.toggle_read_only('secret_field', true);

    const override = store.getState().overrides.get('secret_field');
    expect(override?.hidden).toBe(true); // toggle_display(false) => hidden: true
    expect(override?.reqd).toBe(true);
    expect(override?.read_only).toBe(true);
  });

  it('refresh_field is a callable no-op, never throws', () => {
    const { controller } = makeController('Test DocType', { name: 'X', doctype: 'Test DocType' });
    const frm = createFrmProxy(controller, 'noop-test');
    expect(() => frm.refresh_field('anything')).not.toThrow();
  });

  it('add_child never fabricates a name and stamps standard child-row fields', () => {
    const fields: DocTypeMeta['fields'] = [{ fieldname: 'items', fieldtype: 'Table', options: 'Test Child' }];
    const { controller } = makeController('Test Parent', { name: 'P-1', doctype: 'Test Parent', items: [] }, fields);
    const frm = createFrmProxy(controller, 'child-test');

    const row = frm.add_child('items', { item_code: 'ABC', name: 'FAKE-NAME-SHOULD-BE-DROPPED' });

    expect(row.name).toBeUndefined();
    expect(row.__islocal).toBe(1);
    expect(row.doctype).toBe('Test Child');
    expect(row.parent).toBe('P-1');
    expect(row.parentfield).toBe('items');
    expect(row.parenttype).toBe('Test Parent');
    expect(row.item_code).toBe('ABC');

    const items = frm.doc.items as Record<string, unknown>[];
    expect(items).toHaveLength(1);
    expect(items[0]).toBe(row);
  });

  it('clear_table empties the table field', () => {
    const fields: DocTypeMeta['fields'] = [{ fieldname: 'items', fieldtype: 'Table', options: 'Test Child' }];
    const { controller } = makeController(
      'Test Parent',
      { name: 'P-1', doctype: 'Test Parent', items: [{ item_code: 'ABC' }] },
      fields
    );
    const frm = createFrmProxy(controller, 'clear-test');

    frm.clear_table('items');
    expect(frm.doc.items).toEqual([]);
  });

  it('throws a clear, attributed error when an unsupported member is accessed', () => {
    const { controller } = makeController('Test DocType', { name: 'X', doctype: 'Test DocType' });
    const frm = createFrmProxy(controller, 'my-script') as unknown as Record<string, () => void>;

    expect(() => frm.some_unknown_method()).toThrow(/my-script/);
    expect(() => frm.some_unknown_method()).toThrow(/some_unknown_method/);
  });

  it('throws a clear, attributed error on direct assignment to an frm property', () => {
    const { controller } = makeController('Test DocType', { name: 'X', doctype: 'Test DocType' });
    const frm = createFrmProxy(controller, 'assign-script') as unknown as Record<string, unknown>;

    expect(() => {
      frm.some_field = 'value';
    }).toThrow(/assign-script/);
  });
});
