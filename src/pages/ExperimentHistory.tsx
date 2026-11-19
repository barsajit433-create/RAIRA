import React, { useMemo, useState } from 'react';
import { Download, Eye, Trash2, X } from 'lucide-react';
import type { ExperimentRecord } from '../types/experiment';
import type { AlgorithmType } from '../types/simulation';
import { exportService } from '../services/exportService';
import {
  formatAlgorithmName,
  formatAlgorithmShort,
  formatDateTime,
  formatProvenanceLabel,
  formatWorkloadName,
  getProvenanceClass,
} from '../utils/formatters';

interface ExperimentHistoryProps {
  records: ExperimentRecord[];
  onDeleteRecord: (id: string) => void;
  onClearAll: () => void;
}

export const ExperimentHistory: React.FC<ExperimentHistoryProps> = ({
  records,
  onDeleteRecord,
  onClearAll,
}) => {
  const [algFilter, setAlgFilter] = useState<'ALL' | AlgorithmType>('ALL');
  const [selected, setSelected] = useState<ExperimentRecord | null>(null);

  const filtered = useMemo(() => {
    if (algFilter === 'ALL') return records;
    return records.filter((r) => r.algorithm === algFilter);
  }, [records, algFilter]);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-800/80 bg-[#0B1221] p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-base font-semibold text-slate-100">
            Stored Experiment History
          </h2>
          <p className="text-xs text-slate-400">
            Persisted in browser localStorage · {records.length} recorded run
            {records.length === 1 ? '' : 's'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => exportService.exportExperimentsCsv(filtered)}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-40 cursor-pointer whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={() => exportService.downloadJson(filtered, `raira-history-${Date.now()}.json`)}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-40 cursor-pointer whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Export JSON</span>
          </button>
          {records.length > 0 && (
            <button
              type="button"
              onClick={() => {
                onClearAll();
                setSelected(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/35 bg-red-500/10 px-3.5 py-2 text-xs font-medium text-red-300 hover:bg-red-500/20 cursor-pointer whitespace-nowrap"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Clear All</span>
            </button>
          )}
        </div>
      </section>

      {/* Filter Bar */}
      <div
        role="group"
        aria-label="Filter experiments by algorithm"
        className="flex flex-wrap items-center gap-1.5"
      >
        {(['ALL', 'FCFS', 'RR', 'PRIORITY', 'Q_LEARNING', 'DQN'] as const).map((alg) => {
          const active = algFilter === alg;
          return (
            <button
              key={alg}
              type="button"
              onClick={() => setAlgFilter(alg)}
              aria-pressed={active}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                active
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/35'
                  : 'text-slate-400 border border-slate-800 bg-[#0B1221] hover:text-slate-200'
              }`}
            >
              {alg === 'ALL' ? 'All Algorithms' : formatAlgorithmShort(alg)}
            </button>
          );
        })}
      </div>

      {/* History Table */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-800/80 bg-[#0B1221] p-10 text-center space-y-2">
          <p className="text-sm font-medium text-slate-200">No experiment history yet</p>
          <p className="text-xs text-slate-400">
            Completed simulations, RL training sessions, and multi-algorithm comparison benchmarks
            are automatically archived here in browser localStorage.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-800/80 bg-[#0B1221] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-[#080F1D] text-[11px] text-slate-400">
                  <th className="py-2.5 px-3">Experiment ID</th>
                  <th className="py-2.5 px-3">Date &amp; Time</th>
                  <th className="py-2.5 px-3">Algorithm</th>
                  <th className="py-2.5 px-3">Workload</th>
                  <th className="py-2.5 px-3 text-right">Procs</th>
                  <th className="py-2.5 px-3 text-right">Seed</th>
                  <th className="py-2.5 px-3 text-right">Episodes</th>
                  <th className="py-2.5 px-3 text-right">Avg Wait</th>
                  <th className="py-2.5 px-3 text-right">Avg Turn</th>
                  <th className="py-2.5 px-3 text-right">CPU %</th>
                  <th className="py-2.5 px-3 text-right">RAM %</th>
                  <th className="py-2.5 px-3 text-right">Reward</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
                {filtered.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-800/30">
                    <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap">{rec.id}</td>
                    <td className="py-2.5 px-3 font-sans text-slate-400 whitespace-nowrap">
                      {formatDateTime(rec.timestamp)}
                    </td>
                    <td className="py-2.5 px-3 font-sans text-slate-100 whitespace-nowrap">
                      {formatAlgorithmShort(rec.algorithm)}
                      {!rec.isTrainedModel && (
                        <span className="ml-1.5 text-[11px] text-amber-400">(Untrained)</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-sans text-slate-300 whitespace-nowrap">
                      {formatWorkloadName(rec.workloadType)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-300">{rec.numProcesses}</td>
                    <td className="py-2.5 px-3 text-right text-slate-400">{rec.seed}</td>
                    <td className="py-2.5 px-3 text-right text-slate-300">{rec.episodes}</td>
                    <td className="py-2.5 px-3 text-right text-cyan-300">
                      {rec.avgWaitingTime.toFixed(2)}t
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-200">
                      {rec.avgTurnaroundTime.toFixed(2)}t
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-300">
                      {rec.cpuUtilisation.toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-300">
                      {rec.ramUtilisation.toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3 text-right text-emerald-400 font-semibold">
                      {rec.reward.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setSelected(rec)}
                          aria-label={`View experiment ${rec.id}`}
                          className="p-1.5 rounded-md text-slate-400 hover:bg-slate-800 hover:text-cyan-300 cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onDeleteRecord(rec.id);
                            if (selected?.id === rec.id) setSelected(null);
                          }}
                          aria-label={`Delete experiment ${rec.id}`}
                          className="p-1.5 rounded-md text-slate-400 hover:bg-red-500/15 hover:text-red-400 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Selected Experiment Detail Drawer */}
      {selected && (
        <section className="rounded-xl border border-slate-700 bg-[#0D1629] p-5 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-display text-sm font-semibold text-slate-100">
                Experiment Record · {selected.id}
              </h3>
              <p className="text-xs text-slate-400">
                {formatAlgorithmName(selected.algorithm)} ·{' '}
                {formatWorkloadName(selected.workloadType)} ·{' '}
                <span className={getProvenanceClass(selected.provenance)}>
                  {formatProvenanceLabel(selected.provenance)}
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              aria-label="Close experiment details"
              className="p-1.5 rounded-md text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <dl className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
            {[
              ['Timestamp', formatDateTime(selected.timestamp)],
              ['Random Seed', String(selected.seed)],
              ['Processes', String(selected.numProcesses)],
              ['Episodes', String(selected.episodes)],
              ['Avg Waiting', `${selected.avgWaitingTime}t`],
              ['Avg Turnaround', `${selected.avgTurnaroundTime}t`],
              ['Avg Response', `${selected.avgResponseTime}t`],
              ['CPU Util', `${selected.cpuUtilisation}%`],
              ['RAM Util', `${selected.ramUtilisation}%`],
              ['Throughput', `${selected.throughput} / 100t`],
              ['Jain Fairness', selected.jainFairness.toFixed(4)],
              ['Episode Reward', selected.reward.toFixed(2)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg border border-slate-800 bg-[#080F1D] p-2.5">
                <dt className="text-[11px] text-slate-500">{k}</dt>
                <dd className="mt-1 font-mono tabular-nums text-slate-100">{v}</dd>
              </div>
            ))}
          </dl>

          {selected.notes && (
            <p className="text-xs text-slate-300 border-t border-slate-800 pt-3">
              Notes: {selected.notes}
            </p>
          )}
        </section>
      )}
    </div>
  );
};
