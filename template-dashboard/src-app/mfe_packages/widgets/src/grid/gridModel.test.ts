import { describe, expect, it } from 'vitest';
import type { ValueFormat } from '@gears-frontx/frontx-dashboard-root/contract';

import type { GridColumn, GridRender, GridValue } from '../types';
import { checkGrid, pinnedCount, searchRows, shownTextOf, sortRows } from './gridModel';

const columns = (...keys: string[]) => keys.map((key) => ({ key }));
const rows = (width: number, count = 1): GridValue[][] => Array.from({ length: count }, () => Array.from({ length: width }, () => null));

describe('grid checks', () => {
  it('passes a consistent configuration', () => {
    const render: GridRender = { columns: columns('a', 'b', 'c'), column_groups: [{ title: 'G', members: ['b', 'c'] }], row_color: 'a' };
    expect(checkGrid(render, { rows: rows(3, 2) })).toBeNull();
  });

  it.each<[string, GridRender, number]>([
    ['column key b repeats', { columns: columns('a', 'b', 'b') }, 3],
    ['names z, which is not a column', { columns: columns('a', 'b'), column_groups: [{ title: 'G', members: ['z'] }] }, 2],
    ['is not contiguous', { columns: columns('a', 'b', 'c'), column_groups: [{ title: 'G', members: ['a', 'c'] }] }, 3],
    ['repeats a', { columns: columns('a', 'b'), column_groups: [{ title: 'G', members: ['a', 'a'] }] }, 2],
    ['column b is in groups G and H', { columns: columns('a', 'b', 'c'), column_groups: [{ title: 'G', members: ['a', 'b'] }, { title: 'H', members: ['b', 'c'] }] }, 3],
    ['row_color names z', { columns: columns('a'), row_color: 'z' }, 1],
  ])('fails when %s', (expected, render, width) => {
    expect(checkGrid(render, { rows: rows(width) })).toContain(expected);
  });

  it('fails a row that does not have one value per column, naming its index', () => {
    expect(checkGrid({ columns: columns('a', 'b') }, { rows: [[1, 2], [1]] })).toContain('row 1');
  });

  it.each([1, 0, -1])('fails total_rows %s, below the 2 rows delivered, naming no number', (total_rows) => {
    expect(checkGrid({ columns: columns('a') }, { rows: rows(1, 2), total_rows })).toBe('grid: total_rows is below the number of rows');
  });

  it.each([2, 650, null, undefined])('passes total_rows %s with 2 rows delivered', (total_rows) => {
    expect(checkGrid({ columns: columns('a') }, { rows: rows(1, 2), total_rows })).toBeNull();
  });
});

describe('grid sort', () => {
  const values: GridValue[] = ['beta', 10, null, 'Alpha', 2, { text: 'alpha 2', href: '/a' }, 10];
  const sort = (direction: 'asc' | 'desc') => sortRows(values.map((value, index) => ({ value, index })), (item) => item.value, direction, 'en');

  it('puts numbers first, then strings by the collator, then nulls, keeping equal values in delivered order', () => {
    expect(sort('asc').map((item) => item.index)).toEqual([4, 1, 6, 3, 5, 0, 2]);
  });

  it('reverses within each group and keeps nulls last when descending', () => {
    expect(sort('desc').map((item) => item.index)).toEqual([1, 6, 4, 0, 5, 3, 2]);
  });
});

describe('a column value_format', () => {
  const NUMBER: ValueFormat = { value_type: 'number' };
  const PERCENT: ValueFormat = { value_type: 'percent', decimals: 1 };

  it.each<[string, GridColumn, ValueFormat | undefined, number, string]>([
    ['its own over the widget one', { key: 'c', value_format: PERCENT }, NUMBER, 0.243, '24.3%'],
    ['its own when the widget has none', { key: 'c', value_format: PERCENT }, undefined, 0.243, '24.3%'],
    ['the widget one when it has none', { key: 'c' }, PERCENT, 0.243, '24.3%'],
    ['no format when neither has one', { key: 'c' }, undefined, 0.243, '0.243'],
    ['its own with its notation', { key: 'c', format: { notation: 'compact' }, value_format: { value_type: 'currency', currency: 'USD' } }, NUMBER, 1234567, '$1.2M'],
  ])('formats a number of a column by %s', (_name, column, widgetFormat, value, shown) => {
    expect(shownTextOf(value, column, widgetFormat, 'en')).toBe(shown);
  });

  it.each([
    ['24.3%', ['r1']],
    ['1,234', ['r1']],
    ['0.243', []],
  ])('searches the text each column shows by its own format, for %j', (query, ids) => {
    const columns: GridColumn[] = [{ key: 'id' }, { key: 'share', value_format: PERCENT }, { key: 'count' }];
    const rows: GridValue[][] = [['r1', 0.243, 1234], ['r2', 0.05, 56]];
    expect(searchRows(rows, (row) => row, query, columns, NUMBER, 'en').map((row) => row[0])).toEqual(ids);
  });
});

describe('grid helpers', () => {
  it('extends a frozen count that cuts a group to the end of the group', () => {
    const render: GridRender = { columns: columns('a', 'b', 'c', 'd'), frozen_columns: 2, column_groups: [{ title: 'G', members: ['b', 'c'] }] };
    expect(pinnedCount(render)).toBe(3);
    expect(pinnedCount({ ...render, frozen_columns: 9 })).toBe(4);
    expect(pinnedCount({ ...render, frozen_columns: undefined })).toBe(0);
  });
});
