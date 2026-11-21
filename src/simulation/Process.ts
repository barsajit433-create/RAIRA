import { SYSTEM_CONFIG } from '../types/simulation.ts';
import type { ProcessRecord, ProcessSpec, ProcessValidationResult } from '../types/process.ts';

export function validateProcessInput(input: {
  name?: string;
  arrivalTime: number;
  cpuBurstTime: number;
  priority: number;
  memoryDemand: number;
}): ProcessValidationResult {
  const errors: Record<string, string> = {};

  const trimmedName = typeof input.name === 'string' ? input.name.trim() : '';
  if (trimmedName.length === 0) {
    errors.name = 'Process name is required.';
  } else if (trimmedName.length > 40) {
    errors.name = 'Process name must be 40 characters or fewer.';
  } else if (/[\u0000-\u001F\u007F]/.test(trimmedName)) {
    errors.name = 'Process name must not contain control characters.';
  }

  if (!Number.isInteger(input.arrivalTime) || input.arrivalTime < 0 || input.arrivalTime > 500) {
    errors.arrivalTime = 'Arrival time must be an integer between 0 and 500 ticks.';
  }

  if (!Number.isInteger(input.cpuBurstTime) || input.cpuBurstTime < 1 || input.cpuBurstTime > 100) {
    errors.cpuBurstTime = 'CPU burst time must be an integer between 1 and 100 ticks.';
  }

  if (!Number.isInteger(input.priority) || input.priority < 1 || input.priority > 5) {
    errors.priority = 'Priority must be an integer between 1 (lowest) and 5 (highest).';
  }

  if (
    !Number.isInteger(input.memoryDemand) ||
    input.memoryDemand < 16 ||
    input.memoryDemand > SYSTEM_CONFIG.TOTAL_RAM_MB
  ) {
    errors.memoryDemand = `Memory demand must be an integer between 16 MB and ${SYSTEM_CONFIG.TOTAL_RAM_MB} MB.`;
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function createProcessRecord(spec: ProcessSpec): ProcessRecord {
  return {
    ...spec,
    remainingCpuTime: spec.cpuBurstTime,
    allocatedMemory: 0,
    waitingTime: 0,
    startTime: null,
    completionTime: null,
    turnaroundTime: null,
    responseTime: null,
    status: 'NEW',
  };
}

export function cloneProcessSpec(spec: ProcessSpec): ProcessSpec {
  return { ...spec };
}

export function cloneProcessRecord(proc: ProcessRecord): ProcessRecord {
  return { ...proc };
}

export function formatProcessId(slotIndex: number): string {
  return `P${String(slotIndex + 1).padStart(2, '0')}`;
}
