import React, { useMemo, useState } from 'react';
import { Download, Flame, Play } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { WorkloadType } from '../types/process';
import type { ShockArenaReport, ShockScenarioConfig, ShockType } from '../types/intelligence';
import { SHOCK_TYPE_PRESETS } from '../simulation/ShockArena';
import { rairaApi } from '../services/api';
import { experimentStorage } from '../services/experimentStorage';
import { exportService } from '../services/exportService';
import { formatAlgorithmName } from '../utils/formatters';
import { useTheme } from '../theme/ThemeContext';

export const ShockArena: React.FC = () => {
  const { chartTheme } = useTheme();
  const [config, setConfig] = useState<ShockScenarioConfig>({
    shockType: 'MEMORY_BURST',
    injectionTick: 8,
    additionalProcesses: 4,
    cpuBurst: 8,
    ramDemandMb: 1536,
    priority: 3,
    baseWorkloadType: 'MIXED',
    baseNumProcesses: 10,
    seed: 1042,
    rrQuantum: 2,
    starvationThreshold: 15,
  });

  const [report, setReport] = useState<ShockArenaReport | null>(() => {
    const saved = experimentStorage.loadShockReports();
    return saved.length > 0 ? saved[0] : null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const algColors: Record<string, string> = {
    FCFS: chartTheme.appearance === 'dark' ? '#94A3B8' : '#64748B',
    RR: chartTheme.secondary,
    PRIORITY: chartTheme.warning,
    Q_LEARNING: chartTheme.primary,
    DQN: chartTheme.success,
  };

  const handleSelectShockType = (shockType: ShockType) => {
    const preset = SHOCK_TYPE_PRESETS[shockType];
    setConfig((prev) => ({
      ...prev,
      shockType,
      additionalProcesses: preset.defaultAdditionalProcesses,
      cpuBurst: preset.defaultCpuBurst,
      ramDemandMb: preset.defaultRamDemandMb,
      priority: preset.defaultPriority,
    }));
  };

  const handleRunShock = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await rairaApi.runShockArena(config);
      setReport(res);
      experimentStorage.saveShockReport(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const resilienceChartData = useMemo(() => {
    if (!report) return [];
    return report.results.map((r) => ({
      algorithm: r.algorithm === 'Q_LEARNING' ? 'Q-Learning' : r.algorithm,
      recoveryTicks: r.recoveryTicks ?? 0,
      maxQueue: r.maxQueueLength,
      maxWait: r.maxWaitingTime,
      peakRam: r.peakRamPressurePct,
      starvation: r.starvationEvents,
    }));
  }, [report]);

  const ramTrajectoryData = useMemo(() => {
    if (!report || report.results.length === 0) return [];
    const tickSet = new Set<number>();
    for (const r of report.results) {
      for (const t of r.telemetry) tickSet.add(t.tick);
    }
    const ticks = Array.from(tickSet).sort((a, b) => a - b);
    const step = Math.max(1, Math.floor(ticks.length / 60));
    const sampledTicks = ticks.filter((_, idx) => idx % step === 0 || idx === ticks.length - 1);

    return sampledTicks.map((tick) => {
      const point: Record<string, number> = { tick };
      for (const r of report.results) {
        const entry =
          r.telemetry.find((t) => t.tick >= tick) ?? r.telemetry[r.telemetry.length - 1];
        if (entry) {
          point[r.algorithm] = entry.ramUtilPercent;
        }
      }
      return point;
    });
  }, [report]);

  return (
    <div className="raira-section-stack">
      {/* Shock Configuration Builder */}
      <section className="raira-card raira-card-pad space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Flame className="h-4 w-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              Configurable Workload Disturbance Builder
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Schedules an identical mid-episode workload shock across all five scheduling policies
              (FCFS, RR, Priority, Q-Learning, DQN) to benchmark recovery and starvation resilience.
            </p>
          </div>
          {report && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => exportService.exportShockArenaCsv(report)}
                className="raira-btn-secondary inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs cursor-pointer whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>CSV</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  exportService.downloadJson(
                    report,
                    `raira-shock-${report.config.shockType.toLowerCase()}`
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

        {/* Shock Type Selector Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {(Object.keys(SHOCK_TYPE_PRESETS) as ShockType[]).map((st) => {
            const preset = SHOCK_TYPE_PRESETS[st];
            const active = config.shockType === st;
            return (
              <button
                key={st}
                type="button"
                onClick={() => handleSelectShockType(st)}
                className={`text-left rounded-lg border p-3 transition-colors cursor-pointer ${
                  active
                    ? 'text-[var(--text-primary)]'
                    : 'raira-subtle text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
                style={
                  active
                    ? {
                        borderColor: 'var(--accent-primary)',
                        backgroundColor: 'var(--accent-soft)',
                      }
                    : undefined
                }
              >
                <div className="text-xs font-semibold">{preset.label}</div>
                <p className="mt-1 text-[11px] text-[var(--text-muted)] leading-snug">
                  {preset.description}
                </p>
              </button>
            );
          })}
        </div>

        {/* Parameter Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label htmlFor="shock-tick" className="block text-[11px] text-[var(--text-muted)] mb-1">
              Injection Tick
            </label>
            <input
              id="shock-tick"
              type="number"
              min={1}
              max={100}
              value={config.injectionTick}
              onChange={(e) =>
                setConfig((p) => ({ ...p, injectionTick: Math.max(1, Number(e.target.value)) }))
              }
              className="raira-input w-full rounded-lg px-2.5 py-2 text-xs font-mono"
            />
          </div>

          <div>
            <label htmlFor="shock-procs" className="block text-[11px] text-[var(--text-muted)] mb-1">
              Shock Processes
            </label>
            <input
              id="shock-procs"
              type="number"
              min={1}
              max={16}
              value={config.additionalProcesses}
              onChange={(e) =>
                setConfig((p) => ({
                  ...p,
                  additionalProcesses: Math.max(1, Math.min(16, Number(e.target.value))),
                }))
              }
              className="raira-input w-full rounded-lg px-2.5 py-2 text-xs font-mono"
            />
          </div>

          <div>
            <label htmlFor="shock-cpu" className="block text-[11px] text-[var(--text-muted)] mb-1">
              CPU Burst (ticks)
            </label>
            <input
              id="shock-cpu"
              type="number"
              min={1}
              max={20}
              value={config.cpuBurst}
              onChange={(e) =>
                setConfig((p) => ({
                  ...p,
                  cpuBurst: Math.max(1, Math.min(20, Number(e.target.value))),
                }))
              }
              className="raira-input w-full rounded-lg px-2.5 py-2 text-xs font-mono"
            />
          </div>

          <div>
            <label htmlFor="shock-ram" className="block text-[11px] text-[var(--text-muted)] mb-1">
              RAM Demand (MB)
            </label>
            <input
              id="shock-ram"
              type="number"
              min={64}
              max={3584}
              step={64}
              value={config.ramDemandMb}
              onChange={(e) =>
                setConfig((p) => ({
                  ...p,
                  ramDemandMb: Math.max(64, Math.min(3584, Number(e.target.value))),
                }))
              }
              className="raira-input w-full rounded-lg px-2.5 py-2 text-xs font-mono"
            />
          </div>

          <div>
            <label htmlFor="shock-prio" className="block text-[11px] text-[var(--text-muted)] mb-1">
              Shock Priority (1–5)
            </label>
            <input
              id="shock-prio"
              type="number"
              min={1}
              max={5}
              value={config.priority}
              onChange={(e) =>
                setConfig((p) => ({
                  ...p,
                  priority: Math.max(1, Math.min(5, Number(e.target.value))),
                }))
              }
              className="raira-input w-full rounded-lg px-2.5 py-2 text-xs font-mono"
            />
          </div>

          <div>
            <label htmlFor="shock-base" className="block text-[11px] text-[var(--text-muted)] mb-1">
              Base Workload
            </label>
            <select
              id="shock-base"
              value={config.baseWorkloadType}
              onChange={(e) =>
                setConfig((p) => ({
                  ...p,
                  baseWorkloadType: e.target.value as Exclude<WorkloadType, 'CUSTOM'>,
                }))
              }
              className="raira-input w-full rounded-lg px-2.5 py-2 text-xs font-mono"
            >
              <option value="MIXED">Mixed</option>
              <option value="CPU_INTENSIVE">CPU-Intensive</option>
              <option value="MEMORY_INTENSIVE">Memory-Intensive</option>
              <option value="DYNAMIC">Dynamic Arrivals</option>
            </select>
          </div>
        </div>

        <div
          className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-[var(--text-muted)]">
            <label className="flex items-center gap-2">
              <span>Base Procs</span>
              <input
                type="number"
                min={4}
                max={20}
                value={config.baseNumProcesses}
                onChange={(e) =>
                  setConfig((p) => ({
                    ...p,
                    baseNumProcesses: Math.max(4, Math.min(20, Number(e.target.value))),
                  }))
                }
                className="raira-input w-16 rounded px-2 py-1"
              />
            </label>
            <label className="flex items-center gap-2">
              <span>Seed</span>
              <input
                type="number"
                value={config.seed}
                onChange={(e) => setConfig((p) => ({ ...p, seed: Number(e.target.value) || 1042 }))}
                className="raira-input w-20 rounded px-2 py-1"
              />
            </label>
            <label className="flex items-center gap-2">
              <span>Starvation Wait Threshold</span>
              <input
                type="number"
                min={5}
                max={100}
                value={config.starvationThreshold}
                onChange={(e) =>
                  setConfig((p) => ({
                    ...p,
                    starvationThreshold: Math.max(5, Number(e.target.value)),
                  }))
                }
                className="raira-input w-16 rounded px-2 py-1"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={handleRunShock}
            disabled={loading}
            className="raira-btn-primary inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            <Play className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              {loading ? 'Running 5-Policy Shock Test...' : 'Run 5-Policy Shock Benchmark'}
            </span>
          </button>
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
      </section>

      {report && (
        <>
          {/* 5-Policy Shock Resilience Matrix */}
          <section className="raira-card raira-card-pad space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-sm font-semibold text-[var(--text-primary)]">
                  Shock Resilience Comparison · {SHOCK_TYPE_PRESETS[report.config.shockType].label}
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Injected {report.injectedProcessIds.length} process(es) (
                  {report.injectedProcessIds.join(', ')}) at tick {report.config.injectionTick} onto{' '}
                  {report.config.baseNumProcesses} base {report.config.baseWorkloadType} processes
                  (seed {report.config.seed}).
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="raira-table w-full text-left text-xs">
                <thead>
                  <tr
                    className="border-b text-[11px] uppercase tracking-wider text-[var(--text-muted)]"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <th className="pr-3">Policy</th>
                    <th className="px-3 text-right">Recovery Time</th>
                    <th className="px-3 text-right">Max Queue</th>
                    <th className="px-3 text-right">Max Wait</th>
                    <th className="px-3 text-right">CPU Drop %</th>
                    <th className="px-3 text-right">Peak RAM %</th>
                    <th className="px-3 text-right">Tput Reduction</th>
                    <th className="px-3 text-right">Starvation Events</th>
                    <th className="px-3 text-right">Final Avg Wait</th>
                    <th className="pl-3 text-right">Episode Reward</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)] font-mono tabular-nums">
                  {report.results.map((r) => (
                    <tr key={r.algorithm} className="hover:bg-[var(--surface-subtle)]">
                      <td className="pr-3 font-sans font-semibold text-[var(--text-primary)] whitespace-nowrap">
                        {formatAlgorithmName(r.algorithm)}
                      </td>
                      <td className="px-3 text-right text-[var(--accent-text)]">
                        {r.recoveryTicks !== null ? `${r.recoveryTicks}t` : 'Unstabilized'}
                      </td>
                      <td className="px-3 text-right text-[var(--text-primary)]">
                        {r.maxQueueLength}
                      </td>
                      <td className="px-3 text-right text-amber-700 dark:text-amber-300">
                        {r.maxWaitingTime}t
                      </td>
                      <td className="px-3 text-right text-[var(--text-secondary)]">
                        {r.cpuUtilDropPct.toFixed(1)}%
                      </td>
                      <td
                        className={`px-3 text-right ${
                          r.peakRamPressurePct >= 85
                            ? 'text-red-700 dark:text-red-400 font-semibold'
                            : 'text-[var(--text-primary)]'
                        }`}
                      >
                        {r.peakRamPressurePct.toFixed(1)}%
                      </td>
                      <td className="px-3 text-right text-[var(--text-secondary)]">
                        {r.throughputReductionPct.toFixed(1)}%
                      </td>
                      <td
                        className={`px-3 text-right font-semibold ${
                          r.starvationEvents > 0
                            ? 'text-amber-700 dark:text-amber-400'
                            : 'text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        {r.starvationEvents}
                      </td>
                      <td className="px-3 text-right text-[var(--text-primary)]">
                        {r.finalMetrics.avgWaitingTime.toFixed(2)}t
                      </td>
                      <td className="pl-3 text-right text-emerald-700 dark:text-emerald-300">
                        {r.finalMetrics.totalEpisodeReward.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Visual Charts */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="raira-card raira-card-pad space-y-3">
              <h3 className="font-display text-sm font-semibold text-[var(--text-primary)]">
                Recovery Ticks &amp; Peak Waiting Time Under Shock
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={resilienceChartData}
                    margin={{ top: 8, right: 12, left: -12, bottom: 0 }}
                  >
                    <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="algorithm"
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
                    <Legend wrapperStyle={{ fontSize: 11, color: chartTheme.tick }} />
                    <Bar
                      dataKey="recoveryTicks"
                      name="Recovery Ticks"
                      fill={chartTheme.primary}
                      radius={chartTheme.barRadius}
                      isAnimationActive={false}
                    />
                    <Bar
                      dataKey="maxWait"
                      name="Max Waiting Time"
                      fill={chartTheme.warning}
                      radius={chartTheme.barRadius}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="raira-card raira-card-pad space-y-3">
              <h3 className="font-display text-sm font-semibold text-[var(--text-primary)]">
                RAM Pressure Trajectory (%) Around Shock Injection (t={report.config.injectionTick})
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={ramTrajectoryData}
                    margin={{ top: 8, right: 12, left: -12, bottom: 0 }}
                  >
                    <CartesianGrid stroke={chartTheme.grid} strokeDasharray="3 3" />
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
                    <ReferenceLine
                      x={report.config.injectionTick}
                      stroke={chartTheme.danger}
                      strokeDasharray="4 4"
                      label={{ value: 'SHOCK', fill: chartTheme.danger, fontSize: 10 }}
                    />
                    {report.results.map((r) => (
                      <Line
                        key={r.algorithm}
                        type="monotone"
                        dataKey={r.algorithm}
                        name={r.algorithm === 'Q_LEARNING' ? 'Q-Learning' : r.algorithm}
                        stroke={algColors[r.algorithm] ?? chartTheme.primary}
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
};
