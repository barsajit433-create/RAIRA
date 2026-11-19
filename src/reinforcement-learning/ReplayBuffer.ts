import { SeededRNG } from '../simulation/WorkloadGenerator';

export interface ReplayTransition {
  state: Float32Array;
  action: number;
  reward: number;
  nextState: Float32Array;
  nextActionMask: boolean[];
  elapsedTicks: number;
  terminated: boolean;
  truncated: boolean;
}

export class ReplayBuffer {
  readonly capacity: number;
  private buffer: ReplayTransition[] = [];
  private cursor: number = 0;

  constructor(capacity: number = 10000) {
    this.capacity = Math.max(64, capacity);
  }

  push(transition: ReplayTransition): void {
    const stored: ReplayTransition = {
      state: new Float32Array(transition.state),
      action: transition.action,
      reward: transition.reward,
      nextState: new Float32Array(transition.nextState),
      nextActionMask: [...transition.nextActionMask],
      elapsedTicks: Math.max(1, transition.elapsedTicks),
      terminated: transition.terminated,
      truncated: transition.truncated,
    };

    if (this.buffer.length < this.capacity) {
      this.buffer.push(stored);
    } else {
      this.buffer[this.cursor] = stored;
    }
    this.cursor = (this.cursor + 1) % this.capacity;
  }

  size(): number {
    return this.buffer.length;
  }

  clear(): void {
    this.buffer = [];
    this.cursor = 0;
  }

  sample(batchSize: number, rng: SeededRNG): ReplayTransition[] {
    const n = Math.min(batchSize, this.buffer.length);
    const result: ReplayTransition[] = [];
    for (let i = 0; i < n; i++) {
      const idx = rng.nextInt(0, this.buffer.length - 1);
      result.push(this.buffer[idx]);
    }
    return result;
  }
}
