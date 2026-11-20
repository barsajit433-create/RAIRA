import React, { useMemo, useState } from 'react';
import { CheckCircle2, Download, FlaskConical, Play } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { WorkloadType } from '../types/process';
import type {
  StatisticalValidationConfig,
  StatisticalValidationReport,
} from '../types/intelligence';
import { rairaApi } from '../services/api';
import { exportService } from '../services/exportService';
import { experimentStorage } from '../services/experimentStorage';
import { useTheme } from '../theme/ThemeContext';

interface StatisticalValidationLabProps {
  report: StatisticalValidationReport | null;
  onReportComplete: (report: StatisticalValidationReport) => void;
  defaultFocus?: 'overview' | 'ablation';
}

const ALL_WORKLOADS: Array<{ id: Exclude<WorkloadType, 'CUSTOM'>; label: string }> = [
  { id: 'CPU_INTENSIVE', label: 'CPU-Intensive' },
  { id: 'MEMORY_INTENSIVE', label: 'Memory-Intensive' },
  { id: 'MIXED', label: 'Mixed (In-Dist)' },
  { id: 'DYNAMIC', label: 'Dynamic Arrivals' },
];

export const StatisticalValidationLab: React.FC<StatisticalValidationLabProps> = ({
  report,
  onReportComplete,
  defaultFocus = 'overview',
}) => {
  const { chartTheme } = useTheme();
  const [seedStart, setSeedStart] = useState<number>(1001);
  const [seedCount, setSeedCount] = useState<number>(30);
  const [numProcesses, setNumProcesses] = useState<number>(10);
  const [rrQuantum, setRrQuantum] = useState<number>(2);
  const [selectedWorkloads, setSelectedWorkloads] = useState<
    Array<Exclude<WorkloadType, 'CUSTOM'>>
  >(['CPU_INTENSIVE', 'MEMORY_INTENSIVE', 'MIXED', 'DYNAMIC']);
  const [includeUntrained, setIncludeUntrained] = useState<boolean>(true);
  const [includeAblation, setIncludeAblation] = useState<boolean>(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'ci' | 'generalisation' | 'ablation'>(
    defaultFocus === 'ablation' ? 'ablation' : 'ci'
  );

  const toggleWorkload = (id: Exclude<WorkloadType, 'CUSTOM'>) => {
    setSelectedWorkloads((prev) => {
      if (prev.includes(id)) {
        return prev.length > 1 ? prev.filter((w) => w !== id) : prev;
      }
      return [...prev, id];
    });
  };

  const handleRun = async () => {
    setLoading(true);
    setError(null);
    try {
      const cfg: StatisticalValidationConfig = {
        seedStart: Math.max(1, seedStart),
        seedCount: Math.max(5, Math.min(100, seedCount)),
        workloads: selectedWorkloads,
        numProcesses: Math.max(4, Math.min(24, numProcesses)),
        rrQuantum: Math.max(1, Math.min(8, rrQuantum)),
        includeUntrainedComparison: includeUntrained,
        includeAblationStudy: includeAblation,
        starvationThreshold: experimentStorage.loadSettings().starvationThreshold,
      };
      const result = await rairaApi.runStatisticalValidation(cfg);
      onReportComplete(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const ciChartData = useMemo(() => {
    if (!report) return [];
    return report.overallSummaries.map((s) => ({
      policy: s.label.replace(' (Untrained Ref)', ' (Untr.)'),
      meanWait: s.waitingTime.mean,
      p95Wait: s.waitingTime.p95,
      medianWait: s.waitingTime.median,
      reward: s.episodeReward.mean,
      fairnessPct: Number((s.serviceShareFairness.mean * 100).toFixed(1)),
    }));
  }, [report]);

  return (
    <section className="raira-card raira-card-pad space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-[var(--accent-text)]" aria-hidden="true" />
            Statistical Research Validation Laboratory (≥30-Seed Evaluation)
          </h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Runs identical seeded workloads across all scheduling policies using evaluation seeds
            strictly separated from training seeds (42..875), computing Mean ± SD, Student-t 95%
            Confidence Intervals, Median, P95, Unseen-Workload Generalisation, and Ablation Studies.
          </p>
        </div>

        {report && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => exportService.exportStatisticalValidationCsv(report)}
              className="raira-btn-secondary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs cursor-pointer whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={() =>
                exportService.downloadJson(
                  report,
                  `raira-statistical-validation-${report.config.seedCount}seeds`
                )
              }
              className="raira-btn-secondary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs cursor-pointer whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Export JSON</span>
            </button>
          </div>
        )}
      </div>

      {/* Configuration Controls */}
      <div className="raira-subtle rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label htmlFor="sv-seed-start" className="block text-[11px] text-[var(--text-muted)] mb-1">
              Eval Seed Start (≥1001 disjoint)
            </label>
            <input
              id="sv-seed-start"
              type="number"
              min={1}
              value={seedStart}
              onChange={(e) => setSeedStart(Math.max(1, Number(e.target.value)))}
              className="raira-input w-full rounded-lg px-2.5 py-1.5 text-xs font-mono"
            />
          </div>

          <div>
            <label htmlFor="sv-seed-count" className="block text-[11px] text-[var(--text-muted)] mb-1">
              Independent Seeds (Default 30)
            </label>
            <input
              id="sv-seed-count"
              type="number"
              min={5}
              max={60}
              value={seedCount}
              onChange={(e) => setSeedCount(Math.max(5, Math.min(60, Number(e.target.value))))}
              className="raira-input w-full rounded-lg px-2.5 py-1.5 text-xs font-mono"
            />
          </div>

          <div>
            <label htmlFor="sv-procs" className="block text-[11px] text-[var(--text-muted)] mb-1">
              Processes / Episode
            </label>
            <input
              id="sv-procs"
              type="number"
              min={4}
              max={20}
              value={numProcesses}
              onChange={(e) => setNumProcesses(Math.max(4, Math.min(20, Number(e.target.value))))}
              className="raira-input w-full rounded-lg px-2.5 py-1.5 text-xs font-mono"
            />
          </div>

          <div>
            <label htmlFor="sv-rrq" className="block text-[11px] text-[var(--text-muted)] mb-1">
              RR Quantum
            </label>
            <select
              id="sv-rrq"
              value={rrQuantum}
              onChange={(e) => setRrQuantum(Number(e.target.value))}
              className="raira-input w-full rounded-lg px-2.5 py-1.5 text-xs font-mono"
            >
              {[1, 2, 3, 4].map((q) => (
                <option key={q} value={q}>
                  {q} tick{q > 1 ? 's' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div
          className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-[var(--text-muted)]">Workloads:</span>
            {ALL_WORKLOADS.map((w) => {
              const on = selectedWorkloads.includes(w.id);
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => toggleWorkload(w.id)}
                  className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                    on
                      ? 'text-[var(--accent-text)]'
                      : 'raira-btn-secondary text-[var(--text-muted)]'
                  }`}
                  style={
                    on
                      ? {
                          borderColor: 'var(--accent-primary)',
                          backgroundColor: 'var(--accent-soft)',
                        }
                      : undefined
                  }
                >
                  {w.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--text-secondary)]">
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={includeUntrained}
                onChange={(e) => setIncludeUntrained(e.target.checked)}
                style={{ accentColor: 'var(--accent-primary)' }}
              />
              <span>Trained vs. Untrained RL</span>
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={includeAblation}
                onChange={(e) => setIncludeAblation(e.target.checked)}
                style={{ accentColor: 'var(--accent-primary)' }}
              />
              <span>Run Ablation Study</span>
            </label>
            <button
              type="button"
              onClick={handleRun}
              disabled={loading}
              className="raira-btn-primary inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              <Play className="h-3.5 w-3.5" aria-hidden="true" />
              <span>
                {loading
                  ? `Running ${seedCount} Seeds × ${selectedWorkloads.length} Workloads...`
                  : `Run ${seedCount}-Seed Validation Suite`}
              </span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border px-3.5 py-2.5 text-xs"
          style={{
            borderColor: 'var(--status-danger)',
            backgroundColor: 'var(--status-danger-soft)',
            color: 'var(--status-danger)',
          }}
        >
          {error}
        </div>
      )}

      {report && (
        <div className="space-y-5">
          {/* Validation Provenance & Seed Separation Strip */}
          <div className="raira-subtle rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2
                className={`h-4 w-4 shrink-0 ${
                  report.disjointFromTrainingSeeds
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-amber-700 dark:text-amber-400'
                }`}
                aria-hidden="true"
              />
              <span className="text-[var(--text-primary)]">
                Seeds{' '}
                <span className="font-mono text-[var(--accent-text)]">
                  {report.evaluationSeeds[0]}..
                  {report.evaluationSeeds[report.evaluationSeeds.length - 1]}
                </span>{' '}
                ({report.evaluationSeeds.length} seeds × {report.config.workloads.length} workload
                {report.config.workloads.length > 1 ? 's' : ''} = {report.totalEpisodesExecuted}{' '}
                episodes in {(report.durationMs / 1000).toFixed(2)}s)
              </span>
            </div>
            <span
              className={`font-mono text-[11px] ${
                report.disjointFromTrainingSeeds
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-amber-700 dark:text-amber-400'
              }`}
            >
              {report.disjointFromTrainingSeeds
                ? '100% Disjoint from Training Seeds (42..875)'
                : 'Warning: Overlaps Training Seed Range'}
            </span>
          </div>

          {/* Empirical Observations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs text-[var(--text-secondary)]">
            {report.empiricalFindings.map((finding, idx) => (
              <div key={idx} className="raira-subtle rounded-lg px-3.5 py-2.5 leading-relaxed">
                {finding}
              </div>
            ))}
          </div>

          {/* Sub-view Tabs */}
          <div
            className="flex flex-wrap items-center gap-2 border-b pb-3"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            {[
              { id: 'ci' as const, label: 'Confidence Intervals & Distributions' },
              { id: 'generalisation' as const, label: 'Unseen-Workload Generalisation' },
              { id: 'ablation' as const, label: 'Controlled Ablation Study' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setViewMode(tab.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer border ${
                  viewMode === tab.id
                    ? 'text-[var(--accent-text)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] border-transparent'
                }`}
                style={
                  viewMode === tab.id
                    ? {
                        backgroundColor: 'var(--accent-soft)',
                        borderColor: 'var(--accent-border)',
                      }
                    : undefined
                }
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* VIEW A: Confidence Intervals & Distribution Summary */}
          {viewMode === 'ci' && (
            <div className="space-y-5">
              <div className="overflow-x-auto">
                <table className="raira-table w-full text-left text-xs">
                  <thead>
                    <tr
                      className="border-b text-[11px] uppercase tracking-wider text-[var(--text-muted)]"
                      style={{ borderColor: 'var(--border-subtle)' }}
                    >
                      <th className="pr-3">Policy</th>
                      <th className="px-3 text-right">Wait Mean ± SD</th>
                      <th className="px-3 text-right">Wait 95% CI</th>
                      <th className="px-3 text-right">Median / P95 Wait</th>
                      <th className="px-3 text-right">Turnaround</th>
                      <th className="px-3 text-right">Throughput</th>
                      <th className="px-3 text-right">J_share / Jain</th>
                      <th className="pl-3 text-right">Reward Mean ± SD</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)] font-mono tabular-nums">
                    {report.overallSummaries.map((s) => (
                      <tr
                        key={s.policyKey}
                        className={
                          !s.isTrainedModel
                            ? 'text-[var(--text-muted)] bg-[var(--surface-subtle)]'
                            : 'text-[var(--text-primary)] hover:bg-[var(--surface-subtle)]'
                        }
                      >
                        <td className="pr-3 font-sans font-medium whitespace-nowrap">
                          {s.label}
                          <span className="ml-2 text-[10px] font-mono text-[var(--text-muted)]">
                            n={s.sampleCount}
                          </span>
                        </td>
                        <td className="px-3 text-right">
                          {s.waitingTime.mean.toFixed(2)} ± {s.waitingTime.stdDev.toFixed(2)}
                        </td>
                        <td className="px-3 text-right text-[var(--accent-text)] whitespace-nowrap">
                          [{s.waitingTime.ci95Low.toFixed(2)}, {s.waitingTime.ci95High.toFixed(2)}]
                        </td>
                        <td className="px-3 text-right whitespace-nowrap">
                          {s.waitingTime.median.toFixed(2)} /{' '}
                          <span className="text-amber-700 dark:text-amber-300">
                            {s.waitingTime.p95.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-3 text-right">{s.turnaroundTime.mean.toFixed(2)}t</td>
                        <td className="px-3 text-right">{s.throughput.mean.toFixed(2)}</td>
                        <td className="px-3 text-right whitespace-nowrap">
                          {s.serviceShareFairness.mean.toFixed(3)} /{' '}
                          {s.jainFairness.mean.toFixed(3)}
                        </td>
                        <td className="pl-3 text-right text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
                          {s.episodeReward.mean.toFixed(2)} ± {s.episodeReward.stdDev.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ciChartData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                    <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="policy"
                      stroke={chartTheme.axis}
                      tick={{ fontSize: 10, fill: chartTheme.tick }}
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
                    <Legend wrapperStyle={{ fontSize: 11, color: chartTheme.tick }} />
                    <Bar
                      dataKey="meanWait"
                      name="Mean Wait (t)"
                      fill={chartTheme.primary}
                      radius={chartTheme.barRadius}
                      isAnimationActive={false}
                    />
                    <Bar
                      dataKey="medianWait"
                      name="Median Wait (t)"
                      fill={chartTheme.secondary}
                      radius={chartTheme.barRadius}
                      isAnimationActive={false}
                    />
                    <Bar
                      dataKey="p95Wait"
                      name="P95 Wait (t)"
                      fill={chartTheme.warning}
                      radius={chartTheme.barRadius}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* VIEW B: Unseen-Workload Generalisation */}
          {viewMode === 'generalisation' && (
            <div className="space-y-3">
              <p className="text-xs text-[var(--text-muted)]">
                Bundled Q-Learning &amp; DQN models were trained exclusively on{' '}
                <strong className="text-[var(--text-primary)]">MIXED</strong> workloads. Performance
                on <strong className="text-[var(--accent-text)]">CPU-Intensive</strong>,{' '}
                <strong className="text-[var(--accent-text)]">Memory-Intensive</strong>, and{' '}
                <strong className="text-[var(--accent-text)]">Dynamic Arrivals</strong> measures
                true out-of-distribution generalisation across {report.evaluationSeeds.length}{' '}
                independent evaluation seeds.
              </p>
              <div className="overflow-x-auto">
                <table className="raira-table w-full text-left text-xs">
                  <thead>
                    <tr
                      className="border-b text-[11px] uppercase tracking-wider text-[var(--text-muted)]"
                      style={{ borderColor: 'var(--border-subtle)' }}
                    >
                      <th className="pr-3">Workload Category</th>
                      <th className="px-3">Distribution</th>
                      {report.overallSummaries
                        .filter((s) => s.isTrainedModel)
                        .map((s) => (
                          <th key={s.policyKey} className="px-3 text-right whitespace-nowrap">
                            {s.label} (Wait / Rew)
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)] font-mono tabular-nums">
                    {report.workloadBreakdown.map((row) => (
                      <tr key={row.workloadType} className="hover:bg-[var(--surface-subtle)]">
                        <td className="pr-3 font-sans font-semibold text-[var(--text-primary)]">
                          {row.workloadType}
                        </td>
                        <td className="px-3 text-[11px]">
                          <span
                            className={
                              row.isUnseenForPretrained
                                ? 'text-[var(--accent-text)]'
                                : 'text-emerald-700 dark:text-emerald-400'
                            }
                          >
                            {row.isUnseenForPretrained ? 'Unseen OOD' : 'In-Distribution'}
                          </span>
                        </td>
                        {report.overallSummaries
                          .filter((s) => s.isTrainedModel)
                          .map((s) => {
                            const cell = row.byPolicy[s.policyKey];
                            return (
                              <td key={s.policyKey} className="px-3 text-right whitespace-nowrap">
                                <span className="text-[var(--text-primary)]">
                                  {cell ? `${cell.avgWaitMean.toFixed(1)}t` : '—'}
                                </span>{' '}
                                <span className="text-[var(--text-muted)]">/</span>{' '}
                                <span className="text-emerald-700 dark:text-emerald-300">
                                  {cell ? cell.rewardMean.toFixed(1) : '—'}
                                </span>
                              </td>
                            );
                          })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW C: Controlled Ablation Study */}
          {viewMode === 'ablation' && (
            <div className="space-y-3">
              {report.ablationStudy.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] py-4">
                  Enable “Run Ablation Study” above and execute the validation suite to inspect
                  adaptive quantum and reward-objective ablations.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="raira-table w-full text-left text-xs">
                    <thead>
                      <tr
                        className="border-b text-[11px] uppercase tracking-wider text-[var(--text-muted)]"
                        style={{ borderColor: 'var(--border-subtle)' }}
                      >
                        <th className="pr-3">Ablation Variant</th>
                        <th className="px-3">Experimental Control</th>
                        <th className="px-3 text-right">Wait Mean ± SD</th>
                        <th className="px-3 text-right">Throughput</th>
                        <th className="px-3 text-right">Jain Fairness</th>
                        <th className="px-3 text-right">Mean Reward</th>
                        <th className="pl-3 text-right">Δ Reward vs Full</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle)] font-mono tabular-nums">
                      {report.ablationStudy.map((row) => (
                        <tr key={row.variantId} className="hover:bg-[var(--surface-subtle)]">
                          <td className="pr-3 font-sans font-medium text-[var(--text-primary)] whitespace-nowrap">
                            {row.label}
                          </td>
                          <td className="px-3 font-sans text-[var(--text-muted)]">
                            {row.description}
                          </td>
                          <td className="px-3 text-right whitespace-nowrap text-[var(--text-primary)]">
                            {row.avgWaitMean.toFixed(2)} ± {row.avgWaitStd.toFixed(2)}
                          </td>
                          <td className="px-3 text-right text-[var(--text-primary)]">
                            {row.throughputMean.toFixed(2)}
                          </td>
                          <td className="px-3 text-right text-[var(--text-primary)]">
                            {row.jainFairnessMean.toFixed(4)}
                          </td>
                          <td className="px-3 text-right text-emerald-700 dark:text-emerald-300">
                            {row.rewardMean.toFixed(2)}
                          </td>
                          <td
                            className={`pl-3 text-right font-semibold ${
                              row.deltaRewardVsBaseline > 0
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : row.deltaRewardVsBaseline < 0
                                  ? 'text-amber-700 dark:text-amber-400'
                                  : 'text-[var(--text-muted)]'
                            }`}
                          >
                            {row.deltaRewardVsBaseline === 0
                              ? 'Ref'
                              : `${row.deltaRewardVsBaseline > 0 ? '+' : ''}${row.deltaRewardVsBaseline.toFixed(2)}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
