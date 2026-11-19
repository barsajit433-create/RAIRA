import { DEFAULT_REWARD_WEIGHTS } from '../types/simulation.ts';
import type { ProcessRecord } from '../types/process.ts';
import type { RewardBreakdown, RewardWeights } from '../types/simulation.ts';
import { computeJainFairnessIndex } from '../simulation/MetricsCalculator.ts';

export function emptyRewardBreakdown(): RewardBreakdown {
  return {
    rCpu: 0,
    rCompletion: 0,
    pWaiting: 0,
    pTurnaround: 0,
    rFairness: 0,
    pInvalid: 0,
    total: 0,
  };
}

/**
 * Calculates single-tick reward breakdown:
 *   R_step = R_cpu + R_completion - P_waiting - P_turnaround + R_fairness - P_invalid
 *
 * Safeguards:
 * - Idle CPU ticks NEVER earn a positive CPU utilisation reward (rCpu = 0).
 * - Waiting penalty is charged incrementally per tick (waitingProcessCount * waitingPenaltyWeight),
 *   never repeatedly charging cumulative waiting time.
 * - Turnaround penalty is charged exactly once when a process completes.
 * - Fairness uses Jain's Fairness Index over smoothed waiting-to-burst ratios.
 */
export function calculateTickReward(params: {
  cpuBusy: boolean;
  completedProcess: ProcessRecord | null;
  waitingProcessCount: number;
  processes: ProcessRecord[];
  invalidAction: boolean;
  weights?: RewardWeights;
}): RewardBreakdown {
  const w = params.weights ?? DEFAULT_REWARD_WEIGHTS;

  const rCpu = params.cpuBusy ? w.cpuRewardWeight : 0;
  const rCompletion = params.completedProcess
    ? w.completionBaseBonus + w.priorityCompletionBonus * params.completedProcess.priority
    : 0;
  const pWaiting = params.waitingProcessCount * w.waitingPenaltyWeight;
  const pTurnaround =
    params.completedProcess && params.completedProcess.turnaroundTime !== null
      ? params.completedProcess.turnaroundTime * w.turnaroundPenaltyWeight
      : 0;
  const jain = computeJainFairnessIndex(params.processes);
  const rFairness = params.cpuBusy || params.waitingProcessCount > 0 ? w.fairnessWeight * jain : 0;
  const pInvalid = params.invalidAction ? w.invalidActionPenalty : 0;

  const total = rCpu + rCompletion - pWaiting - pTurnaround + rFairness - pInvalid;

  return {
    rCpu: Number(rCpu.toFixed(4)),
    rCompletion: Number(rCompletion.toFixed(4)),
    pWaiting: Number(pWaiting.toFixed(4)),
    pTurnaround: Number(pTurnaround.toFixed(4)),
    rFairness: Number(rFairness.toFixed(4)),
    pInvalid: Number(pInvalid.toFixed(4)),
    total: Number(total.toFixed(4)),
  };
}

/**
 * Accumulates multi-tick rewards using SMDP geometric discounting:
 *   R_tau = sum_{k=0}^{tau-1} (gamma^k * r_k)
 */
export function accumulateDiscountedRewards(
  tickBreakdowns: RewardBreakdown[],
  gamma: number
): RewardBreakdown {
  let rCpu = 0;
  let rCompletion = 0;
  let pWaiting = 0;
  let pTurnaround = 0;
  let rFairness = 0;
  let pInvalid = 0;
  let total = 0;

  let discount = 1.0;
  for (let k = 0; k < tickBreakdowns.length; k++) {
    const b = tickBreakdowns[k];
    rCpu += discount * b.rCpu;
    rCompletion += discount * b.rCompletion;
    pWaiting += discount * b.pWaiting;
    pTurnaround += discount * b.pTurnaround;
    rFairness += discount * b.rFairness;
    pInvalid += discount * b.pInvalid;
    total += discount * b.total;
    discount *= gamma;
  }

  return {
    rCpu: Number(rCpu.toFixed(4)),
    rCompletion: Number(rCompletion.toFixed(4)),
    pWaiting: Number(pWaiting.toFixed(4)),
    pTurnaround: Number(pTurnaround.toFixed(4)),
    rFairness: Number(rFairness.toFixed(4)),
    pInvalid: Number(pInvalid.toFixed(4)),
    total: Number(total.toFixed(4)),
  };
}
