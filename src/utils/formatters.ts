import type { ProcessStatus, WorkloadType } from '../types/process';
import type { AlgorithmType } from '../types/simulation';
import type { ResultProvenance } from '../types/experiment';

export function formatAlgorithmName(alg: AlgorithmType): string {
  switch (alg) {
    case 'FCFS':
      return 'FCFS';
    case 'RR':
      return 'Round Robin';
    case 'PRIORITY':
      return 'Priority';
    case 'Q_LEARNING':
      return 'Tabular Q-Learning';
    case 'DQN':
      return 'Deep Q-Network (DQN)';
  }
}

export function formatAlgorithmShort(alg: AlgorithmType): string {
  switch (alg) {
    case 'FCFS':
      return 'FCFS';
    case 'RR':
      return 'RR';
    case 'PRIORITY':
      return 'Priority';
    case 'Q_LEARNING':
      return 'Q-Learning';
    case 'DQN':
      return 'DQN';
  }
}

export function formatWorkloadName(w: WorkloadType): string {
  switch (w) {
    case 'CPU_INTENSIVE':
      return 'CPU-Intensive';
    case 'MEMORY_INTENSIVE':
      return 'Memory-Intensive';
    case 'MIXED':
      return 'Mixed Workload';
    case 'DYNAMIC':
      return 'Dynamic Workload';
    case 'CUSTOM':
      return 'Custom Workload';
  }
}

export function getStatusTextClass(status: ProcessStatus): string {
  switch (status) {
    case 'RUNNING':
      return 'text-cyan-400 font-semibold';
    case 'READY':
      return 'text-blue-400';
    case 'BLOCKED':
      return 'text-amber-400';
    case 'COMPLETED':
      return 'text-emerald-400';
    case 'NEW':
      return 'text-slate-400';
  }
}

export function formatProvenanceLabel(provenance: ResultProvenance): string {
  switch (provenance) {
    case 'ACTUAL_GENERATED':
      return 'Actual generated experiment result';
    case 'ILLUSTRATIVE_DEMO':
      return 'Illustrative demonstration';
    case 'UNAVAILABLE_UNTRAINED':
      return 'Unavailable / Untrained RL policy';
  }
}

export function getProvenanceClass(provenance: ResultProvenance): string {
  switch (provenance) {
    case 'ACTUAL_GENERATED':
      return 'text-emerald-400';
    case 'ILLUSTRATIVE_DEMO':
      return 'text-cyan-400';
    case 'UNAVAILABLE_UNTRAINED':
      return 'text-amber-400';
  }
}

export function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}
