import React, { useMemo, useState } from 'react';
import { ArrowUpDown, Eye, Pencil, Trash2 } from 'lucide-react';
import type { ProcessRecord, ProcessStatus } from '../types/process';
import { getStatusTextClass } from '../utils/formatters';

interface ProcessTableProps {
  processes: ProcessRecord[];
  editable?: boolean;
  compact?: boolean;
  onEdit?: (proc: ProcessRecord) => void;
  onDelete?: (proc: ProcessRecord) => void;
  onSelectDetail?: (proc: ProcessRecord) => void;
}

type SortField =
  | 'slotIndex'
  | 'arrivalTime'
  | 'cpuBurstTime'
  | 'remainingCpuTime'
  | 'priority'
  | 'memoryDemand'
  | 'waitingTime'
  | 'status';

const STATUS_FILTERS: Array<'ALL' | ProcessStatus> = [
  'ALL',
  'RUNNING',
  'READY',
  'BLOCKED',
  'NEW',
  'COMPLETED',
];

export const ProcessTable: React.FC<ProcessTableProps> = ({
  processes,
  editable = false,
  compact = false,
  onEdit,
  onDelete,
  onSelectDetail,
}) => {
  const [statusFilter, setStatusFilter] = useState<'ALL' | ProcessStatus>('ALL');
  const [sortField, setSortField] = useState<SortField>('slotIndex');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const filteredAndSorted = useMemo(() => {
    const filtered =
      statusFilter === 'ALL'
        ? processes
        : processes.filter((p) => p.status === statusFilter);

    return [...filtered].sort((a, b) => {
      const av = a[sortField];
      const bv = b[sortField];
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortAsc ? Number(av) - Number(bv) : Number(bv) - Number(av);
    });
  }, [processes, statusFilter, sortField, sortAsc]);

  if (processes.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800/80 bg-[#0B1221] p-8 text-center">
        <p className="text-sm font-medium text-slate-300">No processes in the queue</p>
        <p className="mt-1 text-xs text-slate-500">
          Add processes manually, generate a seeded workload, or launch the demo workload to begin.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-800/80 bg-[#0B1221] overflow-hidden">
      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-800/80">
        <div
          role="group"
          aria-label="Filter processes by status"
          className="flex flex-wrap items-center gap-1"
        >
          {STATUS_FILTERS.map((st) => {
            const count =
              st === 'ALL'
                ? processes.length
                : processes.filter((p) => p.status === st).length;
            const active = statusFilter === st;
            return (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                aria-pressed={active}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-400 border border-transparent hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                {st === 'ALL' ? 'All' : st} ({count})
              </button>
            );
          })}
        </div>

        <div className="text-xs font-mono tabular-nums text-slate-500">
          Showing {filteredAndSorted.length} / {processes.length} slots
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800/80 bg-[#080F1D] text-[11px] font-medium text-slate-400">
              <th className="py-2.5 px-3 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => toggleSort('slotIndex')}
                  className="inline-flex items-center gap-1 hover:text-slate-200 cursor-pointer"
                >
                  PID <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                </button>
              </th>
              <th className="py-2.5 px-3 whitespace-nowrap">Process Name</th>
              <th className="py-2.5 px-3 whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => toggleSort('status')}
                  className="inline-flex items-center gap-1 hover:text-slate-200 cursor-pointer"
                >
                  Status <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                </button>
              </th>
              <th className="py-2.5 px-3 text-right whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => toggleSort('arrivalTime')}
                  className="inline-flex items-center gap-1 hover:text-slate-200 cursor-pointer"
                >
                  Arrival <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                </button>
              </th>
              <th className="py-2.5 px-3 text-right whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => toggleSort('remainingCpuTime')}
                  className="inline-flex items-center gap-1 hover:text-slate-200 cursor-pointer"
                >
                  Rem / Burst <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                </button>
              </th>
              <th className="py-2.5 px-3 text-right whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => toggleSort('priority')}
                  className="inline-flex items-center gap-1 hover:text-slate-200 cursor-pointer"
                >
                  Priority <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                </button>
              </th>
              <th className="py-2.5 px-3 text-right whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => toggleSort('memoryDemand')}
                  className="inline-flex items-center gap-1 hover:text-slate-200 cursor-pointer"
                >
                  RAM Alloc / Req <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                </button>
              </th>
              <th className="py-2.5 px-3 text-right whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => toggleSort('waitingTime')}
                  className="inline-flex items-center gap-1 hover:text-slate-200 cursor-pointer"
                >
                  Wait <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                </button>
              </th>
              {!compact && (
                <>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">Resp</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">Turnaround</th>
                </>
              )}
              {(editable || onSelectDetail) && (
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-xs">
            {filteredAndSorted.map((proc) => (
              <tr
                key={proc.id}
                className={`transition-colors hover:bg-slate-800/35 ${
                  proc.status === 'RUNNING' ? 'bg-cyan-500/5' : ''
                }`}
              >
                <td className="py-2.5 px-3 font-mono tabular-nums text-slate-200 font-medium whitespace-nowrap">
                  {proc.id}
                </td>
                <td className="py-2.5 px-3 text-slate-200 whitespace-nowrap max-w-[160px] truncate">
                  {proc.name}
                </td>
                <td className={`py-2.5 px-3 font-mono whitespace-nowrap ${getStatusTextClass(proc.status)}`}>
                  {proc.status}
                </td>
                <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-300 whitespace-nowrap">
                  {proc.arrivalTime}t
                </td>
                <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-200 whitespace-nowrap">
                  {proc.remainingCpuTime} / {proc.cpuBurstTime}t
                </td>
                <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-300 whitespace-nowrap">
                  P{proc.priority}
                </td>
                <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                  <span className={proc.allocatedMemory > 0 ? 'text-emerald-400' : 'text-slate-500'}>
                    {proc.allocatedMemory}
                  </span>
                  <span className="text-slate-600"> / </span>
                  <span className="text-slate-300">{proc.memoryDemand} MB</span>
                </td>
                <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-300 whitespace-nowrap">
                  {proc.waitingTime}t
                </td>
                {!compact && (
                  <>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-400 whitespace-nowrap">
                      {proc.responseTime !== null ? `${proc.responseTime}t` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-300 whitespace-nowrap">
                      {proc.turnaroundTime !== null ? `${proc.turnaroundTime}t` : '—'}
                    </td>
                  </>
                )}
                {(editable || onSelectDetail) && (
                  <td className="py-2.5 px-3 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1">
                      {onSelectDetail && (
                        <button
                          type="button"
                          onClick={() => onSelectDetail(proc)}
                          aria-label={`Inspect process ${proc.id} ${proc.name}`}
                          className="p-1.5 rounded-md text-slate-400 hover:bg-slate-800 hover:text-cyan-300 cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      )}
                      {editable && onEdit && (
                        <button
                          type="button"
                          onClick={() => onEdit(proc)}
                          aria-label={`Edit process ${proc.id} ${proc.name}`}
                          className="p-1.5 rounded-md text-slate-400 hover:bg-slate-800 hover:text-slate-100 cursor-pointer"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      )}
                      {editable && onDelete && (
                        <button
                          type="button"
                          onClick={() => onDelete(proc)}
                          aria-label={`Delete process ${proc.id} ${proc.name}`}
                          className="p-1.5 rounded-md text-slate-400 hover:bg-red-500/15 hover:text-red-400 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
