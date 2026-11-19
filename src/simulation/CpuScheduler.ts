import type { ProcessRecord } from '../types/process.ts';
import type { AlgorithmType } from '../types/simulation.ts';
import { ResourceManager } from './ResourceManager.ts';

export type BaselineAlgorithm = Extract<AlgorithmType, 'FCFS' | 'RR' | 'PRIORITY'>;

export interface BaselineSchedulerState {
  rrQueue: number[]; // slot indices in Round Robin ready queue
  rrSliceRemaining: number;
}

export function createBaselineSchedulerState(): BaselineSchedulerState {
  return {
    rrQueue: [],
    rrSliceRemaining: 0,
  };
}

/**
 * Admits BLOCKED processes into READY whenever full memory demand fits available RAM.
 * FCFS and RR admit in earliest-arrival order; PRIORITY admits highest priority first
 * with arrival order tie-breaking.
 */
export function admitBlockedProcessesForBaseline(
  algorithm: BaselineAlgorithm,
  processes: ProcessRecord[],
  resourceManager: ResourceManager,
  schedulerState: BaselineSchedulerState
): ProcessRecord[] {
  const blocked = processes.filter((p) => p.status === 'BLOCKED');
  if (blocked.length === 0) return [];

  if (algorithm === 'PRIORITY') {
    blocked.sort(
      (a, b) =>
        b.priority - a.priority ||
        a.arrivalTime - b.arrivalTime ||
        a.slotIndex - b.slotIndex
    );
  } else {
    blocked.sort((a, b) => a.arrivalTime - b.arrivalTime || a.slotIndex - b.slotIndex);
  }

  const admitted: ProcessRecord[] = [];
  for (const proc of blocked) {
    if (resourceManager.allocate(proc)) {
      proc.status = 'READY';
      admitted.push(proc);
      if (algorithm === 'RR' && !schedulerState.rrQueue.includes(proc.slotIndex)) {
        schedulerState.rrQueue.push(proc.slotIndex);
      }
    }
  }

  return admitted;
}

/**
 * Selects the next process slot to execute on the single CPU core for baseline schedulers.
 * - FCFS: non-preemptive, earliest arrived READY process.
 * - Priority: non-preemptive, priority 5 highest -> 1 lowest, tie-break by arrivalTime then slotIndex.
 * - Round Robin: preemptive rotation using rrQueue and configurable quantum.
 */
export function selectBaselineProcessSlot(params: {
  algorithm: BaselineAlgorithm;
  processes: ProcessRecord[];
  currentRunningSlot: number | null;
  rrQuantum: number;
  schedulerState: BaselineSchedulerState;
}): number | null {
  const { algorithm, processes, currentRunningSlot, rrQuantum, schedulerState } = params;

  const runningProc =
    currentRunningSlot !== null
      ? processes.find((p) => p.slotIndex === currentRunningSlot && p.status === 'RUNNING')
      : undefined;

  if (algorithm === 'FCFS') {
    if (runningProc && runningProc.remainingCpuTime > 0) {
      return runningProc.slotIndex;
    }
    const ready = processes
      .filter((p) => p.status === 'READY' && p.remainingCpuTime > 0)
      .sort((a, b) => a.arrivalTime - b.arrivalTime || a.slotIndex - b.slotIndex);
    return ready.length > 0 ? ready[0].slotIndex : null;
  }

  if (algorithm === 'PRIORITY') {
    if (runningProc && runningProc.remainingCpuTime > 0) {
      return runningProc.slotIndex;
    }
    const ready = processes
      .filter((p) => p.status === 'READY' && p.remainingCpuTime > 0)
      .sort(
        (a, b) =>
          b.priority - a.priority ||
          a.arrivalTime - b.arrivalTime ||
          a.slotIndex - b.slotIndex
      );
    return ready.length > 0 ? ready[0].slotIndex : null;
  }

  // Round Robin
  if (runningProc && runningProc.remainingCpuTime > 0 && schedulerState.rrSliceRemaining > 0) {
    return runningProc.slotIndex;
  }

  // Clean up any stale entries from rrQueue and pick head
  while (schedulerState.rrQueue.length > 0) {
    const nextSlot = schedulerState.rrQueue.shift()!;
    const candidate = processes.find((p) => p.slotIndex === nextSlot);
    if (candidate && candidate.status === 'READY' && candidate.remainingCpuTime > 0) {
      schedulerState.rrSliceRemaining = Math.max(1, rrQuantum);
      return candidate.slotIndex;
    }
  }

  // Fallback check if any READY process wasn't queued yet
  const fallbackReady = processes
    .filter((p) => p.status === 'READY' && p.remainingCpuTime > 0)
    .sort((a, b) => a.arrivalTime - b.arrivalTime || a.slotIndex - b.slotIndex);
  if (fallbackReady.length > 0) {
    schedulerState.rrSliceRemaining = Math.max(1, rrQuantum);
    return fallbackReady[0].slotIndex;
  }

  return null;
}
