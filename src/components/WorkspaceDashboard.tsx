import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Workspace, WorkspaceWidget } from '@/hooks/useWorkspaces';
import { WorkspaceQuickList } from '@/components/widgets/WorkspaceQuickList';
import { NumberCardWidget } from '@/components/widgets/NumberCardWidget';
import { ChartWidget } from '@/components/widgets/ChartWidget';
import { OnboardingWidget } from '@/components/widgets/OnboardingWidget';
import { resolveLucideIcon } from '@/lib/icons';
import { decodeHtmlText } from '@/lib/html';
import {
  FileText,
  Users,
  CreditCard,
  ShoppingCart,
  Package,
  BarChart3,
  Settings,
  FileSpreadsheet,
  Building2,
  Briefcase,
  Layers,
  HelpCircle,
  BookOpen
} from 'lucide-react';

const IconForShortcut = ({ name }: { name: string }) => {
  const lower = name.toLowerCase();

  if (lower.includes('user') || lower.includes('customer') || lower.includes('employee')) return <Users className="w-5 h-5" />;
  if (lower.includes('invoice') || lower.includes('bill')) return <FileSpreadsheet className="w-5 h-5" />;
  if (lower.includes('payment') || lower.includes('journal')) return <CreditCard className="w-5 h-5" />;
  if (lower.includes('order') || lower.includes('quotation')) return <ShoppingCart className="w-5 h-5" />;
  if (lower.includes('item') || lower.includes('product') || lower.includes('inventory')) return <Package className="w-5 h-5" />;
  if (lower.includes('report') || lower.includes('analytics')) return <BarChart3 className="w-5 h-5" />;
  if (lower.includes('setting') || lower.includes('setup')) return <Settings className="w-5 h-5" />;
  if (lower.includes('company') || lower.includes('department')) return <Building2 className="w-5 h-5" />;
  if (lower.includes('project') || lower.includes('task')) return <Briefcase className="w-5 h-5" />;
  if (lower.includes('asset')) return <Layers className="w-5 h-5" />;
  if (lower.includes('help') || lower.includes('support')) return <HelpCircle className="w-5 h-5" />;
  if (lower.includes('learn') || lower.includes('doc')) return <BookOpen className="w-5 h-5" />;

  return <FileText className="w-5 h-5" />;
};

interface WorkspaceDashboardProps {
  workspace: Workspace;
  onShortcutClick: (shortcutName: string) => void;
}

export function WorkspaceDashboard({ workspace, onShortcutClick }: WorkspaceDashboardProps) {
  const getColSpanClass = (col: number) => {
    // Tailwind needs static classes to work properly
    const cols = Math.min(Math.max(col, 1), 12);
    switch (cols) {
      case 1: return 'col-span-12 md:col-span-1';
      case 2: return 'col-span-12 md:col-span-2';
      case 3: return 'col-span-12 md:col-span-3';
      case 4: return 'col-span-12 md:col-span-4';
      case 5: return 'col-span-12 md:col-span-5';
      case 6: return 'col-span-12 md:col-span-6';
      case 7: return 'col-span-12 md:col-span-7';
      case 8: return 'col-span-12 md:col-span-8';
      case 9: return 'col-span-12 md:col-span-9';
      case 10: return 'col-span-12 md:col-span-10';
      case 11: return 'col-span-12 md:col-span-11';
      case 12: return 'col-span-12';
      default: return 'col-span-12';
    }
  };

  const renderWidget = (widget: WorkspaceWidget) => {
    const colClass = getColSpanClass(widget.data.col || 12);

    switch (widget.type) {
      case 'header':
        return (
          <div key={widget.id} className={`${colClass} mb-2 mt-4 first:mt-0`}>
            <div className="text-lg font-semibold tracking-tight text-foreground">
              {widget.data.text ? decodeHtmlText(widget.data.text) : ''}
            </div>
          </div>
        );

      case 'shortcut':
        return (
          <div key={widget.id} className={colClass}>
            <Button
              variant="outline"
              className="w-full h-auto py-6 flex flex-col items-center justify-center gap-3 bg-card hover:bg-accent/50 hover:border-primary/50 transition-all duration-200 border-border group shadow-sm"
              onClick={() => onShortcutClick(widget.data.shortcut_name || '')}
            >
              <div className="p-3 rounded-full bg-primary/5 text-primary group-hover:bg-primary/10 transition-colors">
                <IconForShortcut name={widget.data.shortcut_name || widget.data.label || ''} />
              </div>
              <span className="text-sm font-medium text-foreground whitespace-normal text-center leading-snug">
                {widget.data.label || widget.data.shortcut_name}
              </span>
            </Button>
          </div>
        );

      case 'card':
        return (
          <div key={widget.id} className={colClass}>
            <Card className="h-full cursor-pointer hover:shadow-md transition-all duration-200 hover:border-primary/50">
              <CardContent className="p-6 flex flex-col items-center justify-center h-full gap-3">
                <div className="p-3 rounded-full bg-primary/5 text-primary">
                  <IconForShortcut name={widget.data.card_name || ''} />
                </div>
                <span className="text-sm font-medium text-center">{widget.data.card_name}</span>
              </CardContent>
            </Card>
          </div>
        );

      case 'number_card':
        return (
          <div key={widget.id} className={colClass}>
            <NumberCardWidget
              cardName={widget.data.number_card_name || ''}
              col={widget.data.col || 4}
            />
          </div>
        );

      case 'chart':
        return (
          <div key={widget.id} className={colClass}>
            <ChartWidget
              chartName={widget.data.chart_name || ''}
              col={widget.data.col || 12}
            />
          </div>
        );

      case 'quick_list':
        return (
          <div key={widget.id} className={colClass}>
            <WorkspaceQuickList workspace={workspace} widget={widget} />
          </div>
        );

      case 'onboarding':
        return (
          <div key={widget.id} className={colClass}>
            <OnboardingWidget
              onboardingName={widget.data.onboarding_name || ''}
              col={widget.data.col || 12}
            />
          </div>
        );

      case 'spacer':
        return <div key={widget.id} className={`${colClass} h-6`} />;

      default:
        return null;
    }
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto animate-in fade-in duration-500">
      <div className="mb-8 border-b pb-4">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary">
            {(() => {
              const WorkspaceIcon = resolveLucideIcon(workspace.icon, FileText);
              return <WorkspaceIcon className="w-5 h-5" />;
            })()}
          </span>
          {workspace.label}
        </h1>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {workspace.widgets.map(renderWidget)}
      </div>
    </div>
  );
}