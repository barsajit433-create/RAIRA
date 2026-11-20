import React, { useMemo, useState } from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';
import type { ProcessRecord } from '../types/process';
import type { TimelineTickRecord } from '../types/intelligence';
import { SYSTEM_CONFIG } from '../types/simulation';

interface ProcessExecutionTimelineProps {
  processes: ProcessRecord[];
  timelineTicks: TimelineTickRecord[];
}

const PROCESS_MEM_COLORS = [
  '#0891B2',
  '#2563EB',
  '#059669',
  '#7C3AED',
  '#D97706',
  '#DB2777',
  '#0D9488',
  '#4F46E5',
  '#16A34A',
  '#EA580C',
];

export const ProcessExecutionTimeline: React.FC<ProcessExecutionTimelineProps> = ({
  processes,
  timelineTicks,
}) => {
  const [cellWidth, setCellWidth] = useState<number>(22);
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);

  const selectedProcess = useMemo(
    () => processes.find((p) => p.id === selectedProcessId) ?? null,
    [processes, selectedProcessId]
  );

  const selectedProcStats = useMemo(() => {
    if (!selectedProcess) return null;
    let runningTicks = 0;
    let readyTicks = 0;
    let blockedTicks = 0;
    let preemptions = 0;
    let ramReservedStart: number | null = null;
    let ramReservedEnd: number | null = null;

    for (const t of timelineTicks) {
      const cell = t.cells[selectedProcess.id];
      if (!cell) continue;
      if (cell.status === 'RUNNING') runningTicks += 1;
      else if (cell.status === 'READY') readyTicks += 1;
      else if (cell.status === 'BLOCKED') blockedTicks += 1;
      if (cell.preemptedAtTick) preemptions += 1;
      if (cell.allocatedMemoryMb > 0) {
        if (ramReservedStart === null) ramReservedStart = t.tick;
        ramReservedEnd = t.tick;
      }
    }

    return {
      runningTicks,
      readyTicks,
      blockedTicks,
      preemptions,
      ramReservedStart,
      ramReservedEnd,
    };
  }, [selectedProcess, timelineTicks]);

  if (processes.length === 0) {
    return null;
  }

  return (
    <section className="raira-card raira-card-pad space-y-5">
      {/* Header + Zoom Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-sm font-semibold text-[var(--text-primary)]">
            Live Process Execution Timeline (Gantt) &amp; Memory Reservation Track
          </h2>
          <p className="text-xs text-[var(--text-muted)]">
            Driven by per-tick simulator transitions ({timelineTicks.length} recorded ticks). Click
            any process row to inspect intervals, preemption markers, and RAM retention windows.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setCellWidth((w) => Math.max(12, w - 4))}
            aria-label="Zoom out timeline"
            className="raira-btn-secondary inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs cursor-pointer"
          >
            <ZoomOut className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Out</span>
          </button>
          <span className="font-mono text-[11px] text-[var(--text-muted)] tabular-nums w-12 text-center">
            {Math.round((cellWidth / 22) * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setCellWidth((w) => Math.min(44, w + 4))}
            aria-label="Zoom in timeline"
            className="raira-btn-secondary inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs cursor-pointer"
          >
            <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
            <span>In</span>
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-[var(--text-muted)]">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-xs inline-block"
            style={{ backgroundColor: 'var(--accent-primary)' }}
          />{' '}
          RUNNING (CPU)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-xs bg-blue-500/45 border border-blue-500/60 inline-block" />{' '}
          READY (RAM Held)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-xs bg-amber-500/45 border border-amber-500/60 inline-block" />{' '}
          BLOCKED (Awaiting RAM)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-xs bg-emerald-500/35 border border-emerald-500/60 inline-block" />{' '}
          COMPLETED
        </span>
        <span className="inline-flex items-center gap-1.5 font-mono text-amber-700 dark:text-amber-300">
          P = Preempted
        </span>
        <span className="inline-flex items-center gap-1.5 font-mono text-emerald-700 dark:text-emerald-300">
          ✓ = Completed
        </span>
      </div>

      {timelineTicks.length === 0 ? (
        <div className="raira-empty-state py-8 px-4 text-center text-xs">
          Start or step the simulation to populate the per-tick Gantt execution timeline and memory
          reservation chart.
        </div>
      ) : (
        <div className="space-y-5">
          {/* 1. Gantt Process Execution Chart */}
          <div className="overflow-x-auto rounded-lg raira-subtle">
            <div style={{ minWidth: `${148 + timelineTicks.length * cellWidth}px` }}>
              {/* Tick Axis Header */}
              <div
                className="flex border-b text-[10px] font-mono tabular-nums text-[var(--text-muted)]"
                style={{
                  borderColor: 'var(--border-subtle)',
                  backgroundColor: 'var(--surface-card)',
                }}
              >
                <div
                  className="w-[148px] shrink-0 px-3 py-1.5 border-r font-semibold text-[var(--text-secondary)] sticky left-0 z-10"
                  style={{
                    borderColor: 'var(--border-subtle)',
                    backgroundColor: 'var(--surface-card)',
                  }}
                >
                  Process (Arr / Burst)
                </div>
                <div className="flex">
                  {timelineTicks.map((t) => (
                    <div
                      key={t.tick}
                      style={{ width: `${cellWidth}px`, borderColor: 'var(--border-subtle)' }}
                      className="shrink-0 text-center py-1.5 border-r"
                    >
                      {t.tick % (cellWidth < 18 ? 5 : 2) === 0 || t.tick === 1 ? t.tick : ''}
                    </div>
                  ))}
                </div>
              </div>

              {/* Per-Process Rows */}
              {processes.map((proc) => {
                const isSelected = selectedProcessId === proc.id;
                return (
                  <div
                    key={proc.id}
                    onClick={() =>
                      setSelectedProcessId((prev) => (prev === proc.id ? null : proc.id))
                    }
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedProcessId((prev) => (prev === proc.id ? null : proc.id));
                      }
                    }}
                    className="flex items-center border-b cursor-pointer transition-colors hover:bg-[var(--surface-card-hover)]"
                    style={{
                      borderColor: 'var(--border-subtle)',
                      backgroundColor: isSelected ? 'var(--accent-soft)' : undefined,
                    }}
                  >
                    <div
                      className="w-[148px] shrink-0 px-3 py-1.5 border-r text-[11px] font-mono tabular-nums sticky left-0 z-10 flex items-center justify-between"
                      style={{
                        borderColor: 'var(--border-subtle)',
                        backgroundColor: isSelected ? 'var(--accent-soft)' : 'var(--surface-subtle)',
                        color: isSelected ? 'var(--accent-text)' : 'var(--text-primary)',
                      }}
                    >
                      <span className="font-semibold">{proc.id}</span>
                      <span className="text-[10px] text-[var(--text-muted)]">
                        t{proc.arrivalTime} · {proc.cpuBurstTime}t
                      </span>
                    </div>

                    <div className="flex h-7 items-center">
                      {timelineTicks.map((t) => {
                        const cell = t.cells[proc.id];
                        if (!cell || cell.status === 'NEW') {
                          return (
                            <div
                              key={t.tick}
                              style={{
                                width: `${cellWidth}px`,
                                borderColor: 'var(--border-subtle)',
                              }}
                              className="h-full shrink-0 border-r opacity-40"
                              title={`${proc.id} @ tick ${t.tick}: Not yet arrived`}
                            />
                          );
                        }

                        let cellBg = 'bg-slate-400/20 dark:bg-slate-800/30';
                        let inlineStyle: React.CSSProperties = {
                          width: `${cellWidth}px`,
                          borderColor: 'var(--surface-canvas)',
                        };

                        if (cell.status === 'RUNNING') {
                          cellBg = '';
                          inlineStyle = {
                            ...inlineStyle,
                            backgroundColor: 'var(--accent-primary)',
                            color: 'var(--accent-contrast-text)',
                          };
                        } else if (cell.status === 'READY') {
                          cellBg =
                            'bg-blue-500/25 dark:bg-blue-500/35 text-blue-900 dark:text-blue-100';
                        } else if (cell.status === 'BLOCKED') {
                          cellBg =
                            'bg-amber-500/30 dark:bg-amber-500/35 text-amber-950 dark:text-amber-100';
                        } else if (cell.status === 'COMPLETED') {
                          cellBg =
                            'bg-emerald-500/18 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300';
                        }

                        const marker = cell.completedAtTick
                          ? '✓'
                          : cell.preemptedAtTick
                            ? 'P'
                            : cell.status === 'RUNNING' && cellWidth >= 24 && cell.quantumUsed > 0
                              ? `q${cell.quantumUsed}`
                              : '';

                        return (
                          <div
                            key={t.tick}
                            style={inlineStyle}
                            title={`${proc.id} @ tick ${t.tick}: ${cell.status} | RAM: ${cell.allocatedMemoryMb} MB${cell.preemptedAtTick ? ' | PREEMPTED' : ''}${cell.completedAtTick ? ' | COMPLETED' : ''}${cell.quantumUsed ? ` | q=${cell.quantumUsed}` : ''}`}
                            className={`h-5 shrink-0 border-r flex items-center justify-center text-[9px] font-mono font-bold select-none ${cellBg}`}
                          >
                            {marker}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. Synchronized Separate Memory Allocation Timeline */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Memory Allocation Timeline (4096 MB Ceiling)
              </h3>
              <span className="text-[11px] font-mono text-[var(--text-muted)] tabular-nums">
                Stacked per-process RAM reservations across ticks 1–
                {timelineTicks[timelineTicks.length - 1].tick}
              </span>
            </div>

            <div className="overflow-x-auto rounded-lg raira-subtle p-3">
              <div
                className="relative"
                style={{ minWidth: `${timelineTicks.length * cellWidth + 48}px`, height: '124px' }}
              >
                {/* Ceiling Reference Lines */}
                <div className="absolute inset-x-0 top-0 border-t border-dashed border-red-500/45 pointer-events-none flex justify-end">
                  <span className="text-[9px] font-mono text-red-600 dark:text-red-400 pr-1">
                    4096 MB
                  </span>
                </div>
                <div
                  className="absolute inset-x-0 top-1/2 border-t border-dashed pointer-events-none flex justify-end"
                  style={{ borderColor: 'var(--border-strong)' }}
                >
                  <span className="text-[9px] font-mono text-[var(--text-muted)] pr-1">
                    2048 MB
                  </span>
                </div>

                {/* Stacked Vertical Bars per Tick */}
                <div className="flex items-end h-[104px] pt-3">
                  {timelineTicks.map((t) => {
                    const activeMemCells = processes
                      .map((p, idx) => ({
                        id: p.id,
                        mb: t.cells[p.id]?.allocatedMemoryMb ?? 0,
                        color: PROCESS_MEM_COLORS[idx % PROCESS_MEM_COLORS.length],
                      }))
                      .filter((c) => c.mb > 0);

                    return (
                      <div
                        key={t.tick}
                        style={{ width: `${cellWidth}px` }}
                        className="h-full shrink-0 flex flex-col justify-end px-[1px]"
                        title={`Tick ${t.tick}: ${t.totalAllocatedRamMb} MB / ${SYSTEM_CONFIG.TOTAL_RAM_MB} MB (${activeMemCells.map((c) => `${c.id}:${c.mb}M`).join(', ') || '0 MB'})`}
                      >
                        {activeMemCells.map((seg) => {
                          const hPct = (seg.mb / SYSTEM_CONFIG.TOTAL_RAM_MB) * 100;
                          const dimmed =
                            selectedProcessId !== null && selectedProcessId !== seg.id;
                          return (
                            <div
                              key={seg.id}
                              style={{
                                height: `${Math.max(2, hPct)}%`,
                                backgroundColor: seg.color,
                                opacity: dimmed ? 0.25 : 0.92,
                                borderColor: 'var(--surface-canvas)',
                              }}
                              className="w-full border-t"
                            />
                          );
                        })}
                      </div>
                    );
                  })}
                </div>

                {/* Tick Footer */}
                <div
                  className="flex border-t pt-1 text-[9px] font-mono text-[var(--text-muted)] tabular-nums"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  {timelineTicks.map((t) => (
                    <div
                      key={t.tick}
                      style={{ width: `${cellWidth}px` }}
                      className="shrink-0 text-center"
                    >
                      {t.tick % 5 === 0 || t.tick === 1 ? t.tick : ''}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Selected Process Detailed Inspector */}
          {selectedProcess && selectedProcStats && (
            <div
              className="rounded-lg border px-4 py-3 flex flex-wrap items-center justify-between gap-4 text-xs font-mono tabular-nums"
              style={{
                borderColor: 'var(--accent-border)',
                backgroundColor: 'var(--accent-soft)',
              }}
            >
              <div>
                <span className="font-semibold text-[var(--accent-text)]">
                  {selectedProcess.id} ({selectedProcess.name})
                </span>{' '}
                <span className="text-[var(--text-muted)]">
                  · Priority P{selectedProcess.priority} · Arrival t={selectedProcess.arrivalTime} ·
                  Completion{' '}
                  {selectedProcess.completionTime !== null
                    ? `t=${selectedProcess.completionTime}`
                    : 'In Progress'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-[var(--text-primary)]">
                <span>CPU Run: {selectedProcStats.runningTicks}t</span>
                <span>Ready: {selectedProcStats.readyTicks}t</span>
                <span>Blocked: {selectedProcStats.blockedTicks}t</span>
                <span className="text-amber-700 dark:text-amber-300">
                  Preemptions: {selectedProcStats.preemptions}
                </span>
                <span className="text-[var(--accent-text)]">
                  RAM Window:{' '}
                  {selectedProcStats.ramReservedStart !== null
                    ? `t${selectedProcStats.ramReservedStart}–t${selectedProcStats.ramReservedEnd} (${selectedProcess.memoryDemand} MB)`
                    : 'Unallocated'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
