import React from 'react';
import { useTheme } from '../theme/ThemeContext';

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
  const { chartTheme } = useTheme();
  const displayPercent = Math.max(0, Math.min(100, avgCpuUtil));
  const radius = 58;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (displayPercent / 100) * circumference;

  const strokeColor =
    displayPercent >= 85
      ? chartTheme.success
      : displayPercent >= 45
        ? chartTheme.primary
        : displayPercent > 0
          ? chartTheme.warning
          : chartTheme.neutralTrack;

  return (
    <div className="raira-card raira-card-pad flex flex-col justify-between">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-sm font-semibold text-[var(--text-primary)]">
            CPU Utilisation Gauge
          </h3>
          <p className="text-xs text-[var(--text-muted)]">
            Single-core capacity (100% ceiling)
          </p>
        </div>
        <span className="font-mono tabular-nums text-xs text-[var(--text-muted)]">
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
              stroke={chartTheme.neutralTrack}
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
            <span className="font-mono tabular-nums text-2xl font-bold text-[var(--text-primary)]">
              {displayPercent.toFixed(1)}%
            </span>
            <span className="text-[11px] text-[var(--text-muted)]">Avg Util</span>
          </div>
        </div>
      </div>

      <div
        className="grid grid-cols-2 gap-3 pt-3 border-t text-xs"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div>
          <div className="text-[var(--text-muted)]">Active Core Task</div>
          <div className="font-mono tabular-nums text-[var(--text-secondary)] truncate mt-0.5">
            {runningProcessLabel ?? 'None (Idle)'}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[var(--text-muted)]">Busy / Total Ticks</div>
          <div className="font-mono tabular-nums text-[var(--text-secondary)] mt-0.5">
            {busyTicks} / {totalTicks}
          </div>
        </div>
      </div>
    </div>
  );
};
