import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchClientScripts } from '../fetchClientScripts';

const callMock = vi.fn();

vi.mock('@/lib/api/client', () => ({
  getFrappeClient: () => ({ call: callMock }),
}));

describe('fetchClientScripts', () => {
  beforeEach(() => {
    callMock.mockReset();
  });

  it('calls frappe.client.get_list with the verified Client Script fieldnames, scoped to the doctype/enabled/Form view', async () => {
    callMock.mockResolvedValue([
      { name: 'CS-1', dt: 'Sales Order', view: 'Form', script: "frappe.ui.form.on('Sales Order', {});", enabled: 1 },
    ]);

    const result = await fetchClientScripts('Sales Order');

    expect(callMock).toHaveBeenCalledWith('frappe.client.get_list', {
      doctype: 'Client Script',
      filters: { dt: 'Sales Order', enabled: 1, view: 'Form' },
      fields: ['name', 'dt', 'view', 'script', 'enabled'],
    });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('CS-1');
  });

  it('returns an empty array when the RPC yields no results', async () => {
    callMock.mockResolvedValue(null);
    const result = await fetchClientScripts('Nonexistent DocType');
    expect(result).toEqual([]);
  });
});
