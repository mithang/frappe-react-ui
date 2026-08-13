import { describe, it, expect } from 'vitest';
import { buildSidebarTree, routeForSidebarItem, type SidebarItemRow } from '../sidebarItems';

const link = (label: string, extra: Partial<SidebarItemRow> = {}): SidebarItemRow => ({
  type: 'Link',
  link_type: 'DocType',
  link_to: label,
  label,
  ...extra,
});

const section = (label: string, extra: Partial<SidebarItemRow> = {}): SidebarItemRow => ({
  type: 'Section Break',
  label,
  indent: 1,
  collapsible: 1,
  ...extra,
});

describe('buildSidebarTree', () => {
  it('nests a link under the preceding section when child is set', () => {
    const tree = buildSidebarTree([section('Setup'), link('Account', { child: 1 })]);
    expect(tree).toHaveLength(1);
    expect(tree[0]).toMatchObject({ kind: 'section', label: 'Setup' });
    expect((tree[0] as { items: unknown[] }).items).toHaveLength(1);
  });

  it('keeps a child=0 link TOP-LEVEL even though a Section Break precedes it', () => {
    // The real divergence between Desk's rule and "everything until the next break". Selling,
    // Buying, Projects, Support, Assets, Manufacturing and Build all end exactly like this.
    const tree = buildSidebarTree([
      section('Reports'),
      link('General Ledger', { child: 1 }),
      link('Settings', { child: 0 }),
    ]);

    expect(tree).toHaveLength(2);
    expect(tree[0]).toMatchObject({ kind: 'section', label: 'Reports' });
    expect((tree[0] as { items: { label: string }[] }).items.map((i) => i.label)).toEqual([
      'General Ledger',
    ]);
    expect(tree[1]).toMatchObject({ kind: 'link', label: 'Settings' });
  });

  it('keeps links before the first Section Break at the top level', () => {
    // Accounting's "Home" row.
    const tree = buildSidebarTree([
      link('Home', { link_type: 'Workspace', link_to: 'Accounting', child: 0 }),
      section('Setup'),
      link('Account', { child: 1 }),
    ]);
    expect(tree[0]).toMatchObject({ kind: 'link', label: 'Home' });
    expect(tree[1]).toMatchObject({ kind: 'section' });
  });

  it('starts a new group at each Section Break', () => {
    const tree = buildSidebarTree([
      section('Setup'),
      link('Account', { child: 1 }),
      section('Taxes'),
      link('Tax Rule', { child: 1 }),
    ]);
    expect(tree.map((n) => (n as { label: string }).label)).toEqual(['Setup', 'Taxes']);
    expect((tree[1] as { items: { label: string }[] }).items.map((i) => i.label)).toEqual(['Tax Rule']);
  });

  it('carries collapsible and keep_closed onto the section', () => {
    const [open, closed] = buildSidebarTree([
      section('Setup', { keep_closed: 0 }),
      section('Taxes', { keep_closed: 1 }),
    ]) as { keepClosed: boolean; collapsible: boolean }[];

    expect(open).toMatchObject({ keepClosed: false, collapsible: true });
    expect(closed).toMatchObject({ keepClosed: true, collapsible: true });
  });

  it('keeps an empty Section Break — Desk still renders the heading', () => {
    const tree = buildSidebarTree([section('Empty')]);
    expect(tree).toHaveLength(1);
    expect((tree[0] as { items: unknown[] }).items).toEqual([]);
  });

  it('drops Spacer rows and hidden rows', () => {
    const tree = buildSidebarTree([
      { type: 'Spacer' },
      link('Visible'),
      link('Hidden', { hidden: 1 }),
    ]);
    expect(tree.map((n) => (n as { label: string }).label)).toEqual(['Visible']);
  });

  it('orders by idx rather than array position', () => {
    const tree = buildSidebarTree([link('Second', { idx: 2 }), link('First', { idx: 1 })]);
    expect(tree.map((n) => (n as { label: string }).label)).toEqual(['First', 'Second']);
  });

  it('defaults the icon to "list", but leaves indented children icon-less', () => {
    const tree = buildSidebarTree([
      link('Top'),
      section('Setup', { indent: 1 }),
      link('Nested', { child: 1 }),
    ]);
    expect(tree[0]).toMatchObject({ icon: 'list' });
    expect((tree[1] as { items: { icon?: string }[] }).items[0].icon).toBeUndefined();
  });

  it('keeps an explicit icon on a top-level link', () => {
    const tree = buildSidebarTree([link('Home', { icon: 'house' })]);
    expect(tree[0]).toMatchObject({ icon: 'house' });
  });

  it('returns an empty tree for empty/absent input', () => {
    expect(buildSidebarTree([])).toEqual([]);
    expect(buildSidebarTree(undefined as unknown as SidebarItemRow[])).toEqual([]);
  });
});

describe('routeForSidebarItem', () => {
  it('routes each link type this app can reach', () => {
    expect(routeForSidebarItem(link('Item'))).toBe('/doctype/Item');
    expect(routeForSidebarItem(link('General Ledger', { link_type: 'Report' }))).toBe(
      '/reports/General Ledger'
    );
    expect(routeForSidebarItem(link('Accounting', { link_type: 'Workspace' }))).toBe(
      '/workspace/Accounting'
    );
    expect(routeForSidebarItem(link('Selling', { link_type: 'Dashboard' }))).toBe(
      '/doctype/Dashboard/Selling'
    );
    expect(routeForSidebarItem(link('External', { link_type: 'URL', url: 'https://x.test' }))).toBe(
      'https://x.test'
    );
  });

  it('returns null for Page links — Desk-only JS pages with no equivalent here', () => {
    expect(routeForSidebarItem(link('POS', { link_type: 'Page', link_to: 'point-of-sale' }))).toBeNull();
  });

  it('returns null for non-Link rows', () => {
    expect(routeForSidebarItem(section('Setup'))).toBeNull();
    expect(routeForSidebarItem({ type: 'Spacer' })).toBeNull();
  });

  it('returns null when the target is missing or blank', () => {
    expect(routeForSidebarItem({ type: 'Link', link_type: 'DocType' })).toBeNull();
    expect(routeForSidebarItem(link('x', { link_to: '   ' }))).toBeNull();
    expect(routeForSidebarItem(link('x', { link_type: 'URL', url: '' }))).toBeNull();
  });
});
