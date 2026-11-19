import { SYSTEM_CONFIG } from '../types/simulation';
import type { ProcessRecord } from '../types/process';

export const ACTION_SPACE_SIZE = SYSTEM_CONFIG.ACTION_SPACE_SIZE; // 97
export const RL_QUANTA = SYSTEM_CONFIG.RL_QUANTA; // [1, 2, 4]
export const WAIT_ACTION = 0;

export interface DecodedAction {
  actionId: number;
  type: 'WAIT' | 'SCHEDULE';
  slotIndex: number | null;
  quantumIndex: number | null;
  quantum: number;
}

export function encodeAction(slotIndex: number, quantumIndex: number): number {
  if (
    slotIndex < 0 ||
    slotIndex >= SYSTEM_CONFIG.MAX_PROCESSES ||
    quantumIndex < 0 ||
    quantumIndex >= RL_QUANTA.length
  ) {
    throw new Error(`Invalid action encoding arguments: slot=${slotIndex}, quantumIndex=${quantumIndex}`);
  }
  return 1 + slotIndex * RL_QUANTA.length + quantumIndex;
}

export function decodeAction(actionId: number): DecodedAction {
  if (actionId === WAIT_ACTION) {
    return {
      actionId: WAIT_ACTION,
      type: 'WAIT',
      slotIndex: null,
      quantumIndex: null,
      quantum: 1,
    };
  }
  if (actionId < 1 || actionId >= ACTION_SPACE_SIZE) {
    return {
      actionId,
      type: 'WAIT',
      slotIndex: null,
      quantumIndex: null,
      quantum: 1,
    };
  }
  const offset = actionId - 1;
  const slotIndex = Math.floor(offset / RL_QUANTA.length);
  const quantumIndex = offset % RL_QUANTA.length;
  return {
    actionId,
    type: 'SCHEDULE',
    slotIndex,
    quantumIndex,
    quantum: RL_QUANTA[quantumIndex],
  };
}

/**
 * Compute boolean action mask of length 97.
 * Action 0 (WAIT) is always valid.
 * Process actions 1..96 are valid iff:
 * - process at slotIndex exists, has arrived, and is READY or RUNNING with full RAM reserved; OR
 * - process at slotIndex is BLOCKED and its full memoryDemand fits in availableRamMb.
 */
export function computeActionMask(
  processes: ProcessRecord[],
  availableRamMb: number
): boolean[] {
  const mask = new Array<boolean>(ACTION_SPACE_SIZE).fill(false);
  mask[WAIT_ACTION] = true;

  for (const proc of processes) {
    if (proc.slotIndex < 0 || proc.slotIndex >= SYSTEM_CONFIG.MAX_PROCESSES) {
      continue;
    }
    const isAdmittedRunnable =
      (proc.status === 'READY' || proc.status === 'RUNNING') &&
      proc.allocatedMemory === proc.memoryDemand &&
      proc.remainingCpuTime > 0;

    const isAdmissibleBlocked =
      proc.status === 'BLOCKED' &&
      proc.memoryDemand <= availableRamMb &&
      proc.remainingCpuTime > 0;

    if (isAdmittedRunnable || isAdmissibleBlocked) {
      const base = 1 + proc.slotIndex * RL_QUANTA.length;
      mask[base] = true;
      mask[base + 1] = true;
      mask[base + 2] = true;
    }
  }

  return mask;
}

export function getValidActionIndices(mask: boolean[]): number[] {
  const valid: number[] = [];
  for (let i = 0; i < mask.length; i++) {
    if (mask[i]) {
      valid.push(i);
    }
  }
  return valid;
}

export function formatActionLabel(actionId: number, processes: ProcessRecord[]): string {
  const decoded = decodeAction(actionId);
  if (decoded.type === 'WAIT' || decoded.slotIndex === null) {
    return 'WAIT (1 tick)';
  }
  const proc = processes.find((p) => p.slotIndex === decoded.slotIndex);
  const idLabel = proc ? proc.id : `Slot ${decoded.slotIndex}`;
  return `RUN ${idLabel} (q=${decoded.quantum})`;
}
