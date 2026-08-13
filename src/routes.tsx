import type { RouteObject } from 'react-router-dom';
import Dashboard from '@/components/Dashboard';
import WorkspaceView from '@/components/WorkspaceView';
import { SmartForm } from '@/views/forms';
import { SmartList } from '@/views/lists';
import PrintView from '@/pages/PrintView';
import ReportView from '@/pages/ReportView';
import { FileManager } from '@/components/views/FileManager';
import NotFound from '@/pages/NotFound';

/**
 * The authenticated app's route table, as a plain array (W0.12) so RouteRegistry (1C, Wave 1)
 * can become the actual source of this list without App.tsx changing shape again.
 *
 * CalendarView and KanbanView (src/components/views/) are intentionally not routed here — both
 * take per-doctype config (fieldToGroup, statuses) that doesn't have a source yet; wiring them
 * with guessed defaults would ship a wrong view rather than no view. That's Wave 4D's job
 * (alternate views), once SmartList has a real view-switcher to drive them from.
 */
export const routes: RouteObject[] = [
  { path: '/', element: <Dashboard /> },
  { path: '/workspace/:workspaceName', element: <WorkspaceView /> },
  { path: '/doctype/:doctype', element: <SmartList /> },
  { path: '/doctype/:doctype/print/:name', element: <PrintView /> },
  { path: '/doctype/:doctype/:name', element: <SmartForm /> },
  { path: '/reports/:reportName', element: <ReportView /> },
  { path: '/files', element: <FileManager /> },
  // ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE
  { path: '*', element: <NotFound /> },
];
