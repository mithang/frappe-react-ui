// Data Import orchestration — every RPC name/shape below was verified against the real Frappe
// source (frappe/core/doctype/data_import/{data_import,importer,exporter}.py) AND exercised live
// against a running container (upload → create → preview → run → status/logs, including a
// blocked-by-warnings case), not guessed. See the module-level whitelisted wrappers in
// data_import.py:188-312 — they take the Data Import docname directly rather than Desk's
// dt/dn/method dispatch convention, which is why this client calls them as plain `client.call()`s
// instead of needing a `run_doc_method` shim.

import { getFrappeClient } from '@/lib/api/client';
import type { Document } from '@/core/types';

export type DataImportType = 'Insert New Records' | 'Update Existing Records' | 'Insert or Update Records';

export interface ImportWarning {
  row?: number;
  col?: number;
  /** May contain raw HTML (e.g. "<strong>...</strong>") — render with care, don't double-escape. */
  message: string;
  type?: string;
  field?: { fieldname: string; fieldtype: string; label: string; options?: string | null };
}

export interface ImportPreviewColumn {
  header_title: string;
  skip_import: boolean;
  index?: number;
  column_number?: number;
  map_to_field?: string | null;
  date_format?: string | null;
  df?: {
    fieldtype: string;
    fieldname: string;
    label: string;
    options?: string | null;
    reqd?: 0 | 1;
    default?: unknown;
    read_only?: 0 | 1;
  } | null;
  warnings?: ImportWarning[];
}

export interface ImportPreview {
  data: unknown[][];
  columns: ImportPreviewColumn[];
  warnings: ImportWarning[];
  total_number_of_rows: number;
  max_rows_exceeded?: boolean;
  max_rows_in_preview?: number;
}

export interface ImportStatus {
  status: 'Pending' | 'In Progress' | 'Success' | 'Partial Success' | 'Error' | 'Timed Out';
  total_records?: number;
  success?: number;
  failed?: number;
  inserted?: number;
  updated?: number;
}

export interface ImportLogRow {
  success: 0 | 1;
  docname: string | null;
  /** Double-JSON-encoded on the wire — already parsed to a plain array here. */
  messages: unknown[];
  exception: string | null;
  row_indexes: number[];
  import_action: 'Insert' | 'Update' | '' | null;
}

/** Uploads the raw import file and returns its file_url — the string the Data Import doc's
 *  `import_file` Attach field expects (not the File doctype's own `name`). */
export async function uploadImportFile(file: File): Promise<string> {
  const client = getFrappeClient();
  const uploaded = await client.uploadFile({ file, isPrivate: true, folder: 'Home' });
  return uploaded.file_url;
}

export async function createDataImport(args: {
  referenceDoctype: string;
  importType: DataImportType;
  fileUrl: string;
}): Promise<Document> {
  const client = getFrappeClient();
  const { doc } = await client.saveDoc(
    {
      doctype: 'Data Import',
      name: '',
      __islocal: 1,
      reference_doctype: args.referenceDoctype,
      import_type: args.importType,
      import_file: args.fileUrl,
      mute_emails: 1,
    },
    'Save'
  );
  return doc;
}

export async function getImportPreview(dataImportName: string): Promise<ImportPreview> {
  const client = getFrappeClient();
  return client.call<ImportPreview>('frappe.core.doctype.data_import.data_import.get_preview_from_template', {
    data_import: dataImportName,
  });
}

/** Kicks off (or resumes watching) the import job. The boolean return only says whether a job
 *  run was newly (re)started — it is NOT a success/failure signal for the import itself; always
 *  follow up with getImportStatus/getImportLogs. In production (developer_mode off) this runs as
 *  a genuine background job — don't assume completion just because this call returned. */
export async function startImport(dataImportName: string): Promise<boolean> {
  const client = getFrappeClient();
  return client.call<boolean>('frappe.core.doctype.data_import.data_import.form_start_import', {
    data_import: dataImportName,
  });
}

export async function getImportStatus(dataImportName: string): Promise<ImportStatus> {
  const client = getFrappeClient();
  return client.call<ImportStatus>('frappe.core.doctype.data_import.data_import.get_import_status', {
    data_import_name: dataImportName,
  });
}

/** `messages` and `row_indexes` are each individually JSON-encoded strings on the wire (and
 *  `messages` is double-encoded — a JSON string whose content is itself JSON) — parsed here so
 *  callers get plain arrays. A malformed entry decodes to `[]` rather than throwing. */
export async function getImportLogs(dataImportName: string): Promise<ImportLogRow[]> {
  const client = getFrappeClient();
  const rows = await client.call<Record<string, unknown>[]>(
    'frappe.core.doctype.data_import.data_import.get_import_logs',
    { data_import: dataImportName }
  );

  const parseTwice = (raw: unknown): unknown[] => {
    if (typeof raw !== 'string') return [];
    try {
      const once = JSON.parse(raw);
      const twice = typeof once === 'string' ? JSON.parse(once) : once;
      return Array.isArray(twice) ? twice : [];
    } catch {
      return [];
    }
  };
  const parseArray = (raw: unknown): number[] => {
    if (typeof raw !== 'string') return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  return rows.map((row) => ({
    success: (row.success ? 1 : 0) as 0 | 1,
    docname: (row.docname as string) ?? null,
    messages: parseTwice(row.messages),
    exception: (row.exception as string) ?? null,
    row_indexes: parseArray(row.row_indexes),
    import_action: (row.import_action as ImportLogRow['import_action']) ?? null,
  }));
}

/** Blocked-by-invalid-values state: the parent Data Import doc's own `template_warnings` field,
 *  set when the import never ran at all (status stays "Pending", no log rows are written). */
export async function getTemplateWarnings(dataImportName: string): Promise<ImportWarning[]> {
  const client = getFrappeClient();
  const { doc } = await client.getDoc('Data Import', dataImportName);
  const raw = doc.template_warnings as string | undefined;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
