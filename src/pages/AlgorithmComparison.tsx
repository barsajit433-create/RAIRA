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
import { rairaApi } from '../services/api';
import { exportService } from '../services/exportService';
import {
  formatAlgorithmShort,
  formatProvenanceLabel,
  formatWorkloadName,
  getProvenanceClass,
} from '../utils/formatters';

interface AlgorithmComparisonProps {
  latestComparison: SeedComparisonBatch | null;
  training: TrainingSessionSnapshot | null;
  onComparisonComplete: (batch: SeedComparisonBatch) => void;
}

export const AlgorithmComparison: React.FC<AlgorithmComparisonProps> = ({
  latestComparison,
  training,
  onComparisonComplete,
}) => {
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

  // Derive empirical factual summary (never claims RL wins unless numbers prove it)
  const bestByWait = latestComparison?.aggregated
    .filter((a) => a.available && a.rankByWaitingTime === 1)[0];
  const bestByReward = latestComparison?.aggregated
    .filter((a) => a.available && a.rankByReward === 1)[0];

  return (
    <div className="space-y-6">
      {/* Configuration Panel */}
      <section className="rounded-xl border border-slate-800/80 bg-[#0B1221] p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-100">
              Controlled Multi-Algorithm Benchmark
            </h2>
            <p className="text-xs text-slate-400">
              Evaluates FCFS, Round Robin, Priority, Tabular Q-Learning, and DQN on identical
              process workloads and seeds under the same 1-core CPU and 4096 MB RAM rules.
            </p>
          </div>
          <div className="text-xs font-mono text-slate-400 space-y-0.5 text-right">
            <div>
              Q-Learning:{' '}
              <span
                className={
                  training?.qLearningSummary.isTrained ? 'text-emerald-400' : 'text-amber-400'
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
                  training?.dqnSummary.isTrained ? 'text-emerald-400' : 'text-amber-400'
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
            <label htmlFor="cmp-workload" className="block text-slate-400 mb-1 whitespace-nowrap">
              Workload Scenario
            </label>
            <select
              id="cmp-workload"
              value={workloadType}
              onChange={(e) => setWorkloadType(e.target.value as Exclude<WorkloadType, 'CUSTOM'>)}
              className="w-full rounded-lg border border-slate-700 bg-[#070D19] px-3 py-2 text-slate-100 focus:border-cyan-500 focus:outline-none"
            >
              <option value="CPU_INTENSIVE">CPU-Intensive</option>
              <option value="MEMORY_INTENSIVE">Memory-Intensive</option>
              <option value="MIXED">Mixed Workload</option>
              <option value="DYNAMIC">Dynamic Workload</option>
            </select>
          </div>

          <div>
            <label htmlFor="cmp-procs" className="block text-slate-400 mb-1 whitespace-nowrap">
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
              className="w-full rounded-lg border border-slate-700 bg-[#070D19] px-3 py-2 font-mono text-slate-100 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="cmp-seeds" className="block text-slate-400 mb-1 whitespace-nowrap">
              Random Seeds
            </label>
            <input
              id="cmp-seeds"
              type="text"
              value={seedsInput}
              onChange={(e) => setSeedsInput(e.target.value)}
              placeholder="42, 108, 256"
              className="w-full rounded-lg border border-slate-700 bg-[#070D19] px-3 py-2 font-mono text-slate-100 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="cmp-rrq" className="block text-slate-400 mb-1 whitespace-nowrap">
              RR Quantum (ticks)
            </label>
            <input
              id="cmp-rrq"
              type="number"
              min={1}
              max={16}
              value={rrQuantum}
              onChange={(e) => setRrQuantum(Math.max(1, Math.min(16, Number(e.target.value) || 2)))}
              className="w-full rounded-lg border border-slate-700 bg-[#070D19] px-3 py-2 font-mono text-slate-100 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div>
            <button
              type="button"
              onClick={handleRun}
              disabled={running}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Play className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{running ? 'Running Benchmark...' : 'Run Algorithm Comparison'}</span>
            </button>
          </div>
        </div>

        <label className="inline-flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
          <input
            type="checkbox"
            checked={includeUntrainedRL}
            onChange={(e) => setIncludeUntrainedRL(e.target.checked)}
            className="rounded border-slate-700 bg-[#070D19] text-cyan-500"
          />
          <span>
            Evaluate untrained RL agents for baseline reference (clearly marked as Untrained in
            tables and charts)
          </span>
        </label>

        {error && (
          <div role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 px-3.5 py-2.5 text-xs text-red-300">
            {error}
          </div>
        )}
      </section>

      {!latestComparison ? (
        <div className="rounded-xl border border-slate-800/80 bg-[#0B1221] p-10 text-center space-y-2">
          <p className="text-sm font-medium text-slate-200">No comparison benchmark executed yet</p>
          <p className="text-xs text-slate-400 max-w-lg mx-auto">
            Select a workload scenario and random seed list above, then click Run Algorithm
            Comparison to evaluate all five schedulers under identical process arrival traces.
          </p>
        </div>
      ) : (
        <>
          {/* Empirical Summary Banner */}
          <section className="rounded-xl border border-slate-800/80 bg-[#0B1221] p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
                <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
                <span>
                  Empirical Benchmark Summary · {formatWorkloadName(latestComparison.workloadType)}{' '}
                  · {latestComparison.numProcesses} processes · Seeds:{' '}
                  {latestComparison.seeds.join(', ')}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
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
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800 cursor-pointer whitespace-nowrap"
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
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800 cursor-pointer whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Export JSON</span>
              </button>
            </div>
          </section>

          {/* Comparison Table (All 8 Metrics + Ranking + Trained Status) */}
          <section className="rounded-xl border border-slate-800/80 bg-[#0B1221] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-800/80 flex items-center justify-between">
              <div>
                <h3 className="font-display text-sm font-semibold text-slate-100">
                  Aggregated Performance Comparison Table
                </h3>
                <p className="text-xs text-slate-400">
                  Lower waiting/turnaround/response time is better · Higher throughput, useful CPU
                  utilisation, fairness, and reward is better
                </p>
              </div>
              <span className="text-xs font-mono text-slate-500">
                * = untrained RL weights
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-[#080F1D] text-[11px] text-slate-400">
                    <th className="py-2.5 px-3">Algorithm</th>
                    <th className="py-2.5 px-3">Model Status</th>
                    <th className="py-2.5 px-3 text-right">Avg CPU %</th>
                    <th className="py-2.5 px-3 text-right">Avg RAM %</th>
                    <th className="py-2.5 px-3 text-right">Avg Wait (t)</th>
                    <th className="py-2.5 px-3 text-right">Avg Turn (t)</th>
                    <th className="py-2.5 px-3 text-right">Avg Resp (t)</th>
                    <th className="py-2.5 px-3 text-right">Throughput</th>
                    <th className="py-2.5 px-3 text-right">Jain Fairness</th>
                    <th className="py-2.5 px-3 text-right">Avg Reward</th>
                    <th className="py-2.5 px-3 text-right">Rank (Wait / Rew)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
                  {latestComparison.aggregated.map((row) => (
                    <tr key={row.algorithm} className="hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 font-sans font-semibold text-slate-100 whitespace-nowrap">
                        {formatAlgorithmShort(row.algorithm)}
                      </td>
                      <td className={`py-2.5 px-3 font-sans whitespace-nowrap ${getProvenanceClass(row.provenance)}`}>
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
                          <td className="py-2.5 px-3 text-right text-slate-200">
                            {row.avgCpuUtilisation.toFixed(1)}%
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-200">
                            {row.avgRamUtilisation.toFixed(1)}%
                          </td>
                          <td className="py-2.5 px-3 text-right text-cyan-300">
                            {row.avgWaitingTime.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-200">
                            {row.avgTurnaroundTime.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-300">
                            {row.avgResponseTime.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-emerald-400">
                            {row.throughput.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-200">
                            {row.jainFairnessIndex.toFixed(4)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-100 font-semibold">
                            {row.avgEpisodeReward.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-slate-400">
                            #{row.rankByWaitingTime ?? '—'} / #{row.rankByReward ?? '—'}
                          </td>
                        </>
                      ) : (
                        <td colSpan={9} className="py-2.5 px-3 font-sans text-amber-400">
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
            <div className="rounded-xl border border-slate-800/80 bg-[#0B1221] p-5">
              <h3 className="font-display text-sm font-semibold text-slate-100">
                Latency Comparison (Waiting, Turnaround, Response)
              </h3>
              <p className="text-xs text-slate-400 mb-4">Lower bars indicate faster process service</p>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                    <XAxis dataKey="name" stroke="#64748B" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                    <YAxis stroke="#64748B" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0F172A',
                        borderColor: '#334155',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: '#E2E8F0',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="avgWaitingTime" name="Avg Waiting (t)" fill="#06B6D4" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="avgTurnaroundTime" name="Avg Turnaround (t)" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="avgResponseTime" name="Avg Response (t)" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800/80 bg-[#0B1221] p-5">
              <h3 className="font-display text-sm font-semibold text-slate-100">
                Episode Reward &amp; Resource Efficiency
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                Multi-objective episode reward across evaluated algorithms
              </p>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                    <XAxis dataKey="name" stroke="#64748B" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                    <YAxis stroke="#64748B" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0F172A',
                        borderColor: '#334155',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: '#E2E8F0',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="avgEpisodeReward" name="Avg Episode Reward" fill="#10B981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="avgCpuUtilisation" name="Avg CPU Util (%)" fill="#38BDF8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="jainFairnessPct" name="Jain Fairness (%)" fill="#818CF8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          {/* Seed-wise Line Chart & Table */}
          <section className="rounded-xl border border-slate-800/80 bg-[#0B1221] p-5 space-y-4">
            <div>
              <h3 className="font-display text-sm font-semibold text-slate-100">
                Seed-Wise Average Waiting Time Breakdown
              </h3>
              <p className="text-xs text-slate-400">
                Identical workload traces per seed across all evaluated schedulers
              </p>
            </div>

            {seedLineData.length > 1 && (
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={seedLineData} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                    <XAxis dataKey="seed" stroke="#64748B" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                    <YAxis stroke="#64748B" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0F172A',
                        borderColor: '#334155',
                        borderRadius: '8px',
                        fontSize: '12px',
                        color: '#E2E8F0',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Line type="monotone" dataKey="FCFS" stroke="#94A3B8" strokeWidth={2} />
                    <Line type="monotone" dataKey="RR" stroke="#3B82F6" strokeWidth={2} />
                    <Line type="monotone" dataKey="Priority" stroke="#F59E0B" strokeWidth={2} />
                    <Line type="monotone" dataKey="Q-Learning" stroke="#06B6D4" strokeWidth={2} />
                    <Line type="monotone" dataKey="DQN" stroke="#10B981" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] font-sans text-slate-400">
                    <th className="py-2 px-3">Seed</th>
                    <th className="py-2 px-3">Algorithm</th>
                    <th className="py-2 px-3 text-right">Wait (t)</th>
                    <th className="py-2 px-3 text-right">Turnaround (t)</th>
                    <th className="py-2 px-3 text-right">CPU %</th>
                    <th className="py-2 px-3 text-right">RAM %</th>
                    <th className="py-2 px-3 text-right">Fairness</th>
                    <th className="py-2 px-3 text-right">Reward</th>
                    <th className="py-2 px-3 text-right">Outcome</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {latestComparison.seeds.flatMap((seed) =>
                    (latestComparison.perSeedResults[seed] ?? []).map((r) => (
                      <tr key={`${seed}-${r.algorithm}`} className="hover:bg-slate-800/25">
                        <td className="py-2 px-3 text-slate-400">#{seed}</td>
                        <td className="py-2 px-3 font-sans text-slate-200">
                          {formatAlgorithmShort(r.algorithm)}
                          {!r.isTrainedModel && r.available && (
                            <span className="ml-1.5 text-amber-400 text-[11px]">(Untrained)</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right text-cyan-300">
                          {r.available ? r.metrics.avgWaitingTime.toFixed(2) : '—'}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-200">
                          {r.available ? r.metrics.avgTurnaroundTime.toFixed(2) : '—'}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-300">
                          {r.available ? `${r.metrics.avgCpuUtilisation.toFixed(1)}%` : '—'}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-300">
                          {r.available ? `${r.metrics.avgRamUtilisation.toFixed(1)}%` : '—'}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-300">
                          {r.available ? r.metrics.jainFairnessIndex.toFixed(4) : '—'}
                        </td>
                        <td className="py-2 px-3 text-right text-emerald-400">
                          {r.available ? r.metrics.totalEpisodeReward.toFixed(2) : '—'}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-400">
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
    </div>
  );
};
