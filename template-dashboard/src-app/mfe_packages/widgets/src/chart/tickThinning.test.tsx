import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CartesianData, CartesianRender } from '../types';
import { CartesianChart } from './CartesianChart';
import { TICK_CHAR_WIDTH, TICK_TEXT_HEIGHT } from './chrome';

// WORKAROUND: jsdom lays out no text, so Recharts would measure every tick as 0 px and skip none; a tick here is as wide as the chart's own estimate.
beforeEach(() => {
  const measure = HTMLElement.prototype.getBoundingClientRect;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (this.id !== 'recharts_measurement_span') return measure.call(this);
    const width = (this.textContent ?? '').length * TICK_CHAR_WIDTH;
    return { width, height: TICK_TEXT_HEIGHT, x: 0, y: 0, top: 0, left: 0, right: width, bottom: TICK_TEXT_HEIGHT, toJSON: () => ({}) };
  });
  return () => vi.restoreAllMocks();
});

const DAYS = Array.from({ length: 30 }, (_, day) => `Oct ${day + 1}`);
const REPOS = ['api-gateway', 'web-app', 'billing-service', 'mobile-app', 'search-indexer', 'notifications', 'payments-ledger', 'reporting'];
const dataOf = (names: string[]): CartesianData => ({ series: [{ name: 'Runs', points: names.map((x, index) => ({ x, y: index + 1 })) }] });
// A level label longer than its room is cut with an ellipsis, so a tick names its category whole or by a cut prefix.
const tickNames = (tick: string, name: string) => tick === name || (tick.endsWith('\u2026') && name.startsWith(tick.slice(0, -1)));
const ticksOf = (container: HTMLElement, axis: 'x' | 'y') => [...container.querySelectorAll(`.recharts-${axis}Axis-tick-labels .recharts-cartesian-axis-tick-value`)].map((tick) => tick.textContent ?? '');

describe('cartesian_chart category ticks under tick_labels auto', () => {
  // The tests' charts are 640 by 320 pixels (src-app/test-setup.ts).
  it.each<[string, string[], CartesianRender]>([
    ['30 days', DAYS, {}],
    ['8 repository names', REPOS, {}],
    ['30 days on a horizontal chart, the first at the top', DAYS, { orientation: 'horizontal' }],
  ])('keeps a label on the first and the last category of %s, and skips the ones that collide', (_case, categories, chart) => {
    const { container } = render(<CartesianChart payload={{ render: { ...chart, series: [{ name: 'Runs', type: 'bar' }] }, data: dataOf(categories) }} />);
    const ticks = ticksOf(container, chart.orientation === 'horizontal' ? 'y' : 'x');
    expect(ticks.length, 'some labels are skipped').toBeLessThan(categories.length);
    expect(tickNames(ticks[0], categories[0]), `the first tick names ${categories[0]}: ${ticks[0]}`).toBe(true);
    expect(tickNames(ticks[ticks.length - 1], categories[categories.length - 1]), `the last tick names ${categories[categories.length - 1]}: ${ticks[ticks.length - 1]}`).toBe(true);
  });
});
