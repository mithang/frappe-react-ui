import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Bar, BarChart, Line, LineChart, CartesianGrid, XAxis } from 'recharts';
import { getFrappeClient } from '@/lib/api/client';
import { BarChart3Icon } from 'lucide-react';

interface ChartProps {
  chartName: string;
  col?: number;
}

interface ChartData {
  labels: string[];
  datasets: { name: string; values: number[] }[];
}

/**
 * frappe.desk.doctype.dashboard_chart.dashboard_chart.get works for Count/Sum/Average/Group By/
 * Custom charts (verified live: {chart_name} is enough). It does NOT work for chart_type
 * "Report" (verified live: KeyError — the underlying config has no document_type/based_on to
 * build a doctype-field query from). Real Desk runs the linked Report client-side and builds a
 * chart from its result for that case (frappe/public/js/frappe/widgets/chart_widget.js) — a
 * separate, larger feature not built here; Report-type charts get an honest "not supported yet"
 * state instead of a 500 swallowed into silence. frappe.desk.desktop.get_chart_data, the
 * fallback this used to try first, doesn't exist on any Frappe version (confirmed live).
 *
 * Renders a real recharts chart (Bar for chart_type Bar/Percentage, Line otherwise) via the
 * regenerated ui/chart.tsx wrapper — not stacked Progress bars pretending to be a chart (D3).
 */
export function ChartWidget({ chartName }: ChartProps) {
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [chartType, setChartType] = useState<string>('Line');
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
      const { doc } = await client.getDoc('Dashboard Chart', chartName);

      if (doc.chart_type === 'Report') {
        setUnsupported('Report-based charts aren’t supported yet');
        setChartData(null);
        return;
      }

      setChartType((doc.type as string) || 'Line');
      const result = await client.call<ChartData>('frappe.desk.doctype.dashboard_chart.dashboard_chart.get', {
        chart_name: chartName,
      });

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

  const chartConfig: ChartConfig = Object.fromEntries(
    (chartData?.datasets ?? []).map((ds, i) => [ds.name, { label: ds.name, color: `hsl(var(--chart-${(i % 5) + 1}))` }])
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
          <ChartContainer config={chartConfig} className="h-[200px] w-full">
            {chartType === 'Bar' || chartType === 'Percentage' ? (
              <BarChart data={rows} margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} tickFormatter={(value) => value.slice(0, 10)} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dashed" />} />
                {chartData.datasets.map((ds, i) => (
                  <Bar key={ds.name} dataKey={ds.name} fill={`hsl(var(--chart-${(i % 5) + 1}))`} radius={[4, 4, 0, 0]} />
                ))}
              </BarChart>
            ) : (
              <LineChart data={rows} margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} tickFormatter={(value) => value.slice(0, 10)} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dashed" />} />
                {chartData.datasets.map((ds, i) => (
                  <Line
                    key={ds.name}
                    dataKey={ds.name}
                    type="natural"
                    stroke={`hsl(var(--chart-${(i % 5) + 1}))`}
                    strokeWidth={2}
                    dot={{ fill: `hsl(var(--chart-${(i % 5) + 1}))` }}
                    activeDot={{ r: 6 }}
                  />
                ))}
              </LineChart>
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
