import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getFrappeClient } from '@/lib/api/client';
import { formatNumber } from '@/lib/format/formatNumber';

interface NumberCardProps {
  cardName: string;
  col?: number;
}

/**
 * frappe.desk.doctype.number_card.number_card.get_result(doc, filters, to_date?) requires the
 * card's FULL document (not just its name — it reads doc.function/doc.aggregate_function_based_on
 * server-side) and an explicit `filters` argument (missing entirely, not just falsy, throws a
 * TypeError) — both verified live against a real bench after the previous version's call
 * (`{ doc: { name: cardName } }`, no filters) 500'd on every card. frappe.desk.desktop.
 * get_number_cards_data, the fallback this used to try first, doesn't exist on any Frappe
 * version (confirmed live).
 */
export function NumberCardWidget({ cardName }: NumberCardProps) {
  const [value, setValue] = useState<number | string>('--');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadNumberCardData();
  }, [cardName]);

  const loadNumberCardData = async () => {
    setIsLoading(true);
    try {
      const client = getFrappeClient();

      // client.getDoc IS frappe.desk.form.load.getdoc — the same endpoint Desk uses via
      // frappe.model.with_doc, with the same permission behaviour. Don't reach for
      // client.call('frappe.desk.form.load.getdoc') instead: call() returns `body.message`,
      // and getdoc has no `message` key (it replies { docs, docinfo, _link_titles }). That
      // yields undefined for a card that exists, and `[]` for one that doesn't — and `[]` is
      // truthy, so it sailed past the guard and posted doc:"[]", which the server parsed as a
      // list and died on with "AttributeError: 'list' object has no attribute 'function'".
      const { doc } = await client.getDoc('Number Card', cardName);

      const filters = (() => {
        try {
          return JSON.parse((doc.filters_json as string) || '[]');
        } catch {
          return [];
        }
      })();

      const result = await client.call<number>('frappe.desk.doctype.number_card.number_card.get_result', {
        doc: JSON.stringify(doc),
        filters: JSON.stringify(filters),
      });

      setValue(typeof result === 'number' ? result : '--');
    } catch (error) {
      console.error(`Failed to load number card data for ${cardName}:`, error);
      setValue('--');
    } finally {
      setIsLoading(false);
    }
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
    <Card className="hover:shadow-md transition-all duration-200">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          {cardName}
        </CardTitle>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          className="h-4 w-4 text-muted-foreground"
        >
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-20" />
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <div className="text-2xl font-bold">{formatValue(value)}</div>
            <p className="text-xs text-muted-foreground">
              Based on live data
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
