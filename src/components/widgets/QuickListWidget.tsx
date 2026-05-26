import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { getFrappeApp } from '@/lib/frappe';

interface QuickListProps {
  listName: string;
  col: number;
}

interface QuickListItem {
  name: string;
  title?: string;
  modified?: string;
  [key: string]: any;
}

export function QuickListWidget({ listName, col }: QuickListProps) {
  const [items, setItems] = useState<QuickListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadQuickListData();
  }, [listName]);

  const loadQuickListData = async () => {
    try {
      const frappe = getFrappeApp();
      // Try to load the actual doctype data
      const response = await frappe.getDocList(listName, {
        fields: ['name', 'title', 'modified'],
        limit_page_length: 5,
        order_by: 'modified desc'
      });
      setItems(response || []);
    } catch (error) {
      console.error(`Failed to load quick list data for ${listName}:`, error);
      // Set empty array on error
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  const colClass = `col-span-${Math.min(col, 12)}`;

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
                    {item.title || item.name}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {item.modified ? new Date(item.modified).toLocaleDateString() : 'No date'}
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