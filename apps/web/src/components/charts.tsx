'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

/**
 * The two chart shapes the dashboards and reports need, wrapped once so every chart takes its
 * colours from the theme tokens and behaves the same way: a readable axis, a tooltip, and a
 * stated empty state instead of an axis drawn over nothing.
 */

export interface ChartSeries {
  key: string;
  label: string;
}

interface ChartProps {
  /** Rows of whatever shape the caller has; Recharts reads the keys named below. */
  data: readonly object[];
  xKey: string;
  series: ChartSeries[];
  /** Appended to every value in the tooltip and the axis. */
  unit?: string;
  height?: number;
  emptyMessage?: string;
}

const COLOURS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
];

const AXIS = {
  stroke: 'var(--muted-foreground)',
  fontSize: 12,
} as const;

function tooltipStyle() {
  return {
    backgroundColor: 'var(--popover)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--popover-foreground)',
    fontSize: 12,
  };
}

function Empty({ message }: { message: string }) {
  return (
    <div className="flex h-40 items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export function BarChartCard({
  data,
  xKey,
  series,
  unit = '',
  height = 240,
  emptyMessage = 'Nothing to chart yet.',
}: ChartProps) {
  if (data.length === 0) return <Empty message={emptyMessage} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data as object[]} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey={xKey} tick={AXIS} interval="preserveStartEnd" tickMargin={8} />
        <YAxis tick={AXIS} width={unit ? 52 : 44} unit={unit} />
        <Tooltip contentStyle={tooltipStyle()} cursor={{ fill: 'var(--muted)' }} />
        {series.map((entry, index) => (
          <Bar
            key={entry.key}
            dataKey={entry.key}
            name={entry.label}
            fill={COLOURS[index % COLOURS.length]}
            radius={[4, 4, 0, 0]}
            unit={unit}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function LineChartCard({
  data,
  xKey,
  series,
  unit = '',
  height = 240,
  emptyMessage = 'Nothing to chart yet.',
}: ChartProps) {
  if (data.length === 0) return <Empty message={emptyMessage} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data as object[]} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey={xKey} tick={AXIS} interval="preserveStartEnd" tickMargin={8} />
        <YAxis tick={AXIS} width={unit ? 52 : 44} unit={unit} />
        <Tooltip contentStyle={tooltipStyle()} />
        {series.map((entry, index) => (
          <Line
            key={entry.key}
            type="monotone"
            dataKey={entry.key}
            name={entry.label}
            stroke={COLOURS[index % COLOURS.length]}
            strokeWidth={2}
            dot={false}
            // A day with nothing measured is a gap, not a drop to zero.
            connectNulls={false}
            unit={unit}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
