'use client';

import { useId } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatDateKey, formatDateKeyShort } from '@/lib/format';

/**
 * The two chart shapes the dashboards and reports need, wrapped once so every chart takes its
 * colours from the theme tokens and behaves the same way: quiet axes and grid, thin marks, a
 * tooltip on hover, a legend whenever there is more than one series, and a stated empty state
 * instead of an axis drawn over nothing. Colour follows the series in a fixed order (the
 * validated `--chart-*` palette), never its rank.
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
  /** What the chart shows, for screen readers; defaults to the series names. */
  label?: string;
}

const COLOURS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
];

const TICK = { fill: 'var(--muted-foreground)', fontSize: 11.5 } as const;

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** Date keys read as "27 Sept" on the axis and "27 Sept 2026" in the tooltip. */
const axisLabel = (value: unknown) =>
  typeof value === 'string' && DATE_KEY.test(value) ? formatDateKeyShort(value) : String(value);
const tooltipLabel = (value: unknown) =>
  typeof value === 'string' && DATE_KEY.test(value) ? formatDateKey(value) : String(value);

const TOOLTIP_STYLE = {
  backgroundColor: 'var(--popover)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  boxShadow: 'var(--elevation-md)',
  color: 'var(--popover-foreground)',
  fontSize: 12,
  padding: '8px 10px',
} as const;

function Empty({ message }: { message: string }) {
  return (
    <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border px-4 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

/** Identity never rides on colour alone: two or more series always get a named key. */
function Legend({ series }: { series: ChartSeries[] }) {
  if (series.length < 2) return null;
  return (
    <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground-secondary">
      {series.map((entry, index) => (
        <li key={entry.key} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-2.5 rounded-[3px]"
            style={{ backgroundColor: COLOURS[index % COLOURS.length] }}
          />
          {entry.label}
        </li>
      ))}
    </ul>
  );
}

function Frame({
  label,
  series,
  children,
}: {
  label: string | undefined;
  series: ChartSeries[];
  children: React.ReactNode;
}) {
  return (
    <figure className="min-w-0">
      <Legend series={series} />
      <div role="img" aria-label={label ?? `Chart of ${series.map((s) => s.label).join(', ')}`}>
        {children}
      </div>
    </figure>
  );
}

export function BarChartCard({
  data,
  xKey,
  series,
  unit = '',
  height = 240,
  emptyMessage = 'Nothing to chart yet.',
  label,
}: ChartProps) {
  if (data.length === 0) return <Empty message={emptyMessage} />;
  return (
    <Frame label={label} series={series}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data as object[]}
          margin={{ top: 8, right: 4, bottom: 0, left: -8 }}
          barCategoryGap="28%"
          barGap={2}
        >
          <CartesianGrid stroke="var(--border)" strokeOpacity={0.7} vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={TICK}
            tickFormatter={axisLabel}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={16}
            tickMargin={8}
          />
          <YAxis
            tick={TICK}
            axisLine={false}
            tickLine={false}
            width={unit ? 48 : 40}
            unit={unit}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelFormatter={tooltipLabel}
            labelStyle={{ color: 'var(--muted-foreground)', marginBottom: 2 }}
            cursor={{ fill: 'var(--surface-2)', opacity: 0.8 }}
          />
          {series.map((entry, index) => (
            <Bar
              key={entry.key}
              dataKey={entry.key}
              name={entry.label}
              fill={COLOURS[index % COLOURS.length]}
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
              unit={unit}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </Frame>
  );
}

/**
 * A trend over time: a 2px line with a faint area under it. A day with nothing measured stays a
 * gap rather than a drop to zero.
 */
export function LineChartCard({
  data,
  xKey,
  series,
  unit = '',
  height = 240,
  emptyMessage = 'Nothing to chart yet.',
  label,
}: ChartProps) {
  const id = useId().replace(/:/g, '');
  if (data.length === 0) return <Empty message={emptyMessage} />;
  const filled = series.length === 1;
  return (
    <Frame label={label} series={series}>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data as object[]} margin={{ top: 8, right: 4, bottom: 0, left: -8 }}>
          <defs>
            {series.map((entry, index) => (
              <linearGradient key={entry.key} id={`${id}-${index}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLOURS[index % COLOURS.length]} stopOpacity={0.16} />
                <stop offset="100%" stopColor={COLOURS[index % COLOURS.length]} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid stroke="var(--border)" strokeOpacity={0.7} vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={TICK}
            tickFormatter={axisLabel}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={16}
            tickMargin={8}
          />
          <YAxis tick={TICK} axisLine={false} tickLine={false} width={unit ? 48 : 40} unit={unit} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelFormatter={tooltipLabel}
            labelStyle={{ color: 'var(--muted-foreground)', marginBottom: 2 }}
            cursor={{ stroke: 'var(--border-strong)', strokeWidth: 1 }}
          />
          {series.map((entry, index) => (
            <Area
              key={entry.key}
              type="monotone"
              dataKey={entry.key}
              name={entry.label}
              stroke={COLOURS[index % COLOURS.length]}
              strokeWidth={2}
              fill={filled ? `url(#${id}-${index})` : 'transparent'}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--card)' }}
              connectNulls={false}
              unit={unit}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </Frame>
  );
}
