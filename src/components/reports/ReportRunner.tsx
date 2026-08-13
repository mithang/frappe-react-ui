import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getFrappeApp } from '@/lib/frappe';
import { Play, Filter } from 'lucide-react';

interface ReportRunnerProps {
  reportName: string;
}

interface ReportColumn {
  fieldname?: string;
  label?: string;
  fieldtype?: string;
  width?: number;
  [key: string]: unknown;
}

export const ReportRunner: React.FC<ReportRunnerProps> = ({ reportName }) => {
  const [columns, setColumns] = useState<(ReportColumn | string)[]>([]);
  const [rows, setRows] = useState<(Record<string, unknown> | unknown[])[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterValues, setFilterValues] = useState<Record<string, unknown>>({});
  // Use a ref so runReport always reads the latest filters without
  // listing filterValues as a dependency (which caused infinite loops).
  const filterValuesRef = useRef(filterValues);
  filterValuesRef.current = filterValues;

  const runReport = useCallback(async () => {
    setLoading(true);
    try {
      const frappe = getFrappeApp();
      const res = await frappe.call('frappe.desk.query_report.run', {
        report_name: reportName,
        filters: filterValuesRef.current,
      });

      if (res.message) {
        setColumns(res.message.columns || []);
        setRows(res.message.result || []);
      }
    } catch (err) {
      console.error(`Failed to run report ${reportName}:`, err);
    } finally {
      setLoading(false);
    }
  // filterValuesRef is stable (same ref object), so NOT in deps.
  // runReport only recreates when reportName changes.
  }, [reportName]);

  useEffect(() => {
    runReport();
  }, [runReport]);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{reportName}</h1>
          <p className="text-sm text-muted-foreground">Query & Script Report Execution</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={runReport} disabled={loading}>
            <Play className="h-4 w-4 mr-1" /> Run Report
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="p-4 border-b">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" /> Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              placeholder="Filter by keyword..."
              onChange={(e) => setFilterValues({ ...filterValues, keyword: e.target.value })}
              className="text-xs"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-sm text-muted-foreground">Running report query...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((col, idx: number) => {
                    const label = typeof col === 'object' && col !== null ? (col.label || col.fieldname) : String(col);
                    const key = typeof col === 'object' && col !== null ? (col.fieldname || idx) : idx;
                    return (
                      <TableHead key={String(key)} className="text-xs font-bold">
                        {label}
                      </TableHead>
                    );
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, rIdx: number) => (
                  <TableRow key={rIdx}>
                    {columns.map((col, cIdx: number) => {
                      let val: unknown;
                      if (Array.isArray(row)) {
                        val = row[cIdx];
                      } else if (typeof row === 'object' && row !== null) {
                        const key = typeof col === 'object' && col !== null ? (col.fieldname || '') : String(col);
                        val = (row as Record<string, unknown>)[key];
                      }
                      return (
                        <TableCell key={cIdx} className="text-xs">
                          {val !== undefined && val !== null ? String(val) : '-'}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
                {!rows.length && (
                  <TableRow>
                    <TableCell colSpan={columns.length || 1} className="h-24 text-center text-xs text-muted-foreground">
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
