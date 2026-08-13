// frmProxy — wraps a real FormController (FormControllerImpl, frozen) so that classic,
// server-stored "Client Script" JavaScript (`frappe.ui.form.on('DocType', { validate(frm) {...} })`)
// can call `frm.*` the way it does against real Desk. Scoped to exactly the 80/20 surface this
// project's migration plan settled on — see the doc comment on `SUPPORTED` below for the list.
//
// Design: a `Proxy` over an empty object, NOT a hand-built object literal with the supported
// methods plus stub no-ops for everything else. A literal risks a member silently existing (and
// returning `undefined`) that nobody remembered to implement; the Proxy's `get` trap has exactly
// one default case — throw, naming both the offending member and the script that touched it. This
// is the "fail loudly" requirement: an unsupported classic API call must never quietly no-op.
//
// `frm.doc` is intentionally NOT captured once at proxy-creation time. It is a getter that reads
// `controller.doc` fresh on every access, because `controller.doc` itself is a getter over the
// live zustand store (`store.getState().draft`) — snapshotting it here would silently go stale
// the moment a script (or the user) changes a field after the proxy was built.

import type { DocField, Document, FormController } from '@/core/types';
import { FormRegistry } from '@/core/registry/FormRegistry';
import { getFrappeClient } from '@/lib/api/client';

/** The exact `frm.*` surface classic Client Scripts get — see task's 80/20 list. Nothing else. */
export interface FrmProxy {
  readonly doc: Document;
  readonly doctype: string;
  readonly docname: string;
  set_value(fieldname: string, value: unknown): Promise<void>;
  get_value(fieldname: string): unknown;
  set_df_property(fieldname: string, property: keyof DocField, value: unknown): void;
  toggle_display(fieldname: string, show: boolean): void;
  toggle_reqd(fieldname: string, reqd: boolean): void;
  toggle_read_only(fieldname: string, read_only: boolean): void;
  add_custom_button(label: string, handler: (frm: FrmProxy) => void, group?: string): void;
  set_query(fieldname: string, filtersOrFn: unknown): void;
  refresh_field(fieldname: string): void;
  save(): Promise<void>;
  call(method: string, args?: Record<string, unknown>): Promise<unknown>;
  add_child(tablefieldname: string, values?: Record<string, unknown>): Record<string, unknown>;
  clear_table(tablefieldname: string): void;
}

/** Every callable member the proxy exposes — anything else falls through to the throwing default. */
type HandlerMap = {
  [K in keyof Omit<FrmProxy, 'doc' | 'doctype' | 'docname'>]: FrmProxy[K];
};

function buildHandlers(controller: FormController, scriptName: string, getProxy: () => FrmProxy): HandlerMap {
  return {
    set_value: (fieldname, value) => controller.set_value(fieldname as never, value as never),

    get_value: (fieldname) => controller.get_value(fieldname as never),

    set_df_property: (fieldname, property, value) => controller.set_df_property(fieldname, property, value),

    toggle_display: (fieldname, show) => controller.toggle_display(fieldname, show),

    toggle_reqd: (fieldname, reqd) => controller.toggle_reqd(fieldname, reqd),

    toggle_read_only: (fieldname, read_only) => controller.toggle_read_only(fieldname, read_only),

    // Pass the frmProxy itself (not the raw controller) into the button's own handler, so a
    // script's `add_custom_button` callback gets the identical classic `frm.*` surface.
    add_custom_button: (label, handler, group) => {
      FormRegistry.addButton(controller.doctype, {
        label,
        group,
        onClick: () => handler(getProxy()),
      });
    },

    // `link_filters` is the seam DocField reserves specifically for this (see document.ts comment).
    // set_df_property already routes through formStore's setOverride, which is exactly the
    // mechanism `link_filters` was added for — no new plumbing needed.
    set_query: (fieldname, filtersOrFn) => {
      controller.set_df_property(fieldname, 'link_filters', filtersOrFn);
    },

    // No-op: zustand subscribers re-render on their own (see FormControllerImpl.refresh_fields'
    // comment). Still a real, callable member — never throws — because classic scripts call this
    // defensively after almost every field mutation.
    refresh_field: () => {
      // intentionally empty
    },

    save: () => controller.save(),

    // Classic `frm.call(method, args)` merges `doc: frm.doc` into the request when no explicit
    // `doc` override is given (verified against frappe/public/js/frappe/form/form.js — `call()`
    // sets `opts.doc = this.doc` and, when `opts.doc` is set, does NOT prefix `method` with the
    // server module name — that prefixing only happens on the doc-less branch). We only support
    // the common doc-bound form, so we always merge `doc` in and never rewrite `method`.
    call: async (method, args = {}) => {
      return getFrappeClient().call(method, { ...args, doc: controller.doc });
    },

    // Child rows must NEVER get a fabricated `name` — that's a documented gotcha (fake `name`
    // values on new rows are wrong; real Frappe leaves `name` absent and relies on `__islocal: 1`
    // until the row is actually saved). Any `name` passed in `values` is explicitly stripped.
    add_child: (tablefieldname, values = {}) => {
      const field = controller.meta.fields.find((f) => f.fieldname === tablefieldname);
      const childDoctype = field?.options;
      const table = ((controller.get_value(tablefieldname as never) as unknown[] | undefined) ?? []) as Record<
        string,
        unknown
      >[];

      const { name: _discardedFakeName, ...rest } = values;
      const newRow: Record<string, unknown> = {
        ...rest,
        doctype: childDoctype,
        parent: controller.docname,
        parentfield: tablefieldname,
        parenttype: controller.doctype,
        __islocal: 1,
        idx: table.length + 1,
      };

      controller.set_value(tablefieldname as never, [...table, newRow] as never);
      return newRow;
    },

    clear_table: (tablefieldname) => {
      controller.set_value(tablefieldname as never, [] as never);
    },
  };
}

/**
 * Wraps `controller` (a real FormControllerImpl, or anything satisfying the FormController
 * interface) in the classic `frm.*` surface. `scriptName` is threaded through purely for error
 * attribution — every "unsupported member" error names both the script and the member.
 */
export function createFrmProxy(controller: FormController, scriptName: string): FrmProxy {
  // `getProxy` lets `add_custom_button`'s closure refer to the proxy object without a
  // chicken-and-egg problem (the proxy doesn't exist yet while `buildHandlers` runs).
  let proxy: FrmProxy;
  const handlers = buildHandlers(controller, scriptName, () => proxy);

  proxy = new Proxy({} as FrmProxy, {
    get(_target, prop) {
      if (prop === 'doc') return controller.doc;
      if (prop === 'doctype') return controller.doctype;
      if (prop === 'docname') return controller.docname;

      if (typeof prop === 'string' && Object.prototype.hasOwnProperty.call(handlers, prop)) {
        return handlers[prop as keyof HandlerMap];
      }

      throw new Error(
        `[Client Script "${scriptName}"] frm.${String(prop)} is not supported by the compatibility ` +
          `layer. Supported members: doc, doctype, docname, set_value, get_value, set_df_property, ` +
          `toggle_display, toggle_reqd, toggle_read_only, add_custom_button, set_query, refresh_field, ` +
          `save, call, add_child, clear_table.`
      );
    },
    set(_target, prop) {
      throw new Error(
        `[Client Script "${scriptName}"] frm.${String(prop)} cannot be assigned directly — use ` +
          `frm.set_value() (or the matching frm.* method) instead.`
      );
    },
  });

  return proxy;
}
