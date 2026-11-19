import type { WorkloadType } from './process';
import type { AlgorithmType, SimulationMetrics, TickTelemetry } from './simulation';

export type ResultProvenance =
  | 'ACTUAL_GENERATED'
  | 'ILLUSTRATIVE_DEMO'
  | 'UNAVAILABLE_UNTRAINED';

export interface AlgorithmBenchmarkResult {
  algorithm: AlgorithmType;
  available: boolean;
  isTrainedModel: boolean; // Always true for deterministic baselines; true/false for RL agents
  provenance: ResultProvenance;
  unavailableReason?: string;
  seed: number;
  workloadType: WorkloadType;
  numProcesses: number;
  metrics: SimulationMetrics;
  telemetrySample: TickTelemetry[];
  terminated: boolean;
  truncated: boolean;
}

export interface SeedComparisonBatch {
  id: string;
  timestamp: string;
  workloadType: WorkloadType;
  numProcesses: number;
  seeds: number[];
  rrQuantum: number;
  perSeedResults: Record<number, AlgorithmBenchmarkResult[]>;
  aggregated: Array<{
    algorithm: AlgorithmType;
    available: boolean;
    isTrainedModel: boolean;
    provenance: ResultProvenance;
    unavailableReason?: string;
    avgCpuUtilisation: number;
    avgRamUtilisation: number;
    avgWaitingTime: number;
    avgTurnaroundTime: number;
    avgResponseTime: number;
    throughput: number;
    jainFairnessIndex: number;
    avgEpisodeReward: number;
    rankByWaitingTime: number | null;
    rankByReward: number | null;
  }>;
}

export interface ExperimentRecord {
  id: string;
  timestamp: string;
  algorithm: AlgorithmType;
  isTrainedModel: boolean;
  provenance: ResultProvenance;
  workloadType: WorkloadType;
  numProcesses: number;
  seed: number;
  episodes: number;
  avgWaitingTime: number;
  avgTurnaroundTime: number;
  avgResponseTime: number;
  cpuUtilisation: number;
  ramUtilisation: number;
  throughput: number;
  jainFairness: number;
  reward: number;
  notes?: string;
}
