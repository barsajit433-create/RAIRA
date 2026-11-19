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
import { exportService } from '../services/exportService';
import {
  formatAlgorithmShort,
  formatProvenanceLabel,
  formatWorkloadName,
  getProvenanceClass,
} from '../utils/formatters';

interface ResearchAnalyticsProps {
  simulation: SimulationSnapshot | null;
  training: TrainingSessionSnapshot | null;
  qHistory: TrainingEpisodeMetric[];
  dqnHistory: TrainingEpisodeMetric[];
  latestComparison: SeedComparisonBatch | null;
  experiments: ExperimentRecord[];
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
}) => {
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
      exportService.exportExperimentsCsv(experiments, `raira-research-experiments-${Date.now()}.csv`);
    } else if (latestComparison) {
      exportService.exportComparisonCsv(latestComparison, `raira-research-comparison-${Date.now()}.csv`);
    } else if (hasTelemetry) {
      exportService.downloadCsv(
        telemetry.map((t) => ({ ...t })),
        `raira-telemetry-${Date.now()}.csv`
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Export & Provenance Legend */}
      <section className="rounded-xl border border-slate-800/80 bg-[#0B1221] p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <h2 className="font-display text-base font-semibold text-slate-100">
            Empirical Research Analytics &amp; Provenance Tracking
          </h2>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="text-emerald-400 font-mono">
              ● Actual generated experiment result
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-cyan-400 font-mono">● Illustrative demonstration</span>
            <span className="text-slate-600">·</span>
            <span className="text-amber-400 font-mono">
              ● Unavailable because an algorithm has not been trained
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={experiments.length === 0 && !latestComparison && !hasTelemetry}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-40 cursor-pointer whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={handleExportSummaryJson}
            className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400 cursor-pointer whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Download Full Research Summary (JSON)</span>
          </button>
        </div>
      </section>

      {/* RL Learning Curves: Q-Learning & DQN */}
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="rounded-xl border border-slate-800/80 bg-[#0B1221] p-5 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-display text-sm font-semibold text-slate-100">
                Q-Learning Episode Reward Progression
              </h3>
              <p className="text-xs text-slate-400">Sparse candidate-aware tabular SMDP updates</p>
            </div>
            <ProvenanceTag
              provenance={hasQ ? 'ACTUAL_GENERATED' : 'UNAVAILABLE_UNTRAINED'}
            />
          </div>
          <div className="h-56 w-full">
            {!hasQ ? (
              <div className="h-full flex items-center justify-center rounded-lg border border-dashed border-slate-800 px-4 text-center text-xs text-amber-400/90">
                Unavailable — Tabular Q-Learning has not been trained yet. Train in the RL Training
                Centre to plot real episode rewards.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={qHistory} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                  <XAxis dataKey="episode" stroke="#64748B" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <YAxis stroke="#64748B" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Line type="monotone" dataKey="totalReward" name="Episode Reward" stroke="#06B6D4" strokeWidth={1.75} dot={false} />
                  <Line type="monotone" dataKey="avgRewardLast10" name="10-Ep Avg" stroke="#10B981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800/80 bg-[#0B1221] p-5 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-display text-sm font-semibold text-slate-100">
                DQN Reward Curve &amp; Huber Training Loss
              </h3>
              <p className="text-xs text-slate-400">
                TensorFlow.js 262 → 256 → 128 → 97 with target network sync
              </p>
            </div>
            <ProvenanceTag
              provenance={hasDqn ? 'ACTUAL_GENERATED' : 'UNAVAILABLE_UNTRAINED'}
            />
          </div>
          <div className="h-56 w-full">
            {!hasDqn ? (
              <div className="h-full flex items-center justify-center rounded-lg border border-dashed border-slate-800 px-4 text-center text-xs text-amber-400/90">
                Unavailable — Deep Q-Network (DQN) has not been trained yet. Train DQN in the RL
                Training Centre to observe real reward and Huber loss curves.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dqnHistory} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                  <XAxis dataKey="episode" stroke="#64748B" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <YAxis stroke="#64748B" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Line type="monotone" dataKey="totalReward" name="DQN Reward" stroke="#3B82F6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="dqnLoss" name="Huber Loss" stroke="#EF4444" strokeWidth={1.75} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>

      {/* Live Run Resource Utilisation & Waiting/Turnaround Trends */}
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="rounded-xl border border-slate-800/80 bg-[#0B1221] p-5 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-display text-sm font-semibold text-slate-100">
                CPU &amp; RAM Utilisation History
              </h3>
              <p className="text-xs text-slate-400">
                Active simulation telemetry ({simulation ? formatWorkloadName(simulation.workloadType) : 'None'})
              </p>
            </div>
            <ProvenanceTag
              provenance={hasTelemetry ? 'ACTUAL_GENERATED' : 'UNAVAILABLE_UNTRAINED'}
            />
          </div>
          <div className="h-56 w-full">
            {!hasTelemetry ? (
              <div className="h-full flex items-center justify-center rounded-lg border border-dashed border-slate-800 px-4 text-center text-xs text-slate-500">
                Run or step a simulation to capture real per-tick CPU &amp; RAM utilisation curves.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={telemetry} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                  <XAxis dataKey="tick" stroke="#64748B" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <YAxis domain={[0, 100]} stroke="#64748B" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Area type="stepAfter" dataKey="cpuUtil" name="CPU Util (%)" stroke="#06B6D4" fill="#06B6D4" fillOpacity={0.14} />
                  <Area type="stepAfter" dataKey="ramUtilPercent" name="RAM Util (%)" stroke="#10B981" fill="#10B981" fillOpacity={0.14} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800/80 bg-[#0B1221] p-5 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-display text-sm font-semibold text-slate-100">
                Waiting Time &amp; Jain Fairness Trend
              </h3>
              <p className="text-xs text-slate-400">
                Per-tick mean waiting time and fairness index progression
              </p>
            </div>
            <ProvenanceTag
              provenance={hasTelemetry ? 'ACTUAL_GENERATED' : 'UNAVAILABLE_UNTRAINED'}
            />
          </div>
          <div className="h-56 w-full">
            {!hasTelemetry ? (
              <div className="h-full flex items-center justify-center rounded-lg border border-dashed border-slate-800 px-4 text-center text-xs text-slate-500">
                Run or step a simulation to inspect waiting time and fairness trajectories.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={telemetry} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                  <XAxis dataKey="tick" stroke="#64748B" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <YAxis stroke="#64748B" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Line type="monotone" dataKey="avgWaitingTime" name="Avg Waiting (t)" stroke="#F59E0B" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="fairnessIndex" name="Jain Fairness (0-1)" stroke="#818CF8" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>

      {/* Cross-Algorithm Fairness & Turnaround Analysis */}
      <section className="rounded-xl border border-slate-800/80 bg-[#0B1221] p-5 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-display text-sm font-semibold text-slate-100">
              Algorithm Comparison &amp; Fairness Analysis
            </h3>
            <p className="text-xs text-slate-400">
              Waiting time, turnaround time, and Jain Fairness (%) from latest controlled benchmark
            </p>
          </div>
          <ProvenanceTag
            provenance={hasComparison ? 'ACTUAL_GENERATED' : 'UNAVAILABLE_UNTRAINED'}
          />
        </div>

        <div className="h-64 w-full">
          {!hasComparison ? (
            <div className="h-full flex items-center justify-center rounded-lg border border-dashed border-slate-800 px-4 text-center text-xs text-slate-500">
              Run a benchmark in the Algorithm Comparison page to populate multi-algorithm fairness
              and turnaround analytics.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonChartData} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="name" stroke="#64748B" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                <YAxis stroke="#64748B" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    borderColor: '#334155',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="waiting" name="Avg Waiting (t)" fill="#06B6D4" radius={[4, 4, 0, 0]} />
                <Bar dataKey="turnaround" name="Avg Turnaround (t)" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="fairness" name="Jain Fairness (%)" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* Experiment Configuration & Seed Reproducibility Records */}
      <section className="rounded-xl border border-slate-800/80 bg-[#0B1221] p-5 space-y-3">
        <h3 className="font-display text-sm font-semibold text-slate-100">
          Experiment Configuration &amp; Random Seed Records
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono tabular-nums">
          <div className="rounded-lg border border-slate-800 bg-[#080F1D] p-3.5 space-y-1.5">
            <div className="font-sans text-slate-400 font-medium">Reward Weights</div>
            <div className="text-slate-200">
              CPU: {simulation?.rewardWeights.cpuRewardWeight ?? 1.0} · Comp:{' '}
              {simulation?.rewardWeights.completionBaseBonus ?? 10.0} +{' '}
              {simulation?.rewardWeights.priorityCompletionBonus ?? 2.0}×P
            </div>
            <div className="text-slate-400">
              Wait: −{simulation?.rewardWeights.waitingPenaltyWeight ?? 0.05}/t · Turn: −
              {simulation?.rewardWeights.turnaroundPenaltyWeight ?? 0.1}
            </div>
            <div className="text-slate-400">
              Fairness: +{simulation?.rewardWeights.fairnessWeight ?? 0.5} (ε=1.0) · Invalid: −
              {simulation?.rewardWeights.invalidActionPenalty ?? 10.0}
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-[#080F1D] p-3.5 space-y-1.5">
            <div className="font-sans text-slate-400 font-medium">Active Environment</div>
            <div className="text-slate-200">
              Algorithm: {simulation ? formatAlgorithmShort(simulation.algorithm) : 'FCFS'}
            </div>
            <div className="text-slate-400">
              Workload: {simulation ? formatWorkloadName(simulation.workloadType) : 'None'} · Seed:{' '}
              {simulation?.seed ?? 42}
            </div>
            <div className="text-slate-400">
              RR Quantum: {simulation?.rrQuantum ?? 2}t · Max Horizon: {simulation?.maxTicks ?? 600}t
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-[#080F1D] p-3.5 space-y-1.5">
            <div className="font-sans text-slate-400 font-medium">Recorded Seeds &amp; Logs</div>
            <div className="text-slate-200">Saved Experiments: {experiments.length}</div>
            <div className="text-slate-400">
              Last Benchmark Seeds: {latestComparison ? latestComparison.seeds.join(', ') : 'None'}
            </div>
            <div className="text-slate-400">
              Trained Episodes: Q={training?.qLearningSummary.episodesTrained ?? 0} · DQN=
              {training?.dqnSummary.episodesTrained ?? 0}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
