import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getFrappeApp } from '@/lib/frappe';
import { useToast } from '@/hooks/use-toast';
import { TrendingUp, Users, Package, Briefcase, ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';

interface DashboardCard {
  name: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  stats: {
    value: number;
    label: string;
    trend?: number;
  }[];
}

const Dashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const mockDashboard = [
        {
          name: 'sales',
          label: 'Total Revenue',
          icon: <TrendingUp className="h-5 w-5 text-blue-500" />,
          color: 'blue',
          stats: [
            { value: 125000, label: 'Monthly Sales', trend: 12.5 },
          ],
        },
        {
          name: 'customers',
          label: 'Active Customers',
          icon: <Users className="h-5 w-5 text-purple-500" />,
          color: 'purple',
          stats: [
            { value: 1250, label: 'Total Clients', trend: 8.2 },
          ],
        },
        {
          name: 'inventory',
          label: 'Stock Level',
          icon: <Package className="h-5 w-5 text-orange-500" />,
          color: 'orange',
          stats: [
            { value: 850, label: 'Items in Stock', trend: -2.4 },
          ],
        },
        {
          name: 'hr',
          label: 'Total Workforce',
          icon: <Briefcase className="h-5 w-5 text-emerald-500" />,
          color: 'emerald',
          stats: [
            { value: 125, label: 'Employees', trend: 4.1 },
          ],
        },
      ];

      setDashboardData(mockDashboard);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
      toast({
        title: 'Error',
        description: 'Failed to load dashboard data',
        variant: 'destructive',
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
              <div className="h-1 w-full bg-muted animate-pulse" />
              <CardHeader className="animate-pulse space-y-4">
                <div className="flex justify-between items-start">
                  <div className="h-4 bg-muted rounded w-24"></div>
                  <div className="h-8 w-8 bg-muted rounded-lg"></div>
                </div>
                <div className="space-y-2">
                  <div className="h-8 bg-muted rounded w-32"></div>
                  <div className="h-4 bg-muted rounded w-16"></div>
                </div>
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
          <h1 className="text-3xl font-extrabold tracking-tight">System Overview</h1>
          <p className="text-muted-foreground text-lg">Real-time performance metrics for your enterprise.</p>
        </div>
        <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-lg border">
          <button className="px-3 py-1.5 text-sm font-medium bg-background shadow-sm rounded-md border">1D</button>
          <button className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">1W</button>
          <button className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">1M</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {dashboardData.map((card) => (
          <Card key={card.name} className="border-border/50 shadow-soft hover-elevate transition-all overflow-hidden group">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start mb-2">
                <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{card.label}</span>
                <div className="p-2 bg-muted/50 rounded-xl group-hover:bg-primary/10 transition-colors">
                  {card.icon}
                </div>
              </div>
              {card.stats.map((stat, index) => (
                <div key={index} className="space-y-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold tracking-tight">
                      {card.name === 'sales' ? '$' : ''}{stat.value.toLocaleString()}
                    </span>
                    {stat.trend && (
                      <span className={`flex items-center text-xs font-bold ${stat.trend > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {stat.trend > 0 ? <ArrowUpRight className="h-3 w-3 mr-0.5" /> : <ArrowDownRight className="h-3 w-3 mr-0.5" />}
                        {Math.abs(stat.trend)}%
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground font-medium">vs last month</p>
                </div>
              ))}
            </CardHeader>
            <div className="h-1.5 w-full bg-muted mt-4">
              <div 
                className={`h-full bg-primary transition-all duration-1000 ease-out`} 
                style={{ width: '65%' }}
              />
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 border-border/50 shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl font-bold">Activity Feed</CardTitle>
              <CardDescription>Monitor ongoing system operations</CardDescription>
            </div>
            <Activity className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {[
                { title: 'New sales order SO-2024-00156 created', time: '2 mins ago', type: 'order' },
                { title: 'Customer payment received for INV-2024-00234', time: '15 mins ago', type: 'payment' },
                { title: 'Item ITM-001 inventory level low', time: '1 hour ago', type: 'alert' },
                { title: 'New employee onboarded: Jane Doe', time: '3 hours ago', type: 'hr' },
              ].map((activity, index) => (
                <div key={index} className="flex items-start gap-4 p-3 hover:bg-muted/30 rounded-xl transition-colors">
                  <div className={`mt-1 h-2 w-2 rounded-full ring-4 ring-offset-2 ${
                    activity.type === 'alert' ? 'bg-red-500 ring-red-500/20' : 
                    activity.type === 'payment' ? 'bg-emerald-500 ring-emerald-500/20' : 
                    'bg-blue-500 ring-blue-500/20'
                  }`} />
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-semibold leading-none">{activity.title}</p>
                    <p className="text-xs text-muted-foreground font-medium">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
            <button className="w-full mt-6 py-2 text-sm font-bold text-primary hover:bg-primary/5 rounded-lg transition-colors">
              View All Activities
            </button>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-soft">
          <CardHeader>
            <CardTitle className="text-xl font-bold">Operations</CardTitle>
            <CardDescription>Primary workflow actions</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3">
            {[
              { label: 'Create New Order', icon: '📝', color: 'blue' },
              { label: 'Register Customer', icon: '👤', color: 'purple' },
              { label: 'Manage Inventory', icon: '📦', color: 'orange' },
              { label: 'Financial Reports', icon: '📈', color: 'emerald' },
            ].map((action) => (
              <button
                key={action.label}
                className="group flex items-center justify-between p-4 bg-muted/30 border border-transparent hover:border-border hover:bg-background hover:shadow-sm rounded-2xl transition-all text-left"
              >
                <div className="flex items-center gap-4">
                  <div className="text-2xl grayscale group-hover:grayscale-0 transition-all">{action.icon}</div>
                  <span className="text-sm font-bold">{action.label}</span>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all" />
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;