import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getFrappeClient } from '@/lib/api/client';
import { formatDate } from '@/lib/format/formatDate';
import { parseFilterExpression } from '@/lib/expr/filterExpression';
import type { DocTypeMeta, FrappeFilter } from '@/core/types';
import { Plus, ExternalLink } from 'lucide-react';

interface QuickListProps {
  /** The content block's `quick_list_name` — which is the child row's LABEL, not a doctype. */
  listName: string;
  /** Resolved from the workspace's `quick_lists` child table. Absent = misconfigured widget. */
  documentType?: string;
  /** Raw `quick_list_filter` (a JS array literal string) from the same child row. */
  quickListFilter?: string;
  col?: number;
}

interface QuickListRow {
  name: string;
  modified?: string;
  status?: string;
  docstatus?: 0 | 1 | 2;
  [key: string]: unknown;
}

const colClassMap: Record<number, string> = {
  1: 'col-span-1',
  2: 'col-span-2',
  3: 'col-span-3',
  4: 'col-span-4',
  6: 'col-span-6',
  8: 'col-span-8',
  12: 'col-span-12',
};

function statusVariant(row: QuickListRow): { label: string; className: string } | null {
  if (row.status) {
    const s = String(row.status).toLowerCase();
    if (['open', 'pending', 'overdue', 'unpaid', 'to deliver', 'draft'].some((k) => s.includes(k))) {
      return { label: String(row.status), className: 'text-amber-700 bg-amber-50/70 border-amber-200' };
    }
    if (['completed', 'closed', 'paid', 'submitted', 'active'].some((k) => s.includes(k))) {
      return { label: String(row.status), className: 'text-green-700 bg-green-50/70 border-green-200' };
    }
    if (['cancelled', 'failed', 'rejected'].some((k) => s.includes(k))) {
      return { label: String(row.status), className: 'text-red-700 bg-red-50/70 border-red-200' };
    }
    return { label: String(row.status), className: 'text-muted-foreground bg-muted/50' };
  }
  if (row.docstatus === 1) return { label: 'Submitted', className: 'text-blue-700 bg-blue-50/70 border-blue-200' };
  if (row.docstatus === 2) return { label: 'Cancelled', className: 'text-red-700 bg-red-50/70 border-red-200' };
  return null;
}

/**
 * Renders a Workspace "Quick List" block. `quick_list_name` in the workspace content is the LABEL
 * of a row in the workspace's own `quick_lists` child table (doctype "Workspace Quick List"),
 * which carries the real `document_type` and `quick_list_filter` — the label is NOT a doctype.
 * This previously passed it straight to a list call as if it were one, so any quick list whose
 * label wasn't coincidentally a doctype name errored into an empty card.
 *
 * Mirrors Desk's quick_list_widget.js: title field + status/docstatus + modified, filtered by the
 * configured filter, newest first, capped at 4 rows.
 */
export function QuickListWidget({ listName, documentType, quickListFilter, col = 6 }: QuickListProps) {
  const [rows, setRows] = useState<QuickListRow[]>([]);
  const [meta, setMeta] = useState<DocTypeMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!documentType) {
      setError(`No Quick List named "${listName}" is configured on this workspace`);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const client = getFrappeClient();
      const { meta: docMeta } = await client.getMeta(documentType);
      setMeta(docMeta);

      const titleField = docMeta.title_field;
      const hasStatus = docMeta.fields?.some((f) => f.fieldname === 'status');

      const fields = Array.from(
        new Set(
          [
            'name',
            ...(titleField && titleField !== 'name' ? [titleField] : []),
            ...(hasStatus ? ['status', 'docstatus'] : ['docstatus']),
            'modified',
          ].filter(Boolean)
        )
      );

      const { rows: fetched } = await client.getList<QuickListRow>({
        doctype: documentType,
        fields,
        filters: parseFilterExpression(quickListFilter) as FrappeFilter[],
        orderBy: 'creation desc',
        pageLength: 4,
      });
      setRows(fetched);
    } catch (err) {
      console.error(`[QuickListWidget] Failed to load "${listName}" (${documentType}):`, err);
      setError(err instanceof Error ? err.message : 'Failed to load');
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, [listName, documentType, quickListFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const colClass = colClassMap[col] || 'col-span-full';
  const titleField = meta?.title_field;

  return (
    <div className={colClass}>
      <Card className="h-full">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold">{listName}</CardTitle>
            {documentType && (
              <div className="flex items-center gap-1">
                <Button asChild variant="ghost" size="sm" className="h-7 w-7 p-0" title={`New ${documentType}`}>
                  <Link to={`/doctype/${documentType}/new`}>
                    <Plus className="h-3.5 w-3.5" />
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="sm" className="h-7 w-7 p-0" title={`Open ${documentType} list`}>
                  <Link to={`/doctype/${documentType}`}>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-5 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="text-xs text-muted-foreground py-2">{error}</div>
          ) : rows.length === 0 ? (
            <div className="text-xs text-muted-foreground py-2">No items found</div>
          ) : (
            <div className="divide-y">
              {rows.map((row) => {
                const status = statusVariant(row);
                const title = (titleField && (row[titleField] as string)) || row.name;
                return (
                  <Link
                    key={row.name}
                    to={`/doctype/${documentType}/${row.name}`}
                    className="flex items-center justify-between gap-2 py-2 group"
                  >
                    <span className="text-xs font-medium truncate group-hover:text-primary transition-colors">
                      {title}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      {status && (
                        <Badge variant="outline" className={`text-[10px] font-normal ${status.className}`}>
                          {status.label}
                        </Badge>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {row.modified ? formatDate(row.modified) : ''}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
