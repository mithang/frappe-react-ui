// Data export (list view → CSV/Excel), driven by the real frappe.desk.reportview.export_query
// RPC — verified live: it returns raw file bytes (Content-Disposition: attachment), not a JSON
// envelope, for both CSV and Excel (the response Content-Type is application/octet-stream even
// for CSV — don't branch on that). Desk's own JS builds a hidden <form> POST to a deprecated
// cmd= endpoint; calling /api/method/frappe.desk.reportview.export_query directly works
// identically without the deprecation warning.

import type { DocField, DocTypeMeta } from '@/core/types';
import { getFrappeClient } from '@/lib/api/client';

const NON_EXPORTABLE_FIELDTYPES = new Set<DocField['fieldtype']>([
  'Section Break',
  'Column Break',
  'Tab Break',
  'HTML',
  'Button',
  'Heading',
  'Table',
  'Table MultiSelect',
]);

/** Real, value-holding fields for this doctype — excludes layout chrome and child tables (a
 *  single flat export/template can't represent child-table rows without a separate convention
 *  Desk itself uses multi-row CSV blocks for; not built here). */
export function getExportableFieldnames(meta: DocTypeMeta): string[] {
  return meta.fields.filter((f) => !NON_EXPORTABLE_FIELDTYPES.has(f.fieldtype) && !f.hidden).map((f) => f.fieldname);
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export interface ExportListArgs {
  doctype: string;
  meta: DocTypeMeta;
  fileFormatType: 'CSV' | 'Excel';
  /** Export just these records (e.g. the user's current selection) instead of the whole list. */
  selectedNames?: string[];
}

export async function exportList({ doctype, meta, fileFormatType, selectedNames }: ExportListArgs): Promise<void> {
  const client = getFrappeClient();
  const fieldnames = ['name', ...getExportableFieldnames(meta).filter((f) => f !== 'name')];
  const fields = fieldnames.map((fieldname) => `\`tab${doctype}\`.\`${fieldname}\``);

  const { blob, filename } = await client.downloadFile('frappe.desk.reportview.export_query', {
    doctype,
    fields,
    file_format_type: fileFormatType,
    title: doctype,
    ...(selectedNames?.length ? { selected_items: selectedNames } : {}),
  });

  triggerBlobDownload(blob, filename);
}
