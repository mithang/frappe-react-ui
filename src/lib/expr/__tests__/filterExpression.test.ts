import { describe, it, expect, vi } from 'vitest';
import { parseFilterExpression } from '../filterExpression';

describe('parseFilterExpression', () => {
  it('returns [] for empty/absent filters', () => {
    expect(parseFilterExpression(undefined)).toEqual([]);
    expect(parseFilterExpression('')).toEqual([]);
    expect(parseFilterExpression('[]')).toEqual([]);
  });

  it('strips the leading doctype from the 4-element filter-group form', () => {
    // What the Quick List UI actually stores.
    expect(parseFilterExpression('[["ToDo","status","=","Open"]]')).toEqual([['status', '=', 'Open']]);
  });

  it('passes through the 3-element form', () => {
    expect(parseFilterExpression('[["status","=","Open"]]')).toEqual([['status', '=', 'Open']]);
  });

  it('expands the 2-element shorthand to an equality filter', () => {
    expect(parseFilterExpression('[["status","Open"]]')).toEqual([['status', '=', 'Open']]);
  });

  it('drops the trailing UI-only 5th element, as Desk cleanup_filters does', () => {
    expect(parseFilterExpression('[["ToDo","status","=","Open","extra"]]')).toEqual([
      ['status', '=', 'Open'],
    ]);
  });

  it('accepts a single un-nested filter', () => {
    expect(parseFilterExpression('["status","=","Open"]')).toEqual([['status', '=', 'Open']]);
  });

  it('handles multiple filters', () => {
    expect(parseFilterExpression('[["ToDo","status","=","Open"],["ToDo","priority","=","High"]]')).toEqual([
      ['status', '=', 'Open'],
      ['priority', '=', 'High'],
    ]);
  });

  it('evaluates non-JSON JS expressions, which Frappe permits via new Function', () => {
    // Single quotes are not valid JSON but are valid JS — Desk parses these with
    // `new Function('return ' + filter)`, so they must not be dropped.
    expect(parseFilterExpression("[['ToDo','status','=','Open']]")).toEqual([['status', '=', 'Open']]);
  });

  it('supports frappe.* helpers inside a filter expression', () => {
    const result = parseFilterExpression('[["ToDo","due_date","<",frappe.datetime.now_date()]]');
    expect(result).toHaveLength(1);
    expect(result[0][0]).toBe('due_date');
    expect(result[0][1]).toBe('<');
    expect(result[0][2]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('ignores an unparseable filter rather than breaking the whole widget', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(parseFilterExpression('[[[ this is not valid')).toEqual([]);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
