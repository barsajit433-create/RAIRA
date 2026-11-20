import React from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { TickTelemetry } from '../types/simulation';
import { useTheme } from '../theme/ThemeContext';

interface PerformanceChartsProps {
  telemetry: TickTelemetry[];
}

export const PerformanceCharts: React.FC<PerformanceChartsProps> = ({ telemetry }) => {
  const { chartTheme } = useTheme();
  const hasData = telemetry.length > 0;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
      {/* CPU Activity History */}
      <div className="raira-card raira-card-pad">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="font-display text-sm font-semibold text-[var(--text-primary)]">
              CPU Activity History
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              Discrete-time single-core CPU utilisation (%) per tick
            </p>
          </div>
          <span className="font-mono tabular-nums text-xs text-[var(--text-muted)]">
            {telemetry.length} ticks recorded
          </span>
        </div>

        <div className="h-56 w-full">
          {!hasData ? (
            <div className="raira-empty-state h-full flex items-center justify-center text-xs px-4 text-center">
              Run or step the simulation to record real-time CPU utilisation.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={telemetry} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                <XAxis
                  dataKey="tick"
                  stroke={chartTheme.axis}
                  tick={{ fontSize: 11, fill: chartTheme.tick }}
                  tickFormatter={(v) => `t${v}`}
                />
                <YAxis
                  domain={[0, 100]}
                  stroke={chartTheme.axis}
                  tick={{ fontSize: 11, fill: chartTheme.tick }}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: chartTheme.tooltipBg,
                    borderColor: chartTheme.tooltipBorder,
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: chartTheme.tooltipText,
                  }}
                  labelStyle={{ color: chartTheme.tooltipLabel }}
                  formatter={(value: unknown) => [`${value}%`, 'CPU Utilisation']}
                  labelFormatter={(label) => `Tick ${label}`}
                />
                <Line
                  type="stepAfter"
                  dataKey="cpuUtil"
                  stroke={chartTheme.primary}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={chartTheme.animateCharts}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Memory Allocation History */}
      <div className="raira-card raira-card-pad">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="font-display text-sm font-semibold text-[var(--text-primary)]">
              Memory Allocation History
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              Reserved RAM (MB) out of 4096 MB system ceiling
            </p>
          </div>
          <span className="font-mono tabular-nums text-xs text-[var(--text-muted)]">
            Max 4096 MB
          </span>
        </div>

        <div className="h-56 w-full">
          {!hasData ? (
            <div className="raira-empty-state h-full flex items-center justify-center text-xs px-4 text-center">
              Run or step the simulation to record RAM allocation history.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={telemetry} margin={{ top: 8, right: 12, left: -4, bottom: 0 }}>
                <defs>
                  <linearGradient id="ramFillGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartTheme.success} stopOpacity={0.34} />
                    <stop offset="95%" stopColor={chartTheme.success} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                <XAxis
                  dataKey="tick"
                  stroke={chartTheme.axis}
                  tick={{ fontSize: 11, fill: chartTheme.tick }}
                  tickFormatter={(v) => `t${v}`}
                />
                <YAxis
                  domain={[0, 4096]}
                  stroke={chartTheme.axis}
                  tick={{ fontSize: 11, fill: chartTheme.tick }}
                  tickFormatter={(v) => `${v}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: chartTheme.tooltipBg,
                    borderColor: chartTheme.tooltipBorder,
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: chartTheme.tooltipText,
                  }}
                  labelStyle={{ color: chartTheme.tooltipLabel }}
                  formatter={(value: unknown) => [`${value} MB`, 'Allocated RAM']}
                  labelFormatter={(label) => `Tick ${label}`}
                />
                <Area
                  type="stepAfter"
                  dataKey="ramUsedMb"
                  stroke={chartTheme.success}
                  strokeWidth={2}
                  fill={chartTheme.useGradients ? 'url(#ramFillGrad)' : chartTheme.success}
                  fillOpacity={chartTheme.useGradients ? 1 : 0.14}
                  isAnimationActive={chartTheme.animateCharts}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
};
