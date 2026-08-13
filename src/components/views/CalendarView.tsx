import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { getFrappeApp } from '@/lib/frappe';
import { formatDate } from '@/lib/format/formatDate';
import { Calendar as CalendarIcon, Filter } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface CalendarViewProps {
  doctype: string;
  fieldToDate?: string;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ doctype, fieldToDate = 'creation' }) => {
  const [events, setEvents] = useState<Record<string, unknown>[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    try {
      const frappe = getFrappeApp();
      const docs = await frappe.getDocList(doctype, {
        fields: ['name', fieldToDate, 'modified'],
        limit_page_length: 50,
        order_by: `${fieldToDate} desc`,
      });
      setEvents((docs as Record<string, unknown>[]) || []);
    } catch (err) {
      console.error('Failed to load calendar events:', err);
    } finally {
      setLoading(false);
    }
  }, [doctype, fieldToDate]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const filteredEvents = selectedDate
    ? events.filter((evt) => {
        const rawDate = evt[fieldToDate];
        if (!rawDate) return false;
        const evtDate = new Date(String(rawDate));
        return (
          evtDate.getFullYear() === selectedDate.getFullYear() &&
          evtDate.getMonth() === selectedDate.getMonth() &&
          evtDate.getDate() === selectedDate.getDate()
        );
      })
    : events;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CalendarIcon className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">{doctype} Calendar</h1>
        </div>
        {selectedDate && (
          <Button variant="ghost" size="sm" onClick={() => setSelectedDate(undefined)}>
            <Filter className="h-4 w-4 mr-1" /> Show All Dates
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-4 flex justify-center items-center">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            className="rounded-md border"
          />
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="border-b flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">
              {selectedDate
                ? `Events for ${formatDate(selectedDate)}`
                : 'All Scheduled / Created Documents'}
            </CardTitle>
            <Badge variant="secondary">{filteredEvents.length}</Badge>
          </CardHeader>
          <CardContent className="p-6">
            {loading ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Loading calendar data...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredEvents.map((evt) => {
                  const docName = String(evt.name || '');
                  const rawDate = evt[fieldToDate];
                  return (
                    <div key={docName} className="p-4 border rounded-xl bg-card hover:shadow-md transition-shadow">
                      <Link to={`/app/form/${doctype}/${docName}`} className="font-bold text-sm text-primary">
                        {docName}
                      </Link>
                      <p className="text-xs text-muted-foreground mt-1">
                        Date: {rawDate ? formatDate(rawDate) : '-'}
                      </p>
                    </div>
                  );
                })}
                {!filteredEvents.length && (
                  <div className="col-span-full py-12 text-center text-sm text-muted-foreground">
                    No events found for selected period
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
