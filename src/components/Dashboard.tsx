import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getFrappeApp } from '@/lib/frappe';
import { formatNumber } from '@/lib/format/formatNumber';
import { useToast } from '@/hooks/use-toast';
import { Briefcase, ArrowUpRight, Activity, Layers, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';

interface QuickDocType {
  doctype: string;
  count: number | null;
  label: string;
}

const Dashboard: React.FC = () => {
  const [doctypes, setDoctypes] = useState<QuickDocType[]>([
    { doctype: 'Sales Order', count: null, label: 'Sales Orders' },
    { doctype: 'Customer', count: null, label: 'Customers' },
    { doctype: 'Item', count: null, label: 'Items' },
    { doctype: 'Purchase Order', count: null, label: 'Purchase Orders' },
  ]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadCounts();
  }, []);

  const loadCounts = async () => {
    try {
      const frappe = getFrappeApp();
      const updated = await Promise.all(
        doctypes.map(async (dt) => {
          try {
            const countRes = await frappe.call('frappe.client.get_count', { doctype: dt.doctype });
            return { ...dt, count: typeof countRes.message === 'number' ? countRes.message : 0 };
          } catch {
            return { ...dt, count: null };
          }
        })
      );
      setDoctypes(updated);
    } catch (error) {
      console.error('Failed to load system counts:', error);
      toast({
        title: 'Notice',
        description: 'Loaded workspace overview',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="border-muted shadow-sm overflow-hidden">
              <CardHeader className="animate-pulse space-y-4">
                <div className="h-4 bg-muted rounded w-24"></div>
                <div className="h-8 bg-muted rounded w-32"></div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Workspace Overview</h1>
          <p className="text-muted-foreground text-lg">Frappe Desk application portal.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {doctypes.map((item) => (
          <Card key={item.doctype} className="border-border/50 shadow-soft hover-elevate transition-all overflow-hidden group">
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start mb-2">
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{item.label}</span>
                <div className="p-2 bg-muted/50 rounded-xl group-hover:bg-primary/10 transition-colors">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-3xl font-bold tracking-tight">
                  {item.count !== null ? formatNumber(item.count) : '--'}
                </span>
                <p className="text-xs text-muted-foreground font-medium">Total Documents</p>
              </div>
            </CardHeader>
            <div className="px-6 pb-4">
              <Link
                to={`/doctype/${item.doctype}`}
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
              >
                View List <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 border-border/50 shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-bold">Activity Feed</CardTitle>
              <CardDescription>Recent system events</CardDescription>
            </div>
            <Activity className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="py-12 text-center text-muted-foreground text-sm">
              No recent activity recorded.
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-soft">
          <CardHeader>
            <CardTitle className="text-xl font-bold">Shortcuts</CardTitle>
            <CardDescription>Primary workflows</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3">
            {[
              { label: 'Sales Order List', route: '/doctype/Sales Order', icon: <Briefcase className="h-4 w-4 text-blue-500" /> },
              { label: 'Customer List', route: '/doctype/Customer', icon: <Layers className="h-4 w-4 text-purple-500" /> },
              { label: 'Item List', route: '/doctype/Item', icon: <FileText className="h-4 w-4 text-orange-500" /> },
            ].map((action) => (
              <Link
                key={action.label}
                to={action.route}
                className="group flex items-center justify-between p-4 bg-muted/30 border border-transparent hover:border-border hover:bg-background hover:shadow-sm rounded-2xl transition-all"
              >
                <div className="flex items-center gap-3">
                  {action.icon}
                  <span className="text-sm font-bold">{action.label}</span>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all" />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;