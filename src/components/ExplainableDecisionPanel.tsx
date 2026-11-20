import React from 'react';
import { CheckCircle2, Cpu, Layers, Sliders } from 'lucide-react';
import type { DecisionExplanation } from '../types/intelligence';
import { getStatusTextClass } from '../utils/formatters';

interface ExplainableDecisionPanelProps {
  explanation: DecisionExplanation | null;
  history: DecisionExplanation[];
  selectedId: string | null;
  onSelectExplanation: (id: string) => void;
}

export const ExplainableDecisionPanel: React.FC<ExplainableDecisionPanelProps> = ({
  explanation,
  history,
  selectedId,
  onSelectExplanation,
}) => {
  if (!explanation) {
    return (
      <div className="raira-card p-8 text-center space-y-2">
        <p className="text-sm font-medium text-[var(--text-primary)]">
          No Q-Learning or DQN decision captured yet
        </p>
        <p className="text-xs text-[var(--text-muted)] max-w-lg mx-auto">
          Switch the active scheduler to Tabular Q-Learning or Deep Q-Network (DQN) and execute at
          least one step to inspect real Q-values, valid alternatives, reward attribution, and DQN
          feature-perturbation sensitivity.
        </p>
      </div>
    );
  }

  const maxAbsQ = Math.max(
    1e-4,
    ...explanation.alternativeActions.map((a) => Math.abs(a.qValue))
  );
  const sp = explanation.selectedProcess;
  const post = explanation.postExecution;
  const rb = explanation.rewardBreakdown;

  return (
    <div className="raira-section-stack">
      {/* Decision History Selector */}
      {history.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)] shrink-0">
            Decision Trace
          </span>
          {history.slice(0, 12).map((item) => {
            const active = (selectedId ?? history[0].id) === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectExplanation(item.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-mono tabular-nums whitespace-nowrap shrink-0 border transition-colors cursor-pointer ${
                  active
                    ? 'text-[var(--accent-text)]'
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
                t={item.tick} · {item.algorithm === 'DQN' ? 'DQN' : 'Q-L'} ·{' '}
                {item.selectedProcess?.id ?? 'WAIT'}
              </button>
            );
          })}
        </div>
      )}

      {/* Primary Decision Summary Strip */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Selected Process & Hardware Context */}
        <div className="raira-card raira-card-pad space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Cpu className="h-4 w-4 text-[var(--accent-text)]" aria-hidden="true" />
              Selected Decision State
            </h3>
            <span className="font-mono text-xs text-[var(--accent-text)] tabular-nums">
              Tick {explanation.tick} · {explanation.algorithm === 'DQN' ? 'DQN' : 'Q-Learning'}
            </span>
          </div>

          <div
            className="rounded-lg border px-3.5 py-2.5 flex items-center justify-between gap-2"
            style={{
              borderColor: 'var(--accent-border)',
              backgroundColor: 'var(--accent-soft)',
            }}
          >
            <div>
              <div className="text-[11px] text-[var(--text-muted)]">
                Executed Action (#{explanation.selectedActionId})
              </div>
              <div className="font-mono text-sm font-semibold text-[var(--text-primary)]">
                {explanation.selectedActionLabel}
              </div>
            </div>
            <div className="text-right font-mono tabular-nums">
              <div className="text-[11px] text-[var(--text-muted)]">Selected Q-Value</div>
              <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                {explanation.selectedQValue.toFixed(4)}
              </div>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs font-mono tabular-nums">
            <div>
              <dt className="text-[var(--text-muted)]">Process ID</dt>
              <dd className="text-[var(--text-primary)]">
                {sp ? `${sp.id} (${sp.name})` : 'WAIT (CPU Idle)'}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">CPU Quantum</dt>
              <dd className="text-[var(--text-primary)]">{explanation.selectedQuantum} tick(s)</dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">Pre-Step State</dt>
              <dd className={sp ? getStatusTextClass(sp.status) : 'text-[var(--text-muted)]'}>
                {sp ? sp.status : 'IDLE'}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">Priority</dt>
              <dd className="text-[var(--text-primary)]">{sp ? `P${sp.priority} / 5` : '—'}</dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">Remaining CPU</dt>
              <dd className="text-[var(--text-primary)]">
                {sp ? `${sp.remainingCpuTime} / ${sp.cpuBurstTime} ticks` : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">Waiting Time</dt>
              <dd className="text-[var(--text-primary)]">{sp ? `${sp.waitingTime} ticks` : '—'}</dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">Memory Demand</dt>
              <dd className="text-[var(--text-primary)]">{sp ? `${sp.memoryDemand} MB` : '0 MB'}</dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">Allocated Memory</dt>
              <dd className="text-[var(--text-primary)]">
                {sp ? `${sp.allocatedMemory} MB` : '0 MB'}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">Available RAM (Pre)</dt>
              <dd className="text-[var(--accent-text)]">
                {explanation.availableRamBeforeMb} / {explanation.totalRamMb} MB
              </dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">Queues (Pre)</dt>
              <dd className="text-[var(--text-secondary)]">
                {explanation.readyCountBefore} Ready · {explanation.blockedCountBefore} Blocked
              </dd>
            </div>
          </dl>
        </div>

        {/* Reward Attribution & Post-Execution Result */}
        <div className="raira-card raira-card-pad space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <CheckCircle2
                className="h-4 w-4 text-emerald-700 dark:text-emerald-400"
                aria-hidden="true"
              />
              Reward &amp; Post-Execution Outcome
            </h3>
            <span className="font-mono text-xs text-[var(--text-muted)] tabular-nums">
              Δt = +{post.elapsedTicks}t → t={post.newTick}
            </span>
          </div>

          <dl
            className="space-y-1.5 text-xs font-mono tabular-nums border-b pb-3"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <div className="flex justify-between">
              <dt className="text-[var(--text-muted)]">CPU Utilisation Reward (R_cpu)</dt>
              <dd className="text-emerald-700 dark:text-emerald-400">+{rb.rCpu.toFixed(3)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--text-muted)]">Completion Bonus (R_comp)</dt>
              <dd className="text-emerald-700 dark:text-emerald-400">
                +{rb.rCompletion.toFixed(3)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--text-muted)]">Fairness Term (R_fair)</dt>
              <dd className="text-[var(--accent-text)]">+{rb.rFairness.toFixed(3)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--text-muted)]">Waiting Penalty (−P_wait)</dt>
              <dd className="text-amber-700 dark:text-amber-400">−{rb.pWaiting.toFixed(3)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--text-muted)]">Turnaround Penalty (−P_turn)</dt>
              <dd className="text-amber-700 dark:text-amber-400">−{rb.pTurnaround.toFixed(3)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--text-muted)]">Invalid Action Penalty (−P_inv)</dt>
              <dd className="text-red-700 dark:text-red-400">−{rb.pInvalid.toFixed(3)}</dd>
            </div>
            <div
              className="flex justify-between pt-1.5 border-t font-semibold"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              <dt className="text-[var(--text-primary)]">Discounted SMDP Total</dt>
              <dd
                className={
                  rb.total >= 0
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : 'text-red-700 dark:text-red-300'
                }
              >
                {rb.total >= 0 ? '+' : ''}
                {rb.total.toFixed(3)}
              </dd>
            </div>
          </dl>

          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs font-mono tabular-nums">
            <div>
              <dt className="text-[var(--text-muted)]">Status After Step</dt>
              <dd
                className={
                  post.processNewStatus
                    ? getStatusTextClass(post.processNewStatus)
                    : 'text-[var(--text-muted)]'
                }
              >
                {post.processNewStatus ?? 'IDLE'}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">Remaining CPU After</dt>
              <dd className="text-[var(--text-primary)]">
                {post.processRemainingCpuAfter !== null ? `${post.processRemainingCpuAfter}t` : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">Available RAM After</dt>
              <dd className="text-[var(--accent-text)]">{post.availableRamAfterMb} MB</dd>
            </div>
            <div>
              <dt className="text-[var(--text-muted)]">Transition Flags</dt>
              <dd className="text-[var(--text-secondary)]">
                {[
                  post.admittedFromBlocked ? 'Admitted' : null,
                  post.completed ? 'Completed' : null,
                  post.preempted ? 'Preempted' : null,
                  post.invalidAttempt ? 'Invalid' : null,
                ]
                  .filter(Boolean)
                  .join(', ') || 'Steady'}
              </dd>
            </div>
          </dl>
        </div>

        {/* Rule-Based Feature Attribution */}
        <div className="raira-card raira-card-pad space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <Layers className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              Rule-Based Feature Derivation
            </h3>
            <span className="text-[11px] text-[var(--text-muted)] font-mono whitespace-nowrap shrink-0">
              {explanation.isTrainedModel ? 'Trained Policy' : 'Untrained Policy'}
            </span>
          </div>
          <p className="text-[11px] text-[var(--text-muted)]">
            Strictly deterministic explanations computed from simulator state features and actual
            model Q-values (no generative text fabrication).
          </p>
          <ul className="space-y-2 text-xs text-[var(--text-secondary)] leading-relaxed">
            {explanation.ruleBasedReasons.map((reason, idx) => (
              <li key={idx} className="raira-subtle rounded-lg px-3 py-2">
                {reason}
              </li>
            ))}
          </ul>
          {explanation.compactStateKey && (
            <div className="pt-1 text-[11px] font-mono text-[var(--text-muted)] break-all">
              Q-Table State Key:{' '}
              <span className="text-[var(--text-secondary)]">{explanation.compactStateKey}</span>
            </div>
          )}
        </div>
      </div>

      {/* Valid Alternative Actions Ranked by Real Q-Value */}
      <div className="raira-card raira-card-pad space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-sm font-semibold text-[var(--text-primary)]">
              Valid Action Q-Value Landscape ({explanation.validActionCount} Valid Masked Actions)
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              Actual Q-values from the active{' '}
              {explanation.algorithm === 'DQN'
                ? 'TensorFlow.js DQN online network'
                : 'candidate-aware Q-table'}{' '}
              comparing the selected action against top valid alternatives.
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
                <th className="pr-3">Action</th>
                <th className="px-3">Process</th>
                <th className="px-3 text-right">Quantum</th>
                <th className="px-3 text-right">Priority</th>
                <th className="px-3 text-right">Rem. CPU</th>
                <th className="px-3 text-right">Wait</th>
                <th className="px-3 text-right">RAM</th>
                <th className="px-3 text-right">Q-Value</th>
                <th className="px-3 text-right">Gap vs Selected</th>
                <th className="pl-3 w-36">Relative Magnitude</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] font-mono tabular-nums">
              {explanation.alternativeActions.map((alt) => {
                const widthPct = Math.min(100, Math.max(4, (Math.abs(alt.qValue) / maxAbsQ) * 100));
                return (
                  <tr
                    key={alt.actionId}
                    className={
                      alt.isSelected
                        ? 'text-[var(--text-primary)]'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]'
                    }
                    style={
                      alt.isSelected ? { backgroundColor: 'var(--accent-soft)' } : undefined
                    }
                  >
                    <td className="pr-3 whitespace-nowrap font-medium">
                      #{alt.actionId} · {alt.label}
                      {alt.isSelected && (
                        <span className="ml-2 text-[10px] font-sans font-semibold text-emerald-700 dark:text-emerald-400">
                          SELECTED
                        </span>
                      )}
                    </td>
                    <td className="px-3 text-[var(--text-muted)] whitespace-nowrap">
                      {alt.processId ? `${alt.processId} (${alt.processName})` : 'Idle'}
                    </td>
                    <td className="px-3 text-right">{alt.quantum}t</td>
                    <td className="px-3 text-right">
                      {alt.processPriority !== null ? `P${alt.processPriority}` : '—'}
                    </td>
                    <td className="px-3 text-right">
                      {alt.remainingCpuTime !== null ? `${alt.remainingCpuTime}t` : '—'}
                    </td>
                    <td className="px-3 text-right">
                      {alt.waitingTime !== null ? `${alt.waitingTime}t` : '—'}
                    </td>
                    <td className="px-3 text-right">
                      {alt.memoryDemand !== null ? `${alt.memoryDemand}M` : '—'}
                    </td>
                    <td className="px-3 text-right font-semibold text-[var(--text-primary)]">
                      {alt.qValue.toFixed(4)}
                    </td>
                    <td className="px-3 text-right text-[var(--text-muted)]">
                      {alt.isSelected ? '0.0000' : `−${alt.qGapFromSelected.toFixed(4)}`}
                    </td>
                    <td className="pl-3">
                      <div
                        className="h-2 w-full rounded overflow-hidden"
                        style={{ backgroundColor: 'var(--border-subtle)' }}
                      >
                        <div
                          className="h-full rounded"
                          style={{
                            width: `${widthPct}%`,
                            backgroundColor: alt.isSelected
                              ? 'var(--accent-primary)'
                              : alt.qValue >= 0
                                ? '#3B82F6'
                                : '#D97706',
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* DQN Controlled Feature-Perturbation Sensitivity Analysis */}
      {explanation.algorithm === 'DQN' &&
        explanation.perturbationSensitivity &&
        explanation.perturbationSensitivity.length > 0 && (
          <div className="raira-card raira-card-pad space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-[var(--accent-text)]" aria-hidden="true" />
                  DQN Controlled Feature-Perturbation Sensitivity Analysis
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Live TensorFlow.js forward passes perturbing individual features in the 262-dim
                  observation vector to measure ΔQ sensitivity and policy stability.
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
                    <th className="pr-3">Perturbed Input Feature</th>
                    <th className="px-3">Controlled Perturbation</th>
                    <th className="px-3 text-right">Baseline Q</th>
                    <th className="px-3 text-right">Perturbed Q</th>
                    <th className="px-3 text-right">ΔQ Impact</th>
                    <th className="pl-3">Action Stability</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {explanation.perturbationSensitivity.map((row) => (
                    <tr key={row.featureName} className="hover:bg-[var(--surface-subtle)]">
                      <td className="pr-3 font-medium text-[var(--text-primary)] whitespace-nowrap">
                        {row.featureName}
                      </td>
                      <td className="px-3 text-[var(--text-muted)]">
                        {row.perturbationDescription}
                      </td>
                      <td className="px-3 text-right font-mono tabular-nums text-[var(--text-secondary)]">
                        {row.baselineSelectedQ.toFixed(4)}
                      </td>
                      <td className="px-3 text-right font-mono tabular-nums text-[var(--text-primary)]">
                        {row.perturbedSelectedQ.toFixed(4)}
                      </td>
                      <td
                        className={`px-3 text-right font-mono tabular-nums font-semibold ${
                          row.deltaQ > 0.001
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : row.deltaQ < -0.001
                              ? 'text-amber-700 dark:text-amber-400'
                              : 'text-[var(--text-muted)]'
                        }`}
                      >
                        {row.deltaQ >= 0 ? '+' : ''}
                        {row.deltaQ.toFixed(4)}
                      </td>
                      <td className="pl-3 font-mono text-[11px] whitespace-nowrap">
                        {row.actionChanged ? (
                          <span className="text-amber-700 dark:text-amber-300">
                            Switched → {row.newBestActionLabel}
                          </span>
                        ) : (
                          <span className="text-emerald-700 dark:text-emerald-400">
                            Stable (Unchanged)
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
    </div>
  );
};
