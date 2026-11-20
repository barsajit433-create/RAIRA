import React, { useState } from 'react';
import { Download, Play, Trophy } from 'lucide-react';
import {
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
import type { WorkloadType } from '../types/process';
import type { SeedComparisonBatch } from '../types/experiment';
import type { TrainingSessionSnapshot } from '../types/reinforcementLearning';
import type { StatisticalValidationReport } from '../types/intelligence';
import { rairaApi } from '../services/api';
import { exportService } from '../services/exportService';
import { StatisticalValidationLab } from '../components/StatisticalValidationLab';
import {
  formatAlgorithmShort,
  formatProvenanceLabel,
  formatWorkloadName,
  getProvenanceClass,
} from '../utils/formatters';
import { useTheme } from '../theme/ThemeContext';

interface AlgorithmComparisonProps {
  latestComparison: SeedComparisonBatch | null;
  training: TrainingSessionSnapshot | null;
  onComparisonComplete: (batch: SeedComparisonBatch) => void;
  latestValidationReport: StatisticalValidationReport | null;
  onValidationComplete: (report: StatisticalValidationReport) => void;
}

export const AlgorithmComparison: React.FC<AlgorithmComparisonProps> = ({
  latestComparison,
  training,
  onComparisonComplete,
  latestValidationReport,
  onValidationComplete,
}) => {
  const { chartTheme } = useTheme();
  const [workloadType, setWorkloadType] = useState<Exclude<WorkloadType, 'CUSTOM'>>('MIXED');
  const [numProcesses, setNumProcesses] = useState(10);
  const [seedsInput, setSeedsInput] = useState('42, 108, 256');
  const [rrQuantum, setRrQuantum] = useState(2);
  const [includeUntrainedRL, setIncludeUntrainedRL] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    try {
      const parsedSeeds = seedsInput
        .split(/[\s,]+/)
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n));

      if (parsedSeeds.length === 0) {
        setError('Enter at least one numeric random seed (e.g. 42, 108, 256).');
        setRunning(false);
        return;
      }

      const batch = await rairaApi.runComparison({
        workloadType,
        numProcesses,
        seeds: parsedSeeds,
        rrQuantum,
        includeUntrainedRL,
      });
      onComparisonComplete(batch);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  };

  const chartData =
    latestComparison?.aggregated
      .filter((a) => a.available)
      .map((a) => ({
        name: formatAlgorithmShort(a.algorithm) + (a.isTrainedModel ? '' : '*'),
        avgWaitingTime: a.avgWaitingTime,
        avgTurnaroundTime: a.avgTurnaroundTime,
        avgResponseTime: a.avgResponseTime,
        avgCpuUtilisation: a.avgCpuUtilisation,
        avgRamUtilisation: a.avgRamUtilisation,
        throughput: a.throughput,
        jainFairnessPct: Number((a.jainFairnessIndex * 100).toFixed(1)),
        avgEpisodeReward: a.avgEpisodeReward,
      })) ?? [];

  const seedLineData =
    latestComparison?.seeds.map((seed) => {
      const row: Record<string, number | string> = { seed: `Seed ${seed}` };
      const runs = latestComparison.perSeedResults[seed] ?? [];
      for (const r of runs) {
        if (r.available) {
          row[formatAlgorithmShort(r.algorithm)] = r.metrics.avgWaitingTime;
        }
      }
      return row;
    }) ?? [];

  const bestByWait = latestComparison?.aggregated.filter(
    (a) => a.available && a.rankByWaitingTime === 1
  )[0];
  const bestByReward = latestComparison?.aggregated.filter(
    (a) => a.available && a.rankByReward === 1
  )[0];

  return (
    <div className="raira-section-stack">
      {/* Configuration Panel */}
      <section className="raira-card raira-card-pad space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-semibold text-[var(--text-primary)]">
              Controlled Multi-Algorithm Benchmark
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Evaluates FCFS, Round Robin, Priority, Tabular Q-Learning, and DQN on identical
              process workloads and seeds under the same 1-core CPU and 4096 MB RAM rules.
            </p>
          </div>
          <div className="text-xs font-mono text-[var(--text-muted)] space-y-0.5 text-right">
            <div>
              Q-Learning:{' '}
              <span
                className={
                  training?.qLearningSummary.isTrained
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-amber-700 dark:text-amber-400'
                }
              >
                {training?.qLearningSummary.isTrained
                  ? `Trained (${training.qLearningSummary.episodesTrained} ep)`
                  : 'Untrained'}
              </span>
            </div>
            <div>
              DQN:{' '}
              <span
                className={
                  training?.dqnSummary.isTrained
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-amber-700 dark:text-amber-400'
                }
              >
                {training?.dqnSummary.isTrained
                  ? `Trained (${training.dqnSummary.episodesTrained} ep)`
                  : 'Untrained'}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end text-xs">
          <div>
            <label
              htmlFor="cmp-workload"
              className="block text-[var(--text-muted)] mb-1 whitespace-nowrap"
            >
              Workload Scenario
            </label>
            <select
              id="cmp-workload"
              value={workloadType}
              onChange={(e) => setWorkloadType(e.target.value as Exclude<WorkloadType, 'CUSTOM'>)}
              className="raira-input w-full rounded-lg px-3 py-2"
            >
              <option value="CPU_INTENSIVE">CPU-Intensive</option>
              <option value="MEMORY_INTENSIVE">Memory-Intensive</option>
              <option value="MIXED">Mixed Workload</option>
              <option value="DYNAMIC">Dynamic Workload</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="cmp-procs"
              className="block text-[var(--text-muted)] mb-1 whitespace-nowrap"
            >
              Processes (1–32)
            </label>
            <input
              id="cmp-procs"
              type="number"
              min={1}
              max={32}
              value={numProcesses}
              onChange={(e) =>
                setNumProcesses(Math.max(1, Math.min(32, Number(e.target.value) || 1)))
              }
              className="raira-input w-full rounded-lg px-3 py-2 font-mono"
            />
          </div>

          <div>
            <label
              htmlFor="cmp-seeds"
              className="block text-[var(--text-muted)] mb-1 whitespace-nowrap"
            >
              Random Seeds
            </label>
            <input
              id="cmp-seeds"
              type="text"
              value={seedsInput}
              onChange={(e) => setSeedsInput(e.target.value)}
              placeholder="42, 108, 256"
              className="raira-input w-full rounded-lg px-3 py-2 font-mono"
            />
          </div>

          <div>
            <label
              htmlFor="cmp-rrq"
              className="block text-[var(--text-muted)] mb-1 whitespace-nowrap"
            >
              RR Quantum (ticks)
            </label>
            <input
              id="cmp-rrq"
              type="number"
              min={1}
              max={16}
              value={rrQuantum}
              onChange={(e) =>
                setRrQuantum(Math.max(1, Math.min(16, Number(e.target.value) || 2)))
              }
              className="raira-input w-full rounded-lg px-3 py-2 font-mono"
            />
          </div>

          <div>
            <button
              type="button"
              onClick={handleRun}
              disabled={running}
              className="raira-btn-primary w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              <Play className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{running ? 'Running Benchmark...' : 'Run Algorithm Comparison'}</span>
            </button>
          </div>
        </div>

        <label className="inline-flex items-center gap-2 text-xs text-[var(--text-muted)] cursor-pointer">
          <input
            type="checkbox"
            checked={includeUntrainedRL}
            onChange={(e) => setIncludeUntrainedRL(e.target.checked)}
            style={{ accentColor: 'var(--accent-primary)' }}
          />
          <span>
            Evaluate untrained RL agents for baseline reference (clearly marked as Untrained in
            tables and charts)
          </span>
        </label>

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
      </section>

      {!latestComparison ? (
        <div className="raira-card p-10 text-center space-y-2">
          <p className="text-sm font-medium text-[var(--text-primary)]">
            No comparison benchmark executed yet
          </p>
          <p className="text-xs text-[var(--text-muted)] max-w-lg mx-auto">
            Select a workload scenario and random seed list above, then click Run Algorithm
            Comparison to evaluate all five schedulers under identical process arrival traces.
          </p>
        </div>
      ) : (
        <>
          {/* Empirical Summary Banner */}
          <section className="raira-card raira-card-pad flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-mono text-[var(--accent-text)]">
                <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
                <span>
                  Empirical Benchmark Summary · {formatWorkloadName(latestComparison.workloadType)}{' '}
                  · {latestComparison.numProcesses} processes · Seeds:{' '}
                  {latestComparison.seeds.join(', ')}
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                {bestByWait
                  ? `Lowest observed average waiting time: ${formatAlgorithmShort(bestByWait.algorithm)} (${bestByWait.avgWaitingTime}t${bestByWait.isTrainedModel ? '' : ', untrained'}). `
                  : ''}
                {bestByReward
                  ? `Highest observed average episode reward: ${formatAlgorithmShort(bestByReward.algorithm)} (${bestByReward.avgEpisodeReward}${bestByReward.isTrainedModel ? '' : ', untrained'}). `
                  : ''}
                Rankings reflect measured outputs only; untrained RL policies should not be
                interpreted as converged RL performance.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => exportService.exportComparisonCsv(latestComparison)}
                className="raira-btn-secondary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs cursor-pointer whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Export CSV</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  exportService.downloadJson(
                    latestComparison,
                    `raira-comparison-${latestComparison.workloadType.toLowerCase()}.json`
                  )
                }
                className="raira-btn-secondary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs cursor-pointer whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Export JSON</span>
              </button>
            </div>
          </section>

          {/* Comparison Table */}
          <section className="raira-card overflow-hidden">
            <div
              className="px-5 py-3.5 border-b flex items-center justify-between"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              <div>
                <h3 className="font-display text-sm font-semibold text-[var(--text-primary)]">
                  Aggregated Performance Comparison Table
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Lower waiting/turnaround/response time is better · Higher throughput, useful CPU
                  utilisation, fairness, and reward is better
                </p>
              </div>
              <span className="text-xs font-mono text-[var(--text-muted)]">
                * = untrained RL weights
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="raira-table w-full text-left border-collapse text-xs">
                <thead>
                  <tr
                    className="border-b text-[11px] text-[var(--text-muted)]"
                    style={{
                      borderColor: 'var(--border-subtle)',
                      backgroundColor: 'var(--surface-subtle)',
                    }}
                  >
                    <th className="px-3">Algorithm</th>
                    <th className="px-3">Model Status</th>
                    <th className="px-3 text-right">Avg CPU %</th>
                    <th className="px-3 text-right">Avg RAM %</th>
                    <th className="px-3 text-right">Avg Wait (t)</th>
                    <th className="px-3 text-right">Avg Turn (t)</th>
                    <th className="px-3 text-right">Avg Resp (t)</th>
                    <th className="px-3 text-right">Throughput</th>
                    <th className="px-3 text-right">Jain Fairness</th>
                    <th className="px-3 text-right">Avg Reward</th>
                    <th className="px-3 text-right">Rank (Wait / Rew)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)] font-mono tabular-nums">
                  {latestComparison.aggregated.map((row) => (
                    <tr key={row.algorithm} className="hover:bg-[var(--surface-subtle)]">
                      <td className="px-3 font-sans font-semibold text-[var(--text-primary)] whitespace-nowrap">
                        {formatAlgorithmShort(row.algorithm)}
                      </td>
                      <td
                        className={`px-3 font-sans whitespace-nowrap ${getProvenanceClass(row.provenance)}`}
                      >
                        {!row.available
                          ? 'Unavailable'
                          : row.isTrainedModel
                            ? row.algorithm === 'Q_LEARNING' || row.algorithm === 'DQN'
                              ? 'Trained RL Policy'
                              : 'Deterministic Baseline'
                            : 'Untrained RL Agent'}
                      </td>
                      {row.available ? (
                        <>
                          <td className="px-3 text-right text-[var(--text-primary)]">
                            {row.avgCpuUtilisation.toFixed(1)}%
                          </td>
                          <td className="px-3 text-right text-[var(--text-primary)]">
                            {row.avgRamUtilisation.toFixed(1)}%
                          </td>
                          <td className="px-3 text-right text-[var(--accent-text)]">
                            {row.avgWaitingTime.toFixed(2)}
                          </td>
                          <td className="px-3 text-right text-[var(--text-primary)]">
                            {row.avgTurnaroundTime.toFixed(2)}
                          </td>
                          <td className="px-3 text-right text-[var(--text-secondary)]">
                            {row.avgResponseTime.toFixed(2)}
                          </td>
                          <td className="px-3 text-right text-emerald-700 dark:text-emerald-400">
                            {row.throughput.toFixed(2)}
                          </td>
                          <td className="px-3 text-right text-[var(--text-primary)]">
                            {row.jainFairnessIndex.toFixed(4)}
                          </td>
                          <td className="px-3 text-right text-[var(--text-primary)] font-semibold">
                            {row.avgEpisodeReward.toFixed(2)}
                          </td>
                          <td className="px-3 text-right text-[var(--text-muted)]">
                            #{row.rankByWaitingTime ?? '—'} / #{row.rankByReward ?? '—'}
                          </td>
                        </>
                      ) : (
                        <td
                          colSpan={9}
                          className="px-3 font-sans text-amber-700 dark:text-amber-400"
                        >
                          {row.unavailableReason ?? formatProvenanceLabel(row.provenance)}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Bar Charts */}
          <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <div className="raira-card raira-card-pad">
              <h3 className="font-display text-sm font-semibold text-[var(--text-primary)]">
                Latency Comparison (Waiting, Turnaround, Response)
              </h3>
              <p className="text-xs text-[var(--text-muted)] mb-4">
                Lower bars indicate faster process service
              </p>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
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
                      contentStyle={{
                        backgroundColor: chartTheme.tooltipBg,
                        borderColor: chartTheme.tooltipBorder,
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: chartTheme.tooltipText,
                      }}
                      labelStyle={{ color: chartTheme.tooltipLabel }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', color: chartTheme.tick }} />
                    <Bar
                      dataKey="avgWaitingTime"
                      name="Avg Waiting (t)"
                      fill={chartTheme.primary}
                      radius={chartTheme.barRadius}
                      isAnimationActive={false}
                    />
                    <Bar
                      dataKey="avgTurnaroundTime"
                      name="Avg Turnaround (t)"
                      fill={chartTheme.secondary}
                      radius={chartTheme.barRadius}
                      isAnimationActive={false}
                    />
                    <Bar
                      dataKey="avgResponseTime"
                      name="Avg Response (t)"
                      fill={chartTheme.warning}
                      radius={chartTheme.barRadius}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="raira-card raira-card-pad">
              <h3 className="font-display text-sm font-semibold text-[var(--text-primary)]">
                Episode Reward &amp; Resource Efficiency
              </h3>
              <p className="text-xs text-[var(--text-muted)] mb-4">
                Multi-objective episode reward across evaluated algorithms
              </p>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
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
                      contentStyle={{
                        backgroundColor: chartTheme.tooltipBg,
                        borderColor: chartTheme.tooltipBorder,
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: chartTheme.tooltipText,
                      }}
                      labelStyle={{ color: chartTheme.tooltipLabel }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', color: chartTheme.tick }} />
                    <Bar
                      dataKey="avgEpisodeReward"
                      name="Avg Episode Reward"
                      fill={chartTheme.success}
                      radius={chartTheme.barRadius}
                      isAnimationActive={false}
                    />
                    <Bar
                      dataKey="avgCpuUtilisation"
                      name="Avg CPU Util (%)"
                      fill={chartTheme.primary}
                      radius={chartTheme.barRadius}
                      isAnimationActive={false}
                    />
                    <Bar
                      dataKey="jainFairnessPct"
                      name="Jain Fairness (%)"
                      fill={chartTheme.tertiary}
                      radius={chartTheme.barRadius}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          {/* Seed-wise Line Chart & Table */}
          <section className="raira-card raira-card-pad space-y-4">
            <div>
              <h3 className="font-display text-sm font-semibold text-[var(--text-primary)]">
                Seed-Wise Average Waiting Time Breakdown
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Identical workload traces per seed across all evaluated schedulers
              </p>
            </div>

            {seedLineData.length > 1 && (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={seedLineData}
                    margin={{ top: 8, right: 16, left: -10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                    <XAxis
                      dataKey="seed"
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
                        fontSize: '12px',
                        color: chartTheme.tooltipText,
                      }}
                      labelStyle={{ color: chartTheme.tooltipLabel }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', color: chartTheme.tick }} />
                    <Line
                      type="monotone"
                      dataKey="FCFS"
                      stroke={chartTheme.appearance === 'dark' ? '#94A3B8' : '#64748B'}
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="RR"
                      stroke={chartTheme.secondary}
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="Priority"
                      stroke={chartTheme.warning}
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="Q-Learning"
                      stroke={chartTheme.primary}
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="DQN"
                      stroke={chartTheme.success}
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="raira-table w-full text-left border-collapse text-xs font-mono tabular-nums">
                <thead>
                  <tr
                    className="border-b text-[11px] font-sans text-[var(--text-muted)]"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <th className="px-3">Seed</th>
                    <th className="px-3">Algorithm</th>
                    <th className="px-3 text-right">Wait (t)</th>
                    <th className="px-3 text-right">Turnaround (t)</th>
                    <th className="px-3 text-right">CPU %</th>
                    <th className="px-3 text-right">RAM %</th>
                    <th className="px-3 text-right">Fairness</th>
                    <th className="px-3 text-right">Reward</th>
                    <th className="px-3 text-right">Outcome</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {latestComparison.seeds.flatMap((seed) =>
                    (latestComparison.perSeedResults[seed] ?? []).map((r) => (
                      <tr
                        key={`${seed}-${r.algorithm}`}
                        className="hover:bg-[var(--surface-subtle)]"
                      >
                        <td className="px-3 text-[var(--text-muted)]">#{seed}</td>
                        <td className="px-3 font-sans text-[var(--text-primary)]">
                          {formatAlgorithmShort(r.algorithm)}
                          {!r.isTrainedModel && r.available && (
                            <span className="ml-1.5 text-amber-700 dark:text-amber-400 text-[11px]">
                              (Untrained)
                            </span>
                          )}
                        </td>
                        <td className="px-3 text-right text-[var(--accent-text)]">
                          {r.available ? r.metrics.avgWaitingTime.toFixed(2) : '—'}
                        </td>
                        <td className="px-3 text-right text-[var(--text-primary)]">
                          {r.available ? r.metrics.avgTurnaroundTime.toFixed(2) : '—'}
                        </td>
                        <td className="px-3 text-right text-[var(--text-secondary)]">
                          {r.available ? `${r.metrics.avgCpuUtilisation.toFixed(1)}%` : '—'}
                        </td>
                        <td className="px-3 text-right text-[var(--text-secondary)]">
                          {r.available ? `${r.metrics.avgRamUtilisation.toFixed(1)}%` : '—'}
                        </td>
                        <td className="px-3 text-right text-[var(--text-secondary)]">
                          {r.available ? r.metrics.jainFairnessIndex.toFixed(4) : '—'}
                        </td>
                        <td className="px-3 text-right text-emerald-700 dark:text-emerald-400">
                          {r.available ? r.metrics.totalEpisodeReward.toFixed(2) : '—'}
                        </td>
                        <td className="px-3 text-right text-[var(--text-muted)]">
                          {!r.available
                            ? 'N/A'
                            : r.terminated
                              ? 'Terminated'
                              : r.truncated
                                ? 'Truncated'
                                : 'Done'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {/* Feature 6: Statistical Research Validation Laboratory */}
      <StatisticalValidationLab
        report={latestValidationReport}
        onReportComplete={onValidationComplete}
        defaultFocus="overview"
      />
    </div>
  );
};
