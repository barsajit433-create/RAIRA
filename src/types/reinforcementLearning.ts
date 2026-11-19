import type { WorkloadType } from './process';
import type { RewardWeights } from './simulation';

export type RLAgentType = 'Q_LEARNING' | 'DQN';

export interface RLTrainingConfig {
  agentType: RLAgentType;
  workloadType: WorkloadType;
  numProcesses: number;
  episodes: number;
  learningRate: number;
  discountFactor: number;
  epsilonStart: number;
  epsilonDecay: number;
  epsilonMin: number;
  batchSize: number;
  targetUpdateFreq: number;
  seed: number;
  rewardWeights?: RewardWeights;
}

export interface TrainingEpisodeMetric {
  episode: number;
  totalReward: number;
  avgRewardLast10: number;
  epsilon: number;
  avgWaitingTime: number;
  avgTurnaroundTime: number;
  avgCpuUtil: number;
  avgRamUtil: number;
  jainFairness: number;
  completedCount: number;
  totalProcesses: number;
  ticks: number;
  terminated: boolean;
  truncated: boolean;
  qTableStates?: number;
  dqnLoss?: number | null;
}

export type TrainingRunState = 'IDLE' | 'TRAINING' | 'PAUSED' | 'COMPLETED' | 'STOPPED' | 'ERROR';

export interface DQNDependencyStatus {
  available: boolean;
  backend: string | null;
  version: string | null;
  error: string | null;
  parameterCount: number | null;
}

export interface RLAgentSummary {
  agentType: RLAgentType;
  isTrained: boolean;
  episodesTrained: number;
  epsilon: number;
  learningRate: number;
  discountFactor: number;
  epsilonDecay: number;
  epsilonMin: number;
  qTableStates: number;
  totalUpdates: number;
  lastLoss: number | null;
  bestReward: number | null;
  averageReward: number | null;
  lastWorkload: WorkloadType | null;
  lastSeed: number | null;
  dqnStatus?: DQNDependencyStatus;
}

export interface TrainingSessionSnapshot {
  state: TrainingRunState;
  config: RLTrainingConfig | null;
  currentEpisode: number;
  totalEpisodes: number;
  currentReward: number | null;
  averageReward: number | null;
  bestReward: number | null;
  epsilon: number;
  qTableStates: number;
  lastLoss: number | null;
  history: TrainingEpisodeMetric[];
  error: string | null;
  qLearningSummary: RLAgentSummary;
  dqnSummary: RLAgentSummary;
}

export interface SerializedQLearningModel {
  version: 'raira-qtable-v1';
  savedAt: string;
  config: {
    learningRate: number;
    discountFactor: number;
    epsilon: number;
    epsilonDecay: number;
    epsilonMin: number;
  };
  episodesTrained: number;
  totalUpdates: number;
  bestReward: number | null;
  qTable: Record<string, number>;
  history: TrainingEpisodeMetric[];
}

export interface SerializedDQNModel {
  version: 'raira-dqn-v1';
  savedAt: string;
  architecture: {
    inputDim: number;
    hidden1: number;
    hidden2: number;
    outputDim: number;
  };
  config: {
    learningRate: number;
    discountFactor: number;
    epsilon: number;
    epsilonDecay: number;
    epsilonMin: number;
    batchSize: number;
    targetUpdateFreq: number;
  };
  episodesTrained: number;
  totalUpdates: number;
  bestReward: number | null;
  lastLoss: number | null;
  weights: Array<{ shape: number[]; data: number[] }>;
  history: TrainingEpisodeMetric[];
}
