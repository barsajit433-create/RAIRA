import React from 'react';
import type { AlgorithmType } from '../types/simulation';
import { formatAlgorithmShort } from '../utils/formatters';

interface AlgorithmSelectorProps {
  value: AlgorithmType;
  onChange: (alg: AlgorithmType) => void;
  disabled?: boolean;
  qLearningTrained: boolean;
  dqnTrained: boolean;
  dqnAvailable?: boolean;
}

const ALGORITHMS: AlgorithmType[] = ['FCFS', 'RR', 'PRIORITY', 'Q_LEARNING', 'DQN'];

export const AlgorithmSelector: React.FC<AlgorithmSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  qLearningTrained,
  dqnTrained,
  dqnAvailable = true,
}) => {
  return (
    <div className="space-y-1.5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 text-xs text-[var(--text-muted)]">
        <span>Scheduling Algorithm</span>
        <span className="font-mono text-[11px] text-[var(--text-muted)]">
          {value === 'Q_LEARNING'
            ? qLearningTrained
              ? 'Trained Q-table active'
              : 'Untrained Q-table (train in RL Centre)'
            : value === 'DQN'
              ? !dqnAvailable
                ? 'DQN unavailable'
                : dqnTrained
                  ? 'Trained DQN weights active'
                  : 'Untrained DQN weights (train in RL Centre)'
              : 'Deterministic baseline policy'}
        </span>
      </div>
      <div
        role="group"
        aria-label="Select scheduling algorithm"
        className="flex flex-wrap items-center gap-1.5 p-1 rounded-lg raira-subtle"
      >
        {ALGORITHMS.map((alg) => {
          const active = value === alg;
          return (
            <button
              key={alg}
              type="button"
              disabled={disabled || (alg === 'DQN' && !dqnAvailable)}
              onClick={() => onChange(alg)}
              aria-pressed={active}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed border ${
                active
                  ? 'text-[var(--accent-text)]'
                  : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)] hover:bg-[var(--surface-card-hover)]'
              }`}
              style={
                active
                  ? {
                      backgroundColor: 'var(--accent-soft)',
                      borderColor: 'var(--accent-border)',
                    }
                  : undefined
              }
            >
              <span>{formatAlgorithmShort(alg)}</span>
              {alg === 'Q_LEARNING' && (
                <span
                  className={`ml-1.5 text-[10px] font-mono ${
                    qLearningTrained
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-amber-700 dark:text-amber-400'
                  }`}
                >
                  {qLearningTrained ? '(Trained)' : '(Untrained)'}
                </span>
              )}
              {alg === 'DQN' && (
                <span
                  className={`ml-1.5 text-[10px] font-mono ${
                    !dqnAvailable
                      ? 'text-red-700 dark:text-red-400'
                      : dqnTrained
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-amber-700 dark:text-amber-400'
                  }`}
                >
                  {!dqnAvailable ? '(Unavailable)' : dqnTrained ? '(Trained)' : '(Untrained)'}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
