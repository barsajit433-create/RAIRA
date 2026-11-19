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

interface PerformanceChartsProps {
  telemetry: TickTelemetry[];
}

export const PerformanceCharts: React.FC<PerformanceChartsProps> = ({ telemetry }) => {
  const hasData = telemetry.length > 0;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
      {/* CPU Activity History */}
      <div className="rounded-xl border border-slate-800/80 bg-[#0B1221] p-5">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="font-display text-sm font-semibold text-slate-100">
              CPU Activity History
            </h3>
            <p className="text-xs text-slate-400">
              Discrete-time single-core CPU utilisation (%) per tick
            </p>
          </div>
          <span className="font-mono tabular-nums text-xs text-slate-500">
            {telemetry.length} ticks recorded
          </span>
        </div>

        <div className="h-56 w-full">
          {!hasData ? (
            <div className="h-full flex items-center justify-center rounded-lg border border-dashed border-slate-800 text-xs text-slate-500">
              Run or step the simulation to record real-time CPU utilisation.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={telemetry} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis
                  dataKey="tick"
                  stroke="#64748B"
                  tick={{ fontSize: 11, fill: '#94A3B8' }}
                  tickFormatter={(v) => `t${v}`}
                />
                <YAxis
                  domain={[0, 100]}
                  stroke="#64748B"
                  tick={{ fontSize: 11, fill: '#94A3B8' }}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#E2E8F0',
                  }}
                  formatter={(value: unknown) => [`${value}%`, 'CPU Utilisation']}
                  labelFormatter={(label) => `Tick ${label}`}
                />
                <Line
                  type="stepAfter"
                  dataKey="cpuUtil"
                  stroke="#06B6D4"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Memory Allocation History */}
      <div className="rounded-xl border border-slate-800/80 bg-[#0B1221] p-5">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="font-display text-sm font-semibold text-slate-100">
              Memory Allocation History
            </h3>
            <p className="text-xs text-slate-400">
              Reserved RAM (MB) out of 4096 MB system ceiling
            </p>
          </div>
          <span className="font-mono tabular-nums text-xs text-slate-500">Max 4096 MB</span>
        </div>

        <div className="h-56 w-full">
          {!hasData ? (
            <div className="h-full flex items-center justify-center rounded-lg border border-dashed border-slate-800 text-xs text-slate-500">
              Run or step the simulation to record RAM allocation history.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={telemetry} margin={{ top: 8, right: 12, left: -4, bottom: 0 }}>
                <defs>
                  <linearGradient id="ramFillGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis
                  dataKey="tick"
                  stroke="#64748B"
                  tick={{ fontSize: 11, fill: '#94A3B8' }}
                  tickFormatter={(v) => `t${v}`}
                />
                <YAxis
                  domain={[0, 4096]}
                  stroke="#64748B"
                  tick={{ fontSize: 11, fill: '#94A3B8' }}
                  tickFormatter={(v) => `${v}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#E2E8F0',
                  }}
                  formatter={(value: unknown) => [`${value} MB`, 'Allocated RAM']}
                  labelFormatter={(label) => `Tick ${label}`}
                />
                <Area
                  type="stepAfter"
                  dataKey="ramUsedMb"
                  stroke="#10B981"
                  strokeWidth={2}
                  fill="url(#ramFillGrad)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
};
