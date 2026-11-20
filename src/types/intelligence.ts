import type { ProcessStatus, WorkloadType } from './process.ts';
import type { AlgorithmType, RewardBreakdown, RewardWeights, SimulationMetrics, TickTelemetry } from './simulation.ts';

// ============================================================================
// FEATURE 1: EXPLAINABLE AI DECISION ENGINE
// ============================================================================

export interface DecisionProcessSnapshot {
  id: string;
  slotIndex: number;
  name: string;
  status: ProcessStatus;
  priority: number;
  arrivalTime: number;
  cpuBurstTime: number;
  remainingCpuTime: number;
  waitingTime: number;
  memoryDemand: number;
  allocatedMemory: number;
}

export interface AlternativeActionQ {
  actionId: number;
  label: string;
  slotIndex: number | null;
  processId: string | null;
  processName: string | null;
  quantum: number;
  qValue: number;
  qGapFromSelected: number; // selectedQ - thisQ (>= 0 when greedy)
  processPriority: number | null;
  remainingCpuTime: number | null;
  waitingTime: number | null;
  memoryDemand: number | null;
  isSelected: boolean;
}

export interface DQNPerturbationSensitivity {
  featureName: string;
  perturbationDescription: string;
  baselineSelectedQ: number;
  perturbedSelectedQ: number;
  deltaQ: number;
  actionChanged: boolean;
  newBestActionId: number;
  newBestActionLabel: string;
}

export interface DecisionPostExecution {
  newTick: number;
  elapsedTicks: number;
  processNewStatus: ProcessStatus | null;
  processRemainingCpuAfter: number | null;
  processAllocatedMemoryAfter: number | null;
  availableRamAfterMb: number;
  admittedFromBlocked: boolean;
  preempted: boolean;
  completed: boolean;
  invalidAttempt: boolean;
}

export interface DecisionExplanation {
  id: string;
  tick: number;
  algorithm: 'Q_LEARNING' | 'DQN';
  isTrainedModel: boolean;
  selectedActionId: number;
  selectedActionLabel: string;
  selectedQuantum: number;
  selectedProcess: DecisionProcessSnapshot | null;
  availableRamBeforeMb: number;
  totalRamMb: number;
  readyCountBefore: number;
  blockedCountBefore: number;
  selectedQValue: number;
  validActionCount: number;
  alternativeActions: AlternativeActionQ[];
  rewardBreakdown: RewardBreakdown;
  postExecution: DecisionPostExecution;
  ruleBasedReasons: string[];
  compactStateKey?: string;
  perturbationSensitivity?: DQNPerturbationSensitivity[];
}

// ============================================================================
// FEATURE 2: COUNTERFACTUAL WHAT-IF LABORATORY
// ============================================================================

export type CounterfactualBranchId =
  | 'SELECTED_RL'
  | 'FCFS'
  | 'RR'
  | 'PRIORITY'
  | 'ALT_RL';

export interface CounterfactualBranchMetrics {
  endTick: number;
  ticksSimulated: number;
  avgCpuUtilisation: number;
  avgRamUtilisation: number;
  avgWaitingTime: number;
  avgTurnaroundTime: number;
  throughput: number;
  resourceViolations: number;
  jainFairnessIndex: number;
  completedCount: number;
  totalProcesses: number;
  totalEpisodeReward: number;
}

export interface CounterfactualBranchResult {
  branchId: CounterfactualBranchId;
  label: string;
  policyDescription: string;
  initialActionId: number | null;
  initialActionLabel: string;
  metrics: CounterfactualBranchMetrics;
  deltasVsSelected: {
    cpuUtilDelta: number;
    ramUtilDelta: number;
    waitingTimeDelta: number;
    turnaroundTimeDelta: number;
    throughputDelta: number;
    violationsDelta: number;
    fairnessDelta: number;
    rewardDelta: number;
  };
  telemetryTrace: Array<{
    tick: number;
    cpuUtil: number;
    ramUtilPercent: number;
    avgWaitingTime: number;
    completedCount: number;
  }>;
}

export interface CounterfactualReport {
  id: string;
  timestamp: string;
  disclaimer: string;
  sourceAlgorithm: AlgorithmType;
  rlReferenceAgent: 'Q_LEARNING' | 'DQN';
  startTick: number;
  horizonTicks: number | 'FULL_EPISODE';
  workloadType: WorkloadType;
  seed: number;
  availableRamAtBranchMb: number;
  validActionsAtBranch: AlternativeActionQ[];
  selectedAlternativeActionId: number | null;
  branches: CounterfactualBranchResult[];
}

// ============================================================================
// FEATURE 3: WORKLOAD SHOCK ARENA
// ============================================================================

export type ShockType =
  | 'CPU_SPIKE'
  | 'MEMORY_BURST'
  | 'HIGH_PRIORITY_BURST'
  | 'SIMULTANEOUS_ARRIVALS'
  | 'SEVERE_RAM_PRESSURE';

export interface ShockScenarioConfig {
  shockType: ShockType;
  injectionTick: number;
  additionalProcesses: number;
  cpuBurst: number;
  ramDemandMb: number;
  priority: number;
  baseWorkloadType: Exclude<WorkloadType, 'CUSTOM'>;
  baseNumProcesses: number;
  seed: number;
  rrQuantum: number;
  starvationThreshold: number;
}

export interface ShockAlgorithmResult {
  algorithm: AlgorithmType;
  isTrainedModel: boolean;
  injectionTick: number;
  stabilizedTick: number | null;
  recoveryTicks: number | null; // null if episode ended/truncated before stabilizing
  maxQueueLength: number;
  maxWaitingTime: number;
  preShockCpuUtil: number;
  postShockCpuUtil: number;
  cpuUtilDropPct: number;
  peakRamPressurePct: number;
  preShockThroughput: number;
  postShockThroughput: number;
  throughputReductionPct: number;
  starvationEvents: number;
  finalMetrics: SimulationMetrics;
  telemetry: TickTelemetry[];
}

export interface ShockArenaReport {
  id: string;
  timestamp: string;
  config: ShockScenarioConfig;
  injectedProcessIds: string[];
  results: ShockAlgorithmResult[];
}

// ============================================================================
// FEATURE 4: FAIRNESS & STARVATION PREVENTION MONITOR
// ============================================================================

export type RewardPresetId = 'EFFICIENCY' | 'BALANCED' | 'FAIRNESS' | 'CUSTOM';

export interface RewardPresetConfig {
  id: RewardPresetId;
  name: string;
  description: string;
  weights: RewardWeights;
}

export interface ProcessFairnessEntry {
  processId: string;
  processName: string;
  status: ProcessStatus;
  priority: number;
  arrivalTime: number;
  cpuBurstTime: number;
  cpuServiceReceived: number;
  expectedServiceShare: number;
  serviceShareRatio: number; // received / expected
  serviceDeficit: number; // max(0, expected - received)
  waitingTime: number;
  exceedsWaitThreshold: boolean;
  starvationRisk: 'LOW' | 'MODERATE' | 'HIGH';
}

export interface FairnessMonitorSnapshot {
  currentTick: number;
  starvationThreshold: number;
  maxWaitingTime: number;
  avgWaitingTime: number;
  jainFairnessIndex: number;
  serviceShareFairnessIndex: number;
  exceedingThresholdCount: number;
  starvationRiskLevel: 'LOW' | 'MODERATE' | 'HIGH';
  matchesPretrainedRewardWeights: boolean;
  activeRewardPreset: RewardPresetId;
  formulaDescription: string;
  perProcess: ProcessFairnessEntry[];
}

// ============================================================================
// FEATURE 5: LIVE PROCESS EXECUTION TIMELINE
// ============================================================================

export interface TimelineProcessCell {
  processId: string;
  status: ProcessStatus;
  allocatedMemoryMb: number;
  preemptedAtTick: boolean;
  completedAtTick: boolean;
  admittedAtTick: boolean;
  quantumUsed: number;
}

export interface TimelineTickRecord {
  tick: number;
  runningProcessId: string | null;
  totalAllocatedRamMb: number;
  availableRamMb: number;
  preemptedProcessId: string | null;
  completedProcessId: string | null;
  quantumUsed: number;
  cells: Record<string, TimelineProcessCell>;
}

// ============================================================================
// FEATURE 6: STATISTICAL RESEARCH VALIDATION LABORATORY
// ============================================================================

export interface StatisticalMetricSummary {
  mean: number;
  stdDev: number;
  ci95Low: number;
  ci95High: number;
  median: number;
  p95: number;
  min: number;
  max: number;
}

export interface StatisticalAlgorithmSummary {
  policyKey: string; // e.g., 'FCFS', 'RR', 'PRIORITY', 'Q_LEARNING_TRAINED', 'DQN_TRAINED', 'Q_LEARNING_UNTRAINED', 'DQN_UNTRAINED'
  algorithm: AlgorithmType;
  label: string;
  isTrainedModel: boolean;
  sampleCount: number;
  waitingTime: StatisticalMetricSummary;
  turnaroundTime: StatisticalMetricSummary;
  cpuUtilisation: StatisticalMetricSummary;
  ramUtilisation: StatisticalMetricSummary;
  throughput: StatisticalMetricSummary;
  jainFairness: StatisticalMetricSummary;
  serviceShareFairness: StatisticalMetricSummary;
  episodeReward: StatisticalMetricSummary;
  invalidActionsTotal: number;
  starvationEventsTotal: number;
}

export interface WorkloadGeneralisationRow {
  workloadType: Exclude<WorkloadType, 'CUSTOM'>;
  isUnseenForPretrained: boolean;
  sampleSeeds: number;
  byPolicy: Record<
    string,
    {
      avgWaitMean: number;
      avgWaitCi95Half: number;
      throughputMean: number;
      jainFairnessMean: number;
      rewardMean: number;
    }
  >;
}

export interface AblationStudyRow {
  variantId: string;
  label: string;
  description: string;
  algorithm: AlgorithmType;
  avgWaitMean: number;
  avgWaitStd: number;
  throughputMean: number;
  jainFairnessMean: number;
  rewardMean: number;
  deltaRewardVsBaseline: number;
}

export interface StatisticalValidationConfig {
  seedStart: number;
  seedCount: number; // default 30, supports >=30
  workloads: Array<Exclude<WorkloadType, 'CUSTOM'>>;
  numProcesses: number;
  rrQuantum: number;
  includeUntrainedComparison: boolean;
  includeAblationStudy: boolean;
  starvationThreshold: number;
}

export interface StatisticalValidationReport {
  id: string;
  timestamp: string;
  config: StatisticalValidationConfig;
  evaluationSeeds: number[];
  trainingSeedRangeDescription: string;
  disjointFromTrainingSeeds: boolean;
  totalEpisodesExecuted: number;
  durationMs: number;
  overallSummaries: StatisticalAlgorithmSummary[];
  workloadBreakdown: WorkloadGeneralisationRow[];
  ablationStudy: AblationStudyRow[];
  empiricalFindings: string[];
}
