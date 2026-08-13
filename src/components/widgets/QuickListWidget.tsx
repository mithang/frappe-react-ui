import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { getFrappeApp } from '@/lib/frappe';
import { formatDate } from '@/lib/format/formatDate';

interface QuickListProps {
  listName: string;
  col?: number;
}

interface QuickListItem {
  name: string;
  modified?: string;
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

export function QuickListWidget({ listName, col = 6 }: QuickListProps) {
  const [items, setItems] = useState<QuickListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadQuickListData();
  }, [listName]);

  const loadQuickListData = async () => {
    try {
      const frappe = getFrappeApp();
      // Fetch name and modified - avoid requesting 'title' unconditionally
      const response = await frappe.getDocList(listName, {
        fields: ['name', 'modified'],
        limit_page_length: 5,
        order_by: 'modified desc',
      });
      setItems((response as QuickListItem[]) || []);
    } catch (error) {
      console.error(`Failed to load quick list data for ${listName}:`, error);
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  const colClass = colClassMap[col] || 'col-span-full';

  if (isLoading) {
    return (
      <div className={colClass}>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{listName}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={colClass}>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{listName}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {items.length > 0 ? (
              items.map((item) => (
                <div key={item.name} className="flex items-center justify-between py-1">
                  <span className="text-xs font-medium truncate">
                    {item.name}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {item.modified ? formatDate(item.modified) : 'No date'}
                  </Badge>
                </div>
              ))
            ) : (
              <div className="text-xs text-muted-foreground">No items found</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}