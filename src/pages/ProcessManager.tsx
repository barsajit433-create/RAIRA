import React, { useState } from 'react';
import { Check, Plus, RefreshCw, Shuffle, X } from 'lucide-react';
import type { ProcessRecord, ProcessSpec, WorkloadType } from '../types/process';
import type { SimulationSnapshot } from '../types/simulation';
import { SYSTEM_CONFIG } from '../types/simulation';
import { validateProcessInput } from '../simulation/Process';
import { WORKLOAD_SCENARIOS } from '../simulation/WorkloadGenerator';
import { rairaApi } from '../services/api';
import { ProcessTable } from '../components/ProcessTable';
import { formatWorkloadName, getStatusTextClass } from '../utils/formatters';

interface ProcessManagerProps {
  simulation: SimulationSnapshot | null;
  onSimulationUpdated: (snap: SimulationSnapshot) => void;
}

const SCENARIO_LIST = Object.values(WORKLOAD_SCENARIOS);

export const ProcessManager: React.FC<ProcessManagerProps> = ({
  simulation,
  onSimulationUpdated,
}) => {
  const canEdit =
    !simulation || (simulation.status !== 'RUNNING' && simulation.currentTick === 0);

  // Manual Process Form State
  const [editingSlot, setEditingSlot] = useState<number | null>(null);
  const [name, setName] = useState('compute-task');
  const [arrivalTime, setArrivalTime] = useState('0');
  const [cpuBurstTime, setCpuBurstTime] = useState('8');
  const [priority, setPriority] = useState('3');
  const [memoryDemand, setMemoryDemand] = useState('512');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Automatic Workload Generator State
  const [scenario, setScenario] = useState<Exclude<WorkloadType, 'CUSTOM'>>('MIXED');
  const [numProcesses, setNumProcesses] = useState(10);
  const [seed, setSeed] = useState(42);
  const [previewSpecs, setPreviewSpecs] = useState<ProcessSpec[] | null>(null);
  const [generating, setGenerating] = useState(false);

  // Process Detail Inspector
  const [inspectedProc, setInspectedProc] = useState<ProcessRecord | null>(null);

  const currentSpecs: ProcessSpec[] = simulation?.initialSpecs ?? [];

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner(null);
    setStatusMessage(null);

    if (!canEdit) {
      setErrorBanner('Reset the simulation to tick 0 before adding or editing processes.');
      return;
    }

    const parsed = {
      name: name.trim(),
      arrivalTime: Number(arrivalTime),
      cpuBurstTime: Number(cpuBurstTime),
      priority: Number(priority),
      memoryDemand: Number(memoryDemand),
    };

    const validation = validateProcessInput(parsed);
    if (!validation.valid) {
      setFormErrors(validation.errors);
      return;
    }
    setFormErrors({});

    if (editingSlot === null && currentSpecs.length >= SYSTEM_CONFIG.MAX_PROCESSES) {
      setErrorBanner(`Maximum of ${SYSTEM_CONFIG.MAX_PROCESSES} processes per episode reached.`);
      return;
    }

    try {
      let nextSpecs: ProcessSpec[];
      if (editingSlot !== null) {
        nextSpecs = currentSpecs.map((spec) =>
          spec.slotIndex === editingSlot
            ? {
                ...spec,
                name: parsed.name,
                arrivalTime: parsed.arrivalTime,
                cpuBurstTime: parsed.cpuBurstTime,
                priority: parsed.priority,
                memoryDemand: parsed.memoryDemand,
              }
            : spec
        );
      } else {
        const nextIdx = currentSpecs.length;
        nextSpecs = [
          ...currentSpecs,
          {
            id: `P${String(nextIdx + 1).padStart(2, '0')}`,
            slotIndex: nextIdx,
            name: parsed.name,
            arrivalTime: parsed.arrivalTime,
            cpuBurstTime: parsed.cpuBurstTime,
            priority: parsed.priority,
            memoryDemand: parsed.memoryDemand,
          },
        ];
      }

      const snap = await rairaApi.updateProcesses(nextSpecs, 'CUSTOM');
      onSimulationUpdated(snap);
      setStatusMessage(
        editingSlot !== null
          ? `Updated process "${parsed.name}".`
          : `Added process "${parsed.name}" (${parsed.cpuBurstTime}t burst, ${parsed.memoryDemand} MB RAM).`
      );
      setEditingSlot(null);
      setName(`task-${String(nextSpecs.length + 1).padStart(2, '0')}`);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : String(err));
    }
  };

  const handleEditProcess = (proc: ProcessRecord) => {
    setEditingSlot(proc.slotIndex);
    setName(proc.name);
    setArrivalTime(String(proc.arrivalTime));
    setCpuBurstTime(String(proc.cpuBurstTime));
    setPriority(String(proc.priority));
    setMemoryDemand(String(proc.memoryDemand));
    setFormErrors({});
    setStatusMessage(null);
  };

  const handleDeleteProcess = async (proc: ProcessRecord) => {
    setErrorBanner(null);
    setStatusMessage(null);
    try {
      const remaining = currentSpecs.filter((s) => s.slotIndex !== proc.slotIndex);
      const snap = await rairaApi.updateProcesses(remaining, 'CUSTOM');
      onSimulationUpdated(snap);
      if (editingSlot === proc.slotIndex) setEditingSlot(null);
      if (inspectedProc?.id === proc.id) setInspectedProc(null);
      setStatusMessage(`Deleted ${proc.id} (${proc.name}).`);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : String(err));
    }
  };

  const handleGenerateWorkload = async (applyDirectly: boolean) => {
    setGenerating(true);
    setErrorBanner(null);
    setStatusMessage(null);
    try {
      const res = await rairaApi.generateWorkload({
        workloadType: scenario,
        numProcesses,
        seed,
        applyToSimulation: applyDirectly,
      });
      setPreviewSpecs(res.specs);
      if (applyDirectly && res.snapshot) {
        onSimulationUpdated(res.snapshot);
        setEditingSlot(null);
        setStatusMessage(
          `Loaded ${res.specs.length} processes from ${formatWorkloadName(scenario)} (seed ${seed}).`
        );
      } else {
        setStatusMessage(
          `Generated reproducible preview for ${formatWorkloadName(scenario)} (seed ${seed}).`
        );
      }
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  };

  const handleApplyPreview = async () => {
    if (!previewSpecs || previewSpecs.length === 0) return;
    setErrorBanner(null);
    try {
      const snap = await rairaApi.loadWorkload({
        specs: previewSpecs,
        workloadType: scenario,
        seed,
      });
      onSimulationUpdated(snap);
      setStatusMessage(
        `Applied ${previewSpecs.length} preview processes (${formatWorkloadName(scenario)}, seed ${seed}) to simulator.`
      );
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : String(err));
    }
  };

  const activeScenarioMeta = WORKLOAD_SCENARIOS[scenario];

  return (
    <div className="raira-section-stack">
      {errorBanner && (
        <div
          role="alert"
          className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs text-red-700 dark:text-red-300 flex items-center justify-between"
        >
          <span>{errorBanner}</span>
          <button
            type="button"
            onClick={() => setErrorBanner(null)}
            aria-label="Dismiss error"
            className="text-red-700 dark:text-red-300 hover:opacity-80 cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {statusMessage && (
        <div
          role="status"
          className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-700 dark:text-emerald-300 flex items-center justify-between"
        >
          <span>{statusMessage}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            aria-label="Dismiss notice"
            className="text-emerald-700 dark:text-emerald-300 hover:opacity-80 cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Manual Process Creator */}
        <section className="raira-card raira-card-pad space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-semibold text-[var(--text-primary)]">
                {editingSlot !== null
                  ? `Edit Process Slot #${editingSlot + 1}`
                  : 'Create Process Manually'}
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Up to 32 processes per episode · RAM cap 4096 MB · Priority 1 (lowest) to 5
                (highest)
              </p>
            </div>
            {editingSlot !== null && (
              <button
                type="button"
                onClick={() => {
                  setEditingSlot(null);
                  setFormErrors({});
                }}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                Cancel edit
              </button>
            )}
          </div>

          {!canEdit && (
            <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-800 dark:text-amber-300">
              Simulation is at tick {simulation?.currentTick}. Reset the simulation to tick 0 to
              add, edit, or delete individual processes.
            </div>
          )}

          <form onSubmit={handleManualSubmit} noValidate className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label
                  htmlFor="proc-name"
                  className="block text-xs font-medium text-[var(--text-secondary)] mb-1"
                >
                  Process Name
                </label>
                <input
                  id="proc-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. matrix-solver-01"
                  className="raira-input w-full rounded-lg px-3 py-2 text-sm placeholder:text-[var(--text-muted)]"
                />
                {formErrors.name && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{formErrors.name}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="proc-arrival"
                  className="block text-xs font-medium text-[var(--text-secondary)] mb-1"
                >
                  Arrival Time (ticks, 0–500)
                </label>
                <input
                  id="proc-arrival"
                  type="number"
                  value={arrivalTime}
                  onChange={(e) => setArrivalTime(e.target.value)}
                  className="raira-input w-full rounded-lg px-3 py-2 text-sm font-mono"
                />
                {formErrors.arrivalTime && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    {formErrors.arrivalTime}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="proc-burst"
                  className="block text-xs font-medium text-[var(--text-secondary)] mb-1"
                >
                  CPU Burst Time (ticks, 1–100)
                </label>
                <input
                  id="proc-burst"
                  type="number"
                  value={cpuBurstTime}
                  onChange={(e) => setCpuBurstTime(e.target.value)}
                  className="raira-input w-full rounded-lg px-3 py-2 text-sm font-mono"
                />
                {formErrors.cpuBurstTime && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    {formErrors.cpuBurstTime}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="proc-priority"
                  className="block text-xs font-medium text-[var(--text-secondary)] mb-1"
                >
                  Priority (1 lowest – 5 highest)
                </label>
                <input
                  id="proc-priority"
                  type="number"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="raira-input w-full rounded-lg px-3 py-2 text-sm font-mono"
                />
                {formErrors.priority && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    {formErrors.priority}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="proc-memory"
                  className="block text-xs font-medium text-[var(--text-secondary)] mb-1"
                >
                  Memory Demand (MB, 16–4096)
                </label>
                <input
                  id="proc-memory"
                  type="number"
                  value={memoryDemand}
                  onChange={(e) => setMemoryDemand(e.target.value)}
                  className="raira-input w-full rounded-lg px-3 py-2 text-sm font-mono"
                />
                {formErrors.memoryDemand && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    {formErrors.memoryDemand}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-mono tabular-nums text-[var(--text-muted)]">
                Slots used: {currentSpecs.length} / {SYSTEM_CONFIG.MAX_PROCESSES}
              </span>
              <button
                type="submit"
                disabled={!canEdit}
                className="raira-btn-primary inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold disabled:opacity-40 cursor-pointer"
              >
                {editingSlot !== null ? (
                  <>
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Save Process Changes</span>
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Add Process</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        {/* Automatic Workload Generator */}
        <section className="raira-card raira-card-pad space-y-4">
          <div>
            <h2 className="font-display text-base font-semibold text-[var(--text-primary)]">
              Automatic Workload Generator
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Seeded Mulberry32 generator — identical random seeds guarantee identical workloads
            </p>
          </div>

          <div
            role="group"
            aria-label="Workload scenario"
            className="grid grid-cols-2 gap-2"
          >
            {SCENARIO_LIST.map((sc) => {
              const active = scenario === sc.type;
              return (
                <button
                  key={sc.type}
                  type="button"
                  onClick={() => setScenario(sc.type)}
                  aria-pressed={active}
                  className={`text-left rounded-lg border px-3 py-2.5 transition-colors cursor-pointer ${
                    active ? 'font-medium' : 'raira-subtle hover:border-[var(--accent-border)]'
                  }`}
                  style={
                    active
                      ? {
                          borderColor: 'var(--accent-border)',
                          backgroundColor: 'var(--accent-soft)',
                          color: 'var(--accent-text)',
                        }
                      : undefined
                  }
                >
                  <div
                    className={`text-xs font-semibold ${
                      active ? 'text-[var(--accent-text)]' : 'text-[var(--text-primary)]'
                    }`}
                  >
                    {sc.shortLabel}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)] mt-0.5 line-clamp-1">
                    {sc.characteristics}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="raira-subtle rounded-lg px-3.5 py-2.5 text-xs text-[var(--text-secondary)] leading-relaxed">
            <span className="font-semibold text-[var(--text-primary)]">
              {activeScenarioMeta.label}:{' '}
            </span>
            {activeScenarioMeta.description}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="wg-count"
                className="block text-xs font-medium text-[var(--text-secondary)] mb-1"
              >
                Processes (1–32)
              </label>
              <input
                id="wg-count"
                type="number"
                min={1}
                max={32}
                value={numProcesses}
                onChange={(e) =>
                  setNumProcesses(Math.max(1, Math.min(32, Number(e.target.value) || 1)))
                }
                className="raira-input w-full rounded-lg px-3 py-2 text-sm font-mono"
              />
            </div>

            <div>
              <label
                htmlFor="wg-seed"
                className="block text-xs font-medium text-[var(--text-secondary)] mb-1"
              >
                Random Seed
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  id="wg-seed"
                  type="number"
                  value={seed}
                  onChange={(e) => setSeed(Number(e.target.value) || 0)}
                  className="raira-input w-full rounded-lg px-3 py-2 text-sm font-mono"
                />
                <button
                  type="button"
                  onClick={() => setSeed(Math.floor(Math.random() * 9000) + 1000)}
                  aria-label="Randomize seed"
                  className="raira-btn-secondary h-[38px] w-[38px] shrink-0 inline-flex items-center justify-center rounded-lg cursor-pointer"
                >
                  <Shuffle className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => handleGenerateWorkload(true)}
              disabled={generating}
              className="raira-btn-primary inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Generate &amp; Load Workload</span>
            </button>
            <button
              type="button"
              onClick={() => handleGenerateWorkload(false)}
              disabled={generating}
              className="raira-btn-secondary inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium disabled:opacity-50 cursor-pointer"
            >
              <span>Preview Only</span>
            </button>
          </div>
        </section>
      </div>

      {/* Workload Preview Table if previewed */}
      {previewSpecs && previewSpecs.length > 0 && (
        <section
          className="raira-card raira-card-pad space-y-3"
          style={{ borderColor: 'var(--accent-border)' }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-sm font-semibold text-[var(--text-primary)]">
                Generated Workload Preview · {formatWorkloadName(scenario)} · Seed {seed}
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                {previewSpecs.length} processes · Total CPU burst{' '}
                {previewSpecs.reduce((a, p) => a + p.cpuBurstTime, 0)}t · Aggregate RAM demand{' '}
                {previewSpecs.reduce((a, p) => a + p.memoryDemand, 0)} MB
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleApplyPreview}
                className="rounded-lg bg-emerald-600 dark:bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-white dark:text-slate-950 hover:bg-emerald-500 dark:hover:bg-emerald-400 cursor-pointer"
              >
                Apply to Simulator
              </button>
              <button
                type="button"
                onClick={() => setPreviewSpecs(null)}
                className="raira-btn-secondary rounded-lg px-3 py-1.5 text-xs cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-56">
            <table className="raira-table w-full text-left border-collapse text-xs">
              <thead>
                <tr
                  className="border-b text-[var(--text-muted)]"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <th className="px-3">PID</th>
                  <th className="px-3">Name</th>
                  <th className="px-3 text-right">Arrival</th>
                  <th className="px-3 text-right">CPU Burst</th>
                  <th className="px-3 text-right">Priority</th>
                  <th className="px-3 text-right">RAM Demand</th>
                </tr>
              </thead>
              <tbody className="divide-y font-mono tabular-nums">
                {previewSpecs.map((p) => (
                  <tr key={p.id} style={{ borderColor: 'var(--border-subtle)' }}>
                    <td className="px-3 text-[var(--text-primary)] font-medium">{p.id}</td>
                    <td className="px-3 font-sans text-[var(--text-secondary)]">{p.name}</td>
                    <td className="px-3 text-right text-[var(--text-secondary)]">
                      {p.arrivalTime}t
                    </td>
                    <td className="px-3 text-right text-[var(--text-primary)]">
                      {p.cpuBurstTime}t
                    </td>
                    <td className="px-3 text-right text-[var(--text-secondary)]">P{p.priority}</td>
                    <td className="px-3 text-right text-[var(--accent-text)] font-medium">
                      {p.memoryDemand} MB
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Active Simulator Process Table */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-base font-semibold text-[var(--text-primary)]">
              Active Episode Process Table
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Filter by status, sort by column, inspect all 14 OS attributes, or edit before
              execution
            </p>
          </div>
        </div>

        <ProcessTable
          processes={simulation?.processes ?? []}
          editable={canEdit}
          onEdit={handleEditProcess}
          onDelete={handleDeleteProcess}
          onSelectDetail={setInspectedProc}
        />
      </section>

      {/* Process Details Inspector Panel */}
      {inspectedProc && (
        <section
          className="raira-card raira-card-pad space-y-4"
          style={{ borderColor: 'var(--border-strong)' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-sm font-semibold text-[var(--text-primary)]">
                Process Control Block Inspector · {inspectedProc.id} ({inspectedProc.name})
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Stable Slot Index #{inspectedProc.slotIndex} ·{' '}
                <span className={getStatusTextClass(inspectedProc.status)}>
                  {inspectedProc.status}
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setInspectedProc(null)}
              aria-label="Close process inspector"
              className="raira-btn-secondary p-1.5 rounded-md cursor-pointer"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <dl className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-xs">
            {[
              ['Process ID', inspectedProc.id],
              ['Arrival Time', `${inspectedProc.arrivalTime}t`],
              ['CPU Burst', `${inspectedProc.cpuBurstTime}t`],
              ['Remaining CPU', `${inspectedProc.remainingCpuTime}t`],
              ['Priority', `${inspectedProc.priority} / 5`],
              ['Memory Demand', `${inspectedProc.memoryDemand} MB`],
              ['Allocated RAM', `${inspectedProc.allocatedMemory} MB`],
              ['Waiting Time', `${inspectedProc.waitingTime}t`],
              ['Start Time', inspectedProc.startTime !== null ? `${inspectedProc.startTime}t` : '—'],
              [
                'Completion Time',
                inspectedProc.completionTime !== null ? `${inspectedProc.completionTime}t` : '—',
              ],
              [
                'Turnaround Time',
                inspectedProc.turnaroundTime !== null ? `${inspectedProc.turnaroundTime}t` : '—',
              ],
              [
                'Response Time',
                inspectedProc.responseTime !== null ? `${inspectedProc.responseTime}t` : '—',
              ],
              ['Status', inspectedProc.status],
              ['Slot Mapping', `Slot ${inspectedProc.slotIndex}`],
            ].map(([k, v]) => (
              <div key={k} className="raira-subtle rounded-lg p-2.5">
                <dt className="text-[var(--text-muted)] text-[11px]">{k}</dt>
                <dd className="mt-1 font-mono tabular-nums text-[var(--text-primary)] font-medium">
                  {v}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
};
