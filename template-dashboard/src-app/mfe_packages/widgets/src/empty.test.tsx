import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { ActivityFeed } from './cards/ActivityFeed';
import { MetricCard } from './cards/MetricCard';
import { ProgressListCard } from './cards/ProgressListCard';
import { RadialProgress } from './cards/RadialProgress';
import { RankedListCard } from './cards/RankedListCard';
import { SummaryCard } from './cards/SummaryCard';
import { CartesianChart } from './chart/CartesianChart';
import { FunnelChart } from './chart/FunnelChart';
import { PieChart } from './chart/PieChart';
import { RadarChart } from './chart/RadarChart';
import { TreemapChart } from './chart/TreemapChart';
import { WaterfallChart } from './chart/WaterfallChart';
import { GridWidget } from './grid/GridWidget';
import { Heatmap } from './heatmap/Heatmap';
import { ACTIVITY_FEED_SAMPLE, PROGRESS_LIST_CARD_SAMPLE, RANKED_LIST_CARD_SAMPLE } from './samples';

type Draw = (payload: never) => ReactNode;

/** One payload per catalog data widget whose data meets the widget's empty condition. */
const EMPTY: Array<{ widget: string; draw: Draw; payload: { render: object; data: object } }> = [
  { widget: 'metric_card', draw: (payload) => <MetricCard payload={payload} />, payload: { render: {}, data: { value: null } } },
  { widget: 'summary_card', draw: (payload) => <SummaryCard payload={payload} />, payload: { render: {}, data: { rows: [] } } },
  { widget: 'ranked_list_card', draw: (payload) => <RankedListCard payload={payload} />, payload: { ...RANKED_LIST_CARD_SAMPLE, data: { rows: [] } } },
  { widget: 'progress_list_card', draw: (payload) => <ProgressListCard payload={payload} />, payload: { ...PROGRESS_LIST_CARD_SAMPLE, data: { rows: [] } } },
  { widget: 'radial_progress', draw: (payload) => <RadialProgress payload={payload} />, payload: { render: {}, data: { current: null, target: 10 } } },
  { widget: 'grid', draw: (payload) => <GridWidget payload={payload} />, payload: { render: { columns: [{ key: 'name', title: 'Name' }] }, data: { rows: [] } } },
  { widget: 'cartesian_chart', draw: (payload) => <CartesianChart payload={payload} />, payload: { render: {}, data: { series: [] } } },
  { widget: 'pie_chart', draw: (payload) => <PieChart payload={payload} />, payload: { render: {}, data: { slices: [] } } },
  {
    widget: 'radar_chart',
    draw: (payload) => <RadarChart payload={payload} />,
    payload: { render: {}, data: { points: ['Mon', 'Tue', 'Wed'].map((axis) => ({ axis, series: null, value: null })) } },
  },
  { widget: 'treemap_chart', draw: (payload) => <TreemapChart payload={payload} />, payload: { render: {}, data: { items: [{ label: 'a', value: 0, group: null }] } } },
  {
    widget: 'waterfall_chart',
    draw: (payload) => <WaterfallChart payload={payload} />,
    payload: { render: {}, data: { steps: [{ label: 'a', value: null }, { label: 'b', value: null }] } },
  },
  { widget: 'activity_feed', draw: (payload) => <ActivityFeed payload={payload} />, payload: { ...ACTIVITY_FEED_SAMPLE, data: { items: [] } } },
  { widget: 'funnel_chart', draw: (payload) => <FunnelChart payload={payload} />, payload: { render: {}, data: { stages: [{ label: 'a', value: null }] } } },
  { widget: 'heatmap', draw: (payload) => <Heatmap payload={payload} />, payload: { render: {}, data: { rows: [] } } },
];

describe('the empty state', () => {
  it('covers every catalog data widget', () => {
    expect(EMPTY.map(({ widget }) => widget).sort()).toEqual(
      ['activity_feed', 'cartesian_chart', 'funnel_chart', 'grid', 'heatmap', 'metric_card', 'pie_chart', 'progress_list_card', 'radar_chart', 'radial_progress', 'ranked_list_card', 'summary_card', 'treemap_chart', 'waterfall_chart'],
    );
  });

  it.each(EMPTY)('of $widget shows the empty_text of its payload in place of its own text', ({ widget, draw, payload }) => {
    const { unmount } = render(<>{draw({ ...payload, empty_text: 'Nothing in this window. Try a wider range.' } as never)}</>);
    expect(screen.getByText('Nothing in this window. Try a wider range.'), `should show the empty_text: ${widget}`).toBeTruthy();
    expect(screen.queryByText('No data to show'), `should not show the default text: ${widget}`).toBeNull();
    unmount();
    render(<>{draw(payload as never)}</>);
    expect(screen.getByText('No data to show'), `should show the default text without empty_text: ${widget}`).toBeTruthy();
  });
});
