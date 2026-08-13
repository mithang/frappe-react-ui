// System Settings formatting defaults — sourced via `frappe.client.get_value` since there is no
// boot RPC for this client (`frappe.desk.desktop.get_bootinfo` is not whitelisted — see
// docs/agent-rules/frappe-api.md, "No boot RPC"). Real fieldnames verified against
// frappe/frappe/core/doctype/system_settings/system_settings.json in the reference checkout —
// see the report for the exact JSON quoted. `time_zone` has no fixed `options` list (it's
// populated dynamically server-side from the IANA tz database), so it is fetched but not
// token-validated the way date_format/number_format are.
//
// Formatting must never crash the app: `getCachedSystemSettings()` always returns a usable value
// (hardcoded defaults until the first successful fetch, or forever if the fetch fails).

import { getFrappeClient } from '@/lib/api/client';

export interface SystemSettings {
  date_format: string;
  number_format: string;
  time_format: string;
  float_precision: number | null;
  currency_precision: number | null;
  first_day_of_the_week: string;
  time_zone: string | null;
}

/** Sane, safe fallback used before the first successful fetch, and if the fetch ever fails. */
export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  date_format: 'yyyy-mm-dd',
  number_format: '#,###.##',
  time_format: 'HH:mm:ss',
  float_precision: 3,
  currency_precision: 2,
  first_day_of_the_week: 'Sunday',
  time_zone: null,
};

const SYSTEM_SETTINGS_FIELDNAMES = [
  'date_format',
  'number_format',
  'time_format',
  'float_precision',
  'currency_precision',
  'first_day_of_the_week',
  'time_zone',
] as const;

let cachedSettings: SystemSettings = DEFAULT_SYSTEM_SETTINGS;

function toNullableInt(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function coerceSettings(raw: Record<string, unknown> | null | undefined): SystemSettings {
  if (!raw) return DEFAULT_SYSTEM_SETTINGS;
  return {
    date_format: (raw.date_format as string) || DEFAULT_SYSTEM_SETTINGS.date_format,
    number_format: (raw.number_format as string) || DEFAULT_SYSTEM_SETTINGS.number_format,
    time_format: (raw.time_format as string) || DEFAULT_SYSTEM_SETTINGS.time_format,
    float_precision: toNullableInt(raw.float_precision) ?? DEFAULT_SYSTEM_SETTINGS.float_precision,
    currency_precision: toNullableInt(raw.currency_precision),
    first_day_of_the_week:
      (raw.first_day_of_the_week as string) || DEFAULT_SYSTEM_SETTINGS.first_day_of_the_week,
    time_zone: (raw.time_zone as string) || null,
  };
}

/**
 * Fetches System Settings' formatting-relevant fields. `frappe.client.get_value` with a
 * `fieldname` array returns `{ message: { ...requested fields } }` — `call()` already unwraps
 * the envelope. Never throws for formatting purposes: on any failure the caller (useSystemSettings
 * / the query hook) surfaces the error to React Query as normal, but `getCachedSystemSettings()`
 * still returns a safe default until a fetch actually succeeds.
 */
export async function fetchSystemSettings(): Promise<SystemSettings> {
  const raw = await getFrappeClient().call<Record<string, unknown>>('frappe.client.get_value', {
    doctype: 'System Settings',
    fieldname: SYSTEM_SETTINGS_FIELDNAMES as unknown as string[],
  });
  const settings = coerceSettings(raw);
  cachedSettings = settings;
  return settings;
}

/**
 * Plain, non-hook accessor for the last-resolved System Settings — safe to call from anywhere,
 * including outside React (pure formatters). Returns hardcoded defaults until the first
 * successful `fetchSystemSettings()` call resolves, and keeps returning the last good value if a
 * later fetch fails (it never overwrites `cachedSettings` on error).
 */
export function getCachedSystemSettings(): SystemSettings {
  return cachedSettings;
}

/** Test-only escape hatch to reset module-level cache between tests. */
export function __resetCachedSystemSettingsForTests(): void {
  cachedSettings = DEFAULT_SYSTEM_SETTINGS;
}
