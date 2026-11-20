import React from 'react';
import { Download } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SimulationSnapshot } from '../types/simulation';
import type {
  ExperimentRecord,
  ResultProvenance,
  SeedComparisonBatch,
} from '../types/experiment';
import type {
  TrainingEpisodeMetric,
  TrainingSessionSnapshot,
} from '../types/reinforcementLearning';
import type { StatisticalValidationReport } from '../types/intelligence';
import { exportService } from '../services/exportService';
import { StatisticalValidationLab } from '../components/StatisticalValidationLab';
import {
  formatAlgorithmShort,
  formatProvenanceLabel,
  formatWorkloadName,
  getProvenanceClass,
} from '../utils/formatters';
import { useTheme } from '../theme/ThemeContext';

interface ResearchAnalyticsProps {
  simulation: SimulationSnapshot | null;
  training: TrainingSessionSnapshot | null;
  qHistory: TrainingEpisodeMetric[];
  dqnHistory: TrainingEpisodeMetric[];
  latestComparison: SeedComparisonBatch | null;
  experiments: ExperimentRecord[];
  latestValidationReport: StatisticalValidationReport | null;
  onValidationComplete: (report: StatisticalValidationReport) => void;
}

const ProvenanceTag: React.FC<{ provenance: ResultProvenance }> = ({ provenance }) => (
  <span className={`text-[11px] font-mono ${getProvenanceClass(provenance)}`}>
    {formatProvenanceLabel(provenance)}
  </span>
);

export const ResearchAnalytics: React.FC<ResearchAnalyticsProps> = ({
  simulation,
  training,
  qHistory,
  dqnHistory,
  latestComparison,
  experiments,
  latestValidationReport,
  onValidationComplete,
}) => {
  const { chartTheme } = useTheme();
  const telemetry = simulation?.telemetryHistory ?? [];
  const hasTelemetry = telemetry.length > 0;
  const hasQ = qHistory.length > 0;
  const hasDqn = dqnHistory.length > 0;
  const hasComparison = latestComparison !== null;

  const comparisonChartData =
    latestComparison?.aggregated
      .filter((a) => a.available)
      .map((a) => ({
        name: formatAlgorithmShort(a.algorithm) + (a.isTrainedModel ? '' : '*'),
        waiting: a.avgWaitingTime,
        turnaround: a.avgTurnaroundTime,
        fairness: Number((a.jainFairnessIndex * 100).toFixed(2)),
        reward: a.avgEpisodeReward,
      })) ?? [];

  const handleExportSummaryJson = () => {
    exportService.downloadJson(
      {
        exportedAt: new Date().toISOString(),
        configuration: {
          system: '1-core CPU (100%), 4096 MB RAM, max 32 processes, discrete-time',
          activeAlgorithm: simulation?.algorithm ?? null,
          activeWorkload: simulation?.workloadType ?? null,
          activeSeed: simulation?.seed ?? null,
          rewardWeights: simulation?.rewardWeights ?? null,
        },
        agentSummaries: {
          qLearning: training?.qLearningSummary ?? null,
          dqn: training?.dqnSummary ?? null,
        },
        qLearningCurve: qHistory,
        dqnCurve: dqnHistory,
        latestComparison,
        experimentRecords: experiments,
      },
      `raira-research-summary-${Date.now()}.json`
    );
  };

  const handleExportCsv = () => {
    if (experiments.length > 0) {
      exportService.exportExperimentsCsv(
        experiments,
        `raira-research-experiments-${Date.now()}.csv`
      );
    } else if (latestComparison) {
      exportService.exportComparisonCsv(
        latestComparison,
        `raira-research-comparison-${Date.now()}.csv`
      );
    } else if (hasTelemetry) {
      exportService.downloadCsv(
        telemetry.map((t) => ({ ...t })),
        `raira-telemetry-${Date.now()}.csv`
      );
    }
  };

  const tooltipStyle = {
    backgroundColor: chartTheme.tooltipBg,
    borderColor: chartTheme.tooltipBorder,
    borderRadius: '8px',
    fontSize: '12px',
    color: chartTheme.tooltipText,
  };

  return (
    <div className="raira-section-stack">
      {/* Header Export & Provenance Legend */}
      <section className="raira-card raira-card-pad flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <h2 className="font-display text-base font-semibold text-[var(--text-primary)]">
            Empirical Research Analytics &amp; Provenance Tracking
          </h2>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="text-emerald-700 dark:text-emerald-400 font-mono">
              Actual generated experiment result
            </span>
            <span className="text-[var(--text-muted)]">·</span>
            <span className="text-[var(--accent-text)] font-mono">Illustrative demonstration</span>
            <span className="text-[var(--text-muted)]">·</span>
            <span className="text-amber-700 dark:text-amber-400 font-mono">
              Unavailable because an algorithm has not been trained
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={experiments.length === 0 && !latestComparison && !hasTelemetry}
            className="raira-btn-secondary inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium disabled:opacity-40 cursor-pointer whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={handleExportSummaryJson}
            className="raira-btn-primary inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold cursor-pointer whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Download Full Research Summary (JSON)</span>
          </button>
        </div>
      </section>

      {/* RL Learning Curves: Q-Learning & DQN */}
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="raira-card raira-card-pad space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-display text-sm font-semibold text-[var(--text-primary)]">
                Q-Learning Episode Reward Progression
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Sparse candidate-aware tabular SMDP updates
              </p>
            </div>
            <ProvenanceTag provenance={hasQ ? 'ACTUAL_GENERATED' : 'UNAVAILABLE_UNTRAINED'} />
          </div>
          <div className="h-56 w-full">
            {!hasQ ? (
              <div className="raira-empty-state h-full flex items-center justify-center px-4 text-center text-xs text-amber-700 dark:text-amber-400">
                Unavailable — Tabular Q-Learning has not been trained yet. Train in the RL Training
                Centre to plot real episode rewards.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={qHistory} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                  <XAxis
                    dataKey="episode"
                    stroke={chartTheme.axis}
                    tick={{ fontSize: 11, fill: chartTheme.tick }}
                  />
                  <YAxis
                    stroke={chartTheme.axis}
                    tick={{ fontSize: 11, fill: chartTheme.tick }}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelStyle={{ color: chartTheme.tooltipLabel }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', color: chartTheme.tick }} />
                  <Line
                    type="monotone"
                    dataKey="totalReward"
                    name="Episode Reward"
                    stroke={chartTheme.primary}
                    strokeWidth={1.75}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="avgRewardLast10"
                    name="10-Ep Avg"
                    stroke={chartTheme.success}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="raira-card raira-card-pad space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-display text-sm font-semibold text-[var(--text-primary)]">
                DQN Reward Curve &amp; Huber Training Loss
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                TensorFlow.js 262 → 256 → 128 → 97 with target network sync
              </p>
            </div>
            <ProvenanceTag provenance={hasDqn ? 'ACTUAL_GENERATED' : 'UNAVAILABLE_UNTRAINED'} />
          </div>
          <div className="h-56 w-full">
            {!hasDqn ? (
              <div className="raira-empty-state h-full flex items-center justify-center px-4 text-center text-xs text-amber-700 dark:text-amber-400">
                Unavailable — Deep Q-Network (DQN) has not been trained yet. Train DQN in the RL
                Training Centre to observe real reward and Huber loss curves.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dqnHistory} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                  <XAxis
                    dataKey="episode"
                    stroke={chartTheme.axis}
                    tick={{ fontSize: 11, fill: chartTheme.tick }}
                  />
                  <YAxis
                    stroke={chartTheme.axis}
                    tick={{ fontSize: 11, fill: chartTheme.tick }}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelStyle={{ color: chartTheme.tooltipLabel }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', color: chartTheme.tick }} />
                  <Line
                    type="monotone"
                    dataKey="totalReward"
                    name="DQN Reward"
                    stroke={chartTheme.secondary}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="dqnLoss"
                    name="Huber Loss"
                    stroke={chartTheme.danger}
                    strokeWidth={1.75}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>

      {/* Live Run Resource Utilisation & Waiting/Turnaround Trends */}
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="raira-card raira-card-pad space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-display text-sm font-semibold text-[var(--text-primary)]">
                CPU &amp; RAM Utilisation History
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Active simulation telemetry (
                {simulation ? formatWorkloadName(simulation.workloadType) : 'None'})
              </p>
            </div>
            <ProvenanceTag
              provenance={hasTelemetry ? 'ACTUAL_GENERATED' : 'UNAVAILABLE_UNTRAINED'}
            />
          </div>
          <div className="h-56 w-full">
            {!hasTelemetry ? (
              <div className="raira-empty-state h-full flex items-center justify-center px-4 text-center text-xs">
                Run or step a simulation to capture real per-tick CPU &amp; RAM utilisation curves.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={telemetry} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="raCpuGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartTheme.primary} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={chartTheme.primary} stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="raRamGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartTheme.success} stopOpacity={0.28} />
                      <stop offset="95%" stopColor={chartTheme.success} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                  <XAxis
                    dataKey="tick"
                    stroke={chartTheme.axis}
                    tick={{ fontSize: 11, fill: chartTheme.tick }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    stroke={chartTheme.axis}
                    tick={{ fontSize: 11, fill: chartTheme.tick }}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelStyle={{ color: chartTheme.tooltipLabel }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', color: chartTheme.tick }} />
                  <Area
                    type="stepAfter"
                    dataKey="cpuUtil"
                    name="CPU Util (%)"
                    stroke={chartTheme.primary}
                    fill={chartTheme.useGradients ? 'url(#raCpuGrad)' : chartTheme.primary}
                    fillOpacity={chartTheme.useGradients ? 1 : 0.14}
                    isAnimationActive={false}
                  />
                  <Area
                    type="stepAfter"
                    dataKey="ramUtilPercent"
                    name="RAM Util (%)"
                    stroke={chartTheme.success}
                    fill={chartTheme.useGradients ? 'url(#raRamGrad)' : chartTheme.success}
                    fillOpacity={chartTheme.useGradients ? 1 : 0.14}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="raira-card raira-card-pad space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-display text-sm font-semibold text-[var(--text-primary)]">
                Waiting Time &amp; Jain Fairness Trend
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Per-tick mean waiting time and fairness index progression
              </p>
            </div>
            <ProvenanceTag
              provenance={hasTelemetry ? 'ACTUAL_GENERATED' : 'UNAVAILABLE_UNTRAINED'}
            />
          </div>
          <div className="h-56 w-full">
            {!hasTelemetry ? (
              <div className="raira-empty-state h-full flex items-center justify-center px-4 text-center text-xs">
                Run or step a simulation to inspect waiting time and fairness trajectories.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={telemetry} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                  <XAxis
                    dataKey="tick"
                    stroke={chartTheme.axis}
                    tick={{ fontSize: 11, fill: chartTheme.tick }}
                  />
                  <YAxis
                    stroke={chartTheme.axis}
                    tick={{ fontSize: 11, fill: chartTheme.tick }}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelStyle={{ color: chartTheme.tooltipLabel }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', color: chartTheme.tick }} />
                  <Line
                    type="monotone"
                    dataKey="avgWaitingTime"
                    name="Avg Waiting (t)"
                    stroke={chartTheme.warning}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="fairnessIndex"
                    name="Jain Fairness (0-1)"
                    stroke={chartTheme.tertiary}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>

      {/* Cross-Algorithm Fairness & Turnaround Analysis */}
      <section className="raira-card raira-card-pad space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-display text-sm font-semibold text-[var(--text-primary)]">
              Algorithm Comparison &amp; Fairness Analysis
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              Waiting time, turnaround time, and Jain Fairness (%) from latest controlled benchmark
            </p>
          </div>
          <ProvenanceTag
            provenance={hasComparison ? 'ACTUAL_GENERATED' : 'UNAVAILABLE_UNTRAINED'}
          />
        </div>

        <div className="h-64 w-full">
          {!hasComparison ? (
            <div className="raira-empty-state h-full flex items-center justify-center px-4 text-center text-xs">
              Run a benchmark in the Algorithm Comparison page to populate multi-algorithm fairness
              and turnaround analytics.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={comparisonChartData}
                margin={{ top: 8, right: 16, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
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
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: chartTheme.tooltipLabel }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', color: chartTheme.tick }} />
                <Bar
                  dataKey="waiting"
                  name="Avg Waiting (t)"
                  fill={chartTheme.primary}
                  radius={chartTheme.barRadius}
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="turnaround"
                  name="Avg Turnaround (t)"
                  fill={chartTheme.secondary}
                  radius={chartTheme.barRadius}
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="fairness"
                  name="Jain Fairness (%)"
                  fill={chartTheme.success}
                  radius={chartTheme.barRadius}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* Experiment Configuration & Seed Reproducibility Records */}
      <section className="raira-card raira-card-pad space-y-3">
        <h3 className="font-display text-sm font-semibold text-[var(--text-primary)]">
          Experiment Configuration &amp; Random Seed Records
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono tabular-nums">
          <div className="raira-subtle rounded-lg p-3.5 space-y-1.5">
            <div className="font-sans text-[var(--text-muted)] font-medium">Reward Weights</div>
            <div className="text-[var(--text-primary)]">
              CPU: {simulation?.rewardWeights.cpuRewardWeight ?? 1.0} · Comp:{' '}
              {simulation?.rewardWeights.completionBaseBonus ?? 10.0} +{' '}
              {simulation?.rewardWeights.priorityCompletionBonus ?? 2.0}×P
            </div>
            <div className="text-[var(--text-muted)]">
              Wait: −{simulation?.rewardWeights.waitingPenaltyWeight ?? 0.05}/t · Turn: −
              {simulation?.rewardWeights.turnaroundPenaltyWeight ?? 0.1}
            </div>
            <div className="text-[var(--text-muted)]">
              Fairness: +{simulation?.rewardWeights.fairnessWeight ?? 0.5} (ε=1.0) · Invalid: −
              {simulation?.rewardWeights.invalidActionPenalty ?? 10.0}
            </div>
          </div>

          <div className="raira-subtle rounded-lg p-3.5 space-y-1.5">
            <div className="font-sans text-[var(--text-muted)] font-medium">Active Environment</div>
            <div className="text-[var(--text-primary)]">
              Algorithm: {simulation ? formatAlgorithmShort(simulation.algorithm) : 'FCFS'}
            </div>
            <div className="text-[var(--text-muted)]">
              Workload: {simulation ? formatWorkloadName(simulation.workloadType) : 'None'} · Seed:{' '}
              {simulation?.seed ?? 42}
            </div>
            <div className="text-[var(--text-muted)]">
              RR Quantum: {simulation?.rrQuantum ?? 2}t · Max Horizon:{' '}
              {simulation?.maxTicks ?? 600}t
            </div>
          </div>

          <div className="raira-subtle rounded-lg p-3.5 space-y-1.5">
            <div className="font-sans text-[var(--text-muted)] font-medium">
              Recorded Seeds &amp; Logs
            </div>
            <div className="text-[var(--text-primary)]">
              Saved Experiments: {experiments.length}
            </div>
            <div className="text-[var(--text-muted)]">
              Last Benchmark Seeds: {latestComparison ? latestComparison.seeds.join(', ') : 'None'}
            </div>
            <div className="text-[var(--text-muted)]">
              Trained Episodes: Q={training?.qLearningSummary.episodesTrained ?? 0} · DQN=
              {training?.dqnSummary.episodesTrained ?? 0}
            </div>
          </div>
        </div>
      </section>

      {/* Feature 6: Statistical Research Validation */}
      <StatisticalValidationLab
        report={latestValidationReport}
        onReportComplete={onValidationComplete}
        defaultFocus="ablation"
      />
    </div>
  );
};
