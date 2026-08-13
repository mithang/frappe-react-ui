// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DocInfoSidebar } from '../docinfo/DocInfoSidebar';
import { ReportRunner } from '../reports/ReportRunner';
import { PrintPreview } from '../print/PrintPreview';
import { KanbanView } from '../views/KanbanView';
import { CalendarView } from '../views/CalendarView';
import { FileManager } from '../views/FileManager';

// vi.hoisted() ensures these are initialized before vi.mock() factories run,
// which is required since vi.mock() is hoisted to the top of the file.
const { callMock, getDocListMock } = vi.hoisted(() => {
  const callMock = vi.fn().mockImplementation((method: string) => {
    if (method === 'frappe.desk.form.utils.add_comment') {
      return Promise.resolve({ message: 'ok' });
    }
    if (method === 'frappe.desk.query_report.run') {
      return Promise.resolve({
        message: {
          columns: [{ fieldname: 'name', label: 'ID' }, { fieldname: 'status', label: 'Status' }],
          result: [{ name: 'SO-001', status: 'Draft' }],
        },
      });
    }
    if (method === 'frappe.www.printview.get_html_and_style') {
      return Promise.resolve({ html: '<div>Print HTML Content</div>' });
    }
    return Promise.resolve({ message: 'ok' });
  });

  const getDocListMock = vi.fn().mockImplementation((doctype: string) => {
    if (doctype === 'Print Format') {
      return Promise.resolve([{ name: 'Standard' }, { name: 'Custom Invoice' }]);
    }
    if (doctype === 'File') {
      return Promise.resolve([
        { name: 'FILE-001', file_name: 'test.pdf', file_size: 2048, creation: '2026-08-01' },
      ]);
    }
    return Promise.resolve([
      { name: 'SO-001', modified: '2026-08-01', creation: '2026-08-01', status: 'Draft' },
    ]);
  });

  return { callMock, getDocListMock };
});

vi.mock('@/lib/frappe', () => ({
  getFrappeApp: () => ({
    call: callMock,
    getDocList: getDocListMock,
  }),
}));

// ReportRunner talks to the FrappeClient directly (not the deprecated shim).
vi.mock('@/lib/api/client', () => ({
  getFrappeClient: () => ({
    call: (method: string, args?: unknown) => callMock(method, args).then((r: any) => r?.message ?? r),
  }),
}));

// Filter definitions live inside the report's own JS; evaluating that is covered separately, so
// here we hand the component one filter and assert the behaviour that depends on it.
vi.mock('@/lib/frappe/reportScript', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/frappe/reportScript')>();
  return {
    ...actual,
    getReportFilterDefs: vi.fn().mockResolvedValue([
      { fieldname: 'company', label: 'Company', fieldtype: 'Data', reqd: 1, default: 'ACME' },
    ]),
  };
});

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { full_name: 'Jane User', email: 'jane@example.com' },
    logout: vi.fn(),
  }),
}));

beforeEach(() => {
  callMock.mockClear();
  getDocListMock.mockClear();
});

// ============================================================================
// Wave 3A: DocInfoSidebar
// ============================================================================
describe('Wave 3A: DocInfoSidebar', () => {
  const docinfo = {
    comments: [{ name: 'c1', comment_email: 'jane@example.com', content: 'Test Comment', creation: '2026-08-01' }],
    tags: 'urgent,sales',
    attachments: [],
    assignments: ['jane@example.com'],
  };

  it('renders existing comments with correct author email', () => {
    render(<DocInfoSidebar doctype="Sales Order" name="SO-001" docinfo={docinfo} />);
    expect(screen.getByText('Test Comment')).toBeDefined();
    expect(screen.getByText('jane@example.com')).toBeDefined();
  });

  it('submits comment using authenticated user email from useAuth(), NOT hardcoded Administrator', async () => {
    render(<DocInfoSidebar doctype="Sales Order" name="SO-001" docinfo={docinfo} />);

    const textarea = screen.getByPlaceholderText('Add a comment...');
    fireEvent.change(textarea, { target: { value: 'My new comment' } });

    const submitBtn = screen.getByRole('button', { name: /comment/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(callMock).toHaveBeenCalledWith(
        'frappe.desk.form.utils.add_comment',
        expect.objectContaining({
          comment_email: 'jane@example.com',
          comment_by: 'Jane User',
          content: 'My new comment',
          reference_doctype: 'Sales Order',
          reference_name: 'SO-001',
        })
      );
    });
  });
});

// ============================================================================
// Wave 4B: ReportRunner
// ============================================================================
describe('Wave 4B: ReportRunner', () => {
  const renderReport = () =>
    render(
      <MemoryRouter>
        <ReportRunner reportName="Sales Analytics" />
      </MemoryRouter>
    );

  it('runs query report on mount and displays columns and result rows', async () => {
    renderReport();
    expect(await screen.findByText('Sales Analytics')).toBeDefined();
    expect(await screen.findByText('SO-001')).toBeDefined();
  });

  it("seeds filters from the report's own defaults before running", async () => {
    // Running with {} makes any report with mandatory filters return zero rows, so the defaults
    // declared in its script have to reach the query.
    renderReport();
    await screen.findByText('SO-001');

    const runCall = callMock.mock.calls.find((args) => args[0] === 'frappe.desk.query_report.run');
    expect(runCall?.[1]).toMatchObject({ filters: { company: 'ACME' } });
  });

  it('does NOT re-run report on every keystroke (regression: infinite loop)', async () => {
    renderReport();
    // Wait for initial mount load to complete
    await screen.findByText('SO-001');

    const initialCallCount = callMock.mock.calls.filter(
      (args) => args[0] === 'frappe.desk.query_report.run'
    ).length;

    // Typing in a filter must NOT trigger additional API calls — only Run Report does.
    const input = screen.getByDisplayValue('ACME');
    fireEvent.change(input, { target: { value: 'test' } });
    fireEvent.change(input, { target: { value: 'test2' } });
    fireEvent.change(input, { target: { value: 'test3' } });

    // Flush any queued micro-tasks
    await new Promise((r) => setTimeout(r, 100));

    const callsAfterTyping = callMock.mock.calls.filter(
      (args) => args[0] === 'frappe.desk.query_report.run'
    ).length;
    expect(callsAfterTyping).toBe(initialCallCount); // no extra API calls from keystrokes
  });
});

// ============================================================================
// Wave 4C: PrintPreview
// ============================================================================
describe('Wave 4C: PrintPreview', () => {
  it('renders iframe with sandbox attribute after async HTML load', async () => {
    render(<PrintPreview doctype="Sales Order" name="SO-001" />);
    const iframe = (await screen.findByTitle('Print Preview')) as HTMLIFrameElement;
    expect(iframe).toBeDefined();
    expect(iframe.getAttribute('sandbox')).toContain('allow-same-origin');
    expect(iframe.getAttribute('sandbox')).toContain('allow-scripts');
  });
});

// ============================================================================
// Wave 4D: KanbanView, CalendarView, FileManager
// ============================================================================
describe('Wave 4D: KanbanView, CalendarView, and FileManager', () => {
  it('KanbanView groups documents and renders all default status columns (stable ref)', async () => {
    render(
      <MemoryRouter>
        <KanbanView doctype="Sales Order" fieldToGroup="status" />
      </MemoryRouter>
    );
    expect(await screen.findByText('Draft')).toBeDefined();
    expect(await screen.findByText('Submitted')).toBeDefined();
    expect(await screen.findByText('Cancelled')).toBeDefined();
  });

  it('CalendarView renders calendar picker grid and event list', async () => {
    render(
      <MemoryRouter>
        <CalendarView doctype="Sales Order" />
      </MemoryRouter>
    );
    expect(await screen.findByText('Sales Order Calendar')).toBeDefined();
    // shadcn Calendar renders an ARIA grid for the month view
    expect(screen.getByRole('grid')).toBeDefined();
  });

  it('FileManager displays uploaded files in table with correct name', async () => {
    render(<FileManager />);
    expect(await screen.findByText('test.pdf')).toBeDefined();
  });
});
