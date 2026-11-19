import { SYSTEM_CONFIG } from '../types/simulation';
import type { ProcessRecord, ProcessStatus } from '../types/process';
import { decodeAction, WAIT_ACTION } from './ActionSpace';

export const OBSERVATION_SIZE = SYSTEM_CONFIG.OBSERVATION_SIZE; // 6 + 32 * 8 = 262
const GLOBAL_FEATURES = 6;
const FEATURES_PER_SLOT = 8;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function encodeProcessStatus(status: ProcessStatus): number {
  switch (status) {
    case 'NEW':
      return 0.2;
    case 'BLOCKED':
      return 0.4;
    case 'READY':
      return 0.6;
    case 'RUNNING':
      return 0.8;
    case 'COMPLETED':
      return 1.0;
  }
}

/**
 * Encodes environment state into a fixed normalized Float32Array of 262 features in [0, 1].
 *
 * 6 global features:
 *  0. availableRam / totalRam
 *  1. ramUtilisation (allocatedRam / totalRam)
 *  2. readyQueueLength / 32
 *  3. blockedQueueLength / 32
 *  4. activeArrivedCount / 32 (BLOCKED + READY + RUNNING)
 *  5. prevTickCpuBusy (0 or 1)
 *
 * 32 process slots x 8 features (empty slots are all 0.0; COMPLETED slots have
 * slotOccupied = 1.0, status = 1.0, remaining = 0, allocated = 0, timeToArrival = 0):
 *  0. slotOccupied (1.0 if assigned, 0.0 if empty)
 *  1. processStatus (NEW=0.2, BLOCKED=0.4, READY=0.6, RUNNING=0.8, COMPLETED=1.0)
 *  2. remainingCpuTime / 50
 *  3. memoryDemand / 4096
 *  4. allocatedMemory / 4096
 *  5. normalizedPriority ((priority - 1) / 4)
 *  6. waitingTime / 200
 *  7. timeToArrival / 50 (max(0, arrivalTime - currentTick) / 50)
 */
export function encodeObservation(params: {
  processes: ProcessRecord[];
  currentTick: number;
  availableRamMb: number;
  totalRamMb: number;
  prevTickCpuBusy: boolean;
}): Float32Array {
  const { processes, currentTick, availableRamMb, totalRamMb, prevTickCpuBusy } = params;
  const vec = new Float32Array(OBSERVATION_SIZE);

  const allocatedRamMb = totalRamMb - availableRamMb;
  let readyCount = 0;
  let blockedCount = 0;
  let runningCount = 0;

  for (const p of processes) {
    if (p.status === 'READY') readyCount++;
    else if (p.status === 'BLOCKED') blockedCount++;
    else if (p.status === 'RUNNING') runningCount++;
  }

  const activeArrivedCount = readyCount + blockedCount + runningCount;

  vec[0] = clamp01(availableRamMb / totalRamMb);
  vec[1] = clamp01(allocatedRamMb / totalRamMb);
  vec[2] = clamp01(readyCount / SYSTEM_CONFIG.MAX_PROCESSES);
  vec[3] = clamp01(blockedCount / SYSTEM_CONFIG.MAX_PROCESSES);
  vec[4] = clamp01(activeArrivedCount / SYSTEM_CONFIG.MAX_PROCESSES);
  vec[5] = prevTickCpuBusy ? 1.0 : 0.0;

  for (const proc of processes) {
    if (proc.slotIndex < 0 || proc.slotIndex >= SYSTEM_CONFIG.MAX_PROCESSES) {
      continue;
    }
    const offset = GLOBAL_FEATURES + proc.slotIndex * FEATURES_PER_SLOT;
    const timeToArrival = Math.max(0, proc.arrivalTime - currentTick);

    vec[offset] = 1.0;
    vec[offset + 1] = encodeProcessStatus(proc.status);
    vec[offset + 2] = clamp01(proc.remainingCpuTime / 50);
    vec[offset + 3] = clamp01(proc.memoryDemand / totalRamMb);
    vec[offset + 4] = clamp01(proc.allocatedMemory / totalRamMb);
    vec[offset + 5] = clamp01((proc.priority - 1) / 4);
    vec[offset + 6] = clamp01(proc.waitingTime / 200);
    vec[offset + 7] = clamp01(timeToArrival / 50);
  }

  return vec;
}

/**
 * Compact 9-feature discretised state representation for Tabular Q-Learning:
 *  1. RAM utilisation category (0..3)
 *  2. Ready queue category (0..3)
 *  3. Blocked queue category (0..3)
 *  4. CPU state (0=idle, 1=busy)
 *  5. Max normalized waiting time category (0..3)
 *  6. Highest ready process priority (0..5)
 *  7. Shortest ready CPU burst category (0..3)
 *  8. Existence of an admissible blocked process (0/1)
 *  9. Future arrival category (0..2)
 */
export function encodeCompactStateKey(params: {
  processes: ProcessRecord[];
  currentTick: number;
  availableRamMb: number;
  totalRamMb: number;
  prevTickCpuBusy: boolean;
}): string {
  const { processes, currentTick, availableRamMb, totalRamMb, prevTickCpuBusy } = params;
  const ramUtil = (totalRamMb - availableRamMb) / totalRamMb;
  const ramCat = ramUtil < 0.25 ? 0 : ramUtil < 0.55 ? 1 : ramUtil < 0.85 ? 2 : 3;

  const readyProcs = processes.filter((p) => p.status === 'READY' || p.status === 'RUNNING');
  const blockedProcs = processes.filter((p) => p.status === 'BLOCKED');
  const futureProcs = processes.filter((p) => p.status === 'NEW');

  const readyCat =
    readyProcs.length === 0 ? 0 : readyProcs.length <= 2 ? 1 : readyProcs.length <= 6 ? 2 : 3;
  const blockedCat =
    blockedProcs.length === 0 ? 0 : blockedProcs.length <= 2 ? 1 : blockedProcs.length <= 6 ? 2 : 3;
  const cpuState = prevTickCpuBusy ? 1 : 0;

  let maxWaitNorm = 0;
  for (const p of processes) {
    if (p.status === 'READY' || p.status === 'BLOCKED') {
      maxWaitNorm = Math.max(maxWaitNorm, clamp01(p.waitingTime / 200));
    }
  }
  const waitCat = maxWaitNorm < 0.05 ? 0 : maxWaitNorm < 0.15 ? 1 : maxWaitNorm < 0.35 ? 2 : 3;

  const highestReadyPrio =
    readyProcs.length > 0 ? Math.max(...readyProcs.map((p) => p.priority)) : 0;

  let shortestBurstCat = 0;
  if (readyProcs.length > 0) {
    const shortest = Math.min(...readyProcs.map((p) => p.remainingCpuTime));
    shortestBurstCat = shortest <= 3 ? 1 : shortest <= 10 ? 2 : 3;
  }

  const hasAdmissibleBlocked = blockedProcs.some((p) => p.memoryDemand <= availableRamMb) ? 1 : 0;

  let futureCat = 0;
  if (futureProcs.length > 0) {
    const soonest = Math.min(...futureProcs.map((p) => Math.max(0, p.arrivalTime - currentTick)));
    futureCat = soonest <= 5 ? 2 : 1;
  }

  return `R${ramCat}_Q${readyCat}_B${blockedCat}_C${cpuState}_W${waitCat}_P${highestReadyPrio}_S${shortestBurstCat}_A${hasAdmissibleBlocked}_F${futureCat}`;
}

/**
 * Candidate-aware state-action key for Tabular Q-Learning.
 * Differentiates process slots by their concrete candidate attributes relative to
 * competing processes, ensuring different process slots never collapse into identical
 * action values while enabling generalization across episodes.
 */
export function encodeCandidateStateActionKey(params: {
  compactStateKey: string;
  actionId: number;
  processes: ProcessRecord[];
  availableRamMb: number;
}): string {
  const { compactStateKey, actionId, processes, availableRamMb } = params;
  if (actionId === WAIT_ACTION) {
    return `${compactStateKey}|WAIT`;
  }

  const decoded = decodeAction(actionId);
  if (decoded.slotIndex === null || decoded.quantumIndex === null) {
    return `${compactStateKey}|WAIT`;
  }

  const proc = processes.find((p) => p.slotIndex === decoded.slotIndex);
  if (!proc) {
    return `${compactStateKey}|INVALID_${decoded.slotIndex}`;
  }

  const candidates = processes.filter(
    (p) =>
      p.status === 'READY' ||
      p.status === 'RUNNING' ||
      (p.status === 'BLOCKED' && p.memoryDemand <= availableRamMb)
  );

  const minRemaining =
    candidates.length > 0 ? Math.min(...candidates.map((c) => c.remainingCpuTime)) : proc.remainingCpuTime;
  const maxPriority =
    candidates.length > 0 ? Math.max(...candidates.map((c) => c.priority)) : proc.priority;
  const maxWait =
    candidates.length > 0 ? Math.max(...candidates.map((c) => c.waitingTime)) : proc.waitingTime;

  const statusTag = proc.status === 'BLOCKED' ? 'B' : 'R';
  const burstBucket =
    proc.remainingCpuTime <= 2 ? 0 : proc.remainingCpuTime <= 6 ? 1 : proc.remainingCpuTime <= 14 ? 2 : 3;
  const prioBucket = proc.priority >= 4 ? 2 : proc.priority >= 2 ? 1 : 0;
  const waitBucket = proc.waitingTime <= 5 ? 0 : proc.waitingTime <= 20 ? 1 : 2;
  const memBucket = proc.memoryDemand <= 512 ? 0 : proc.memoryDemand <= 1280 ? 1 : 2;
  const isShortest = proc.remainingCpuTime === minRemaining ? 1 : 0;
  const isHighestPrio = proc.priority === maxPriority ? 1 : 0;
  const isLongestWait = proc.waitingTime === maxWait && maxWait > 0 ? 1 : 0;
  const finishesInQuantum = proc.remainingCpuTime <= decoded.quantum ? 1 : 0;

  return `${compactStateKey}|${statusTag}_b${burstBucket}_p${prioBucket}_w${waitBucket}_m${memBucket}_sh${isShortest}_hp${isHighestPrio}_lw${isLongestWait}_fin${finishesInQuantum}_q${decoded.quantumIndex}`;
}
