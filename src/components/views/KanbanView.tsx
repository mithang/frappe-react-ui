import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getFrappeApp } from '@/lib/frappe';
import { formatDate } from '@/lib/format/formatDate';
import { Link } from 'react-router-dom';

interface KanbanViewProps {
  doctype: string;
  fieldToGroup: string;
  statuses?: string[];
}

const DEFAULT_KANBAN_STATUSES = ['Draft', 'Submitted', 'Cancelled'];

export const KanbanView: React.FC<KanbanViewProps> = ({
  doctype,
  fieldToGroup,
  statuses = DEFAULT_KANBAN_STATUSES,
}) => {
  const [columns, setColumns] = useState<Record<string, Record<string, unknown>[]>>({});
  const [loading, setLoading] = useState(true);

  const loadKanbanData = useCallback(async () => {
    setLoading(true);
    try {
      const frappe = getFrappeApp();
      const docs = await frappe.getDocList(doctype, {
        fields: ['name', 'modified', fieldToGroup],
        limit_page_length: 50,
      });

      const grouped: Record<string, Record<string, unknown>[]> = {};
      statuses.forEach((s) => (grouped[s] = []));

      (docs || []).forEach((doc: Record<string, unknown>) => {
        const rawVal = doc[fieldToGroup];
        const val = rawVal !== undefined && rawVal !== null ? String(rawVal) : 'Draft';
        if (!grouped[val]) grouped[val] = [];
        grouped[val].push(doc);
      });

      setColumns(grouped);
    } catch (err) {
      console.error('Failed to load kanban data:', err);
    } finally {
      setLoading(false);
    }
  }, [doctype, fieldToGroup, statuses]);

  useEffect(() => {
    loadKanbanData();
  }, [loadKanbanData]);

  if (loading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading Kanban...</div>;
  }

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <div className="flex gap-6 overflow-x-auto pb-4">
        {Object.keys(columns).map((status) => (
          <div key={status} className="w-80 shrink-0 bg-muted/30 p-4 rounded-xl border space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-sm">{status}</h3>
              <Badge variant="secondary" className="text-xs">
                {columns[status]?.length || 0}
              </Badge>
            </div>

            <div className="space-y-3">
              {(columns[status] || []).map((doc) => {
                const docName = String(doc.name || '');
                const docModified = doc.modified ? String(doc.modified) : undefined;
                return (
                  <Card key={docName} className="hover:shadow-md transition-shadow">
                    <CardHeader className="p-3 pb-1">
                      <CardTitle className="text-xs font-bold text-primary">
                        <Link to={`/app/form/${doctype}/${docName}`}>{docName}</Link>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-1 text-[10px] text-muted-foreground">
                      Modified: {docModified ? formatDate(docModified) : '-'}
                    </CardContent>
                  </Card>
                );
              })}
              {!columns[status]?.length && (
                <div className="p-6 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
                  No records
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
