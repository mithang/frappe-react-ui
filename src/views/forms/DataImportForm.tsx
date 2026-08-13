// Custom Form for the "Data Import" doctype, registered via DocTypeRegistry so it renders at
// the doctype's normal /doctype/Data Import/:name route (SmartForm's existing dispatch) instead
// of a bespoke page/route. This mirrors how real Desk does it: Data Import is a plain doctype
// rendered by the SAME generic Form View as everything else, augmented by a client script
// (frappe/core/doctype/data_import/data_import.js, frappe.ui.form.on("Data Import", {...})) that
// bolts on a progress bar, custom buttons, and one bespoke preview-table widget. reference_doctype
// (Link) and import_type (Select) below are real doc fields rendered through the same
// FieldDispatcher/useFormController machinery every other doctype's form uses — only import_file
// (this app's "Attach" fieldtype has no real upload widget yet, just a plain text input) and the
// preview/progress/results panels are custom, same as Desk's own genuinely-custom parts.

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useFormController } from '@/hooks/useFormController';
import { FormStoreProvider } from '@/store/formStore';
import { FieldDispatcher } from '@/views/fields/FieldDispatcher';
import { getFrappeClient } from '@/lib/api/client';
import {
  getImportPreview,
  startImport,
  getImportStatus,
  getImportLogs,
  getTemplateWarnings,
  type ImportPreview,
  type ImportStatus,
  type ImportLogRow,
  type ImportWarning,
} from '@/lib/api/dataImport';
import { decodeHtmlText } from '@/lib/html';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, UploadCloud, Download, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface DataImportFormProps {
  doctype: string;
  name?: string;
  onClose?: () => void;
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

/** "Pending" is ambiguous — it means "still queued/running" right up until the moment a run is
 *  blocked by unresolved warnings, at which point it stays "Pending" forever with no log rows
 *  written. Distinguish the two by checking template_warnings once the run's had a moment. */
async function pollUntilDone(dataImportName: string): Promise<{ status: ImportStatus; blockedBy: ImportWarning[] }> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const status = await getImportStatus(dataImportName);
    if (status.status !== 'Pending' && status.status !== 'In Progress') {
      return { status, blockedBy: [] };
    }
    const blockedBy = await getTemplateWarnings(dataImportName);
    if (blockedBy.length > 0) {
      return { status, blockedBy };
    }
    await new Promise((resolve) => setTimeout(resolve, 1200));
  }
  throw new Error('Import is taking longer than expected — check the Data Import list later.');
}

const DataImportForm: React.FC<DataImportFormProps> = ({ name, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const isNew = !name || name === 'new';

  // Set by SmartList's "Import" button (navigate(..., { state: { referenceDoctype } })) so the
  // reference_doctype field arrives pre-filled instead of the user re-picking a doctype they
  // already told the list view they wanted to import into.
  const prefillReferenceDoctype = (location.state as { referenceDoctype?: string } | null)?.referenceDoctype;

  const { frm, store, doc, meta, isLoading, isSaving, save, getValue, setValue } = useFormController({
    doctype: 'Data Import',
    name,
    onSave: (savedDoc) => {
      if (isNew) navigate(`/doctype/Data Import/${savedDoc.name}`, { replace: true });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Gated on `frm` (not just `isNew`) — useFormController's load is async, and setValue() is a
  // silent no-op before `frm` exists. Once the value is actually set, getValue() reflects it and
  // naturally stops this from re-firing — no extra "already prefilled" ref needed.
  useEffect(() => {
    if (!isNew || !prefillReferenceDoctype || !frm) return;
    if (getValue('reference_doctype')) return;
    setValue('reference_doctype', prefillReferenceDoctype);
  }, [isNew, prefillReferenceDoctype, frm, getValue, setValue]);

  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [blockingWarnings, setBlockingWarnings] = useState<ImportWarning[]>([]);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<ImportStatus | null>(null);
  const [logs, setLogs] = useState<ImportLogRow[]>([]);

  const importFile = getValue<string | undefined>('import_file');

  // Once a saved doc has a file attached, load (or reload) its preview.
  useEffect(() => {
    if (isNew || !name || !importFile) return;
    setPreviewLoading(true);
    getImportPreview(name)
      .then(setPreview)
      .catch((e) => toast({ title: 'Failed to load preview', description: e instanceof Error ? e.message : String(e), variant: 'destructive' }))
      .finally(() => setPreviewLoading(false));
  }, [isNew, name, importFile, toast]);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploading(true);
      try {
        const client = getFrappeClient();
        const uploaded = await client.uploadFile({ file, isPrivate: true, folder: 'Home' });
        await setValue('import_file', uploaded.file_url);
      } catch (err) {
        toast({ title: 'Upload failed', description: err instanceof Error ? err.message : String(err), variant: 'destructive' });
      } finally {
        setUploading(false);
        e.target.value = '';
      }
    },
    [setValue, toast]
  );

  const handleStartImport = useCallback(async () => {
    if (!name) return;
    setRunning(true);
    setBlockingWarnings([]);
    setStatus(null);
    setLogs([]);
    try {
      await startImport(name);
      const { status: finalStatus, blockedBy } = await pollUntilDone(name);
      setStatus(finalStatus);
      if (blockedBy.length > 0) {
        setBlockingWarnings(blockedBy);
      } else {
        setLogs(await getImportLogs(name));
      }
    } catch (e) {
      toast({ title: 'Import failed', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    } finally {
      setRunning(false);
    }
  }, [name, toast]);

  const handleDownloadLog = useCallback(async () => {
    if (!name) return;
    try {
      const client = getFrappeClient();
      const { blob, filename } = await client.downloadFile(
        'frappe.core.doctype.data_import.data_import.download_import_log',
        { data_import_name: name }
      );
      triggerBlobDownload(blob, filename);
    } catch (e) {
      toast({ title: 'Failed to download log', description: e instanceof Error ? e.message : String(e), variant: 'destructive' });
    }
  }, [name, toast]);

  const goBack = () => (onClose ? onClose() : navigate(-1));

  if (isLoading || !meta || !store) {
    return <div className="p-8 text-center text-muted-foreground">Loading…</div>;
  }

  const referenceDoctypeField = meta.fields.find((f) => f.fieldname === 'reference_doctype');
  const importTypeField = meta.fields.find((f) => f.fieldname === 'import_type');

  return (
    <FormStoreProvider value={store}>
      <div className="p-8 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={goBack}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{isNew ? 'New Data Import' : name}</h1>
            <p className="text-sm text-muted-foreground">Bulk-create or update records from a CSV or Excel file.</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
            {!isNew && <CardDescription>reference_doctype and import_type can't change after creation.</CardDescription>}
          </CardHeader>
          <CardContent className="space-y-4">
            {referenceDoctypeField && (
              <FieldDispatcher
                field={referenceDoctypeField}
                value={getValue('reference_doctype')}
                onChange={(v) => setValue('reference_doctype', v)}
                doctype="Data Import"
                doc={doc}
                disabled={!isNew}
              />
            )}
            {importTypeField && (
              <FieldDispatcher
                field={importTypeField}
                value={getValue('import_type')}
                onChange={(v) => setValue('import_type', v)}
                doctype="Data Import"
                doc={doc}
                disabled={!isNew}
              />
            )}

            <div className="space-y-1">
              <label className="text-sm font-medium">Import File</label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 px-4 py-2 border rounded-md cursor-pointer hover:bg-accent/50 text-sm">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                  {importFile ? importFile.split('/').pop() : 'Choose file…'}
                  <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileChange} disabled={uploading} />
                </label>
              </div>
            </div>

            {isNew && (
              <Button
                onClick={() => save()}
                disabled={isSaving || !getValue('reference_doctype') || !getValue('import_type') || !importFile}
              >
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create
              </Button>
            )}
          </CardContent>
        </Card>

        {!isNew && previewLoading && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Loading preview…
          </div>
        )}

        {!isNew && preview && (
          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
              <CardDescription>
                {preview.total_number_of_rows} row(s) detected
                {preview.max_rows_exceeded ? ` — showing the first ${preview.max_rows_in_preview}` : ''}. Columns
                are matched to {getValue('reference_doctype')} fields by name automatically.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {blockingWarnings.length > 0 && (
                <Alert variant="destructive">
                  <AlertTitle>Import blocked — fix these and re-upload</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc pl-4 space-y-1 mt-1">
                      {blockingWarnings.map((w, i) => (
                        <li key={i}>{decodeHtmlText(w.message)}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
              {preview.warnings.length > 0 && blockingWarnings.length === 0 && (
                <Alert>
                  <AlertTitle>{preview.warnings.length} warning(s) in this file</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc pl-4 space-y-1 mt-1">
                      {preview.warnings.map((w, i) => (
                        <li key={i}>{decodeHtmlText(w.message)}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {preview.columns.map((col, i) => (
                        <TableHead key={i} className="whitespace-nowrap">
                          <div>{col.header_title}</div>
                          {col.df ? (
                            <div className="text-xs font-normal text-muted-foreground">
                              → {col.df.label}
                              {col.df.reqd ? ' *' : ''}
                            </div>
                          ) : !col.skip_import ? (
                            <div className="text-xs font-normal text-destructive">not mapped</div>
                          ) : null}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.data.map((row, ri) => (
                      <TableRow key={ri}>
                        {row.map((cell, ci) => (
                          <TableCell key={ci} className="whitespace-nowrap">
                            {cell === null || cell === undefined || cell === '' ? '—' : String(cell)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <Button onClick={handleStartImport} disabled={running}>
                {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                {running ? 'Importing…' : 'Start Import'}
              </Button>
            </CardContent>
          </Card>
        )}

        {status && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {status.status === 'Success' ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : status.status === 'Partial Success' ? (
                  <CheckCircle2 className="h-5 w-5 text-amber-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive" />
                )}
                Import {status.status}
              </CardTitle>
              <CardDescription>
                {status.success ?? 0} succeeded, {status.failed ?? 0} failed, out of {status.total_records ?? 0} total.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button variant="outline" size="sm" onClick={handleDownloadLog}>
                <Download className="h-4 w-4 mr-2" /> Download log
              </Button>

              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Row(s)</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Document</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log, i) => (
                      <TableRow key={i}>
                        <TableCell>{log.row_indexes.join(', ')}</TableCell>
                        <TableCell>
                          {log.success ? (
                            <Badge variant="outline" className="text-green-600 bg-green-50/50 border-green-200">
                              Success
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-red-600 bg-red-50/50 border-red-200">
                              Failed
                            </Badge>
                          )}
                          {log.import_action ? <span className="ml-1.5 text-xs text-muted-foreground">{log.import_action}</span> : null}
                        </TableCell>
                        <TableCell>{log.docname ?? '—'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-md truncate">{log.exception ?? ''}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </FormStoreProvider>
  );
};

export default DataImportForm;
