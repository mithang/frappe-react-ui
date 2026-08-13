import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createFrappeClient } from '@/lib/api/client';
import {
  fetchSystemSettings,
  getCachedSystemSettings,
  DEFAULT_SYSTEM_SETTINGS,
  __resetCachedSystemSettingsForTests,
} from '../settings';

describe('System Settings formatting defaults', () => {
  beforeEach(() => {
    __resetCachedSystemSettingsForTests();
  });

  afterEach(() => {
    __resetCachedSystemSettingsForTests();
    vi.restoreAllMocks();
  });

  it('getCachedSystemSettings returns hardcoded defaults before any fetch resolves', () => {
    expect(getCachedSystemSettings()).toEqual(DEFAULT_SYSTEM_SETTINGS);
  });

  it('fetchSystemSettings calls frappe.client.get_value with the real System Settings fieldnames and updates the cache', async () => {
    const call = vi.fn().mockResolvedValue({
      date_format: 'dd-mm-yyyy',
      number_format: '#.###,##',
      time_format: 'HH:mm',
      float_precision: '4',
      currency_precision: '2',
      first_day_of_the_week: 'Monday',
      time_zone: 'Asia/Kolkata',
    });
    createFrappeClient('https://example.test');
    // @ts-expect-error test double, only `call` is exercised by fetchSystemSettings
    vi.spyOn(await import('@/lib/api/client'), 'getFrappeClient').mockReturnValue({ call });

    const result = await fetchSystemSettings();

    expect(call).toHaveBeenCalledWith('frappe.client.get_value', {
      doctype: 'System Settings',
      fieldname: [
        'date_format',
        'number_format',
        'time_format',
        'float_precision',
        'currency_precision',
        'first_day_of_the_week',
        'time_zone',
      ],
    });
    expect(result.date_format).toBe('dd-mm-yyyy');
    expect(result.number_format).toBe('#.###,##');
    expect(result.float_precision).toBe(4);
    expect(result.currency_precision).toBe(2);
    expect(getCachedSystemSettings()).toEqual(result);
  });

  it('falls back to defaults for missing/blank fields in the response', async () => {
    const call = vi.fn().mockResolvedValue({});
    createFrappeClient('https://example.test');
    vi.spyOn(await import('@/lib/api/client'), 'getFrappeClient').mockReturnValue({
      call,
    } as unknown as ReturnType<typeof import('@/lib/api/client').getFrappeClient>);

    const result = await fetchSystemSettings();

    expect(result.date_format).toBe(DEFAULT_SYSTEM_SETTINGS.date_format);
    expect(result.number_format).toBe(DEFAULT_SYSTEM_SETTINGS.number_format);
    expect(result.currency_precision).toBeNull();
  });
});
