import { SYSTEM_CONFIG } from '../types/simulation.ts';
import type { ProcessRecord } from '../types/process.ts';
import type { SimulationMetrics } from '../types/simulation.ts';

/**
 * Compute Jain's Fairness Index over normalized waiting-to-burst ratios.
 *
 * Ratio definition:
 *   x_i = (waitingTime_i + epsilon) / (cpuBurstTime_i + epsilon)
 * where epsilon = SYSTEM_CONFIG.FAIRNESS_SMOOTHING_EPSILON (1.0) prevents division
 * by zero and ensures that when all processes have identical ratios (including 0 wait),
 * J = 1.0.
 *
 * Jain's Fairness Index:
 *   J(x_1..x_n) = (sum(x_i))^2 / (n * sum(x_i^2))  in (0, 1]
 */
export function computeJainFairnessIndex(
  processes: ProcessRecord[],
  epsilon: number = SYSTEM_CONFIG.FAIRNESS_SMOOTHING_EPSILON
): number {
  const arrived = processes.filter((p) => p.status !== 'NEW');
  if (arrived.length <= 1) {
    return 1.0;
  }

  let sum = 0;
  let sumSq = 0;
  for (const p of arrived) {
    const ratio = (p.waitingTime + epsilon) / (p.cpuBurstTime + epsilon);
    sum += ratio;
    sumSq += ratio * ratio;
  }

  if (sumSq <= 0) {
    return 1.0;
  }

  const jain = (sum * sum) / (arrived.length * sumSq);
  return Math.max(0, Math.min(1, jain));
}

export function calculateSimulationMetrics(params: {
  processes: ProcessRecord[];
  currentTick: number;
  cpuBusyTicks: number;
  lastTickCpuBusy: boolean;
  cumulativeRamUtilPercent: number;
  currentRamUsedMb: number;
  totalRamMb: number;
  totalEpisodeReward: number;
  contextSwitches: number;
  invalidActionCount: number;
}): SimulationMetrics {
  const {
    processes,
    currentTick,
    cpuBusyTicks,
    lastTickCpuBusy,
    cumulativeRamUtilPercent,
    currentRamUsedMb,
    totalRamMb,
    totalEpisodeReward,
    contextSwitches,
    invalidActionCount,
  } = params;

  const readyCount = processes.filter((p) => p.status === 'READY').length;
  const blockedCount = processes.filter((p) => p.status === 'BLOCKED').length;
  const runningCount = processes.filter((p) => p.status === 'RUNNING').length;
  const completed = processes.filter((p) => p.status === 'COMPLETED');
  const arrived = processes.filter((p) => p.status !== 'NEW');
  const started = processes.filter((p) => p.responseTime !== null);

  const avgCpuUtilisation = currentTick > 0 ? (cpuBusyTicks / currentTick) * 100 : 0;
  const currentCpuUtilisation = lastTickCpuBusy ? 100 : 0;
  const currentRamUtilisation = (currentRamUsedMb / totalRamMb) * 100;
  const avgRamUtilisation = currentTick > 0 ? cumulativeRamUtilPercent / currentTick : currentRamUtilisation;
  const availableRamMb = totalRamMb - currentRamUsedMb;

  const avgWaitingTime =
    arrived.length > 0
      ? arrived.reduce((acc, p) => acc + p.waitingTime, 0) / arrived.length
      : 0;

  const avgTurnaroundTime =
    completed.length > 0
      ? completed.reduce((acc, p) => acc + (p.turnaroundTime ?? 0), 0) / completed.length
      : 0;

  const avgResponseTime =
    started.length > 0
      ? started.reduce((acc, p) => acc + (p.responseTime ?? 0), 0) / started.length
      : 0;

  const throughput = currentTick > 0 ? (completed.length / currentTick) * 100 : 0;
  const jainFairnessIndex = computeJainFairnessIndex(processes);

  return {
    currentTick,
    cpuBusyTicks,
    avgCpuUtilisation: Number(avgCpuUtilisation.toFixed(2)),
    currentCpuUtilisation,
    avgRamUtilisation: Number(avgRamUtilisation.toFixed(2)),
    currentRamUsedMb,
    currentRamUtilisation: Number(currentRamUtilisation.toFixed(2)),
    availableRamMb,
    activeProcessCount: readyCount + blockedCount + runningCount,
    readyCount,
    blockedCount,
    completedCount: completed.length,
    totalProcesses: processes.length,
    avgWaitingTime: Number(avgWaitingTime.toFixed(2)),
    avgTurnaroundTime: Number(avgTurnaroundTime.toFixed(2)),
    avgResponseTime: Number(avgResponseTime.toFixed(2)),
    throughput: Number(throughput.toFixed(2)),
    jainFairnessIndex: Number(jainFairnessIndex.toFixed(4)),
    totalEpisodeReward: Number(totalEpisodeReward.toFixed(3)),
    contextSwitches,
    invalidActionCount,
  };
}
