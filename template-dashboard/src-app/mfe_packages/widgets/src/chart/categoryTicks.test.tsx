import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CartesianData, CartesianRender } from '../types';
import { CartesianChart } from './CartesianChart';
import { TICK_CHAR_WIDTH, TICK_TEXT_HEIGHT } from './chrome';

/*
 * The tick labels of a category axis with long names. The tests' charts are 640 by 320 pixels (src-app/test-setup.ts).
 * jsdom lays out no text, so the chart library would measure every label as 0 px wide and skip none: here a text is as
 * wide as the chart's own estimate, TICK_CHAR_WIDTH per character, so `auto` skips the labels that collide, as a
 * browser does.
 */
beforeEach(() => {
  const measure = HTMLElement.prototype.getBoundingClientRect;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (this.id !== 'recharts_measurement_span') return measure.call(this);
    const width = (this.textContent ?? '').length * TICK_CHAR_WIDTH;
    return { width, height: TICK_TEXT_HEIGHT, x: 0, y: 0, top: 0, left: 0, right: width, bottom: TICK_TEXT_HEIGHT, toJSON: () => ({}) };
  });
  return () => vi.restoreAllMocks();
});

const WORDS = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel', 'india', 'juliett', 'kilo', 'lima'];
// 12 names of 34 to 38 characters that differ from their first character.
const LONG = WORDS.map((word) => `${word}-service-integration-test-suite`);
// 12 names of 10 characters that differ from their first character.
const SHORT = WORDS.map((word) => `${word}-team-name`.slice(0, 10));

const dataOf = (names: string[]): CartesianData => ({ series: [{ name: 'Runs', points: names.map((x, index) => ({ x, y: index + 1 })) }] });
const ticksOf = (container: HTMLElement, axis: 'x' | 'y') => [...container.querySelectorAll(`.recharts-${axis}Axis-tick-labels .recharts-cartesian-axis-tick-value`)].map((tick) => tick.textContent ?? '');
/** The x column of the chart's text alternative. */
const namesOf = (label: string) =>
  within(within(screen.getByRole('figure', { name: label })).getByRole('table', { hidden: true }))
    .getAllByRole('row', { hidden: true })
    .slice(1)
    .map((row) => within(row).getAllByRole('cell', { hidden: true })[0].textContent);
/** The names a tick label can stand for: a whole name, or each name a cut label (its text before the ellipsis) begins. */
const namesTickedBy = (tick: string, names: string[]) => names.filter((name) => name === tick || (tick.endsWith('…') && name.startsWith(tick.slice(0, -1))));

describe('cartesian_chart long category names', () => {
  it.each<[string, CartesianRender['x_axis']]>([
    ['auto', undefined],
    ['every', { tick_labels: 'every' }],
  ])('cuts the long names of a vertical bar chart with an ellipsis, so tick_labels %s labels at least half of the bars', (_mode, x_axis) => {
    const { container } = render(<CartesianChart payload={{ render: { x_axis, series: [{ name: 'Runs', type: 'bar' }] }, data: dataOf(LONG) }} label="Runs" />);
    const ticks = ticksOf(container, 'x');
    expect(ticks.length).toBeGreaterThanOrEqual(LONG.length / 2);
    for (const tick of ticks) {
      expect(tick.endsWith('…'), `should be cut: ${tick}`).toBe(true);
      expect(namesTickedBy(tick, LONG), `should stand for one name: ${tick}`).toHaveLength(1);
    }
    expect(namesOf('Runs')).toEqual(LONG);
  });

  it('cuts the long names of a horizontal bar chart to its category column, a third of the chart wide', () => {
    const { container } = render(<CartesianChart payload={{ render: { orientation: 'horizontal', series: [{ name: 'Runs', type: 'bar' }] }, data: dataOf(LONG) }} label="Runs" />);
    const ticks = ticksOf(container, 'y');
    expect(ticks).toHaveLength(LONG.length);
    ticks.forEach((tick, index) => {
      expect(tick.endsWith('…'), `should be cut: ${tick}`).toBe(true);
      expect(tick.length * TICK_CHAR_WIDTH, `should fit the column: ${tick}`).toBeLessThanOrEqual(640 / 3);
      expect(namesTickedBy(tick, LONG), `should stand for its own name: ${tick}`).toEqual([LONG[index]]);
    });
    expect(namesOf('Runs')).toEqual(LONG);
  });

  it('keeps the part that tells apart names with a long common beginning', () => {
    const shared = Array.from({ length: 12 }, (_, index) => `synthetic-checkout-suite-${String(index + 1).padStart(2, '0')}-retries-on-timeout`);
    const { container } = render(<CartesianChart payload={{ render: { series: [{ name: 'Runs', type: 'bar' }] }, data: dataOf(shared) }} />);
    const ticks = ticksOf(container, 'x');
    expect(ticks.length).toBeGreaterThan(0);
    for (const tick of ticks) {
      expect(tick.endsWith('…'), `should be cut: ${tick}`).toBe(true);
      expect(namesTickedBy(tick, shared), `should stand for one name: ${tick}`).toHaveLength(1);
    }
  });

  // What draws as before: names that fit their room, names of 10 characters or fewer, turned ticks, and value and time axes.
  it.each<[string, CartesianRender, string[]]>([
    ['names that fit their bands', {}, ['alpha-service-test-suite', 'bravo-service-test-suite', 'charlie-service-test-suite']],
    ['names of 10 characters, where they do not fit their bands', {}, SHORT],
    ['names of 10 characters with tick_labels every, where they do not fit their bands', { x_axis: { tick_labels: 'every' } }, SHORT],
    ['dates, where they do not fit their bands', {}, Array.from({ length: 30 }, (_, day) => `2026-10-${String(day + 1).padStart(2, '0')}`)],
    ['names that fit the column of a horizontal chart', { orientation: 'horizontal' }, ['alpha-service-test-suite', 'bravo-service-test-suite']],
    ['long names on turned ticks', { x_axis: { tick_angle: -90 } }, LONG],
  ])('writes %s whole', (_case, chart, names) => {
    const axis = chart.orientation === 'horizontal' ? 'y' : 'x';
    const { container } = render(<CartesianChart payload={{ render: { ...chart, series: [{ name: 'Runs', type: 'bar' }] }, data: dataOf(names) }} />);
    const ticks = ticksOf(container, axis);
    expect(ticks.length).toBeGreaterThan(0);
    for (const tick of ticks) expect(names, `should be a whole name: ${tick}`).toContain(tick);
  });

  it.each<[string, CartesianData]>([
    ['value', { series: [{ name: 'Runs', points: Array.from({ length: 60 }, (_, index) => ({ x: 1_000_000_000 + index * 123_456_789, y: index })) }] }],
    ['time', { series: [{ name: 'Runs', points: Array.from({ length: 60 }, (_, index) => ({ x: `2026-10-01T${String(index % 24).padStart(2, '0')}:${String(index).padStart(2, '0')}:07Z`, y: index })) }] }],
  ])('cuts no tick of a %s axis', (type, data) => {
    const { container } = render(<CartesianChart payload={{ render: { x_axis: { type: type as 'value' | 'time' }, series: [{ name: 'Runs', type: 'line' }] }, data }} />);
    const ticks = ticksOf(container, 'x');
    expect(ticks.length).toBeGreaterThan(0);
    for (const tick of ticks) expect(tick, `should be whole: ${tick}`).not.toContain('…');
  });
});

describe('cartesian_chart tick_angle auto', () => {
  const anglesOf = (container: HTMLElement) => [...container.querySelectorAll('.recharts-xAxis-tick-labels .recharts-cartesian-axis-tick-value')].map((tick) => /rotate\((-?\d+)/.exec(tick.getAttribute('transform') ?? '')?.[1] ?? '0');
  const every: CartesianRender['x_axis'] = { tick_labels: 'every', tick_angle: 'auto' };
  // 32 names of 7 characters: a band of the 640 px chart is narrower than a label turned 45° needs, and as wide as one turned 90° needs.
  const MANY = Array.from({ length: 32 }, (_, index) => `name-${String(index + 1).padStart(2, '0')}`);

  it.each<[string, string[], string]>([
    ['level, when every whole name fits its band', ['alpha-service-test-suite', 'bravo-service-test-suite', 'charlie-service-test-suite'], '0'],
    ['at -45, when a name does not fit its band level', LONG, '-45'],
    ['at -90, when a band is narrower than a label turned 45° needs', MANY, '-90'],
  ])('labels each bar with its whole name %s', (_case, names, angle) => {
    const { container } = render(<CartesianChart payload={{ render: { x_axis: every, series: [{ name: 'Runs', type: 'bar' }] }, data: dataOf(names) }} />);
    expect(ticksOf(container, 'x')).toEqual(names);
    expect(new Set(anglesOf(container))).toEqual(new Set([angle]));
  });

  // A band of 51 names is 11.5 px wide: a label needs two bands at 45° and at 90°. A band of 60 names needs three at 45° and two at 90°.
  it.each<[number, string]>([
    [51, '-45'],
    [60, '-90'],
  ])('labels every other one of %i bars that no turn fits, at %s', (count, angle) => {
    const names = Array.from({ length: count }, (_, index) => `name-${String(index + 1).padStart(2, '0')}`);
    const { container } = render(<CartesianChart payload={{ render: { x_axis: every, series: [{ name: 'Runs', type: 'bar' }] }, data: dataOf(names) }} />);
    expect(new Set(anglesOf(container))).toEqual(new Set([angle]));
    expect(ticksOf(container, 'x')).toEqual(names.filter((_, index) => index % 2 === 0));
  });

  it('writes the categories of a horizontal chart level', () => {
    const { container } = render(<CartesianChart payload={{ render: { orientation: 'horizontal', x_axis: every, series: [{ name: 'Runs', type: 'bar' }] }, data: dataOf(LONG) }} />);
    expect(container.querySelector('.recharts-yAxis-tick-labels [transform*="rotate(-"]')).toBeNull();
  });

  it('keeps the ticks of a value axis level', () => {
    const data: CartesianData = { series: [{ name: 'Runs', points: Array.from({ length: 60 }, (_, index) => ({ x: 1_000_000_000 + index * 123_456_789, y: index })) }] };
    const { container } = render(<CartesianChart payload={{ render: { x_axis: { type: 'value', tick_angle: 'auto' }, series: [{ name: 'Runs', type: 'line' }] }, data }} />);
    expect(new Set(anglesOf(container))).toEqual(new Set(['0']));
  });
});
