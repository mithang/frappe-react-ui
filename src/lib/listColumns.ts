// Resolves which columns a list view shows, mirroring Desk's own order
// (frappe/public/js/frappe/list/list_view.js#setup_columns):
//   title_field (or `name`) first, then every in_list_view docfield.
//
// "List View Settings" participates in two distinct ways, which is easy to conflate:
//   1. WHICH fields — saving list settings writes `in_list_view` Property Setters on the DocType
//      (set_listview_fields in list_view_settings.py), so the meta this client already fetches
//      ALREADY reflects the user's saved choice. No extra call needed for selection.
//   2. Their ORDER — held only in the settings doc's own `fields` JSON
//      ([{fieldname, label}, ...]), which is why we fetch it and reorder by it.

import type { DocTypeMeta, DocField } from '@/core/types';

/** Fieldtypes that hold no displayable scalar value. Desk filters these via is_value_type(). */
const NON_VALUE_FIELDTYPES = new Set<DocField['fieldtype']>([
  'Section Break',
  'Column Break',
  'Tab Break',
  'HTML',
  'Button',
  'Heading',
  'Table',
  'Table MultiSelect',
  'Image',
  'Signature',
  'Geolocation',
]);

export interface ListViewSettings {
  /** JSON string of [{fieldname, label}] — ordering only; selection lives in in_list_view. */
  fields?: string;
  disable_count?: 0 | 1;
  disable_comment_count?: 0 | 1;
  disable_sidebar_stats?: 0 | 1;
}

/** Parses the settings doc's `fields` JSON into an ordered fieldname list. */
export function parseSettingsFieldOrder(settings: ListViewSettings | null | undefined): string[] {
  if (!settings?.fields) return [];
  try {
    const parsed = JSON.parse(settings.fields);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((f) => (typeof f === 'string' ? f : (f as { fieldname?: string })?.fieldname))
      .filter((f): f is string => typeof f === 'string' && f.length > 0);
  } catch {
    return [];
  }
}

/**
 * The ordered fieldnames to render as columns, excluding `name` — SmartList renders that itself
 * as the always-present leading column, the way Desk's "Subject" column works.
 */
export function resolveListColumns(
  meta: DocTypeMeta | null,
  settings?: ListViewSettings | null
): string[] {
  if (!meta?.fields) return [];

  const byFieldname = new Map(meta.fields.map((f) => [f.fieldname, f]));
  const isUsable = (fieldname: string): boolean => {
    const df = byFieldname.get(fieldname);
    return !!df && !df.hidden && !NON_VALUE_FIELDTYPES.has(df.fieldtype);
  };

  const ordered: string[] = [];
  const push = (fieldname: string | undefined) => {
    if (!fieldname || fieldname === 'name' || ordered.includes(fieldname)) return;
    if (!isUsable(fieldname)) return;
    ordered.push(fieldname);
  };

  // Desk shows the title field as the subject column; keep it leftmost so rows are identifiable
  // by something human-readable rather than only by the ID column.
  push(meta.title_field);

  // Explicit order from List View Settings wins for the fields it names.
  for (const fieldname of parseSettingsFieldOrder(settings)) push(fieldname);

  // Then everything flagged in_list_view (which already reflects saved list settings).
  for (const df of meta.fields) {
    if (df.in_list_view) push(df.fieldname);
  }

  // A doctype with no in_list_view flags at all would otherwise render an ID-only table.
  if (ordered.length === 0) {
    for (const fieldname of ['status', 'modified']) push(fieldname);
  }

  return ordered;
}
