import React from 'react';
import { ArrowRight, Play, Sparkles } from 'lucide-react';
import type { AlgorithmType, SimulationSnapshot } from '../types/simulation';
import type { ExperimentRecord } from '../types/experiment';
import type { TrainingSessionSnapshot } from '../types/reinforcementLearning';
import type { NavPageId } from '../components/Sidebar';
import { MetricCard } from '../components/MetricCard';
import { CpuGauge } from '../components/CpuGauge';
import { RamMonitor } from '../components/RamMonitor';
import { PerformanceCharts } from '../components/PerformanceCharts';
import { ProcessTable } from '../components/ProcessTable';
import { SimulationControls } from '../components/SimulationControls';
import { AlgorithmSelector } from '../components/AlgorithmSelector';
import {
  formatAlgorithmName,
  formatAlgorithmShort,
  formatDateTime,
  formatWorkloadName,
} from '../utils/formatters';

interface DashboardProps {
  simulation: SimulationSnapshot | null;
  training: TrainingSessionSnapshot | null;
  recentExperiments: ExperimentRecord[];
  busy: boolean;
  onLaunchDemo: () => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStep: () => void;
  onReset: () => void;
  onChangeAlgorithm: (alg: AlgorithmType) => void;
  onNavigate: (page: NavPageId) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  simulation,
  training,
  recentExperiments,
  busy,
  onLaunchDemo,
  onStart,
  onPause,
  onResume,
  onStep,
  onReset,
  onChangeAlgorithm,
  onNavigate,
}) => {
  const hasProcesses = (simulation?.processes.length ?? 0) > 0;
  const metrics = simulation?.metrics;
  const runningProc =
    simulation && simulation.runningSlot !== null
      ? simulation.processes.find((p) => p.slotIndex === simulation.runningSlot)
      : null;

  const qSummary = training?.qLearningSummary;
  const dqnSummary = training?.dqnSummary;

  return (
    <div className="raira-section-stack">
      {/* Clean Initial Launch Banner when no workload is loaded */}
      {!hasProcesses && (
        <section
          className="raira-card raira-card-pad flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5"
          style={{ borderColor: 'var(--accent-border)' }}
        >
          <div className="space-y-2 max-w-2xl">
            <div className="text-xs font-mono text-[var(--accent-text)]">
              RAIRA Research Environment Ready
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
              Intelligent Resource Allocation Using Reinforcement Learning
            </h2>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              The simulator is initialized in a clean state with zero fabricated metrics. Launch a
              deterministic 10-process Mixed workload (seed 42) to explore live CPU &amp; RAM
              scheduling immediately, or configure custom processes and train RL policies.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={onLaunchDemo}
              disabled={busy}
              className="raira-btn-primary inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-50 whitespace-nowrap cursor-pointer"
            >
              <Play className="h-4 w-4" aria-hidden="true" />
              <span>Launch Demo Workload</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('processes')}
              className="raira-btn-secondary inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium whitespace-nowrap cursor-pointer"
            >
              <span>Create Custom Workload</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </section>
      )}

      {/* Top 6 KPI Cards */}
      <section
        aria-label="Key Performance Indicators"
        className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4"
      >
        <MetricCard
          label="CPU Utilisation"
          value={metrics ? metrics.avgCpuUtilisation.toFixed(1) : '0.0'}
          unit="%"
          detail={
            metrics
              ? `Instant: ${metrics.currentCpuUtilisation}% · ${metrics.cpuBusyTicks} busy ticks`
              : 'Single-core 100% cap'
          }
          tone={metrics && metrics.avgCpuUtilisation >= 70 ? 'cyan' : 'default'}
        />
        <MetricCard
          label="RAM Utilisation"
          value={metrics ? metrics.currentRamUtilisation.toFixed(1) : '0.0'}
          unit="%"
          detail={metrics ? `${metrics.currentRamUsedMb} / 4096 MB used` : '0 / 4096 MB used'}
          tone={
            metrics && metrics.currentRamUtilisation >= 90
              ? 'red'
              : metrics && metrics.currentRamUtilisation >= 75
                ? 'amber'
                : 'emerald'
          }
        />
        <MetricCard
          label="Available RAM"
          value={metrics ? metrics.availableRamMb : 4096}
          unit="MB"
          detail={metrics ? `Avg util: ${metrics.avgRamUtilisation.toFixed(1)}%` : '4096 MB total'}
          tone="emerald"
        />
        <MetricCard
          label="Active Processes"
          value={metrics ? metrics.activeProcessCount : 0}
          detail={
            metrics
              ? `${metrics.readyCount} ready · ${metrics.blockedCount} blocked`
              : '0 ready · 0 blocked'
          }
          tone={metrics && metrics.blockedCount > 0 ? 'amber' : 'default'}
        />
        <MetricCard
          label="Completed Processes"
          value={metrics ? `${metrics.completedCount}/${metrics.totalProcesses}` : '0/0'}
          detail={
            metrics && metrics.completedCount > 0
              ? `Avg TT: ${metrics.avgTurnaroundTime}t`
              : 'No completions yet'
          }
          tone={
            metrics && metrics.totalProcesses > 0 && metrics.completedCount === metrics.totalProcesses
              ? 'emerald'
              : 'default'
          }
        />
        <MetricCard
          label="Current Algorithm"
          value={simulation ? formatAlgorithmShort(simulation.algorithm) : 'FCFS'}
          detail={
            simulation && hasProcesses
              ? `${formatWorkloadName(simulation.workloadType)} · Seed ${simulation.seed}`
              : 'No workload loaded'
          }
          tone="cyan"
        />
      </section>

      {/* Control Strip */}
      <section className="raira-card p-4 flex flex-col xl:flex-row xl:items-end justify-between gap-4">
        <AlgorithmSelector
          value={simulation?.algorithm ?? 'FCFS'}
          onChange={onChangeAlgorithm}
          disabled={simulation?.status === 'RUNNING'}
          qLearningTrained={Boolean(qSummary?.isTrained)}
          dqnTrained={Boolean(dqnSummary?.isTrained)}
          dqnAvailable={dqnSummary?.dqnStatus?.available ?? true}
        />
        <SimulationControls
          status={simulation?.status ?? 'IDLE'}
          hasProcesses={hasProcesses}
          busy={busy}
          onStart={onStart}
          onPause={onPause}
          onResume={onResume}
          onStep={onStep}
          onReset={onReset}
        />
      </section>

      {/* CPU Gauge, RAM Monitor & RL Agent / Workload Status */}
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

        {/* Workload & RL Agent Status Card */}
        <div className="raira-card raira-card-pad flex flex-col justify-between gap-4">
          <div>
            <h3 className="font-display text-sm font-semibold text-[var(--text-primary)]">
              Workload &amp; RL Agent Status
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              Live environment configuration and agent readiness
            </p>
          </div>

          <dl className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-[var(--text-muted)]">Active Workload</dt>
              <dd className="font-mono text-[var(--text-primary)]">
                {simulation && hasProcesses
                  ? `${formatWorkloadName(simulation.workloadType)} (Seed ${simulation.seed})`
                  : 'None loaded'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-[var(--text-muted)]">Tabular Q-Learning</dt>
              <dd
                className={`font-mono ${
                  qSummary?.isTrained
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-amber-700 dark:text-amber-400'
                }`}
              >
                {qSummary?.isTrained
                  ? `Trained · ${qSummary.episodesTrained} ep · ${qSummary.qTableStates} states`
                  : 'Untrained (0 episodes)'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-[var(--text-muted)]">TensorFlow.js DQN</dt>
              <dd
                className={`font-mono ${
                  dqnSummary?.dqnStatus?.available === false
                    ? 'text-red-700 dark:text-red-400'
                    : dqnSummary?.isTrained
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-amber-700 dark:text-amber-400'
                }`}
              >
                {dqnSummary?.dqnStatus?.available === false
                  ? 'Dependency Error'
                  : dqnSummary?.isTrained
                    ? `Trained · ${dqnSummary.episodesTrained} ep · ${dqnSummary.dqnStatus?.backend ?? 'cpu'}`
                    : `Ready (${dqnSummary?.dqnStatus?.backend ?? 'cpu'}) · Untrained`}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-[var(--text-muted)]">Jain Fairness Index</dt>
              <dd className="font-mono tabular-nums text-[var(--text-primary)]">
                {metrics ? metrics.jainFairnessIndex.toFixed(4) : '1.0000'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-[var(--text-muted)]">Episode Reward</dt>
              <dd className="font-mono tabular-nums text-[var(--accent-text)] font-medium">
                {metrics ? metrics.totalEpisodeReward.toFixed(2) : '0.00'}
              </dd>
            </div>
          </dl>

          <div
            className="flex items-center gap-2 pt-3 border-t"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <button
              type="button"
              onClick={() => onNavigate('training')}
              className="raira-btn-secondary flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5 text-[var(--accent-text)]" aria-hidden="true" />
              <span>Open RL Training</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('comparison')}
              className="raira-btn-secondary flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium cursor-pointer"
            >
              <span>Compare All 5</span>
            </button>
          </div>
        </div>
      </section>

      {/* Real-time CPU & RAM Charts */}
      <PerformanceCharts telemetry={simulation?.telemetryHistory ?? []} />

      {/* Process Execution Table */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-[var(--text-primary)]">
              Process Execution Table
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Real-time state of all process slots in the current episode
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('processes')}
            className="text-xs font-medium text-[var(--accent-text)] hover:underline transition-colors cursor-pointer"
          >
            Manage processes →
          </button>
        </div>
        <ProcessTable processes={simulation?.processes ?? []} compact />
      </section>

      {/* Decisions, Recent Experiments, and System Event Log */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Latest Allocation Decisions */}
        <div className="raira-card raira-card-pad flex flex-col">
          <h3 className="font-display text-sm font-semibold text-[var(--text-primary)]">
            Latest Allocation Decisions
          </h3>
          <p className="text-xs text-[var(--text-muted)] mb-3">
            Per-step scheduling actions and discounted reward
          </p>
          <div
            className="flex-1 overflow-y-auto max-h-64 divide-y"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            {!simulation || simulation.recentDecisions.length === 0 ? (
              <div className="raira-empty-state py-8 px-4 text-center text-xs">
                No scheduling decisions executed yet.
              </div>
            ) : (
              simulation.recentDecisions.slice(0, 12).map((d, idx) => (
                <div
                  key={`${d.tick}-${idx}`}
                  className="py-2.5 flex items-center justify-between gap-2 text-xs"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <div className="min-w-0">
                    <div className="font-mono text-[var(--text-primary)] truncate">
                      t={d.tick} · {d.actionLabel}
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)] truncate">
                      {d.admittedFromBlocked ? `Admitted (+${d.ramAllocatedMb} MB) · ` : ''}
                      {d.completed ? 'Completed' : d.preempted ? 'Preempted' : `${d.elapsedTicks}t`}
                    </div>
                  </div>
                  <span
                    className={`font-mono tabular-nums shrink-0 font-medium ${
                      d.reward >= 0
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-amber-700 dark:text-amber-400'
                    }`}
                  >
                    {d.reward >= 0 ? '+' : ''}
                    {d.reward.toFixed(2)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Experiment Results (real localStorage only) */}
        <div className="raira-card raira-card-pad flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-display text-sm font-semibold text-[var(--text-primary)]">
                Recent Experiment Results
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Completed runs saved in localStorage
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('history')}
              className="text-xs font-medium text-[var(--accent-text)] hover:underline cursor-pointer"
            >
              View all
            </button>
          </div>
          <div className="flex-1 overflow-y-auto max-h-64 divide-y">
            {recentExperiments.length === 0 ? (
              <div className="raira-empty-state py-8 px-4 text-center text-xs">
                No completed experiments recorded yet. Run a simulation, RL training session, or
                algorithm comparison to log verified results.
              </div>
            ) : (
              recentExperiments.slice(0, 8).map((exp) => (
                <div
                  key={exp.id}
                  className="py-2.5 flex items-center justify-between gap-2 text-xs"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <div className="min-w-0">
                    <div className="font-medium text-[var(--text-primary)] truncate">
                      {formatAlgorithmName(exp.algorithm)} · {formatWorkloadName(exp.workloadType)}
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)] font-mono tabular-nums">
                      Seed {exp.seed} · WT {exp.avgWaitingTime}t · {formatDateTime(exp.timestamp)}
                    </div>
                  </div>
                  <span className="font-mono tabular-nums text-[var(--accent-text)] font-medium shrink-0">
                    R={exp.reward.toFixed(1)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* System Event Log */}
        <div className="raira-card raira-card-pad flex flex-col">
          <h3 className="font-display text-sm font-semibold text-[var(--text-primary)]">
            System Event Log
          </h3>
          <p className="text-xs text-[var(--text-muted)] mb-3">
            Kernel admission, preemption, completion, and violation events
          </p>
          <div className="flex-1 overflow-y-auto max-h-64 space-y-2 font-mono text-[11px]">
            {!simulation || simulation.eventLog.length === 0 ? (
              <div className="raira-empty-state py-8 px-4 text-center text-xs font-sans">
                Event log is empty. Load a workload to observe kernel transitions.
              </div>
            ) : (
              simulation.eventLog.slice(0, 25).map((ev) => (
                <div key={ev.id} className="flex items-start gap-2 leading-relaxed">
                  <span className="text-[var(--text-muted)] shrink-0 tabular-nums">t={ev.tick}</span>
                  <span
                    className={
                      ev.level === 'error'
                        ? 'text-red-700 dark:text-red-400'
                        : ev.level === 'warning'
                          ? 'text-amber-700 dark:text-amber-400'
                          : ev.level === 'success'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-[var(--text-secondary)]'
                    }
                  >
                    {ev.message}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
