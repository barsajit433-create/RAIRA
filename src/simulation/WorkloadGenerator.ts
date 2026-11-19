import { SYSTEM_CONFIG } from '../types/simulation';
import type { ProcessSpec, WorkloadType } from '../types/process';
import { formatProcessId } from './Process';

export class SeededRNG {
  private state: number;

  constructor(seed: number) {
    // Normalize seed to unsigned 32-bit integer
    this.state = (Math.floor(seed) >>> 0) || 1;
  }

  /** Mulberry32 deterministic PRNG returning float in [0, 1) */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  nextInt(min: number, max: number): number {
    const low = Math.ceil(min);
    const high = Math.floor(max);
    return Math.floor(this.next() * (high - low + 1)) + low;
  }

  pick<T>(items: readonly T[]): T {
    return items[this.nextInt(0, items.length - 1)];
  }
}

export interface WorkloadMetadata {
  type: Exclude<WorkloadType, 'CUSTOM'>;
  label: string;
  shortLabel: string;
  description: string;
  characteristics: string;
}

export const WORKLOAD_SCENARIOS: Record<Exclude<WorkloadType, 'CUSTOM'>, WorkloadMetadata> = {
  CPU_INTENSIVE: {
    type: 'CPU_INTENSIVE',
    label: 'CPU-Intensive Workload',
    shortLabel: 'CPU-Intensive',
    description:
      'Compute-bound tasks with long CPU bursts (12–34 ticks) and modest RAM footprints (128–640 MB). Stresses CPU scheduling efficiency, waiting times, and quantum sizing.',
    characteristics: 'Burst 12–34 ticks · RAM 128–640 MB · Tight arrival spread',
  },
  MEMORY_INTENSIVE: {
    type: 'MEMORY_INTENSIVE',
    label: 'Memory-Intensive Workload',
    shortLabel: 'Memory-Intensive',
    description:
      'Memory-heavy jobs requiring 768–2048 MB of RAM each with moderate CPU bursts (4–14 ticks). Creates frequent RAM contention where admission order governs blocking and throughput.',
    characteristics: 'Burst 4–14 ticks · RAM 768–2048 MB · High RAM contention',
  },
  MIXED: {
    type: 'MIXED',
    label: 'Mixed Workload',
    shortLabel: 'Mixed',
    description:
      'Balanced combination of compute-heavy tasks, memory-heavy analytics jobs, and short interactive utilities competing for both single-core CPU and 4096 MB RAM.',
    characteristics: 'Heterogeneous bursts (2–28 ticks) · RAM 128–1920 MB',
  },
  DYNAMIC: {
    type: 'DYNAMIC',
    label: 'Dynamic Workload',
    shortLabel: 'Dynamic',
    description:
      'Staggered multi-wave process arrivals across simulation ticks with shifting CPU/RAM demand profiles and varying priorities (1–5). Evaluates adaptive preemption and admission.',
    characteristics: 'Staggered arrivals (0–45 ticks) · Shifting demand · Priorities 1–5',
  },
};

const CPU_TASK_NAMES = [
  'matrix-mul',
  'fft-solver',
  'ray-tracer',
  'crypto-hash',
  'neural-eval',
  'llvm-opt',
  'sim-kernel',
  'monte-carlo',
];

const MEM_TASK_NAMES = [
  'inmem-index',
  'graph-cache',
  'tensor-buf',
  'parquet-scan',
  'heap-sort',
  'kv-compactor',
  'frame-buffer',
  'bio-align',
];

const MIXED_TASK_NAMES = [
  'http-worker',
  'sql-planner',
  'log-indexer',
  'video-trans',
  'ml-prep',
  'io-scheduler',
  'cache-sync',
  'rpc-gateway',
];

function roundMemoryTo64(mb: number): number {
  const clamped = Math.max(64, Math.min(SYSTEM_CONFIG.TOTAL_RAM_MB, mb));
  return Math.round(clamped / 64) * 64;
}

export function generateWorkload(
  workloadType: Exclude<WorkloadType, 'CUSTOM'>,
  count: number,
  seed: number
): ProcessSpec[] {
  const safeCount = Math.max(1, Math.min(SYSTEM_CONFIG.MAX_PROCESSES, Math.floor(count)));
  const rng = new SeededRNG(seed);
  const specs: ProcessSpec[] = [];

  for (let i = 0; i < safeCount; i++) {
    let arrivalTime = 0;
    let cpuBurstTime = 6;
    let memoryDemand = 512;
    let priority = rng.nextInt(1, 5);
    let baseName = 'proc';

    switch (workloadType) {
      case 'CPU_INTENSIVE': {
        arrivalTime = i < 3 ? 0 : rng.nextInt(0, Math.min(18, safeCount * 2));
        cpuBurstTime = rng.nextInt(12, 34);
        memoryDemand = roundMemoryTo64(rng.nextInt(128, 640));
        priority = rng.nextInt(1, 5);
        baseName = rng.pick(CPU_TASK_NAMES);
        break;
      }
      case 'MEMORY_INTENSIVE': {
        arrivalTime = i < 4 ? 0 : rng.nextInt(0, Math.min(20, safeCount * 2));
        cpuBurstTime = rng.nextInt(4, 14);
        memoryDemand = roundMemoryTo64(rng.nextInt(768, 2048));
        priority = rng.nextInt(1, 5);
        baseName = rng.pick(MEM_TASK_NAMES);
        break;
      }
      case 'MIXED': {
        const archetype = i % 3;
        arrivalTime = i < 3 ? 0 : rng.nextInt(0, Math.min(24, safeCount * 2));
        if (archetype === 0) {
          // CPU heavy
          cpuBurstTime = rng.nextInt(14, 28);
          memoryDemand = roundMemoryTo64(rng.nextInt(192, 640));
          baseName = rng.pick(CPU_TASK_NAMES);
        } else if (archetype === 1) {
          // Memory heavy
          cpuBurstTime = rng.nextInt(5, 13);
          memoryDemand = roundMemoryTo64(rng.nextInt(1024, 1920));
          baseName = rng.pick(MEM_TASK_NAMES);
        } else {
          // Short interactive utility
          cpuBurstTime = rng.nextInt(2, 7);
          memoryDemand = roundMemoryTo64(rng.nextInt(128, 512));
          baseName = rng.pick(MIXED_TASK_NAMES);
        }
        priority = rng.nextInt(1, 5);
        break;
      }
      case 'DYNAMIC': {
        // Multi-wave arrival pattern with shifting resource pressure
        const wave = Math.floor((i / Math.max(1, safeCount)) * 4);
        if (wave === 0) {
          arrivalTime = rng.nextInt(0, 4);
          cpuBurstTime = rng.nextInt(4, 12);
          memoryDemand = roundMemoryTo64(rng.nextInt(512, 1280));
          baseName = rng.pick(MIXED_TASK_NAMES);
        } else if (wave === 1) {
          arrivalTime = rng.nextInt(6, 16);
          cpuBurstTime = rng.nextInt(10, 24);
          memoryDemand = roundMemoryTo64(rng.nextInt(256, 768));
          baseName = rng.pick(CPU_TASK_NAMES);
        } else if (wave === 2) {
          arrivalTime = rng.nextInt(18, 30);
          cpuBurstTime = rng.nextInt(5, 15);
          memoryDemand = roundMemoryTo64(rng.nextInt(1024, 2048));
          baseName = rng.pick(MEM_TASK_NAMES);
        } else {
          arrivalTime = rng.nextInt(31, 45);
          cpuBurstTime = rng.nextInt(3, 18);
          memoryDemand = roundMemoryTo64(rng.nextInt(256, 1536));
          baseName = rng.pick(MIXED_TASK_NAMES);
        }
        priority = rng.nextInt(1, 5);
        break;
      }
    }

    specs.push({
      id: formatProcessId(i),
      slotIndex: i,
      name: `${baseName}-${String(i + 1).padStart(2, '0')}`,
      arrivalTime,
      cpuBurstTime,
      priority,
      memoryDemand,
    });
  }

  // Sort by arrivalTime ascending, then reassign stable slotIndex & id
  specs.sort((a, b) => a.arrivalTime - b.arrivalTime || a.slotIndex - b.slotIndex);
  return specs.map((spec, idx) => ({
    ...spec,
    id: formatProcessId(idx),
    slotIndex: idx,
  }));
}
