import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getFrappeApp } from '@/lib/frappe';
import { ArrowUpIcon, ArrowDownIcon, MinusIcon } from 'lucide-react';

interface NumberCardProps {
  cardName: string;
  col: number;
}

export function NumberCardWidget({ cardName, col }: NumberCardProps) {
  const [value, setValue] = useState<number | string>('--');
  const [isLoading, setIsLoading] = useState(true);
  const [trend, setTrend] = useState<'up' | 'down' | 'neutral'>(Math.random() > 0.5 ? 'up' : 'down'); // Mock trend for visualization
  const [percentage, setPercentage] = useState(Math.floor(Math.random() * 20)); // Mock percentage

  useEffect(() => {
    loadNumberCardData();
  }, [cardName]);

  const loadNumberCardData = async () => {
    try {
      const frappe = getFrappeApp();

      // Try to get data from ERPNext dashboard number cards API
      const response = await frappe.call('frappe.desk.desktop.get_number_cards_data', {
        card_name: cardName
      });

      if (response.message) {
        setValue(response.message.value || '--');
      } else {
        // Fallback: try to get a count from a related doctype
        const doctype = extractDoctypeFromCardName(cardName);
        if (doctype) {
          const countResponse = await frappe.getDocList(doctype, {
            fields: ['count(name) as total'],
            limit_page_length: 1
          });
          setValue(countResponse?.[0]?.total || 0);
        } else {
          setValue('--');
        }
      }
    } catch (error) {
      console.error(`Failed to load number card data for ${cardName}:`, error);
      setValue('--');
    } finally {
      setIsLoading(false);
    }
  };

  const extractDoctypeFromCardName = (name: string): string | null => {
    const mappings: { [key: string]: string } = {
      'Total Outgoing Bills': 'Purchase Invoice',
      'Total Incoming Bills': 'Sales Invoice',
      'Total Incoming Payment': 'Payment Entry',
      'Total Outgoing Payment': 'Payment Entry',
      'Active Customers': 'Customer',
      'Active Suppliers': 'Supplier'
    };
    return mappings[name] || null;
  };

  const formatValue = (val: number | string): string => {
    if (typeof val === 'number') {
      if (val >= 1000000) {
        return `${(val / 1000000).toFixed(1)}M`;
      } else if (val >= 1000) {
        return `${(val / 1000).toFixed(1)}K`;
      }
      return val.toLocaleString();
    }
    return String(val);
  };

  return (
    <Card className="h-full hover:shadow-md transition-all duration-200">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {cardName}
        </CardTitle>
        <span className="text-xs text-muted-foreground">
          {/* Optional icon or indicator */}
        </span>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-4 w-12" />
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <div className="text-2xl font-bold">{formatValue(value)}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              {trend === 'up' && <ArrowUpIcon className="mr-1 h-3 w-3 text-green-500" />}
              {trend === 'down' && <ArrowDownIcon className="mr-1 h-3 w-3 text-red-500" />}
              {trend === 'neutral' && <MinusIcon className="mr-1 h-3 w-3" />}
              <span className={trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : ''}>
                {percentage}%
              </span>
              <span className="ml-1">from last month</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}