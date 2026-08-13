import { describe, it, expect, beforeEach, vi } from 'vitest';
import { defineExtension } from '@/sdk';
import { installExtension } from '../installExtension';
import { DocTypeRegistry } from '../DocTypeRegistry';
import { NavRegistry } from '../NavRegistry';
import { FormRegistry } from '../FormRegistry';
import { CommandRegistry } from '../CommandRegistry';

describe('installExtension (1C exit criteria)', () => {
  beforeEach(() => {
    DocTypeRegistry.clear();
    NavRegistry.clear();
    FormRegistry.clear();
    CommandRegistry.clear();
  });

  it('a fixture extension can swap a form, add a nav item, a form toolbar button, and a command — with no change to core files', async () => {
    const MyOrderForm = () => null;

    const fixture = defineExtension({
      name: 'fixture-app',
      apiVersion: '1.0',
      setup(host) {
        host.doctypes.registerForm('Sales Order', MyOrderForm as any);
        host.nav.addItem({ label: 'My Reports', route: '/my-app/reports' });
        host.forms.addButton('Sales Order', { label: 'Sync to CRM', group: 'Actions', onClick: () => {} });
        host.commands.add({ label: 'Open CRM', onRun: () => {} });
      },
    });

    const result = await installExtension(fixture);

    expect(result.ok).toBe(true);
    expect(DocTypeRegistry.getForm('Sales Order')).toBe(MyOrderForm);
    expect(NavRegistry.getItems()).toContainEqual({ label: 'My Reports', route: '/my-app/reports' });
    expect(FormRegistry.getButtons('Sales Order')).toHaveLength(1);
    expect(FormRegistry.getButtons('Sales Order')[0].label).toBe('Sync to CRM');
    expect(CommandRegistry.getCommands()).toHaveLength(1);
  });

  it('an extension that throws in setup() degrades to core UI with a warning, not a crash', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const broken = defineExtension({
      name: 'broken-app',
      apiVersion: '1.0',
      setup() {
        throw new Error('boom');
      },
    });

    const result = await installExtension(broken);

    expect(result.ok).toBe(false);
    expect(result.error?.message).toBe('boom');
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('rejects a mismatched apiVersion loudly, named and attributed, before setup() ever runs', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const setupSpy = vi.fn();

    const incompatible = defineExtension({
      name: 'future-app',
      apiVersion: '2.0',
      setup: setupSpy,
    });

    const result = await installExtension(incompatible);

    expect(result.ok).toBe(false);
    expect(result.error?.message).toContain('future-app');
    expect(result.error?.message).toContain('2.0');
    expect(setupSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
