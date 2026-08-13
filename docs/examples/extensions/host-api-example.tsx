/**
 * Worked example of the host-based extension API (1C, Wave 1). This is what a downstream
 * Frappe app's UI bundle looks like — see the plan's "Downstream extensibility" section for the
 * full design rationale. Not wired into the app; reference material only, same as
 * SalesOrderExtension.tsx in this directory (the older, pre-host ScriptRegistry-only pattern).
 *
 * To actually install this: `installExtension(myAppExtension)` from
 * `@/core/registry/installExtension` — see its tests for the exact contract this is checked
 * against (src/core/registry/__tests__/installExtension.test.ts).
 */

import { defineExtension } from '@/sdk';

function MyReportsPage() {
  return <div className="p-6">My App's custom reports page.</div>;
}

export default defineExtension({
  name: 'my_app',
  apiVersion: '1.0',
  setup(host) {
    // Sidebar entry, gated to a role.
    host.nav.addItem({ label: 'My Reports', route: '/my-app/reports', roles: ['Sales User'] });

    // The route that nav entry points at.
    host.routes.add({ path: '/my-app/reports', element: <MyReportsPage /> });

    // A form toolbar button on a specific doctype.
    host.forms.addButton('Sales Order', {
      label: 'Sync to CRM',
      group: 'Actions',
      onClick: (frm) => {
        console.log('Syncing', frm.docname, 'to CRM...');
      },
    });

    // A list bulk action.
    host.lists.addBulkAction('Sales Order', {
      label: 'Approve',
      onClick: (names) => {
        console.log('Approving', names);
      },
    });

    // A command-palette entry.
    host.commands.add({
      label: 'Open CRM',
      onRun: () => window.open('https://crm.example.com', '_blank'),
    });

    // A typed client-script hook, same shim ScriptRegistry already supports.
    host.scripts.on('Sales Order', {
      validate(frm) {
        if (!frm.doc.customer) {
          throw new Error('Customer is required before saving.');
        }
      },
    });
  },
});
