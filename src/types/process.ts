export type ProcessStatus = 'NEW' | 'BLOCKED' | 'READY' | 'RUNNING' | 'COMPLETED';

export type WorkloadType =
  | 'CPU_INTENSIVE'
  | 'MEMORY_INTENSIVE'
  | 'MIXED'
  | 'DYNAMIC'
  | 'CUSTOM';

export interface ProcessSpec {
  id: string;
  slotIndex: number;
  name: string;
  arrivalTime: number;
  cpuBurstTime: number;
  priority: number; // 1 (lowest) to 5 (highest)
  memoryDemand: number; // MB, 1..4096
}

export interface ProcessRecord extends ProcessSpec {
  remainingCpuTime: number;
  allocatedMemory: number;
  waitingTime: number;
  startTime: number | null;
  completionTime: number | null;
  turnaroundTime: number | null;
  responseTime: number | null;
  status: ProcessStatus;
}

export interface ProcessValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}
