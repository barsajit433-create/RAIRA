import type { ProcessRecord, ProcessSpec, WorkloadType } from './process';

export type AlgorithmType = 'FCFS' | 'RR' | 'PRIORITY' | 'Q_LEARNING' | 'DQN';

export type SimulationStatus = 'IDLE' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'TRUNCATED';

export const SYSTEM_CONFIG = {
  CPU_CORES: 1,
  CPU_CAPACITY_PERCENT: 100,
  TOTAL_RAM_MB: 4096,
  MAX_PROCESSES: 32,
  RL_QUANTA: [1, 2, 4] as const,
  DEFAULT_RR_QUANTUM: 2,
  MAX_EPISODE_TICKS: 600,
  OBSERVATION_SIZE: 262,
  ACTION_SPACE_SIZE: 97,
  FAIRNESS_SMOOTHING_EPSILON: 1.0,
} as const;

export interface RewardWeights {
  cpuRewardWeight: number;
  completionBaseBonus: number;
  priorityCompletionBonus: number;
  waitingPenaltyWeight: number;
  turnaroundPenaltyWeight: number;
  fairnessWeight: number;
  invalidActionPenalty: number;
  gamma: number;
}

export const DEFAULT_REWARD_WEIGHTS: RewardWeights = {
  cpuRewardWeight: 1.0,
  completionBaseBonus: 10.0,
  priorityCompletionBonus: 2.0,
  waitingPenaltyWeight: 0.05,
  turnaroundPenaltyWeight: 0.1,
  fairnessWeight: 0.5,
  invalidActionPenalty: 10.0,
  gamma: 0.95,
};

export interface RewardBreakdown {
  rCpu: number;
  rCompletion: number;
  pWaiting: number;
  pTurnaround: number;
  rFairness: number;
  pInvalid: number;
  total: number;
}

export interface TickTelemetry {
  tick: number;
  cpuUtil: number; // 0 or 100 on single-core
  ramUsedMb: number;
  ramUtilPercent: number;
  availableRamMb: number;
  readyCount: number;
  blockedCount: number;
  runningProcessId: string | null;
  completedCount: number;
  avgWaitingTime: number;
  fairnessIndex: number;
  stepReward: number;
}

export interface AllocationDecision {
  tick: number;
  algorithm: AlgorithmType;
  actionId: number | null;
  actionLabel: string;
  processId: string | null;
  processName: string | null;
  quantum: number;
  elapsedTicks: number;
  ramAllocatedMb: number;
  reward: number;
  rewardBreakdown: RewardBreakdown;
  admittedFromBlocked: boolean;
  preempted: boolean;
  completed: boolean;
  invalidAttempt: boolean;
}

export interface SystemEvent {
  id: string;
  tick: number;
  level: 'info' | 'success' | 'warning' | 'error';
  category: 'ADMISSION' | 'DISPATCH' | 'PREEMPT' | 'COMPLETE' | 'BLOCKED' | 'IDLE' | 'SYSTEM';
  message: string;
}

export interface SimulationMetrics {
  currentTick: number;
  cpuBusyTicks: number;
  avgCpuUtilisation: number;
  currentCpuUtilisation: number;
  avgRamUtilisation: number;
  currentRamUsedMb: number;
  currentRamUtilisation: number;
  availableRamMb: number;
  activeProcessCount: number;
  readyCount: number;
  blockedCount: number;
  completedCount: number;
  totalProcesses: number;
  avgWaitingTime: number;
  avgTurnaroundTime: number;
  avgResponseTime: number;
  throughput: number; // completed processes per 100 ticks
  jainFairnessIndex: number;
  totalEpisodeReward: number;
  contextSwitches: number;
  invalidActionCount: number;
}

export interface SimulationSnapshot {
  status: SimulationStatus;
  algorithm: AlgorithmType;
  workloadType: WorkloadType;
  seed: number;
  rrQuantum: number;
  maxTicks: number;
  currentTick: number;
  runningSlot: number | null;
  processes: ProcessRecord[];
  initialSpecs: ProcessSpec[];
  metrics: SimulationMetrics;
  telemetryHistory: TickTelemetry[];
  recentDecisions: AllocationDecision[];
  eventLog: SystemEvent[];
  rewardWeights: RewardWeights;
  rlTrainedStatus: {
    qLearningTrained: boolean;
    dqnTrained: boolean;
  };
}
