import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getFrappeClient } from '@/lib/api/client';
import { prettyDate } from '@/lib/format/prettyDate';
import { parseFilterExpression } from '@/lib/expr/filterExpression';
import type { DocTypeMeta, FrappeFilter } from '@/core/types';
import { Plus, RefreshCw, ChevronRight } from 'lucide-react';

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

/** Frappe indicator colour names -> badge classes, matching Desk's palette. */
const INDICATOR_CLASSES: Record<string, string> = {
  red: 'text-red-700 bg-red-50 border-red-200',
  orange: 'text-orange-700 bg-orange-50 border-orange-200',
  amber: 'text-amber-700 bg-amber-50 border-amber-200',
  yellow: 'text-yellow-700 bg-yellow-50 border-yellow-200',
  green: 'text-green-700 bg-green-50 border-green-200',
  blue: 'text-blue-700 bg-blue-50 border-blue-200',
  'light-blue': 'text-sky-700 bg-sky-50 border-sky-200',
  purple: 'text-purple-700 bg-purple-50 border-purple-200',
  pink: 'text-pink-700 bg-pink-50 border-pink-200',
  gray: 'text-gray-600 bg-gray-50 border-gray-200',
  grey: 'text-gray-600 bg-gray-50 border-gray-200',
  black: 'text-gray-900 bg-gray-100 border-gray-300',
};

/** Heuristic fallback for doctypes that define no DocType State rows — see getIndicator. */
function guessColour(status: string): string {
  const s = status.toLowerCase();
  if (['completed', 'closed', 'paid', 'active', 'success', 'approved', 'received'].some((k) => s.includes(k))) return 'green';
  if (['cancelled', 'failed', 'rejected', 'overdue', 'error'].some((k) => s.includes(k))) return 'red';
  if (['pending', 'open', 'to ', 'unpaid', 'draft', 'queued'].some((k) => s.includes(k))) return 'orange';
  return 'gray';
}

/**
 * Port of frappe.get_indicator's precedence (frappe/public/js/frappe/model/indicator.js):
 * submittable draft/cancelled first, then the `status` field coloured by the DocType's own
 * `states` rows.
 *
 * Desk has two more sources we genuinely cannot reach: workflow state, and an app bundle's
 * `listview_settings[doctype].get_indicator` (which is where ERPNext defines Sales Invoice's
 * Paid/Overdue colours). Verified on this bench that `states` comes back EMPTY for both ToDo and
 * Sales Invoice, so without a fallback every badge would render an undifferentiated grey —
 * hence guessColour, which is explicitly a heuristic, not a claim to match Desk exactly.
 */
function getIndicator(
  row: QuickListRow,
  meta: DocTypeMeta | null
): { label: string; className: string } | null {
  const isSubmittable = !!meta?.is_submittable;

  if (isSubmittable && row.docstatus === 0) return { label: 'Draft', className: INDICATOR_CLASSES.red };
  if (isSubmittable && row.docstatus === 2) return { label: 'Cancelled', className: INDICATOR_CLASSES.red };

  if (row.status) {
    const status = String(row.status);
    const state = meta?.states?.find((s) => s.title === status);
    const colour = state?.color ? state.color.toLowerCase().replace(/\s+/g, '-') : guessColour(status);
    return { label: status, className: INDICATOR_CLASSES[colour] ?? INDICATOR_CLASSES.gray };
  }

  if (isSubmittable && row.docstatus === 1) return { label: 'Submitted', className: INDICATOR_CLASSES.blue };
  return null;
}

/**
 * Renders a Workspace "Quick List" block, laid out like Desk's quick_list_widget.js: each row is
 * the title stacked above a relative timestamp on the left, with the status badge and a chevron
 * on the right — not a single inline row with an absolute date.
 *
 * `quick_list_name` in the workspace content is the LABEL of a row in that workspace's own
 * `quick_lists` child table (doctype "Workspace Quick List"), which carries the real
 * `document_type` and `quick_list_filter`. The label is NOT a doctype.
 */
export function QuickListWidget({ listName, documentType, quickListFilter, col = 6 }: QuickListProps) {
  const navigate = useNavigate();
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
        new Set([
          'name',
          ...(titleField && titleField !== 'name' ? [titleField] : []),
          ...(hasStatus ? ['status'] : []),
          'docstatus',
          'modified',
        ])
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
      {/* min-h matches Desk's .quick-list-widget-box, so a 1-row list doesn't collapse next to a
          full one and leave the dashboard grid ragged. */}
      <Card className="h-full min-h-[202px] flex flex-col">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold truncate">{listName}</CardTitle>
            {documentType && (
              <div className="flex items-center gap-0.5 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-muted-foreground"
                  title={`Add New ${documentType}`}
                  onClick={() => navigate(`/doctype/${documentType}/new`)}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-muted-foreground"
                  title="Refresh List"
                  onClick={load}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="flex-1 pt-0">
          {isLoading ? (
            <div className="text-sm text-muted-foreground py-2">Loading...</div>
          ) : error ? (
            <div className="text-sm text-muted-foreground py-2">{error}</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground py-2">No Data...</div>
          ) : (
            <div className="flex flex-col">
              {rows.map((row) => {
                const indicator = getIndicator(row, meta);
                const title = (titleField && (row[titleField] as string)) || row.name;
                return (
                  <div
                    key={row.name}
                    role="link"
                    tabIndex={0}
                    onClick={() => navigate(`/doctype/${documentType}/${row.name}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate(`/doctype/${documentType}/${row.name}`);
                      }
                    }}
                    className="flex items-center justify-between my-0.5 px-1.5 py-1 rounded-md cursor-pointer hover:bg-accent/60 transition-colors"
                  >
                    <div className="flex flex-col flex-1 min-w-0">
                      <div className="text-sm truncate" title={title}>
                        {title}
                      </div>
                      <div className="text-xs text-muted-foreground">{prettyDate(row.modified)}</div>
                    </div>
                    {indicator && (
                      <span
                        className={`ml-3 shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-normal ${indicator.className}`}
                      >
                        {indicator.label}
                      </span>
                    )}
                    <ChevronRight className="ml-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
