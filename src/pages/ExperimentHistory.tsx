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
    <div className="raira-section-stack">
      <section className="raira-card raira-card-pad flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-base font-semibold text-[var(--text-primary)]">
            Stored Experiment History
          </h2>
          <p className="text-xs text-[var(--text-muted)]">
            Persisted in browser localStorage · {records.length} recorded run
            {records.length === 1 ? '' : 's'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => exportService.exportExperimentsCsv(filtered)}
            disabled={filtered.length === 0}
            className="raira-btn-secondary inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium disabled:opacity-40 cursor-pointer whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={() =>
              exportService.downloadJson(filtered, `raira-history-${Date.now()}.json`)
            }
            disabled={filtered.length === 0}
            className="raira-btn-secondary inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium disabled:opacity-40 cursor-pointer whitespace-nowrap"
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
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/35 bg-red-500/10 px-3.5 py-2 text-xs font-medium text-red-700 dark:text-red-300 hover:bg-red-500/20 cursor-pointer whitespace-nowrap"
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
              className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                active
                  ? ''
                  : 'raira-subtle text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-border)]'
              }`}
              style={
                active
                  ? {
                      backgroundColor: 'var(--accent-soft)',
                      color: 'var(--accent-text)',
                      borderColor: 'var(--accent-border)',
                    }
                  : undefined
              }
            >
              {alg === 'ALL' ? 'All Algorithms' : formatAlgorithmShort(alg)}
            </button>
          );
        })}
      </div>

      {/* History Table */}
      {filtered.length === 0 ? (
        <div className="raira-card p-10 text-center space-y-2">
          <p className="text-sm font-medium text-[var(--text-primary)]">
            No experiment history yet
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            Completed simulations, RL training sessions, and multi-algorithm comparison benchmarks
            are automatically archived here in browser localStorage.
          </p>
        </div>
      ) : (
        <div className="raira-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="raira-table w-full text-left border-collapse text-xs">
              <thead>
                <tr
                  className="border-b text-[11px] text-[var(--text-muted)]"
                  style={{
                    backgroundColor: 'var(--surface-subtle)',
                    borderColor: 'var(--border-subtle)',
                  }}
                >
                  <th className="px-3">Experiment ID</th>
                  <th className="px-3">Date &amp; Time</th>
                  <th className="px-3">Algorithm</th>
                  <th className="px-3">Workload</th>
                  <th className="px-3 text-right">Procs</th>
                  <th className="px-3 text-right">Seed</th>
                  <th className="px-3 text-right">Episodes</th>
                  <th className="px-3 text-right">Avg Wait</th>
                  <th className="px-3 text-right">Avg Turn</th>
                  <th className="px-3 text-right">CPU %</th>
                  <th className="px-3 text-right">RAM %</th>
                  <th className="px-3 text-right">Reward</th>
                  <th className="px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y font-mono tabular-nums">
                {filtered.map((rec) => (
                  <tr
                    key={rec.id}
                    className="hover:bg-[var(--surface-subtle)] transition-colors"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <td className="px-3 text-[var(--text-secondary)] whitespace-nowrap">
                      {rec.id}
                    </td>
                    <td className="px-3 font-sans text-[var(--text-muted)] whitespace-nowrap">
                      {formatDateTime(rec.timestamp)}
                    </td>
                    <td className="px-3 font-sans text-[var(--text-primary)] font-medium whitespace-nowrap">
                      {formatAlgorithmShort(rec.algorithm)}
                      {!rec.isTrainedModel && (
                        <span className="ml-1.5 text-[11px] text-amber-700 dark:text-amber-400">
                          (Untrained)
                        </span>
                      )}
                    </td>
                    <td className="px-3 font-sans text-[var(--text-secondary)] whitespace-nowrap">
                      {formatWorkloadName(rec.workloadType)}
                    </td>
                    <td className="px-3 text-right text-[var(--text-secondary)]">
                      {rec.numProcesses}
                    </td>
                    <td className="px-3 text-right text-[var(--text-muted)]">{rec.seed}</td>
                    <td className="px-3 text-right text-[var(--text-secondary)]">{rec.episodes}</td>
                    <td className="px-3 text-right text-[var(--accent-text)] font-medium">
                      {rec.avgWaitingTime.toFixed(2)}t
                    </td>
                    <td className="px-3 text-right text-[var(--text-primary)]">
                      {rec.avgTurnaroundTime.toFixed(2)}t
                    </td>
                    <td className="px-3 text-right text-[var(--text-secondary)]">
                      {rec.cpuUtilisation.toFixed(1)}%
                    </td>
                    <td className="px-3 text-right text-[var(--text-secondary)]">
                      {rec.ramUtilisation.toFixed(1)}%
                    </td>
                    <td className="px-3 text-right text-emerald-700 dark:text-emerald-400 font-semibold">
                      {rec.reward.toFixed(2)}
                    </td>
                    <td className="px-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setSelected(rec)}
                          aria-label={`View experiment ${rec.id}`}
                          className="p-1.5 rounded-md text-[var(--text-muted)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent-text)] cursor-pointer"
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
                          className="p-1.5 rounded-md text-[var(--text-muted)] hover:bg-red-500/15 hover:text-red-600 dark:hover:text-red-400 cursor-pointer"
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
        <section
          className="raira-card raira-card-pad space-y-4"
          style={{ borderColor: 'var(--border-strong)' }}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-display text-sm font-semibold text-[var(--text-primary)]">
                Experiment Record · {selected.id}
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
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
              className="raira-btn-secondary p-1.5 rounded-md cursor-pointer"
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
              <div key={k} className="raira-subtle rounded-lg p-2.5">
                <dt className="text-[11px] text-[var(--text-muted)]">{k}</dt>
                <dd className="mt-1 font-mono tabular-nums text-[var(--text-primary)] font-medium">
                  {v}
                </dd>
              </div>
            ))}
          </dl>

          {selected.notes && (
            <p
              className="text-xs text-[var(--text-secondary)] border-t pt-3"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              Notes: {selected.notes}
            </p>
          )}
        </section>
      )}
    </div>
  );
};
