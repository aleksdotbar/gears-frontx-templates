import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ValueFormat } from '@gears-frontx/frontx-dashboard-root/contract';

import type { CartesianData, CartesianRender } from '../types';
import { CartesianChart } from './CartesianChart';
import { TICK_CHAR_WIDTH, TICK_TEXT_HEIGHT } from './chrome';

// WORKAROUND: jsdom lays out no text. In a browser Recharts measures a tick at the page's 16 px, wider than the 12 px the kit draws, so the measure here is 8 px a character.
const MEASURED_CHAR_WIDTH = 8;
beforeEach(() => {
  const measure = HTMLElement.prototype.getBoundingClientRect;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (this.id !== 'recharts_measurement_span') return measure.call(this);
    const width = (this.textContent ?? '').length * MEASURED_CHAR_WIDTH;
    return { width, height: TICK_TEXT_HEIGHT, x: 0, y: 0, top: 0, left: 0, right: width, bottom: TICK_TEXT_HEIGHT, toJSON: () => ({}) };
  });
  return () => vi.restoreAllMocks();
});

const COMPOUND: ValueFormat = { value_type: 'duration', unit: 'h', compound: true };
const TEAMS = ['Atlas', 'Borealis', 'Cobalt', 'Delta', 'Ember', 'Fjord'];
const LEAD: CartesianData = { series: [{ name: 'Lead time', points: [14, 24, 33, 43, 53, 63].map((y, index) => ({ x: TEAMS[index], y })) }] };
const SCATTER: CartesianData = { series: [{ name: 'Review', points: Array.from({ length: 12 }, (_, index) => ({ x: 20 + index * 80, y: 2 + ((index * 13.7) % 60) })) }] };

/** Each y tick: its text and the number of lines Recharts broke it into. */
const ticksOf = (container: HTMLElement) =>
  [...container.querySelectorAll('.recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value')].map((tick) => ({ text: tick.textContent ?? '', lines: tick.querySelectorAll('tspan').length }));
/** The left edge of the plot: the clip rectangle Recharts draws the series in. */
const plotLeftOf = (container: HTMLElement) => Number(container.querySelector('clipPath rect')?.getAttribute('x'));

describe('cartesian_chart y axis width', () => {
  it.each<[string, CartesianRender, CartesianData]>([
    ['a bar chart', { series: [{ name: 'Lead time', type: 'bar' }] }, LEAD],
    ['a bar chart with a y axis title', { series: [{ name: 'Lead time', type: 'bar' }], y_axis: { label: 'Lead time' } }, LEAD],
    ['a scatter chart', { x_axis: { type: 'value' }, series: [{ name: 'Review', type: 'scatter' }] }, SCATTER],
    ['a bar chart with a reference line above its data', { series: [{ name: 'Lead time', type: 'bar' }], reference_lines: [{ value: 300, label: 'Limit' }] }, LEAD],
  ])('writes each two-part duration tick of %s on one line, in an axis as wide as its longest tick', (_case, chart, data) => {
    const { container } = render(<CartesianChart payload={{ render: chart, value_format: COMPOUND, data }} />);
    const ticks = ticksOf(container);
    expect(ticks.some((tick) => tick.text.includes(' ')), 'some ticks have two parts').toBe(true);
    for (const tick of ticks) expect(tick.lines, `one line: ${tick.text}`).toBe(1);
    const longest = Math.max(...ticks.map((tick) => tick.text.length));
    const title = chart.y_axis?.label ? 16 : 0;
    expect(plotLeftOf(container) - title).toBeGreaterThanOrEqual(longest * TICK_CHAR_WIDTH + 8);
  });

  it('sizes the axis by the ticks of a stack, its members summed per x', () => {
    const stack: CartesianData = { series: ['Review', 'Build'].map((name) => ({ name, points: [{ x: 'Mon', y: 100 }, { x: 'Tue', y: 150 }] })) };
    const { container } = render(<CartesianChart payload={{ render: { series: [{ name: 'Review', type: 'bar', stack_group: 'all' }, { name: 'Build', type: 'bar', stack_group: 'all' }] }, value_format: COMPOUND, data: stack }} />);
    const ticks = ticksOf(container);
    expect(ticks.map((tick) => tick.text)).toContain('12d 12h');
    for (const tick of ticks) expect(tick.lines, `one line: ${tick.text}`).toBe(1);
    expect(plotLeftOf(container)).toBeGreaterThanOrEqual(Math.max(...ticks.map((tick) => tick.text.length)) * TICK_CHAR_WIDTH + 8);
  });

  it('keeps the 44 px axis for ticks that fit it, as before', () => {
    const { container } = render(<CartesianChart payload={{ render: { series: [{ name: 'Runs', type: 'bar' }] }, data: { series: [{ name: 'Runs', points: [{ x: 'Mon', y: 120 }, { x: 'Tue', y: 80 }] }] } }} />);
    expect(plotLeftOf(container)).toBe(44);
  });
});
