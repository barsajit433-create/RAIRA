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
          className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 cursor-pointer"
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
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 px-3.5 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/30 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
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
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Play className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Resume</span>
        </button>
      )}

      <button
        type="button"
        onClick={onStep}
        disabled={!hasProcesses || isRunning || isFinished || busy}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 cursor-pointer"
      >
        <StepForward className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Step</span>
      </button>

      <button
        type="button"
        onClick={onReset}
        disabled={!hasProcesses || busy}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 cursor-pointer"
      >
        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Reset</span>
      </button>

      {showSpeedControl && onChangeSpeed && (
        <div className="flex items-center gap-2 ml-auto text-xs text-slate-400">
          <label htmlFor="sim-speed-select" className="whitespace-nowrap">
            Tick Speed
          </label>
          <select
            id="sim-speed-select"
            value={stepIntervalMs}
            onChange={(e) => onChangeSpeed(Number(e.target.value))}
            className="rounded-lg border border-slate-700 bg-[#080F1D] px-2.5 py-1.5 text-xs font-mono text-slate-200 focus:border-cyan-500 focus:outline-none"
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
