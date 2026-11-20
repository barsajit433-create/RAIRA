import React from 'react';
import { Pause, Play, RotateCcw, StepForward } from 'lucide-react';
import type { SimulationStatus } from '../types/simulation';

interface SimulationControlsProps {
  status: SimulationStatus;
  hasProcesses: boolean;
  busy?: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStep: () => void;
  onReset: () => void;
  stepIntervalMs?: number;
  onChangeSpeed?: (ms: number) => void;
  showSpeedControl?: boolean;
}

export const SimulationControls: React.FC<SimulationControlsProps> = ({
  status,
  hasProcesses,
  busy = false,
  onStart,
  onPause,
  onResume,
  onStep,
  onReset,
  stepIntervalMs = 300,
  onChangeSpeed,
  showSpeedControl = false,
}) => {
  const isRunning = status === 'RUNNING';
  const isPaused = status === 'PAUSED';
  const isFinished = status === 'COMPLETED' || status === 'TRUNCATED';

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!isRunning && !isPaused && (
        <button
          type="button"
          onClick={onStart}
          disabled={!hasProcesses || busy}
          className="raira-btn-primary inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Play className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{isFinished ? 'Run Again' : 'Start Simulation'}</span>
        </button>
      )}

      {isRunning && (
        <button
          type="button"
          onClick={onPause}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-semibold disabled:opacity-40 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          style={{
            backgroundColor: 'var(--status-warning-soft)',
            borderColor: 'var(--status-warning)',
            color: 'var(--status-warning)',
          }}
        >
          <Pause className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Pause</span>
        </button>
      )}

      {isPaused && (
        <button
          type="button"
          onClick={onResume}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 dark:bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-white dark:text-slate-950 hover:bg-emerald-700 dark:hover:bg-emerald-400 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Play className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Resume</span>
        </button>
      )}

      <button
        type="button"
        onClick={onStep}
        disabled={!hasProcesses || isRunning || isFinished || busy}
        className="raira-btn-secondary inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap shrink-0 cursor-pointer"
      >
        <StepForward className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Step</span>
      </button>

      <button
        type="button"
        onClick={onReset}
        disabled={!hasProcesses || busy}
        className="raira-btn-secondary inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap shrink-0 cursor-pointer"
      >
        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Reset</span>
      </button>

      {showSpeedControl && onChangeSpeed && (
        <div className="flex items-center gap-2 ml-auto text-xs text-[var(--text-muted)]">
          <label htmlFor="sim-speed-select" className="whitespace-nowrap">
            Tick Speed
          </label>
          <select
            id="sim-speed-select"
            value={stepIntervalMs}
            onChange={(e) => onChangeSpeed(Number(e.target.value))}
            className="raira-input rounded-lg px-2.5 py-1.5 text-xs font-mono"
          >
            <option value={800}>Slow (800ms)</option>
            <option value={350}>Normal (350ms)</option>
            <option value={150}>Fast (150ms)</option>
            <option value={80}>Rapid (80ms)</option>
          </select>
        </div>
      )}
    </div>
  );
};
