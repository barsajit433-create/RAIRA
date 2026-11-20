import type { ProcessRecord } from '../types/process.ts';
import { DEFAULT_REWARD_WEIGHTS, type RewardWeights } from '../types/simulation.ts';
import type {
  FairnessMonitorSnapshot,
  ProcessFairnessEntry,
  RewardPresetConfig,
  RewardPresetId,
} from '../types/intelligence.ts';
import { computeJainFairnessIndex } from './MetricsCalculator.ts';

export const DEFAULT_STARVATION_THRESHOLD = 15;

export const REWARD_PRESETS: Record<Exclude<RewardPresetId, 'CUSTOM'>, RewardPresetConfig> = {
  EFFICIENCY: {
    id: 'EFFICIENCY',
    name: 'Efficiency-focused',
    description:
      'Maximizes CPU utilization and fast high-priority job completions with lower fairness weight.',
    weights: {
      cpuRewardWeight: 1.5,
      completionBaseBonus: 14.0,
      priorityCompletionBonus: 3.5,
      waitingPenaltyWeight: 0.03,
      turnaroundPenaltyWeight: 0.14,
      fairnessWeight: 0.15,
      invalidActionPenalty: 10.0,
      gamma: 0.95,
    },
  },
  BALANCED: {
    id: 'BALANCED',
    name: 'Balanced (Pretrained Baseline)',
    description:
      'Exact default reward objective used when training RAIRA’s bundled Q-Learning (50 ep) and DQN (25 ep) models.',
    weights: { ...DEFAULT_REWARD_WEIGHTS },
  },
  FAIRNESS: {
    id: 'FAIRNESS',
    name: 'Fairness-focused',
    description:
      'Strongly penalizes long queue waiting times and amplifies Jain fairness reward to prevent process starvation.',
    weights: {
      cpuRewardWeight: 0.85,
      completionBaseBonus: 9.0,
      priorityCompletionBonus: 1.0,
      waitingPenaltyWeight: 0.15,
      turnaroundPenaltyWeight: 0.12,
      fairnessWeight: 1.6,
      invalidActionPenalty: 10.0,
      gamma: 0.95,
    },
  },
};

export function areRewardWeightsEqual(a: RewardWeights, b: RewardWeights): boolean {
  const eps = 1e-6;
  return (
    Math.abs(a.cpuRewardWeight - b.cpuRewardWeight) < eps &&
    Math.abs(a.completionBaseBonus - b.completionBaseBonus) < eps &&
    Math.abs(a.priorityCompletionBonus - b.priorityCompletionBonus) < eps &&
    Math.abs(a.waitingPenaltyWeight - b.waitingPenaltyWeight) < eps &&
    Math.abs(a.turnaroundPenaltyWeight - b.turnaroundPenaltyWeight) < eps &&
    Math.abs(a.fairnessWeight - b.fairnessWeight) < eps &&
    Math.abs(a.invalidActionPenalty - b.invalidActionPenalty) < eps &&
    Math.abs(a.gamma - b.gamma) < eps
  );
}

export function detectRewardPreset(weights: RewardWeights): RewardPresetId {
  if (areRewardWeightsEqual(weights, REWARD_PRESETS.BALANCED.weights)) return 'BALANCED';
  if (areRewardWeightsEqual(weights, REWARD_PRESETS.EFFICIENCY.weights)) return 'EFFICIENCY';
  if (areRewardWeightsEqual(weights, REWARD_PRESETS.FAIRNESS.weights)) return 'FAIRNESS';
  return 'CUSTOM';
}

export function matchesPretrainedRewardWeights(weights: RewardWeights): boolean {
  return areRewardWeightsEqual(weights, DEFAULT_REWARD_WEIGHTS);
}

/**
 * Service-Share Fairness Monitor:
 *
 * Raw waiting-time equality alone does not distinguish a short job arriving late from a
 * long job arriving early. Therefore, RAIRA computes an explicit arrival- and demand-aware
 * expected CPU service share E_i for every arrived process i:
 *
 *   For each tick tau in [arrival_i, min(currentTick, completion_i)):
 *     Let A(tau) = set of processes active (arrived and not yet completed) at tick tau.
 *     Instantaneous ideal processor-sharing increment = 1 / |A(tau)|.
 *     E_i = min(cpuBurst_i, sum_{tau} (1 / |A(tau)|)).
 *
 *   Actual CPU service received: s_i = cpuBurst_i - remainingCpuTime_i.
 *   Service-share attainment ratio: x_i = (s_i + eps) / (E_i + eps), clamped to [0, 1.5]
 *   (and 1.0 when a process has completed its full burst).
 *   Service-share Jain index: J_share = (sum x_i)^2 / (n * sum x_i^2).
 */
export function computeFairnessMonitorSnapshot(params: {
  processes: ProcessRecord[];
  currentTick: number;
  rewardWeights: RewardWeights;
  starvationThreshold?: number;
}): FairnessMonitorSnapshot {
  const { processes, currentTick, rewardWeights } = params;
  const threshold = Math.max(1, Math.floor(params.starvationThreshold ?? DEFAULT_STARVATION_THRESHOLD));

  const arrived = processes.filter((p) => p.status !== 'NEW');
  const jainFairnessIndex = Number(computeJainFairnessIndex(processes).toFixed(4));
  const matchesPretrained = matchesPretrainedRewardWeights(rewardWeights);
  const activeRewardPreset = detectRewardPreset(rewardWeights);

  const formulaDescription =
    'Ideal GPS Service Share E_i = Σ_{τ=arrival_i}^{end_i-1} (1 / |Active(τ)|) across each process’s residency window. Service Attainment x_i = (ServiceReceived_i + 0.5) / (E_i + 0.5). Service-Share Jain Index J_share = (Σ x_i)² / (n · Σ x_i²).';

  if (arrived.length === 0) {
    return {
      currentTick,
      starvationThreshold: threshold,
      maxWaitingTime: 0,
      avgWaitingTime: 0,
      jainFairnessIndex,
      serviceShareFairnessIndex: 1,
      exceedingThresholdCount: 0,
      starvationRiskLevel: 'LOW',
      matchesPretrainedRewardWeights: matchesPretrained,
      activeRewardPreset,
      formulaDescription,
      perProcess: [],
    };
  }

  // Precompute |Active(tau)| across [0, currentTick)
  const horizon = Math.max(0, currentTick);
  const activeCountPerTick = new Int32Array(horizon);
  for (const p of arrived) {
    const start = Math.max(0, Math.min(horizon, p.arrivalTime));
    const end =
      p.completionTime !== null ? Math.max(start, Math.min(horizon, p.completionTime)) : horizon;
    for (let t = start; t < end; t++) {
      activeCountPerTick[t] += 1;
    }
  }

  let maxWaitingTime = 0;
  let totalWaiting = 0;
  let exceedingCount = 0;
  const shareRatios: number[] = [];

  const perProcess: ProcessFairnessEntry[] = arrived.map((p) => {
    const serviceReceived = p.cpuBurstTime - p.remainingCpuTime;
    const start = Math.max(0, Math.min(horizon, p.arrivalTime));
    const end =
      p.completionTime !== null ? Math.max(start, Math.min(horizon, p.completionTime)) : horizon;

    let idealShare = 0;
    for (let t = start; t < end; t++) {
      const denom = activeCountPerTick[t];
      if (denom > 0) {
        idealShare += 1 / denom;
      }
    }
    const expectedServiceShare = Number(idealShare.toFixed(2));
    const serviceDeficit = Number(Math.max(0, expectedServiceShare - serviceReceived).toFixed(2));

    const eps = 0.5;
    const rawRatio = Math.min(2.0, (serviceReceived + eps) / (expectedServiceShare + eps));
    const serviceShareRatio = Number(rawRatio.toFixed(3));
    shareRatios.push(serviceShareRatio);

    if (p.waitingTime > maxWaitingTime) maxWaitingTime = p.waitingTime;
    totalWaiting += p.waitingTime;
    const exceeds = p.waitingTime >= threshold;
    if (exceeds) exceedingCount += 1;

    let starvationRisk: 'LOW' | 'MODERATE' | 'HIGH' = 'LOW';
    if (p.status !== 'COMPLETED') {
      if (p.waitingTime >= threshold || (serviceDeficit >= 3 && p.waitingTime >= threshold * 0.7)) {
        starvationRisk = 'HIGH';
      } else if (p.waitingTime >= Math.ceil(threshold * 0.5) || serviceDeficit >= 1.5) {
        starvationRisk = 'MODERATE';
      }
    } else if (exceeds) {
      // Completed after experiencing threshold breach — flag moderate historical starvation
      starvationRisk = 'MODERATE';
    }

    return {
      processId: p.id,
      processName: p.name,
      status: p.status,
      priority: p.priority,
      arrivalTime: p.arrivalTime,
      cpuBurstTime: p.cpuBurstTime,
      cpuServiceReceived: serviceReceived,
      expectedServiceShare,
      serviceShareRatio,
      serviceDeficit,
      waitingTime: p.waitingTime,
      exceedsWaitThreshold: exceeds,
      starvationRisk,
    };
  });

  const sumX = shareRatios.reduce((a, b) => a + b, 0);
  const sumXSq = shareRatios.reduce((a, b) => a + b * b, 0);
  const serviceShareFairnessIndex =
    sumXSq > 0 ? Number(Math.max(0, Math.min(1, (sumX * sumX) / (shareRatios.length * sumXSq))).toFixed(4)) : 1;

  const avgWaitingTime = Number((totalWaiting / arrived.length).toFixed(2));
  const activeHighRisk = perProcess.filter((p) => p.status !== 'COMPLETED' && p.starvationRisk === 'HIGH').length;
  const activeModerateRisk = perProcess.filter((p) => p.status !== 'COMPLETED' && p.starvationRisk === 'MODERATE').length;

  let starvationRiskLevel: 'LOW' | 'MODERATE' | 'HIGH' = 'LOW';
  if (activeHighRisk > 0 || exceedingCount >= Math.max(2, Math.ceil(arrived.length * 0.25))) {
    starvationRiskLevel = 'HIGH';
  } else if (activeModerateRisk > 0 || exceedingCount > 0 || serviceShareFairnessIndex < 0.75) {
    starvationRiskLevel = 'MODERATE';
  }

  return {
    currentTick,
    starvationThreshold: threshold,
    maxWaitingTime,
    avgWaitingTime,
    jainFairnessIndex,
    serviceShareFairnessIndex,
    exceedingThresholdCount: exceedingCount,
    starvationRiskLevel,
    matchesPretrainedRewardWeights: matchesPretrained,
    activeRewardPreset,
    formulaDescription,
    perProcess,
  };
}
