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
  'bg-sky-400',
  'bg-indigo-400',
  'bg-teal-400',
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
      ? 'text-red-400'
      : ramUtilPercent >= 75
        ? 'text-amber-400'
        : 'text-emerald-400';

  return (
    <div className="rounded-xl border border-slate-800/80 bg-[#0B1221] p-5 flex flex-col justify-between">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-sm font-semibold text-slate-100">
            RAM Allocation Monitor
          </h3>
          <p className="text-xs text-slate-400">
            Dynamic reservation across {totalRam} MB capacity
          </p>
        </div>
        <div className={`font-mono tabular-nums text-lg font-semibold ${barTone}`}>
          {ramUtilPercent.toFixed(1)}%
        </div>
      </div>

      {/* Segmented Allocation Bar */}
      <div className="my-5 space-y-2.5">
        <div
          className="h-4 w-full rounded-md bg-slate-900 border border-slate-800 overflow-hidden flex"
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
                style={{ width: `${widthPct}%` }}
                title={`${proc.id} (${proc.name}): ${proc.allocatedMemory} MB`}
                className={`${SEGMENT_COLORS[idx % SEGMENT_COLORS.length]} h-full border-r border-[#0B1221] transition-all duration-200`}
              />
            );
          })}
        </div>

        <div className="flex items-center justify-between text-xs font-mono tabular-nums">
          <span className="text-slate-200">Used: {ramUsedMb} MB</span>
          <span className="text-emerald-400">Available: {availableRamMb} MB</span>
        </div>
      </div>

      {/* Resident Processes & Contention */}
      <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-800/70 text-xs">
        <div>
          <div className="text-slate-500">Resident Jobs</div>
          <div className="font-mono tabular-nums text-slate-200 mt-0.5">
            {allocatedProcs.length}
          </div>
        </div>
        <div>
          <div className="text-slate-500">RAM-Blocked</div>
          <div
            className={`font-mono tabular-nums mt-0.5 ${
              blockedProcs.length > 0 ? 'text-amber-400' : 'text-slate-200'
            }`}
          >
            {blockedProcs.length}
          </div>
        </div>
        <div className="text-right">
          <div className="text-slate-500">Avg RAM Util</div>
          <div className="font-mono tabular-nums text-slate-200 mt-0.5">
            {avgRamUtilPercent.toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  );
};
