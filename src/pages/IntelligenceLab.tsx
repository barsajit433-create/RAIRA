import React, { useMemo, useState } from 'react';
import {
  Download,
  GitBranch,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  StepForward,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AlgorithmType, SimulationSnapshot } from '../types/simulation';
import type { CounterfactualReport } from '../types/intelligence';
import { rairaApi } from '../services/api';
import { exportService } from '../services/exportService';
import { ExplainableDecisionPanel } from '../components/ExplainableDecisionPanel';
import { formatAlgorithmName } from '../utils/formatters';
import { useTheme } from '../theme/ThemeContext';

interface IntelligenceLabProps {
  simulation: SimulationSnapshot | null;
  busy: boolean;
  onLaunchDemo: () => void;
  onStep: () => void;
  onPause: () => void;
  onReset: () => void;
  onChangeAlgorithm: (alg: AlgorithmType) => void;
}

export const IntelligenceLab: React.FC<IntelligenceLabProps> = ({
  simulation,
  busy,
  onLaunchDemo,
  onStep,
  onPause,
  onReset,
  onChangeAlgorithm,
}) => {
  const { chartTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<'xai' | 'counterfactual'>('xai');
  const [selectedExpId, setSelectedExpId] = useState<string | null>(null);

  // Counterfactual Lab controls
  const [horizon, setHorizon] = useState<number | 'FULL_EPISODE'>(20);
  const [rlRefAgent, setRlRefAgent] = useState<'Q_LEARNING' | 'DQN'>('DQN');
  const [altActionId, setAltActionId] = useState<number | 'AUTO'>('AUTO');
  const [cfLoading, setCfLoading] = useState(false);
  const [cfError, setCfError] = useState<string | null>(null);
  const [cfReport, setCfReport] = useState<CounterfactualReport | null>(null);

  const hasProcesses = (simulation?.processes.length ?? 0) > 0;
  const explanations = simulation?.explanationHistory ?? [];

  const activeExplanation = useMemo(() => {
    if (explanations.length === 0) return null;
    if (selectedExpId) {
      const found = explanations.find((e) => e.id === selectedExpId);
      if (found) return found;
    }
    return explanations[0];
  }, [explanations, selectedExpId]);

  const handleRunCounterfactual = async () => {
    setCfLoading(true);
    setCfError(null);
    try {
      const report = await rairaApi.runCounterfactual({
        horizonTicks: horizon,
        rlReferenceAgent: rlRefAgent,
        alternativeActionId: altActionId === 'AUTO' ? null : altActionId,
      });
      setCfReport(report);
    } catch (err) {
      setCfError(err instanceof Error ? err.message : String(err));
    } finally {
      setCfLoading(false);
    }
  };

  const chartData = useMemo(() => {
    if (!cfReport) return [];
    return cfReport.branches.map((b) => ({
      name:
        b.branchId === 'SELECTED_RL'
          ? 'Selected RL'
          : b.branchId === 'ALT_RL'
            ? 'Alt RL'
            : b.branchId,
      avgWait: b.metrics.avgWaitingTime,
      turnaround: b.metrics.avgTurnaroundTime,
      throughput: b.metrics.throughput,
      reward: b.metrics.totalEpisodeReward,
    }));
  }, [cfReport]);

  return (
    <div className="raira-section-stack">
      {/* Unified Intelligence Control Strip */}
      <section className="raira-card raira-card-pad space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('xai')}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer border ${
                activeTab === 'xai'
                  ? 'text-[var(--accent-text)]'
                  : 'raira-subtle text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
              style={
                activeTab === 'xai'
                  ? {
                      borderColor: 'var(--accent-primary)',
                      backgroundColor: 'var(--accent-soft)',
                    }
                  : undefined
              }
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Explainable AI Decision Engine</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('counterfactual')}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer border ${
                activeTab === 'counterfactual'
                  ? 'text-[var(--accent-text)]'
                  : 'raira-subtle text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
              style={
                activeTab === 'counterfactual'
                  ? {
                      borderColor: 'var(--accent-primary)',
                      backgroundColor: 'var(--accent-soft)',
                    }
                  : undefined
              }
            >
              <GitBranch className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Counterfactual What-If Laboratory</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!hasProcesses ? (
              <button
                type="button"
                onClick={onLaunchDemo}
                disabled={busy}
                className="raira-btn-primary inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                <Play className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Launch Demo Workload</span>
              </button>
            ) : (
              <>
                <div className="flex items-center rounded-lg raira-subtle p-0.5 text-xs">
                  {(['Q_LEARNING', 'DQN'] as const).map((alg) => (
                    <button
                      key={alg}
                      type="button"
                      disabled={simulation?.status === 'RUNNING'}
                      onClick={() => {
                        onChangeAlgorithm(alg);
                        setRlRefAgent(alg);
                      }}
                      className={`px-2.5 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap cursor-pointer ${
                        simulation?.algorithm === alg
                          ? 'text-[var(--accent-text)]'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                      }`}
                      style={
                        simulation?.algorithm === alg
                          ? { backgroundColor: 'var(--accent-soft)' }
                          : undefined
                      }
                    >
                      {alg === 'Q_LEARNING' ? 'Q-Learning' : 'DQN'}
                    </button>
                  ))}
                </div>

                {simulation?.status === 'RUNNING' && (
                  <button
                    type="button"
                    onClick={onPause}
                    className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium cursor-pointer whitespace-nowrap"
                    style={{
                      borderColor: 'var(--status-warning)',
                      backgroundColor: 'var(--status-warning-soft)',
                      color: 'var(--status-warning)',
                    }}
                  >
                    <Pause className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Pause</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={onStep}
                  disabled={
                    busy ||
                    simulation?.status === 'RUNNING' ||
                    simulation?.status === 'COMPLETED' ||
                    simulation?.status === 'TRUNCATED'
                  }
                  className="raira-btn-primary inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold disabled:opacity-45 cursor-pointer whitespace-nowrap"
                >
                  <StepForward className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Step Active Policy</span>
                </button>

                <button
                  type="button"
                  onClick={onReset}
                  disabled={busy}
                  className="raira-btn-secondary inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium cursor-pointer whitespace-nowrap"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Reset</span>
                </button>
              </>
            )}
          </div>
        </div>

        {hasProcesses && simulation && (
          <div
            className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t text-xs font-mono tabular-nums text-[var(--text-muted)]"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <span>
              Active Scheduler:{' '}
              <strong className="text-[var(--accent-text)]">
                {formatAlgorithmName(simulation.algorithm)}
              </strong>{' '}
              · Tick {simulation.currentTick} · Status {simulation.status}
            </span>
            <span>
              RAM Free: {simulation.metrics.availableRamMb} MB · Completed:{' '}
              {simulation.metrics.completedCount}/{simulation.metrics.totalProcesses} · Captured RL
              Decisions: {explanations.length}
            </span>
          </div>
        )}
      </section>

      {/* TAB 1: EXPLAINABLE AI DECISION ENGINE */}
      {activeTab === 'xai' && (
        <ExplainableDecisionPanel
          explanation={activeExplanation}
          history={explanations}
          selectedId={selectedExpId}
          onSelectExplanation={setSelectedExpId}
        />
      )}

      {/* TAB 2: COUNTERFACTUAL WHAT-IF LABORATORY */}
      {activeTab === 'counterfactual' && (
        <div className="raira-section-stack">
          <section className="raira-card raira-card-pad space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-sm font-semibold text-[var(--text-primary)]">
                  Counterfactual Branching Controls
                </h2>
                <p className="text-xs text-[var(--text-muted)]">
                  Snapshots the exact current simulator state (tick {simulation?.currentTick ?? 0})
                  into 5 isolated clones with identical future process arrivals. Live simulator
                  state is never modified.
                </p>
              </div>
              {cfReport && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => exportService.exportCounterfactualCsv(cfReport)}
                    className="raira-btn-secondary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs cursor-pointer whitespace-nowrap"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      exportService.downloadJson(
                        cfReport,
                        `raira-counterfactual-t${cfReport.startTick}`
                      )
                    }
                    className="raira-btn-secondary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs cursor-pointer whitespace-nowrap"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>JSON</span>
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
              <div>
                <label
                  htmlFor="cf-horizon"
                  className="block text-[11px] font-medium text-[var(--text-muted)] mb-1"
                >
                  Evaluation Horizon
                </label>
                <select
                  id="cf-horizon"
                  value={String(horizon)}
                  onChange={(e) =>
                    setHorizon(
                      e.target.value === 'FULL_EPISODE' ? 'FULL_EPISODE' : Number(e.target.value)
                    )
                  }
                  className="raira-input w-full rounded-lg px-3 py-2 text-xs font-mono"
                >
                  <option value="5">5 Ticks Ahead</option>
                  <option value="10">10 Ticks Ahead</option>
                  <option value="20">20 Ticks Ahead</option>
                  <option value="40">40 Ticks Ahead</option>
                  <option value="FULL_EPISODE">Until Episode Completion</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="cf-rl-agent"
                  className="block text-[11px] font-medium text-[var(--text-muted)] mb-1"
                >
                  Reference RL Policy
                </label>
                <select
                  id="cf-rl-agent"
                  value={rlRefAgent}
                  onChange={(e) => {
                    setRlRefAgent(e.target.value as 'Q_LEARNING' | 'DQN');
                    setAltActionId('AUTO');
                  }}
                  className="raira-input w-full rounded-lg px-3 py-2 text-xs font-mono"
                >
                  <option value="DQN">Deep Q-Network (DQN)</option>
                  <option value="Q_LEARNING">Tabular Q-Learning</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="cf-alt-action"
                  className="block text-[11px] font-medium text-[var(--text-muted)] mb-1"
                >
                  Alternative Valid RL Action
                </label>
                <select
                  id="cf-alt-action"
                  value={String(altActionId)}
                  onChange={(e) =>
                    setAltActionId(e.target.value === 'AUTO' ? 'AUTO' : Number(e.target.value))
                  }
                  className="raira-input w-full rounded-lg px-3 py-2 text-xs font-mono"
                >
                  <option value="AUTO">Auto (2nd Highest Valid Q-Action)</option>
                  {cfReport?.validActionsAtBranch
                    .filter((a) => !a.isSelected)
                    .map((a) => (
                      <option key={a.actionId} value={a.actionId}>
                        #{a.actionId} · {a.label} (Q={a.qValue.toFixed(2)})
                      </option>
                    ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleRunCounterfactual}
                disabled={cfLoading || !hasProcesses || simulation?.status === 'COMPLETED'}
                className="raira-btn-primary inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold disabled:opacity-45 cursor-pointer whitespace-nowrap"
              >
                <GitBranch className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{cfLoading ? 'Cloning & Simulating...' : 'Run 5-Branch What-If'}</span>
              </button>
            </div>

            {cfError && (
              <div
                role="alert"
                className="rounded-lg border px-3.5 py-2.5 text-xs"
                style={{
                  borderColor: 'var(--status-danger)',
                  backgroundColor: 'var(--status-danger-soft)',
                  color: 'var(--status-danger)',
                }}
              >
                {cfError}
              </div>
            )}

            {/* Scientific Counterfactual Disclaimer */}
            <div
              className="rounded-lg border px-3.5 py-2.5 text-xs"
              style={{
                borderColor: 'var(--status-warning)',
                backgroundColor: 'var(--status-warning-soft)',
                color: 'var(--text-primary)',
              }}
            >
              <strong style={{ color: 'var(--status-warning)' }}>
                Counterfactual Simulation Notice:
              </strong>{' '}
              Branches execute deterministic isolated clones from Tick {simulation?.currentTick ?? 0}{' '}
              using identical scheduled arrivals. This is a controlled counterfactual comparison, not
              a guaranteed prediction of future real-world workloads with unknown arrivals.
            </div>
          </section>

          {cfReport && (
            <>
              {/* Interactive Comparison Table */}
              <section className="raira-card raira-card-pad space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-display text-sm font-semibold text-[var(--text-primary)]">
                    Counterfactual Outcome Matrix · Branched at Tick {cfReport.startTick} (Horizon:{' '}
                    {cfReport.horizonTicks === 'FULL_EPISODE'
                      ? 'Full Episode'
                      : `${cfReport.horizonTicks} ticks`}
                    )
                  </h3>
                  <span className="font-mono text-xs text-[var(--text-muted)] tabular-nums">
                    RAM at Branch: {cfReport.availableRamAtBranchMb} MB free
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="raira-table w-full text-left text-xs">
                    <thead>
                      <tr
                        className="border-b text-[11px] uppercase tracking-wider text-[var(--text-muted)]"
                        style={{ borderColor: 'var(--border-subtle)' }}
                      >
                        <th className="pr-3">Branch Policy</th>
                        <th className="px-3">Initial Action @ t={cfReport.startTick}</th>
                        <th className="px-3 text-right">CPU %</th>
                        <th className="px-3 text-right">RAM %</th>
                        <th className="px-3 text-right">Avg Wait</th>
                        <th className="px-3 text-right">Turnaround</th>
                        <th className="px-3 text-right">Throughput</th>
                        <th className="px-3 text-right">Violations</th>
                        <th className="px-3 text-right">Reward</th>
                        <th className="pl-3 text-right">Δ Wait vs RL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle)] font-mono tabular-nums">
                      {cfReport.branches.map((b) => {
                        const isRef = b.branchId === 'SELECTED_RL';
                        return (
                          <tr
                            key={b.branchId}
                            className={
                              isRef
                                ? 'text-[var(--text-primary)]'
                                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]'
                            }
                            style={
                              isRef ? { backgroundColor: 'var(--accent-soft)' } : undefined
                            }
                          >
                            <td className="pr-3 font-sans font-medium whitespace-nowrap">
                              <div>{b.label}</div>
                              <div className="text-[10px] text-[var(--text-muted)] font-normal">
                                {b.metrics.completedCount}/{b.metrics.totalProcesses} done by t=
                                {b.metrics.endTick}
                              </div>
                            </td>
                            <td className="px-3 text-[var(--accent-text)] whitespace-nowrap">
                              {b.initialActionLabel}
                            </td>
                            <td className="px-3 text-right">
                              {b.metrics.avgCpuUtilisation.toFixed(1)}%
                            </td>
                            <td className="px-3 text-right">
                              {b.metrics.avgRamUtilisation.toFixed(1)}%
                            </td>
                            <td className="px-3 text-right font-semibold text-[var(--text-primary)]">
                              {b.metrics.avgWaitingTime.toFixed(2)}t
                            </td>
                            <td className="px-3 text-right">
                              {b.metrics.avgTurnaroundTime.toFixed(2)}t
                            </td>
                            <td className="px-3 text-right">{b.metrics.throughput.toFixed(2)}</td>
                            <td
                              className={`px-3 text-right ${
                                b.metrics.resourceViolations > 0
                                  ? 'text-red-700 dark:text-red-400 font-semibold'
                                  : 'text-emerald-700 dark:text-emerald-400'
                              }`}
                            >
                              {b.metrics.resourceViolations}
                            </td>
                            <td className="px-3 text-right">
                              {b.metrics.totalEpisodeReward.toFixed(2)}
                            </td>
                            <td
                              className={`pl-3 text-right font-semibold ${
                                isRef
                                  ? 'text-[var(--text-muted)]'
                                  : b.deltasVsSelected.waitingTimeDelta < 0
                                    ? 'text-emerald-700 dark:text-emerald-400'
                                    : b.deltasVsSelected.waitingTimeDelta > 0
                                      ? 'text-amber-700 dark:text-amber-400'
                                      : 'text-[var(--text-muted)]'
                              }`}
                            >
                              {isRef
                                ? 'Baseline'
                                : `${b.deltasVsSelected.waitingTimeDelta >= 0 ? '+' : ''}${b.deltasVsSelected.waitingTimeDelta.toFixed(2)}t`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Visual Bar Chart Comparison */}
              <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="raira-card raira-card-pad space-y-3">
                  <h3 className="font-display text-sm font-semibold text-[var(--text-primary)]">
                    Waiting &amp; Turnaround Time Across Branches (Lower is Better)
                  </h3>
                  <div className="h-60">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                        <CartesianGrid
                          stroke={chartTheme.grid}
                          strokeDasharray="3 3"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="name"
                          stroke={chartTheme.axis}
                          tick={{ fontSize: 11, fill: chartTheme.tick }}
                        />
                        <YAxis
                          stroke={chartTheme.axis}
                          tick={{ fontSize: 11, fill: chartTheme.tick }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: chartTheme.tooltipBg,
                            borderColor: chartTheme.tooltipBorder,
                            borderRadius: '8px',
                            fontSize: 12,
                            color: chartTheme.tooltipText,
                          }}
                          labelStyle={{ color: chartTheme.tooltipLabel }}
                        />
                        <Bar
                          dataKey="avgWait"
                          name="Avg Wait (t)"
                          fill={chartTheme.primary}
                          radius={chartTheme.barRadius}
                          isAnimationActive={false}
                        />
                        <Bar
                          dataKey="turnaround"
                          name="Turnaround (t)"
                          fill={chartTheme.secondary}
                          radius={chartTheme.barRadius}
                          isAnimationActive={false}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="raira-card raira-card-pad space-y-3">
                  <h3 className="font-display text-sm font-semibold text-[var(--text-primary)]">
                    Episode Reward &amp; Throughput Across Branches (Higher is Better)
                  </h3>
                  <div className="h-60">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                        <CartesianGrid
                          stroke={chartTheme.grid}
                          strokeDasharray="3 3"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="name"
                          stroke={chartTheme.axis}
                          tick={{ fontSize: 11, fill: chartTheme.tick }}
                        />
                        <YAxis
                          stroke={chartTheme.axis}
                          tick={{ fontSize: 11, fill: chartTheme.tick }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: chartTheme.tooltipBg,
                            borderColor: chartTheme.tooltipBorder,
                            borderRadius: '8px',
                            fontSize: 12,
                            color: chartTheme.tooltipText,
                          }}
                          labelStyle={{ color: chartTheme.tooltipLabel }}
                        />
                        <Bar
                          dataKey="reward"
                          name="Episode Reward"
                          fill={chartTheme.success}
                          radius={chartTheme.barRadius}
                          isAnimationActive={false}
                        />
                        <Bar
                          dataKey="throughput"
                          name="Throughput (/100t)"
                          fill={chartTheme.tertiary}
                          radius={chartTheme.barRadius}
                          isAnimationActive={false}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>
      )}
    </div>
  );
};
