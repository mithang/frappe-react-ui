import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getFrappeApp } from '@/lib/frappe';
import { formatNumber } from '@/lib/format/formatNumber';

interface NumberCardProps {
  cardName: string;
  col?: number;
}

export function NumberCardWidget({ cardName }: NumberCardProps) {
  const [value, setValue] = useState<number | string>('--');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadNumberCardData();
  }, [cardName]);

  const loadNumberCardData = async () => {
    try {
      const frappe = getFrappeApp();

      // Call Frappe Number Card API
      let response: { message?: unknown } | null = null;
      try {
        response = await frappe.call('frappe.desk.doctype.number_card.number_card.get_result', {
          doc: { name: cardName },
        });
      } catch {
        // Fallback to legacy endpoint if available
        try {
          response = await frappe.call('frappe.desk.desktop.get_number_cards_data', {
            card_name: cardName,
          });
        } catch {
          response = null;
        }
      }

      if (response && response.message !== undefined && response.message !== null) {
        setValue(response.message as number | string);
      } else {
        const doctype = extractDoctypeFromCardName(cardName);
        if (doctype) {
          try {
            const countRes = await frappe.call('frappe.client.get_count', { doctype });
            setValue(typeof countRes.message === 'number' ? countRes.message : '--');
          } catch {
            setValue('--');
          }
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
    const mappings: Record<string, string> = {
      'Total Outgoing Bills': 'Purchase Invoice',
      'Total Incoming Bills': 'Sales Invoice',
      'Total Incoming Payment': 'Payment Entry',
      'Total Outgoing Payment': 'Payment Entry',
      'Active Customers': 'Customer',
      'Active Suppliers': 'Supplier',
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
      return formatNumber(val);
    }
    return String(val);
  };

  return (
    <Card className="h-full hover:shadow-md transition-all duration-200">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {cardName}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-20" />
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <div className="text-2xl font-bold">{formatValue(value)}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}