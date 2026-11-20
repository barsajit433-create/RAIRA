import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Save, ShieldCheck } from 'lucide-react';
import type { RewardWeights, SimulationSnapshot } from '../types/simulation';
import type { RewardPresetId } from '../types/intelligence';
import {
  matchesPretrainedRewardWeights,
  REWARD_PRESETS,
} from '../simulation/FairnessMonitor';
import { rairaApi } from '../services/api';
import { experimentStorage, type SavedRewardConfig } from '../services/experimentStorage';
import { getStatusTextClass } from '../utils/formatters';

interface FairnessMonitorPageProps {
  simulation: SimulationSnapshot | null;
  onSimulationUpdated: (snap: SimulationSnapshot) => void;
  onLaunchDemo: () => void;
}

export const FairnessMonitorPage: React.FC<FairnessMonitorPageProps> = ({
  simulation,
  onSimulationUpdated,
  onLaunchDemo,
}) => {
  const fairness = simulation?.fairnessMonitor;
  const [threshold, setThreshold] = useState<number>(
    fairness?.starvationThreshold ?? experimentStorage.loadSettings().starvationThreshold
  );
  const [draftWeights, setDraftWeights] = useState<RewardWeights>(
    simulation?.rewardWeights ?? REWARD_PRESETS.BALANCED.weights
  );
  const [profileName, setProfileName] = useState('');
  const [savedConfigs, setSavedConfigs] = useState<SavedRewardConfig[]>(() =>
    experimentStorage.loadSavedRewardConfigs()
  );
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (simulation?.rewardWeights) {
      setDraftWeights(simulation.rewardWeights);
    }
    if (simulation?.fairnessMonitor?.starvationThreshold) {
      setThreshold(simulation.fairnessMonitor.starvationThreshold);
    }
  }, [simulation?.rewardWeights, simulation?.fairnessMonitor?.starvationThreshold]);

  const applyConfig = async (nextWeights: RewardWeights, nextThreshold?: number, msg?: string) => {
    setSaving(true);
    try {
      const snap = await rairaApi.configureSimulation({
        rewardWeights: nextWeights,
        starvationThreshold: nextThreshold ?? threshold,
      });
      onSimulationUpdated(snap);
      if (nextThreshold !== undefined) {
        experimentStorage.saveSettings({ starvationThreshold: nextThreshold });
      }
      setStatusNotice(msg ?? 'Updated active simulator reward & starvation settings.');
      setTimeout(() => setStatusNotice(null), 3500);
    } finally {
      setSaving(false);
    }
  };

  const handleApplyPreset = (presetId: Exclude<RewardPresetId, 'CUSTOM'>) => {
    const preset = REWARD_PRESETS[presetId];
    setDraftWeights({ ...preset.weights });
    void applyConfig(preset.weights, threshold, `Applied "${preset.name}" reward weights.`);
  };

  const handleSaveCustomProfile = () => {
    const updated = experimentStorage.saveRewardConfig(
      profileName || `Custom (${new Date().toLocaleTimeString()})`,
      draftWeights
    );
    setSavedConfigs(updated);
    setProfileName('');
    void applyConfig(draftWeights, threshold, 'Saved custom reward profile and applied to simulator.');
  };

  const matchesPretrained = matchesPretrainedRewardWeights(draftWeights);

  return (
    <div className="raira-section-stack">
      {/* Top Fairness KPI Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <div className="raira-card p-4">
          <div className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
            Service-Share Fairness (J_share)
          </div>
          <div className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-[var(--accent-text)]">
            {(fairness?.serviceShareFairnessIndex ?? 1).toFixed(4)}
          </div>
          <div className="mt-1 text-[11px] text-[var(--text-muted)]">
            Demand &amp; arrival-aware GPS index
          </div>
        </div>

        <div className="raira-card p-4">
          <div className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
            Wait-Based Jain Index
          </div>
          <div className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-blue-700 dark:text-blue-300">
            {(fairness?.jainFairnessIndex ?? 1).toFixed(4)}
          </div>
          <div className="mt-1 text-[11px] text-[var(--text-muted)]">
            Raw waiting distribution equality
          </div>
        </div>

        <div className="raira-card p-4">
          <div className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
            Max / Avg Waiting Time
          </div>
          <div className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-[var(--text-primary)]">
            {fairness?.maxWaitingTime ?? 0}t{' '}
            <span className="text-sm font-normal text-[var(--text-muted)]">
              / {(fairness?.avgWaitingTime ?? 0).toFixed(1)}t
            </span>
          </div>
          <div className="mt-1 text-[11px] text-[var(--text-muted)]">
            Tick {simulation?.currentTick ?? 0} live measurement
          </div>
        </div>

        <div className="raira-card p-4">
          <div className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
            Threshold Breaches (≥{threshold}t)
          </div>
          <div
            className={`mt-1.5 font-mono text-2xl font-bold tabular-nums ${
              (fairness?.exceedingThresholdCount ?? 0) > 0
                ? 'text-amber-700 dark:text-amber-400'
                : 'text-emerald-700 dark:text-emerald-400'
            }`}
          >
            {fairness?.exceedingThresholdCount ?? 0}
          </div>
          <div className="mt-1 text-[11px] text-[var(--text-muted)]">
            Processes exceeding wait threshold
          </div>
        </div>

        <div className="raira-card p-4">
          <div className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
            Starvation Risk Status
          </div>
          <div
            className={`mt-1.5 font-display text-2xl font-bold ${
              fairness?.starvationRiskLevel === 'HIGH'
                ? 'text-red-700 dark:text-red-400'
                : fairness?.starvationRiskLevel === 'MODERATE'
                  ? 'text-amber-700 dark:text-amber-400'
                  : 'text-emerald-700 dark:text-emerald-400'
            }`}
          >
            {fairness?.starvationRiskLevel ?? 'LOW'}
          </div>
          <div className="mt-1 text-[11px] text-[var(--text-muted)]">
            Active preset: {fairness?.activeRewardPreset ?? 'BALANCED'}
          </div>
        </div>
      </section>

      {/* Reward Provenance & Methodology Banner */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="raira-card raira-card-pad space-y-2.5">
          <h2 className="font-display text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[var(--accent-text)]" aria-hidden="true" />
            Documented Service-Share Fairness Definition
          </h2>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Raw waiting-time equality alone does not distinguish short late arrivals from long early
            jobs. RAIRA computes each arrived process’s ideal{' '}
            <strong className="text-[var(--accent-text)]">
              Generalized Processor Sharing (GPS)
            </strong>{' '}
            expected CPU service share:
          </p>
          <div className="raira-subtle rounded-lg px-3.5 py-2.5 font-mono text-[11px] text-[var(--accent-text)] leading-relaxed">
            {fairness?.formulaDescription ??
              'E_i = min(Burst_i, Σ 1 / |Active(τ)|); J_share = (Σ x_i)² / (n · Σ x_i²) where x_i = (ServiceReceived_i + 0.5) / (E_i + 0.5).'}
          </div>
        </div>

        <div
          className={`raira-card raira-card-pad space-y-2.5 ${
            matchesPretrained
              ? 'border-emerald-500/35 bg-emerald-500/[0.06]'
              : 'border-amber-500/40 bg-amber-500/[0.06]'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
              {matchesPretrained ? (
                <CheckCircle2
                  className="h-4 w-4 text-emerald-700 dark:text-emerald-400"
                  aria-hidden="true"
                />
              ) : (
                <AlertTriangle
                  className="h-4 w-4 text-amber-700 dark:text-amber-400"
                  aria-hidden="true"
                />
              )}
              Model Reward Provenance Check
            </h2>
            <span className="font-mono text-[11px] text-[var(--text-secondary)]">
              {matchesPretrained ? 'Matches Pretrained Baseline' : 'Experimental Objective Active'}
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            {matchesPretrained
              ? 'Active reward weights match the exact Balanced baseline objective used to train the bundled Q-Learning (50 ep) and DQN (25 ep) models.'
              : 'Active reward weights differ from the Balanced baseline objective used to train the bundled Q-Learning & DQN checkpoints. Evaluations now score policies against your modified objective; retrain in RL Training Centre if you want agents optimized for these weights.'}
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <label
              htmlFor="starvation-thresh-input"
              className="text-xs text-[var(--text-secondary)] whitespace-nowrap"
            >
              Starvation Waiting Threshold (ticks):
            </label>
            <input
              id="starvation-thresh-input"
              type="number"
              min={3}
              max={120}
              value={threshold}
              onChange={(e) => setThreshold(Math.max(3, Math.min(120, Number(e.target.value))))}
              className="raira-input w-20 rounded-lg px-2.5 py-1 text-xs font-mono"
            />
            <button
              type="button"
              disabled={saving}
              onClick={() =>
                void applyConfig(
                  draftWeights,
                  threshold,
                  `Updated starvation waiting threshold to ${threshold} ticks.`
                )
              }
              className="rounded-lg border px-3 py-1 text-xs font-medium cursor-pointer transition-colors"
              style={{
                borderColor: 'var(--accent-border)',
                backgroundColor: 'var(--accent-soft)',
                color: 'var(--accent-text)',
              }}
            >
              Apply Threshold
            </button>
          </div>
        </div>
      </section>

      {statusNotice && (
        <div className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-700 dark:text-emerald-300">
          {statusNotice}
        </div>
      )}

      {/* Reward Presets & Weight Tuner */}
      <section className="raira-card raira-card-pad space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-sm font-semibold text-[var(--text-primary)]">
              Reward Objective Presets &amp; Configurable Weight Tuning
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Switch between Efficiency-focused, Balanced (Pretrained Baseline), and
              Fairness-focused presets, or tune individual weights and save named profiles.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(['EFFICIENCY', 'BALANCED', 'FAIRNESS'] as const).map((presetId) => {
            const p = REWARD_PRESETS[presetId];
            const active = fairness?.activeRewardPreset === presetId;
            return (
              <button
                key={presetId}
                type="button"
                onClick={() => handleApplyPreset(presetId)}
                className={`text-left rounded-lg border p-3.5 transition-colors cursor-pointer ${
                  active ? '' : 'raira-subtle hover:border-[var(--accent-border)]'
                }`}
                style={
                  active
                    ? {
                        borderColor: 'var(--accent-border)',
                        backgroundColor: 'var(--accent-soft)',
                      }
                    : undefined
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[var(--text-primary)]">{p.name}</span>
                  {active && (
                    <span className="text-[10px] font-mono font-semibold text-[var(--accent-text)]">
                      ACTIVE
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-[var(--text-muted)] leading-snug">
                  {p.description}
                </p>
                <div className="mt-2 font-mono text-[10px] text-[var(--text-muted)] tabular-nums">
                  CPU {p.weights.cpuRewardWeight} · Wait −{p.weights.waitingPenaltyWeight} · Fair +
                  {p.weights.fairnessWeight}
                </div>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
          {(
            [
              ['cpuRewardWeight', 'CPU Weight', 0.1],
              ['completionBaseBonus', 'Completion Base', 1],
              ['priorityCompletionBonus', 'Priority Bonus', 0.5],
              ['waitingPenaltyWeight', 'Wait Penalty', 0.01],
              ['turnaroundPenaltyWeight', 'Turnaround Pen.', 0.02],
              ['fairnessWeight', 'Fairness Weight', 0.1],
            ] as const
          ).map(([key, label, step]) => (
            <div key={key}>
              <label
                htmlFor={`rw-${key}`}
                className="block text-[11px] text-[var(--text-muted)] mb-1"
              >
                {label}
              </label>
              <input
                id={`rw-${key}`}
                type="number"
                step={step}
                min={0}
                value={draftWeights[key]}
                onChange={(e) =>
                  setDraftWeights((prev) => ({
                    ...prev,
                    [key]: Math.max(0, Number(e.target.value)),
                  }))
                }
                className="raira-input w-full rounded-lg px-2.5 py-1.5 text-xs font-mono"
              />
            </div>
          ))}
        </div>

        <div
          className="flex flex-wrap items-center gap-3 pt-2 border-t"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <input
            type="text"
            placeholder="Optional profile name (e.g. Low-Starvation v1)"
            value={profileName}
            onChange={(e) => setProfileName(e.target.value)}
            className="raira-input flex-1 min-w-[200px] rounded-lg px-3 py-2 text-xs placeholder:text-[var(--text-muted)]"
          />
          <button
            type="button"
            disabled={saving}
            onClick={() => void applyConfig(draftWeights, threshold)}
            className="raira-btn-primary rounded-lg px-3.5 py-2 text-xs font-semibold cursor-pointer whitespace-nowrap"
          >
            Apply Weights
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSaveCustomProfile}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/12 px-3.5 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 cursor-pointer whitespace-nowrap"
          >
            <Save className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Save &amp; Apply Profile</span>
          </button>
        </div>

        {savedConfigs.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span className="text-[11px] text-[var(--text-muted)]">Saved Profiles:</span>
            {savedConfigs.slice(0, 6).map((cfg) => (
              <button
                key={cfg.id}
                type="button"
                onClick={() => {
                  setDraftWeights({ ...cfg.weights });
                  void applyConfig(cfg.weights, threshold, `Loaded saved profile "${cfg.name}".`);
                }}
                className="raira-btn-secondary rounded-md px-2.5 py-1 text-[11px] cursor-pointer"
              >
                {cfg.name}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Per-Process Service-Share Fairness & Starvation Table */}
      <section className="raira-card raira-card-pad space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-sm font-semibold text-[var(--text-primary)]">
              Per-Process Service Received vs. Expected Service Share
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Monitors arrived processes in the live simulator for service deficit and starvation
              threshold breaches.
            </p>
          </div>
        </div>

        {!fairness || fairness.perProcess.length === 0 ? (
          <div className="raira-empty-state py-8 px-4 text-center space-y-3">
            <p className="text-xs text-[var(--text-muted)]">
              Load and step a simulation workload to monitor live per-process service fairness and
              starvation risk.
            </p>
            <button
              type="button"
              onClick={onLaunchDemo}
              className="raira-btn-primary rounded-lg px-4 py-2 text-xs font-semibold cursor-pointer"
            >
              Launch Demo Workload
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="raira-table w-full text-left text-xs">
              <thead>
                <tr
                  className="border-b text-[11px] uppercase tracking-wider text-[var(--text-muted)]"
                  style={{ borderColor: 'var(--border-subtle)' }}
                >
                  <th className="pr-3">Process</th>
                  <th className="px-3">Status</th>
                  <th className="px-3 text-right">Priority</th>
                  <th className="px-3 text-right">Arrival</th>
                  <th className="px-3 text-right">CPU Service</th>
                  <th className="px-3 text-right">Expected Share</th>
                  <th className="px-3 text-right">Service Deficit</th>
                  <th className="px-3 text-right">Wait Time</th>
                  <th className="pl-3 text-right">Starvation Risk</th>
                </tr>
              </thead>
              <tbody className="divide-y font-mono tabular-nums">
                {fairness.perProcess.map((row) => (
                  <tr
                    key={row.processId}
                    className="hover:bg-[var(--surface-subtle)] transition-colors"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <td className="pr-3 text-[var(--text-primary)] whitespace-nowrap">
                      <span className="font-semibold">{row.processId}</span>{' '}
                      <span className="text-[var(--text-muted)] font-sans">
                        ({row.processName})
                      </span>
                    </td>
                    <td className={`px-3 font-medium ${getStatusTextClass(row.status)}`}>
                      {row.status}
                    </td>
                    <td className="px-3 text-right text-[var(--text-secondary)]">
                      P{row.priority}
                    </td>
                    <td className="px-3 text-right text-[var(--text-muted)]">
                      t={row.arrivalTime}
                    </td>
                    <td className="px-3 text-right text-[var(--accent-text)] font-medium">
                      {row.cpuServiceReceived} / {row.cpuBurstTime}t
                    </td>
                    <td className="px-3 text-right text-[var(--text-secondary)]">
                      {row.expectedServiceShare.toFixed(2)}t
                    </td>
                    <td
                      className={`px-3 text-right ${
                        row.serviceDeficit >= 2
                          ? 'text-amber-700 dark:text-amber-400 font-semibold'
                          : 'text-[var(--text-muted)]'
                      }`}
                    >
                      {row.serviceDeficit.toFixed(2)}t
                    </td>
                    <td
                      className={`px-3 text-right ${
                        row.exceedsWaitThreshold
                          ? 'text-red-700 dark:text-red-400 font-semibold'
                          : 'text-[var(--text-primary)]'
                      }`}
                    >
                      {row.waitingTime}t
                    </td>
                    <td
                      className={`pl-3 text-right font-semibold ${
                        row.starvationRisk === 'HIGH'
                          ? 'text-red-700 dark:text-red-400'
                          : row.starvationRisk === 'MODERATE'
                            ? 'text-amber-700 dark:text-amber-400'
                            : 'text-emerald-700 dark:text-emerald-400'
                      }`}
                    >
                      {row.starvationRisk}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
