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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 text-xs text-slate-400">
        <span>Scheduling Algorithm</span>
        <span className="font-mono text-[11px] text-slate-500">
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
        className="flex flex-wrap items-center gap-1.5 p-1 rounded-lg bg-[#080F1D] border border-slate-800/90"
      >
        {ALGORITHMS.map((alg) => {
          const active = value === alg;
          const isUntrainedRL =
            (alg === 'Q_LEARNING' && !qLearningTrained) ||
            (alg === 'DQN' && (!dqnTrained || !dqnAvailable));

          return (
            <button
              key={alg}
              type="button"
              disabled={disabled || (alg === 'DQN' && !dqnAvailable)}
              onClick={() => onChange(alg)}
              aria-pressed={active}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                active
                  ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40'
                  : 'text-slate-400 border border-transparent hover:text-slate-100 hover:bg-slate-800/60'
              }`}
            >
              <span>{formatAlgorithmShort(alg)}</span>
              {alg === 'Q_LEARNING' && (
                <span
                  className={`ml-1.5 text-[10px] font-mono ${
                    qLearningTrained ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {qLearningTrained ? '(Trained)' : '(Untrained)'}
                </span>
              )}
              {alg === 'DQN' && (
                <span
                  className={`ml-1.5 text-[10px] font-mono ${
                    !dqnAvailable
                      ? 'text-red-400'
                      : dqnTrained
                        ? 'text-emerald-400'
                        : 'text-amber-400'
                  }`}
                >
                  {!dqnAvailable ? '(Unavailable)' : dqnTrained ? '(Trained)' : '(Untrained)'}
                </span>
              )}
              {!isUntrainedRL && alg !== 'Q_LEARNING' && alg !== 'DQN' ? null : null}
            </button>
          );
        })}
      </div>
    </div>
  );
};
