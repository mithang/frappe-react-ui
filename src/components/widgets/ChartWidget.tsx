import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig } from '@/components/ui/chart';
import { Bar, BarChart, Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { getFrappeClient } from '@/lib/api/client';
import { buildReportChartFilters, getAllFilters } from '@/lib/frappe/reportUtils';
import { resolveChartSourceSettings, fetchChartSourceData } from '@/lib/frappe/chartSource';
import { resolveDynamicFilters } from '@/lib/frappe/dynamicFilters';
import { resolveSeriesColors, type ChartColorSources } from '@/lib/frappe/chartColors';
import { BarChart3Icon } from 'lucide-react';

interface ChartProps {
  chartName: string;
  col?: number;
}

interface ChartData {
  labels: string[];
  datasets: { name: string; values: number[] }[];
}

export function ChartWidget({ chartName }: ChartProps) {
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [chartType, setChartType] = useState<string>('Line');
  // Colour config as Frappe stores it (y_axis rows / custom_options / color), kept so rendering
  // can resolve each series' colour instead of hardcoding a theme ramp.
  const [colorSources, setColorSources] = useState<ChartColorSources>({});
  const [reportColors, setReportColors] = useState<unknown>(undefined);
  const [unsupported, setUnsupported] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadChartData();
  }, [chartName]);

  const loadChartData = async () => {
    setIsLoading(true);
    setUnsupported(null);
    try {
      const client = getFrappeClient();
      const doc = await client.call<any>('frappe.client.get', { 
        doctype: 'Dashboard Chart', 
        name: chartName 
      });

      setChartType((doc.type as string) || 'Line');
      setColorSources({ color: doc.color, custom_options: doc.custom_options, y_axis: doc.y_axis });
      setReportColors(undefined);

      if (doc.chart_type === 'Report') {
        // Use the same logic as Frappe Desk's chart_widget.js:
        //   get_filters_for_chart_type → get_report_filters → get_script
        //   update_default_date_filters → overwrite stale saved dates with fresh server defaults
        //   set_chart_filters → merge user-saved with chart defaults
        const mergedFilters = await buildReportChartFilters(doc);

        // dynamic_filters_json wins over filters_json: the stored literals are frozen at whenever
        // the chart was authored (standard charts still carry 2020-21 dates), while these are
        // expressions meant to resolve against the CURRENT company/fiscal year. Several standard
        // charts put a mandatory filter here and nowhere else, so omitting them made the report
        // throw rather than merely return stale data.
        const dynamicFilters = await resolveDynamicFilters(doc.dynamic_filters_json);
        const reportFilters = { ...mergedFilters, ...dynamicFilters };

        const reportResult = await client.call<any>('frappe.desk.query_report.run', {
          report_name: doc.report_name,
          filters: reportFilters,
          ignore_prepared_report: 1
        });

        // Desk's get_report_chart_data (chart_widget.js) branches FIRST on this: when the report
        // returns its own `chart` and the chart doc sets use_report_chart, that chart IS the
        // answer — x_field/y_axes are never consulted. Standard charts like "Purchase Order
        // Trends" and "Asset Value Analytics" are exactly this shape: use_report_chart = 1 and NO
        // x_field/y_axes at all, so building from those fields yielded empty labels and rendered
        // "No chart data available" even though the report had returned a full chart.
        const reportChart = reportResult?.chart;
        if (doc.use_report_chart && reportChart?.data?.labels?.length) {
          // The report declares its own render type ("line"/"bar", lowercased) — prefer it over
          // the chart doc's, which is what Desk effectively does via chart.type/custom_options.
          const reportType = typeof reportChart.type === 'string' ? reportChart.type : '';
          if (reportType) setChartType(reportType.charAt(0).toUpperCase() + reportType.slice(1));
          setReportColors(reportChart.colors);

          setChartData({
            labels: reportChart.data.labels.map((l: unknown) => String(l)),
            datasets: (reportChart.data.datasets || []).map((ds: any) => ({
              name: ds.name || 'Value',
              values: (ds.values || []).map((v: unknown) => Number(v) || 0),
            })),
          });
          return;
        }

        const resultData = reportResult?.result || [];
        const columns = reportResult?.columns || [];
        const xField = doc.x_field || 'name';
        const yAxes = Array.isArray(doc.y_axes) && doc.y_axes.length > 0 
          ? doc.y_axes 
          : (doc.y_field ? [{ y_field: doc.y_field }] : []);

        const getFieldValue = (row: any, fieldname: string) => {
          if (!row) return undefined;
          if (!Array.isArray(row)) return row[fieldname];
          
          const colIndex = columns.findIndex((col: any) => {
            const colName = typeof col === 'string' ? col : (col.fieldname || col.label);
            return colName === fieldname;
          });
          return colIndex >= 0 ? row[colIndex] : undefined;
        };

        const processedLabels: string[] = [];
        const processedValues: Record<string, number[]> = {};
        yAxes.forEach((y: any) => {
          processedValues[y.y_field || 'Value'] = [];
        });

        resultData.forEach((row: any) => {
          const xVal = getFieldValue(row, xField);
          if (xVal == null || xVal === '') return; // Skip invalid rows
          
          processedLabels.push(String(xVal));
          yAxes.forEach((yAxis: any) => {
            const yFieldName = yAxis.y_field || 'Value';
            const yVal = getFieldValue(row, yFieldName);
            processedValues[yFieldName].push(Number(yVal) || 0);
          });
        });

        const labels = processedLabels;
        const datasets = yAxes.map((yAxis: any) => ({
          name: yAxis.y_field || 'Value',
          values: processedValues[yAxis.y_field || 'Value']
        }));

        setChartData({ labels, datasets });
        setIsLoading(false);
        return;
      }

      if (doc.chart_type === 'Custom') {
        // Custom charts must NOT go through dashboard_chart.get — it appends a filter on
        // chart.document_type, which Custom charts don't have, so the server dies with
        // "DocType  not found". Desk resolves the chart's `source` to a whitelisted method and
        // calls that instead (chart_widget.js#get_settings).
        const source = await resolveChartSourceSettings(doc.source);
        if (!source) {
          setUnsupported(`Couldn't resolve chart source "${doc.source || '(none)'}"`);
          setChartData(null);
          return;
        }

        // Only what the CHART declares. Deliberately not injecting the source's own filter
        // defaults: those are computed from the client's idea of the default company, and this
        // bench proves that guess can be wrong — Global Defaults says "Vyogo Technologies" while
        // the stock (and every warehouse holding it) belongs to "Vyogo Technologies (Demo)".
        // Sending the wrong company returned an EMPTY chart, whereas sending nothing lets the
        // source's Python fall back to frappe.defaults.get_defaults() and return real data.
        // Under-specifying beats over-specifying here.
        const customFilters = {
          ...getAllFilters(doc),
          ...(await resolveDynamicFilters(doc.dynamic_filters_json)),
        };
        // refresh: 0 — these sources are wrapped in @cache_source, and forcing a refresh makes
        // every mount recompute AND rewrite the cache. With several charts loading at once that
        // contends on the same rows and the server returns 508 QueryDeadlockError (observed here).
        // Reading the cache is the normal path; Desk only forces a refresh on explicit user action.
        const customArgs: Record<string, unknown> = { chart_name: chartName, refresh: 0 };
        if (Object.keys(customFilters).length > 0) {
          customArgs.filters = JSON.stringify(customFilters);
        }

        const customResult = await fetchChartSourceData<ChartData>(source.method, customArgs);
        setChartData(customResult?.labels?.length ? customResult : null);
        return;
      }

      const savedFilters = { ...getAllFilters(doc), ...(await resolveDynamicFilters(doc.dynamic_filters_json)) };
      const callArgs: any = {
        chart_name: chartName,
        refresh: 1,
      };

      if (doc.timespan) callArgs.timespan = doc.timespan;
      if (doc.time_grain) callArgs.time_grain = doc.time_grain;
      if (Object.keys(savedFilters).length > 0) {
        callArgs.filters = JSON.stringify(savedFilters);
      }

      const result = await client.call<ChartData>('frappe.desk.doctype.dashboard_chart.dashboard_chart.get', callArgs);

      setChartData(result?.labels ? result : null);
    } catch (error) {
      console.error(`Failed to load chart data for ${chartName}:`, error);
      setChartData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const rows =
    chartData?.labels.map((label, i) => ({
      label,
      ...Object.fromEntries(chartData.datasets.map((ds) => [ds.name, ds.values[i]])),
    })) ?? [];

  const seriesColors = resolveSeriesColors(colorSources, chartData?.datasets.length ?? 0, reportColors);

  const chartConfig: ChartConfig = Object.fromEntries(
    (chartData?.datasets ?? []).map((ds, i) => [ds.name, { label: ds.name.replace(/_/g, ' '), color: seriesColors[i] }])
  );

  return (
    <Card className="flex flex-col hover:shadow-md transition-all duration-200">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex flex-col space-y-1.5">
          <CardTitle className="text-sm font-medium">{chartName}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex-1 pb-4">
        {isLoading ? (
          <Skeleton className="h-[200px] w-full" />
        ) : unsupported ? (
          <div className="h-[200px] bg-muted/20 rounded-md border border-dashed flex items-center justify-center">
            <span className="text-muted-foreground text-sm">{unsupported}</span>
          </div>
        ) : rows.length > 0 && chartData ? (
          <ChartContainer config={chartConfig} className="h-[250px] w-full">
            {chartType === 'Bar' || chartType === 'Percentage' ? (
              <BarChart data={rows} margin={{ left: -15, right: 10, top: 20, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} tickFormatter={(value) => String(value).slice(0, 15)} />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} fontSize={12} width={40} tickFormatter={(value) => value >= 1000 ? `${(value/1000).toFixed(0)}k` : value} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dashed" />} />
                <ChartLegend content={<ChartLegendContent />} />
                {chartData.datasets.map((ds, i) => (
                  <Bar key={ds.name} dataKey={ds.name} fill={seriesColors[i]} radius={[4, 4, 0, 0]} maxBarSize={40} />
                ))}
              </BarChart>
            ) : (
              <AreaChart data={rows} margin={{ left: -15, right: 10, top: 20, bottom: 0 }}>
                <defs>
                  {chartData.datasets.map((ds, i) => (
                    <linearGradient key={`fill-${ds.name}`} id={`fill-${ds.name}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={seriesColors[i]} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={seriesColors[i]} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} tickFormatter={(value) => String(value).slice(0, 15)} />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} fontSize={12} width={40} tickFormatter={(value) => value >= 1000 ? `${(value/1000).toFixed(0)}k` : value} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dashed" />} />
                <ChartLegend content={<ChartLegendContent />} />
                {chartData.datasets.map((ds, i) => (
                  <Area
                    key={ds.name}
                    dataKey={ds.name}
                    type="natural"
                    fill={`url(#fill-${ds.name})`}
                    fillOpacity={1}
                    stroke={seriesColors[i]}
                    strokeWidth={2}
                    activeDot={{ r: 6 }}
                  />
                ))}
              </AreaChart>
            )}
          </ChartContainer>
        ) : (
          <div className="h-[200px] bg-muted/20 rounded-md border border-dashed flex items-center justify-center">
            <span className="text-muted-foreground text-sm">No chart data available</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
