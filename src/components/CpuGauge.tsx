import React from 'react';

interface CpuGaugeProps {
  currentCpuUtil: number;
  avgCpuUtil: number;
  busyTicks: number;
  totalTicks: number;
  runningProcessLabel: string | null;
}

export const CpuGauge: React.FC<CpuGaugeProps> = ({
  currentCpuUtil,
  avgCpuUtil,
  busyTicks,
  totalTicks,
  runningProcessLabel,
}) => {
  const displayPercent = Math.max(0, Math.min(100, avgCpuUtil));
  const radius = 58;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (displayPercent / 100) * circumference;

  const strokeColor =
    displayPercent >= 85
      ? '#10B981'
      : displayPercent >= 45
        ? '#06B6D4'
        : displayPercent > 0
          ? '#F59E0B'
          : '#334155';

  return (
    <div className="rounded-xl border border-slate-800/80 bg-[#0B1221] p-5 flex flex-col justify-between">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-sm font-semibold text-slate-100">
            CPU Utilisation Gauge
          </h3>
          <p className="text-xs text-slate-400">Single-core capacity (100% ceiling)</p>
        </div>
        <span className="font-mono tabular-nums text-xs text-slate-400">
          {currentCpuUtil > 0 ? 'Core Busy' : 'Core Idle'}
        </span>
      </div>

      <div className="my-4 flex items-center justify-center">
        <div className="relative h-36 w-36 flex items-center justify-center">
          <svg
            viewBox="0 0 140 140"
            className="h-full w-full -rotate-90"
            role="img"
            aria-label={`Average CPU utilisation ${displayPercent.toFixed(1)} percent`}
          >
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke="#1E293B"
              strokeWidth={strokeWidth}
            />
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className="transition-all duration-300"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="font-mono tabular-nums text-2xl font-bold text-slate-100">
              {displayPercent.toFixed(1)}%
            </span>
            <span className="text-[11px] text-slate-400">Avg Util</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-800/70 text-xs">
        <div>
          <div className="text-slate-500">Active Core Task</div>
          <div className="font-mono tabular-nums text-slate-200 truncate mt-0.5">
            {runningProcessLabel ?? 'None (Idle)'}
          </div>
        </div>
        <div className="text-right">
          <div className="text-slate-500">Busy / Total Ticks</div>
          <div className="font-mono tabular-nums text-slate-200 mt-0.5">
            {busyTicks} / {totalTicks}
          </div>
        </div>
      </div>
    </div>
  );
};
