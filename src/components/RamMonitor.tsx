import React from 'react';
import { SYSTEM_CONFIG } from '../types/simulation';
import type { ProcessRecord } from '../types/process';

interface RamMonitorProps {
  ramUsedMb: number;
  availableRamMb: number;
  ramUtilPercent: number;
  avgRamUtilPercent: number;
  processes: ProcessRecord[];
}

const SEGMENT_COLORS = [
  'bg-cyan-500',
  'bg-blue-500',
  'bg-emerald-500',
  'bg-sky-500',
  'bg-violet-500',
  'bg-teal-500',
];

export const RamMonitor: React.FC<RamMonitorProps> = ({
  ramUsedMb,
  availableRamMb,
  ramUtilPercent,
  avgRamUtilPercent,
  processes,
}) => {
  const totalRam = SYSTEM_CONFIG.TOTAL_RAM_MB;
  const allocatedProcs = processes.filter((p) => p.allocatedMemory > 0);
  const blockedProcs = processes.filter((p) => p.status === 'BLOCKED');

  const barTone =
    ramUtilPercent >= 90
      ? 'var(--status-danger)'
      : ramUtilPercent >= 75
        ? 'var(--status-warning)'
        : 'var(--status-success)';

  return (
    <div className="raira-card raira-card-pad flex flex-col justify-between">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-sm font-semibold text-[var(--text-primary)]">
            RAM Allocation Monitor
          </h3>
          <p className="text-xs text-[var(--text-muted)]">
            Dynamic reservation across {totalRam} MB capacity
          </p>
        </div>
        <div
          className="font-mono tabular-nums text-lg font-semibold"
          style={{ color: barTone }}
        >
          {ramUtilPercent.toFixed(1)}%
        </div>
      </div>

      {/* Segmented Allocation Bar */}
      <div className="my-5 space-y-2.5">
        <div
          className="h-4 w-full rounded-md raira-subtle overflow-hidden flex"
          role="progressbar"
          aria-valuenow={Math.round(ramUsedMb)}
          aria-valuemin={0}
          aria-valuemax={totalRam}
          aria-label="Allocated RAM in megabytes"
        >
          {allocatedProcs.map((proc, idx) => {
            const widthPct = (proc.allocatedMemory / totalRam) * 100;
            return (
              <div
                key={proc.id}
                style={{
                  width: `${widthPct}%`,
                  borderColor: 'var(--surface-canvas)',
                }}
                title={`${proc.id} (${proc.name}): ${proc.allocatedMemory} MB`}
                className={`${SEGMENT_COLORS[idx % SEGMENT_COLORS.length]} h-full border-r transition-all duration-200`}
              />
            );
          })}
        </div>

        <div className="flex items-center justify-between text-xs font-mono tabular-nums">
          <span className="text-[var(--text-secondary)]">Used: {ramUsedMb} MB</span>
          <span style={{ color: 'var(--status-success)' }}>Available: {availableRamMb} MB</span>
        </div>
      </div>

      {/* Resident Processes & Contention */}
      <div
        className="grid grid-cols-3 gap-3 pt-3 border-t text-xs"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div>
          <div className="text-[var(--text-muted)]">Resident Jobs</div>
          <div className="font-mono tabular-nums text-[var(--text-secondary)] mt-0.5">
            {allocatedProcs.length}
          </div>
        </div>
        <div>
          <div className="text-[var(--text-muted)]">RAM-Blocked</div>
          <div
            className="font-mono tabular-nums mt-0.5"
            style={{
              color: blockedProcs.length > 0 ? 'var(--status-warning)' : 'var(--text-secondary)',
            }}
          >
            {blockedProcs.length}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[var(--text-muted)]">Avg RAM Util</div>
          <div className="font-mono tabular-nums text-[var(--text-secondary)] mt-0.5">
            {avgRamUtilPercent.toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  );
};
