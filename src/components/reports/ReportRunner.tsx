import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { getFrappeClient } from '@/lib/api/client';
import { getReportFilterDefs, buildInitialFilterValues, type ReportFilter } from '@/lib/frappe/reportScript';
import { formatDate } from '@/lib/format/formatDate';
import { Play, Filter, AlertCircle } from 'lucide-react';

interface ReportRunnerProps {
  reportName: string;
}

interface ReportColumn {
  fieldname?: string;
  label?: string;
  fieldtype?: string;
  width?: number;
  options?: string;
  [key: string]: unknown;
}

const NUMERIC_FIELDTYPES = new Set(['Currency', 'Float', 'Int', 'Percent']);

function columnKey(col: ReportColumn | string, index: number): string {
  if (typeof col === 'string') {
    // Query Report columns can arrive as "Label:Fieldtype/Options:Width".
    return col.split(':')[0] || String(index);
  }
  return col.fieldname || col.label || String(index);
}

function columnLabel(col: ReportColumn | string, index: number): string {
  if (typeof col === 'string') return col.split(':')[0] || `Column ${index + 1}`;
  return col.label || col.fieldname || `Column ${index + 1}`;
}

function columnFieldtype(col: ReportColumn | string): string {
  if (typeof col === 'string') return col.split(':')[1]?.split('/')[0] || 'Data';
  return col.fieldtype || 'Data';
}

function formatCell(value: unknown, fieldtype: string): string {
  if (value === null || value === undefined || value === '') return '';
  if (fieldtype === 'Date' || fieldtype === 'Datetime') return formatDate(value as string);
  if (fieldtype === 'Check') return value ? 'Yes' : 'No';
  if (NUMERIC_FIELDTYPES.has(fieldtype)) {
    const n = Number(value);
    if (Number.isNaN(n)) return String(value);
    return n.toLocaleString(undefined, {
      minimumFractionDigits: fieldtype === 'Int' ? 0 : 2,
      maximumFractionDigits: fieldtype === 'Int' ? 0 : 2,
    });
  }
  return String(value);
}

/** Select filters declare options as a newline-separated string or an array. */
function selectOptions(options: ReportFilter['options']): string[] {
  if (Array.isArray(options)) return options.map((o) => String(o));
  if (typeof options === 'string') return options.split('\n').map((o) => o.trim());
  return [];
}

export const ReportRunner: React.FC<ReportRunnerProps> = ({ reportName }) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [filterDefs, setFilterDefs] = useState<ReportFilter[]>([]);
  const [filterValues, setFilterValues] = useState<Record<string, unknown>>({});
  const [columns, setColumns] = useState<(ReportColumn | string)[]>([]);
  const [rows, setRows] = useState<(Record<string, unknown> | unknown[])[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Filter definitions live inside the report's own script, and their defaults are what make a
  // report return anything at all — running with {} silently yields zero rows for any report with
  // mandatory filters (verified: Accounts Payable gives 0 rows unfiltered, 4 rows filtered).
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setError(null);

    getReportFilterDefs(reportName)
      .then((defs) => {
        if (cancelled) return;
        setFilterDefs(defs);
        setFilterValues(buildInitialFilterValues(defs, searchParams));
      })
      .catch(() => {
        if (!cancelled) setFilterDefs([]);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
    };
    // searchParams intentionally omitted: it seeds the FIRST load only, so editing a filter in the
    // UI (which writes back to the URL) doesn't re-seed and clobber what was just typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportName]);

  const runReport = useCallback(
    async (values: Record<string, unknown>) => {
      setLoading(true);
      setError(null);
      try {
        const result = await getFrappeClient().call<{
          columns?: (ReportColumn | string)[];
          result?: (Record<string, unknown> | unknown[])[];
        }>('frappe.desk.query_report.run', {
          report_name: reportName,
          filters: values,
          ignore_prepared_report: 1,
        });

        setColumns(result?.columns ?? []);
        setRows(result?.result ?? []);
      } catch (err) {
        console.error(`Failed to run report ${reportName}:`, err);
        setError(err instanceof Error ? err.message : 'Failed to run report');
        setColumns([]);
        setRows([]);
      } finally {
        setLoading(false);
      }
    },
    [reportName]
  );

  useEffect(() => {
    if (ready) runReport(filterValues);
    // Runs once filters are seeded; subsequent runs are explicit (Run Report).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, reportName]);

  const setFilter = (fieldname: string, value: unknown) => {
    setFilterValues((prev) => ({ ...prev, [fieldname]: value }));
  };

  const applyFilters = () => {
    // Mirror the filters into the URL so a report view stays shareable/bookmarkable, the way
    // Desk's own query-report links are.
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(filterValues)) {
      if (value === undefined || value === null || value === '') continue;
      next.set(key, String(value));
    }
    setSearchParams(next, { replace: true });
    runReport(filterValues);
  };

  const visibleFilters = useMemo(() => filterDefs.filter((f) => !f.hidden), [filterDefs]);

  const missingRequired = useMemo(
    () =>
      visibleFilters
        .filter((f) => f.reqd)
        .filter((f) => {
          const v = filterValues[f.fieldname];
          return v === undefined || v === null || v === '';
        })
        .map((f) => f.label || f.fieldname),
    [visibleFilters, filterValues]
  );

  const renderFilter = (def: ReportFilter) => {
    const value = filterValues[def.fieldname];
    const label = def.label || def.fieldname;
    const fieldtype = def.fieldtype || 'Data';

    const control = (() => {
      if (fieldtype === 'Check') {
        return (
          <Checkbox
            checked={!!value}
            onCheckedChange={(checked) => setFilter(def.fieldname, checked === true ? 1 : 0)}
          />
        );
      }

      if (fieldtype === 'Select') {
        const options = selectOptions(def.options);
        return (
          <Select value={value ? String(value) : ''} onValueChange={(v) => setFilter(def.fieldname, v)}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder={`Select ${label}`} />
            </SelectTrigger>
            <SelectContent>
              {options
                .filter((o) => o !== '')
                .map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        );
      }

      if (fieldtype === 'Date') {
        return (
          <Input
            type="date"
            className="h-9"
            value={value ? String(value) : ''}
            onChange={(e) => setFilter(def.fieldname, e.target.value)}
          />
        );
      }

      // Link filters render as free text rather than a picker: the report's `get_query` narrowing
      // needs live form state this view doesn't have, and a picker showing the wrong candidates
      // would be worse than typing the exact name.
      return (
        <Input
          className="h-9"
          placeholder={fieldtype === 'Link' ? `${def.options || label}…` : label}
          value={value === undefined || value === null ? '' : String(value)}
          onChange={(e) => setFilter(def.fieldname, e.target.value)}
        />
      );
    })();

    return (
      <div key={def.fieldname} className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          {label}
          {def.reqd ? <span className="text-destructive ml-0.5">*</span> : null}
        </label>
        {control}
      </div>
    );
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{reportName}</h1>
          <p className="text-sm text-muted-foreground">
            {loading ? 'Running…' : `${rows.length} row${rows.length === 1 ? '' : 's'}`}
          </p>
        </div>
        <Button size="sm" onClick={applyFilters} disabled={loading}>
          <Play className="h-4 w-4 mr-1" /> Run Report
        </Button>
      </div>

      {visibleFilters.length > 0 && (
        <Card>
          <CardHeader className="p-4 pb-3 border-b">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" /> Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {visibleFilters.map(renderFilter)}
            </div>
            {missingRequired.length > 0 && (
              <p className="mt-3 text-xs text-amber-600 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" />
                Required: {missingRequired.join(', ')}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="p-12 text-center text-sm text-destructive">{error}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((col, idx) => (
                    <TableHead
                      key={columnKey(col, idx)}
                      className={`text-xs font-semibold whitespace-nowrap ${
                        NUMERIC_FIELDTYPES.has(columnFieldtype(col)) ? 'text-right' : ''
                      }`}
                    >
                      {columnLabel(col, idx)}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, rIdx) => (
                  <TableRow key={rIdx}>
                    {columns.map((col, cIdx) => {
                      const fieldtype = columnFieldtype(col);
                      const value = Array.isArray(row)
                        ? row[cIdx]
                        : (row as Record<string, unknown>)[columnKey(col, cIdx)];
                      return (
                        <TableCell
                          key={cIdx}
                          className={`text-xs whitespace-nowrap ${
                            NUMERIC_FIELDTYPES.has(fieldtype) ? 'text-right tabular-nums' : ''
                          }`}
                        >
                          {formatCell(value, fieldtype)}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
                {!rows.length && (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length || 1}
                      className="h-24 text-center text-xs text-muted-foreground"
                    >
                      No report results found
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
