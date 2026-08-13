import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getFrappeApp } from '@/lib/frappe';
import { File, Download } from 'lucide-react';

export const FileManager: React.FC = () => {
  const [files, setFiles] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const frappe = getFrappeApp();
      const docs = await frappe.getDocList('File', {
        fields: ['name', 'file_name', 'file_url', 'file_size', 'attached_to_doctype', 'attached_to_name', 'creation'],
        limit_page_length: 50,
        order_by: 'creation desc',
      });
      setFiles((docs as Record<string, unknown>[]) || []);
    } catch (err) {
      console.error('Failed to load file list:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">File Manager</h1>
          <p className="text-sm text-muted-foreground">Uploaded assets & documents</p>
        </div>
      </div>

      <Card>
        <CardHeader className="p-4 border-b">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <File className="h-4 w-4 text-muted-foreground" /> File List
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center text-sm text-muted-foreground">Loading files...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-bold">File Name</TableHead>
                  <TableHead className="text-xs font-bold">Attached To</TableHead>
                  <TableHead className="text-xs font-bold">Size</TableHead>
                  <TableHead className="text-xs font-bold">Uploaded</TableHead>
                  <TableHead className="text-xs font-bold w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((file) => {
                  const name = String(file.name || '');
                  const fileName = file.file_name ? String(file.file_name) : name;
                  const attachedDoctype = file.attached_to_doctype ? String(file.attached_to_doctype) : null;
                  const attachedName = file.attached_to_name ? String(file.attached_to_name) : '';
                  const fileSize = file.file_size ? Number(file.file_size) : null;
                  const creation = file.creation ? String(file.creation) : null;
                  const fileUrl = file.file_url ? String(file.file_url) : null;

                  return (
                    <TableRow key={name}>
                      <TableCell className="text-xs font-medium flex items-center gap-2">
                        <File className="h-4 w-4 text-primary shrink-0" />
                        <span className="truncate max-w-xs">{fileName}</span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {attachedDoctype ? `${attachedDoctype}: ${attachedName}` : 'Unattached'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {fileSize ? `${Math.round(fileSize / 1024)} KB` : '-'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {creation ? new Date(creation).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell>
                        {fileUrl && (
                          <a href={fileUrl} target="_blank" rel="noreferrer">
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Download className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </a>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!files.length && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-xs text-muted-foreground">
                      No files uploaded
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default FileManager;
