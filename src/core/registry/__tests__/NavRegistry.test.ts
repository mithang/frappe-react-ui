import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NavRegistry } from '../NavRegistry';

// Pane components are only ever compared by identity here, never rendered.
const RailA = (() => null) as never;
const PanelA = (() => null) as never;
const PanelB = (() => null) as never;

describe('NavRegistry', () => {
  beforeEach(() => NavRegistry.clear());

  describe('items', () => {
    it('adds an item and returns an unsubscribe that removes it', () => {
      const remove = NavRegistry.addItem({ label: 'My Reports', route: '/my-app/reports' });
      expect(NavRegistry.getItems()).toHaveLength(1);
      remove();
      expect(NavRegistry.getItems()).toHaveLength(0);
    });

    it('scopes workspace-specific items, keeping unscoped ones everywhere', () => {
      NavRegistry.addItem({ label: 'Global', route: '/g' });
      NavRegistry.addItem({ label: 'Selling only', route: '/s', workspace: 'Selling' });

      expect(NavRegistry.getItems('Selling').map((i) => i.label)).toEqual(['Global', 'Selling only']);
      expect(NavRegistry.getItems('Buying').map((i) => i.label)).toEqual(['Global']);
      expect(NavRegistry.getItems().map((i) => i.label)).toEqual(['Global']);
    });

    it('filters by role only when roles are supplied', () => {
      NavRegistry.addItem({ label: 'Admin', route: '/a', roles: ['System Manager'] });
      // No roles passed -> no filtering, because the app has no role source today.
      expect(NavRegistry.getItems()).toHaveLength(1);
      expect(NavRegistry.getItems(undefined, ['Sales User'])).toHaveLength(0);
      expect(NavRegistry.getItems(undefined, ['System Manager'])).toHaveLength(1);
    });
  });

  describe('pane overrides', () => {
    it('returns null when nothing is registered, so the caller renders its default', () => {
      expect(NavRegistry.getRail()).toBeNull();
      expect(NavRegistry.getPanel('Accounting')).toBeNull();
    });

    it('prefers a per-workspace panel over the global one', () => {
      NavRegistry.registerPanel(PanelA, 'global-ext');
      NavRegistry.registerPanelFor('Accounting', PanelB, 'accounting-ext');

      expect(NavRegistry.getPanel('Accounting')).toMatchObject({
        component: PanelB,
        extensionName: 'accounting-ext',
      });
      // Any other workspace still gets the global override.
      expect(NavRegistry.getPanel('Selling')).toMatchObject({ component: PanelA });
    });

    it('falls back to the global panel once the specific one unregisters', () => {
      NavRegistry.registerPanel(PanelA);
      const remove = NavRegistry.registerPanelFor('Accounting', PanelB);
      remove();
      expect(NavRegistry.getPanel('Accounting')).toMatchObject({ component: PanelA });
    });

    it('records which extension supplied a pane, for crash attribution', () => {
      NavRegistry.registerRail(RailA, 'my-app');
      expect(NavRegistry.getRail()).toMatchObject({ component: RailA, extensionName: 'my-app' });
    });

    it('does not clobber a newer registration when an older one unregisters', () => {
      NavRegistry.registerPanel(PanelA);
      NavRegistry.registerPanel(PanelB);
      // PanelA's unsubscribe must be a no-op now that PanelB has replaced it.
      expect(NavRegistry.getPanel()).toMatchObject({ component: PanelB });
    });
  });

  describe('slots', () => {
    it('collects multiple contributions per slot in registration order', () => {
      NavRegistry.addSlot('rail-bottom', 'first', 'ext-1');
      NavRegistry.addSlot('rail-bottom', 'second', 'ext-2');
      expect(NavRegistry.getSlot('rail-bottom').map((s) => s.node)).toEqual(['first', 'second']);
    });

    it('keeps slots independent and empty by default', () => {
      NavRegistry.addSlot('panel-header', 'x');
      expect(NavRegistry.getSlot('panel-header')).toHaveLength(1);
      expect(NavRegistry.getSlot('panel-footer')).toEqual([]);
    });

    it('removes only the unsubscribed contribution', () => {
      const removeFirst = NavRegistry.addSlot('panel-footer', 'first');
      NavRegistry.addSlot('panel-footer', 'second');
      removeFirst();
      expect(NavRegistry.getSlot('panel-footer').map((s) => s.node)).toEqual(['second']);
    });
  });

  describe('subscribe', () => {
    // Extensions install AFTER login, i.e. after the sidebar has mounted. Without notification
    // the nav would never show anything they register.
    it('notifies on every kind of mutation', () => {
      const listener = vi.fn();
      NavRegistry.subscribe(listener);

      NavRegistry.addItem({ label: 'a', route: '/a' });
      NavRegistry.addSlot('rail-top', 'x');
      NavRegistry.registerRail(RailA);
      NavRegistry.registerPanel(PanelA);
      NavRegistry.registerPanelFor('Selling', PanelB);

      expect(listener).toHaveBeenCalledTimes(5);
    });

    it('notifies on unsubscribe of a contribution', () => {
      const remove = NavRegistry.addItem({ label: 'a', route: '/a' });
      const listener = vi.fn();
      NavRegistry.subscribe(listener);
      remove();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('stops notifying once the listener unsubscribes', () => {
      const listener = vi.fn();
      const unsubscribe = NavRegistry.subscribe(listener);
      unsubscribe();
      NavRegistry.addItem({ label: 'a', route: '/a' });
      expect(listener).not.toHaveBeenCalled();
    });

    it('keeps a stable snapshot identity between mutations', () => {
      // useSyncExternalStore re-renders forever if the snapshot is a fresh array each read.
      NavRegistry.addItem({ label: 'a', route: '/a' });
      expect(NavRegistry.getItemsSnapshot()).toBe(NavRegistry.getItemsSnapshot());
    });

    it('changes snapshot identity when the items actually change', () => {
      const before = NavRegistry.getItemsSnapshot();
      NavRegistry.addItem({ label: 'a', route: '/a' });
      expect(NavRegistry.getItemsSnapshot()).not.toBe(before);
    });
  });

  it('clear() removes items, slots and every pane override', () => {
    NavRegistry.addItem({ label: 'a', route: '/a' });
    NavRegistry.addSlot('rail-top', 'x');
    NavRegistry.registerRail(RailA);
    NavRegistry.registerPanel(PanelA);
    NavRegistry.registerPanelFor('Selling', PanelB);

    NavRegistry.clear();

    expect(NavRegistry.getItems()).toEqual([]);
    expect(NavRegistry.getSlot('rail-top')).toEqual([]);
    expect(NavRegistry.getRail()).toBeNull();
    expect(NavRegistry.getPanel()).toBeNull();
    expect(NavRegistry.getPanel('Selling')).toBeNull();
  });
});
