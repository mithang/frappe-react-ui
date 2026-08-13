import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createFormStore } from '@/store/formStore';
import { FormControllerImpl } from '@/controllers/FormController';
import { ScriptRegistry } from '@/core/registry/ScriptRegistry';
import { executeClientScript } from '../executeClientScript';
import type { DocTypeMeta, Document } from '@/core/types';
import type { FrappeClient } from '@/lib/api/client';

function makeController(doctype: string, doc: Document): FormControllerImpl {
  const meta: DocTypeMeta = { name: doctype, module: 'Test', fields: [] };
  const store = createFormStore(doc);
  return new FormControllerImpl(store, meta, false, {} as FrappeClient);
}

describe('executeClientScript (server Client Script compatibility)', () => {
  beforeEach(() => {
    ScriptRegistry.clear();
  });

  it('registers a classic frappe.ui.form.on script, and its validate hook, run against a real store-backed FormControllerImpl, actually updates the store', async () => {
    const script = `
      frappe.ui.form.on('Test DocType', {
        validate(frm) {
          frm.set_value('status', 'Validated');
        }
      });
    `;

    const result = executeClientScript(script, 'validate-script');
    expect(result.ok).toBe(true);
    expect(ScriptRegistry.has('Test DocType')).toBe(true);

    const controller = makeController('Test DocType', { name: 'X', doctype: 'Test DocType', status: 'Draft' });
    expect(controller.get_value('status')).toBe('Draft');

    const ok = await ScriptRegistry.executeHook('Test DocType', 'validate', controller);

    expect(ok).toBe(true);
    // Proves real behavior: the classic script's frm.set_value actually reached the real
    // formStore-backed controller, not a mock.
    expect(controller.get_value('status')).toBe('Validated');
  });

  it('a script calling an unsupported frm member throws a clear, attributed error when its hook runs', async () => {
    const script = `
      frappe.ui.form.on('Test DocType 2', {
        refresh(frm) {
          frm.some_unknown_method();
        }
      });
    `;

    const result = executeClientScript(script, 'bad-member-script');
    expect(result.ok).toBe(true); // registration itself succeeds; the bad call only fires later

    const controller = makeController('Test DocType 2', { name: 'Y', doctype: 'Test DocType 2' });
    const [registered] = ScriptRegistry.get('Test DocType 2');
    const refreshHook = registered.hooks.refresh!;

    // Call the wrapped hook directly (bypassing ScriptRegistry.executeHook's own try/catch) so we
    // can assert on the thrown error itself, not just that it was logged.
    await expect(async () => {
      await refreshHook(controller);
    }).rejects.toThrow(/bad-member-script/);
    await expect(async () => {
      await refreshHook(controller);
    }).rejects.toThrow(/some_unknown_method/);
  });

  it('an immediate top-level throw (syntax error or frappe.throw at registration time) is caught, logged, and reported via the result object rather than crashing the batch', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const brokenScript = `this is not valid javascript {{{`;
    const result = executeClientScript(brokenScript, 'syntax-error-script');

    expect(result.ok).toBe(false);
    expect(result.error).toBeInstanceOf(Error);
    expect(errorSpy).toHaveBeenCalled();
    const loggedArgs = errorSpy.mock.calls[0];
    expect(loggedArgs.some((arg) => typeof arg === 'string' && arg.includes('syntax-error-script'))).toBe(true);

    errorSpy.mockRestore();
  });

  it('frappe.throw at top level halts the script and is reported as a failure, attributed by name', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const script = `frappe.throw('Something is misconfigured');`;
    const result = executeClientScript(script, 'top-level-throw-script');

    expect(result.ok).toBe(false);
    expect(result.error?.message).toBe('Something is misconfigured');

    errorSpy.mockRestore();
  });
});
