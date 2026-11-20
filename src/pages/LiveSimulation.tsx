import React, { useState } from 'react';
import { GitBranch, Save, ShieldCheck } from 'lucide-react';
import type { AlgorithmType, SimulationSnapshot } from '../types/simulation';
import type { TrainingSessionSnapshot } from '../types/reinforcementLearning';
import type { NavPageId } from '../components/Sidebar';
import { AlgorithmSelector } from '../components/AlgorithmSelector';
import { SimulationControls } from '../components/SimulationControls';
import { CpuGauge } from '../components/CpuGauge';
import { RamMonitor } from '../components/RamMonitor';
import { PerformanceCharts } from '../components/PerformanceCharts';
import { ProcessExecutionTimeline } from '../components/ProcessExecutionTimeline';
import { ProcessTable } from '../components/ProcessTable';
import { formatAlgorithmName, formatWorkloadName, getStatusTextClass } from '../utils/formatters';

interface LiveSimulationProps {
  simulation: SimulationSnapshot | null;
  training: TrainingSessionSnapshot | null;
  busy: boolean;
  stepIntervalMs: number;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStep: () => void;
  onReset: () => void;
  onChangeAlgorithm: (alg: AlgorithmType) => void;
  onChangeRRQuantum: (q: number) => void;
  onChangeSpeed: (ms: number) => void;
  onSaveRunToHistory: () => void;
  onLaunchDemo: () => void;
  onNavigate?: (page: NavPageId) => void;
}

export const LiveSimulation: React.FC<LiveSimulationProps> = ({
  simulation,
  training,
  busy,
  stepIntervalMs,
  onStart,
  onPause,
  onResume,
  onStep,
  onReset,
  onChangeAlgorithm,
  onChangeRRQuantum,
  onChangeSpeed,
  onSaveRunToHistory,
  onLaunchDemo,
  onNavigate,
}) => {
  const [savedNotice, setSavedNotice] = useState(false);

  const hasProcesses = (simulation?.processes.length ?? 0) > 0;
  const metrics = simulation?.metrics;
  const latestDecision = simulation?.recentDecisions[0] ?? null;

  const runningProc =
    simulation && simulation.runningSlot !== null
      ? simulation.processes.find((p) => p.slotIndex === simulation.runningSlot)
      : null;

  const readyProcs = simulation?.processes.filter((p) => p.status === 'READY') ?? [];
  const blockedProcs = simulation?.processes.filter((p) => p.status === 'BLOCKED') ?? [];
  const newProcs = simulation?.processes.filter((p) => p.status === 'NEW') ?? [];
  const completedProcs = simulation?.processes.filter((p) => p.status === 'COMPLETED') ?? [];

  const handleSave = () => {
    onSaveRunToHistory();
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  return (
    <div className="raira-section-stack">
      {/* Control Deck */}
      <section className="raira-card raira-card-pad space-y-4">
        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
          <AlgorithmSelector
            value={simulation?.algorithm ?? 'FCFS'}
            onChange={onChangeAlgorithm}
            disabled={simulation?.status === 'RUNNING'}
            qLearningTrained={Boolean(training?.qLearningSummary.isTrained)}
            dqnTrained={Boolean(training?.dqnSummary.isTrained)}
            dqnAvailable={training?.dqnSummary.dqnStatus?.available ?? true}
          />

          <div className="flex flex-wrap items-center gap-3">
            {simulation?.algorithm === 'RR' && (
              <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <label htmlFor="rr-quantum-input" className="whitespace-nowrap">
                  RR Quantum
                </label>
                <select
                  id="rr-quantum-input"
                  value={simulation.rrQuantum}
                  disabled={simulation.status === 'RUNNING'}
                  onChange={(e) => onChangeRRQuantum(Number(e.target.value))}
                  className="raira-input rounded-lg px-2.5 py-1.5 text-xs font-mono"
                >
                  {[1, 2, 3, 4, 6, 8].map((q) => (
                    <option key={q} value={q}>
                      {q} tick{q > 1 ? 's' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {hasProcesses && onNavigate && (
              <>
                <button
                  type="button"
                  onClick={() => onNavigate('intelligence')}
                  className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap"
                  style={{
                    borderColor: 'var(--accent-border)',
                    backgroundColor: 'var(--accent-soft)',
                    color: 'var(--accent-text)',
                  }}
                >
                  <GitBranch className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>XAI &amp; What-If</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate('fairness')}
                  className="raira-btn-secondary inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium cursor-pointer whitespace-nowrap"
                >
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Fairness</span>
                </button>
              </>
            )}

            {hasProcesses && (simulation?.currentTick ?? 0) > 0 && (
              <button
                type="button"
                onClick={handleSave}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/12 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Save className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{savedNotice ? 'Saved to History' : 'Log Run to History'}</span>
              </button>
            )}
          </div>
        </div>

        <div className="pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <SimulationControls
            status={simulation?.status ?? 'IDLE'}
            hasProcesses={hasProcesses}
            busy={busy}
            onStart={onStart}
            onPause={onPause}
            onResume={onResume}
            onStep={onStep}
            onReset={onReset}
            stepIntervalMs={stepIntervalMs}
            onChangeSpeed={onChangeSpeed}
            showSpeedControl
          />
        </div>
      </section>

      {!hasProcesses && (
        <div className="raira-card p-8 text-center space-y-3">
          <p className="text-sm font-medium text-[var(--text-primary)]">
            No workload currently loaded
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            Launch the demo workload or generate a custom scenario in Process Manager to begin live
            discrete-time execution.
          </p>
          <button
            type="button"
            onClick={onLaunchDemo}
            className="raira-btn-primary rounded-lg px-4 py-2 text-xs font-semibold cursor-pointer"
          >
            Launch Demo Workload
          </button>
        </div>
      )}

      {/* Live Queue Pipeline Board */}
      {hasProcesses && (
        <section className="raira-card raira-card-pad space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-sm font-semibold text-[var(--text-primary)]">
                Discrete-Time OS Queue State · Tick {simulation?.currentTick ?? 0}
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                {formatAlgorithmName(simulation!.algorithm)} ·{' '}
                {formatWorkloadName(simulation!.workloadType)} · Seed {simulation!.seed} · Context
                Switches: {metrics?.contextSwitches ?? 0}
              </p>
            </div>
            <div className="font-mono tabular-nums text-xs text-[var(--text-secondary)]">
              Throughput: {metrics?.throughput.toFixed(2) ?? '0.00'} proc/100t · Jain Fairness:{' '}
              {metrics?.jainFairnessIndex.toFixed(4) ?? '1.0000'}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {[
              { label: 'NEW (Future)', items: newProcs, tone: 'text-[var(--text-muted)]' },
              {
                label: 'BLOCKED (Waiting RAM)',
                items: blockedProcs,
                tone: 'text-amber-700 dark:text-amber-400',
              },
              {
                label: 'READY (RAM Reserved)',
                items: readyProcs,
                tone: 'text-blue-700 dark:text-blue-400',
              },
              {
                label: 'RUNNING (1 Core)',
                items: runningProc ? [runningProc] : [],
                tone: 'text-[var(--accent-text)]',
              },
              {
                label: 'COMPLETED',
                items: completedProcs,
                tone: 'text-emerald-700 dark:text-emerald-400',
              },
            ].map((lane) => (
              <div
                key={lane.label}
                className="raira-subtle rounded-lg p-3 flex flex-col min-h-[130px]"
              >
                <div className="flex items-center justify-between text-[11px] font-medium mb-2">
                  <span className={lane.tone}>{lane.label}</span>
                  <span className="font-mono tabular-nums text-[var(--text-muted)]">
                    {lane.items.length}
                  </span>
                </div>
                <div className="space-y-1.5 overflow-y-auto max-h-40">
                  {lane.items.length === 0 ? (
                    <div className="text-[11px] text-[var(--text-muted)] opacity-75 py-2">Empty</div>
                  ) : (
                    lane.items.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between gap-1 text-[11px] font-mono tabular-nums py-1 px-2 rounded border"
                        style={{
                          backgroundColor: 'var(--surface-card)',
                          borderColor: 'var(--border-subtle)',
                        }}
                      >
                        <span className={`font-medium ${getStatusTextClass(p.status)}`}>
                          {p.id}
                        </span>
                        <span className="text-[var(--text-secondary)]">
                          {p.remainingCpuTime}t · {p.memoryDemand}M
                        </span>
                        <span className="text-[var(--text-muted)]">P{p.priority}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Gauges + Step Reward Inspector */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <CpuGauge
          currentCpuUtil={metrics?.currentCpuUtilisation ?? 0}
          avgCpuUtil={metrics?.avgCpuUtilisation ?? 0}
          busyTicks={metrics?.cpuBusyTicks ?? 0}
          totalTicks={metrics?.currentTick ?? 0}
          runningProcessLabel={runningProc ? `${runningProc.id} (${runningProc.name})` : null}
        />
        <RamMonitor
          ramUsedMb={metrics?.currentRamUsedMb ?? 0}
          availableRamMb={metrics?.availableRamMb ?? 4096}
          ramUtilPercent={metrics?.currentRamUtilisation ?? 0}
          avgRamUtilPercent={metrics?.avgRamUtilisation ?? 0}
          processes={simulation?.processes ?? []}
        />

        {/* Inspectable Multi-Objective Reward Breakdown */}
        <div className="raira-card raira-card-pad flex flex-col justify-between">
          <div>
            <h3 className="font-display text-sm font-semibold text-[var(--text-primary)]">
              Latest Step Reward Breakdown
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              R = R_cpu + R_comp − P_wait − P_turn + R_fair − P_inv
            </p>
          </div>

          {latestDecision ? (
            <dl className="my-3 space-y-2 text-xs font-mono tabular-nums">
              <div className="flex justify-between">
                <dt className="text-[var(--text-muted)]">Action Executed</dt>
                <dd className="text-[var(--accent-text)] font-medium">
                  {latestDecision.actionLabel}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--text-muted)]">CPU Reward (R_cpu)</dt>
                <dd className="text-emerald-700 dark:text-emerald-400">
                  +{latestDecision.rewardBreakdown.rCpu.toFixed(3)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--text-muted)]">Completion Bonus</dt>
                <dd className="text-emerald-700 dark:text-emerald-400">
                  +{latestDecision.rewardBreakdown.rCompletion.toFixed(3)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--text-muted)]">Fairness (Jain)</dt>
                <dd className="text-[var(--accent-text)]">
                  +{latestDecision.rewardBreakdown.rFairness.toFixed(3)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--text-muted)]">Waiting Penalty</dt>
                <dd className="text-amber-700 dark:text-amber-400">
                  −{latestDecision.rewardBreakdown.pWaiting.toFixed(3)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--text-muted)]">Turnaround Penalty</dt>
                <dd className="text-amber-700 dark:text-amber-400">
                  −{latestDecision.rewardBreakdown.pTurnaround.toFixed(3)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--text-muted)]">Invalid Penalty</dt>
                <dd className="text-red-700 dark:text-red-400">
                  −{latestDecision.rewardBreakdown.pInvalid.toFixed(3)}
                </dd>
              </div>
              <div
                className="flex justify-between pt-2 border-t"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                <dt className="text-[var(--text-secondary)] font-semibold">Discounted Step Total</dt>
                <dd className="text-[var(--text-primary)] font-semibold">
                  {latestDecision.reward >= 0 ? '+' : ''}
                  {latestDecision.reward.toFixed(3)}
                </dd>
              </div>
            </dl>
          ) : (
            <div className="raira-empty-state my-4 py-8 px-4 text-center text-xs">
              Step the simulation to inspect per-tick reward decomposition.
            </div>
          )}

          <div
            className="flex justify-between text-xs font-mono tabular-nums pt-2 border-t"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <span className="text-[var(--text-muted)]">Cumulative Episode Reward</span>
            <span className="text-[var(--accent-text)] font-semibold">
              {metrics ? metrics.totalEpisodeReward.toFixed(2) : '0.00'}
            </span>
          </div>
        </div>
      </section>

      {/* Feature 5: Interactive Process Execution Timeline (Gantt) & Separate Memory Timeline */}
      {hasProcesses && (
        <ProcessExecutionTimeline
          processes={simulation?.processes ?? []}
          timelineTicks={simulation?.timelineTicks ?? []}
        />
      )}

      <PerformanceCharts telemetry={simulation?.telemetryHistory ?? []} />

      <ProcessTable processes={simulation?.processes ?? []} />
    </div>
  );
};
