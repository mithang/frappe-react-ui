import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { getFrappeApp } from '@/lib/frappe';
import { BarChart3Icon } from 'lucide-react';

interface ChartProps {
  chartName: string;
  col?: number;
}

interface ChartData {
  labels: string[];
  datasets: {
    name: string;
    values: number[];
  }[];
}

export function ChartWidget({ chartName }: ChartProps) {
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadChartData();
  }, [chartName]);

  const loadChartData = async () => {
    try {
      const frappe = getFrappeApp();
      let response: { message?: ChartData } | null = null;

      try {
        response = await frappe.call('frappe.desk.doctype.dashboard_chart.dashboard_chart.get', {
          chart_name: chartName,
        });
      } catch {
        try {
          response = await frappe.call('frappe.desk.desktop.get_chart_data', {
            chart_name: chartName,
          });
        } catch {
          response = null;
        }
      }

      if (response && response.message && response.message.labels) {
        setChartData(response.message);
      } else {
        setChartData(null);
      }
    } catch (error) {
      console.error(`Failed to load chart data for ${chartName}:`, error);
      setChartData(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="h-full hover:shadow-md transition-all duration-200 flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">{chartName}</CardTitle>
          <BarChart3Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-end">
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : chartData && chartData.datasets && chartData.datasets.length > 0 ? (
          <div className="space-y-3 mt-auto">
            {chartData.datasets[0]?.values.map((value, index) => {
              const maxValue = Math.max(...chartData.datasets[0].values) || 1;
              const percentage = (value / maxValue) * 100;
              if (index > 4) return null;

              return (
                <div key={index} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground font-medium">
                      {chartData.labels[index] || `Item ${index + 1}`}
                    </span>
                    <span className="font-semibold">{value.toLocaleString()}</span>
                  </div>
                  <Progress value={percentage} className="h-2" />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="h-32 bg-muted/50 rounded-md border border-dashed flex items-center justify-center">
            <span className="text-muted-foreground text-sm">No chart data available</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}