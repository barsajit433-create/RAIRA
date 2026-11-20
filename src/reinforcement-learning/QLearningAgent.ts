import type { ProcessRecord, WorkloadType } from '../types/process.ts';
import type {
  RLAgentSummary,
  SerializedQLearningModel,
  TrainingEpisodeMetric,
} from '../types/reinforcementLearning.ts';
import { SeededRNG } from '../simulation/WorkloadGenerator.ts';
import { getValidActionIndices, WAIT_ACTION } from './ActionSpace.ts';
import { encodeCandidateStateActionKey, encodeCompactStateKey } from './StateEncoder.ts';

export interface QLearningHyperparams {
  learningRate: number;
  discountFactor: number;
  epsilon: number;
  epsilonDecay: number;
  epsilonMin: number;
}

export const DEFAULT_QLEARNING_PARAMS: QLearningHyperparams = {
  learningRate: 0.15,
  discountFactor: 0.95,
  epsilon: 1.0,
  epsilonDecay: 0.96,
  epsilonMin: 0.05,
};

export class QLearningAgent {
  private qTable: Map<string, number> = new Map();
  private stateSet: Set<string> = new Set();
  private params: QLearningHyperparams;
  private rng: SeededRNG;

  private episodesTrained: number = 0;
  private totalUpdates: number = 0;
  private bestReward: number | null = null;
  private history: TrainingEpisodeMetric[] = [];
  private lastWorkload: WorkloadType | null = null;
  private lastSeed: number | null = null;

  constructor(params?: Partial<QLearningHyperparams>, seed: number = 42) {
    this.params = { ...DEFAULT_QLEARNING_PARAMS, ...params };
    this.rng = new SeededRNG(seed);
  }

  configure(params: Partial<QLearningHyperparams>, seed?: number): void {
    this.params = { ...this.params, ...params };
    if (seed !== undefined) {
      this.rng = new SeededRNG(seed);
      this.lastSeed = seed;
    }
  }

  reset(seed: number = 42): void {
    this.qTable.clear();
    this.stateSet.clear();
    this.params = { ...DEFAULT_QLEARNING_PARAMS };
    this.rng = new SeededRNG(seed);
    this.episodesTrained = 0;
    this.totalUpdates = 0;
    this.bestReward = null;
    this.history = [];
    this.lastWorkload = null;
    this.lastSeed = null;
  }

  isTrained(): boolean {
    return this.episodesTrained > 0 && this.qTable.size > 0;
  }

  getQValue(key: string): number {
    return this.qTable.get(key) ?? 0.0;
  }

  getEpsilon(): number {
    return this.params.epsilon;
  }

  getStateCount(): number {
    return this.stateSet.size;
  }

  getQTableEntryCount(): number {
    return this.qTable.size;
  }

  getHistory(): TrainingEpisodeMetric[] {
    return [...this.history];
  }

  /**
   * Evaluates Q(s, a) for every currently valid action without mutating agent state or RNG.
   * Used by the Explainable AI Decision Engine and Counterfactual What-If Laboratory.
   */
  evaluateValidActions(params: {
    processes: ProcessRecord[];
    currentTick: number;
    availableRamMb: number;
    totalRamMb: number;
    prevTickCpuBusy: boolean;
    actionMask: boolean[];
  }): {
    compactStateKey: string;
    validActionQValues: Array<{ actionId: number; qValue: number; stateActionKey: string }>;
  } {
    const validActions = getValidActionIndices(params.actionMask);
    const compactStateKey = encodeCompactStateKey({
      processes: params.processes,
      currentTick: params.currentTick,
      availableRamMb: params.availableRamMb,
      totalRamMb: params.totalRamMb,
      prevTickCpuBusy: params.prevTickCpuBusy,
    });

    const validActionQValues = validActions.map((actionId) => {
      const stateActionKey = encodeCandidateStateActionKey({
        compactStateKey,
        actionId,
        processes: params.processes,
        availableRamMb: params.availableRamMb,
      });
      return {
        actionId,
        qValue: this.getQValue(stateActionKey),
        stateActionKey,
      };
    });

    validActionQValues.sort((a, b) => b.qValue - a.qValue || a.actionId - b.actionId);
    return { compactStateKey, validActionQValues };
  }

  /**
   * Selects a valid masked action using epsilon-greedy exploration (during training)
   * or greedy exploitation (during evaluation, explore = false).
   */
  selectAction(params: {
    processes: ProcessRecord[];
    currentTick: number;
    availableRamMb: number;
    totalRamMb: number;
    prevTickCpuBusy: boolean;
    actionMask: boolean[];
    explore: boolean;
  }): { actionId: number; compactStateKey: string; stateActionKey: string } {
    const validActions = getValidActionIndices(params.actionMask);
    const compactStateKey = encodeCompactStateKey({
      processes: params.processes,
      currentTick: params.currentTick,
      availableRamMb: params.availableRamMb,
      totalRamMb: params.totalRamMb,
      prevTickCpuBusy: params.prevTickCpuBusy,
    });

    if (validActions.length === 0) {
      return {
        actionId: WAIT_ACTION,
        compactStateKey,
        stateActionKey: `${compactStateKey}|WAIT`,
      };
    }

    // Prefer non-WAIT actions when process actions exist during random exploration 85% of the time
    const processActions = validActions.filter((a) => a !== WAIT_ACTION);

    if (params.explore && this.rng.next() < this.params.epsilon) {
      const pool = processActions.length > 0 && this.rng.next() < 0.9 ? processActions : validActions;
      const chosen = pool[this.rng.nextInt(0, pool.length - 1)];
      const key = encodeCandidateStateActionKey({
        compactStateKey,
        actionId: chosen,
        processes: params.processes,
        availableRamMb: params.availableRamMb,
      });
      return { actionId: chosen, compactStateKey, stateActionKey: key };
    }

    // Greedy evaluation over valid actions with tie-breaking
    // When process actions are valid and we are evaluating greedily, break exact 0 ties in favor of non-WAIT
    let bestQ = -Infinity;
    let bestCandidates: Array<{ actionId: number; key: string }> = [];

    for (const actionId of validActions) {
      const key = encodeCandidateStateActionKey({
        compactStateKey,
        actionId,
        processes: params.processes,
        availableRamMb: params.availableRamMb,
      });
      const qVal = this.getQValue(key);
      if (qVal > bestQ + 1e-9) {
        bestQ = qVal;
        bestCandidates = [{ actionId, key }];
      } else if (Math.abs(qVal - bestQ) <= 1e-9) {
        bestCandidates.push({ actionId, key });
      }
    }

    // Avoid idle deadlock on exact tie when runnable processes exist
    const nonWaitBest = bestCandidates.filter((c) => c.actionId !== WAIT_ACTION);
    const tiePool = nonWaitBest.length > 0 ? nonWaitBest : bestCandidates;
    const picked = tiePool[this.rng.nextInt(0, tiePool.length - 1)];

    return {
      actionId: picked.actionId,
      compactStateKey,
      stateActionKey: picked.key,
    };
  }

  /**
   * SMDP Q-Learning update:
   *   Q(s, a) <- Q(s, a) + alpha * [R_tau + bootstrap * gamma^tau * max_{a' valid} Q(s', a') - Q(s, a)]
   *
   * Bootstrapping rule:
   * - Genuinely terminal episodes (terminated = true): bootstrap = 0 (no future value).
   * - Time-limit truncation (truncated = true, terminated = false): bootstrap = 1
   *   because the underlying OS workload did not naturally finish; horizon cut it off.
   */
  update(params: {
    compactStateKey: string;
    stateActionKey: string;
    reward: number;
    elapsedTicks: number;
    terminated: boolean;
    truncated: boolean;
    nextProcesses: ProcessRecord[];
    nextTick: number;
    nextAvailableRamMb: number;
    totalRamMb: number;
    nextPrevTickCpuBusy: boolean;
    nextActionMask: boolean[];
  }): number {
    const currentQ = this.getQValue(params.stateActionKey);
    let maxNextQ = 0;

    if (!params.terminated) {
      const nextValid = getValidActionIndices(params.nextActionMask);
      if (nextValid.length > 0) {
        const nextCompact = encodeCompactStateKey({
          processes: params.nextProcesses,
          currentTick: params.nextTick,
          availableRamMb: params.nextAvailableRamMb,
          totalRamMb: params.totalRamMb,
          prevTickCpuBusy: params.nextPrevTickCpuBusy,
        });
        maxNextQ = -Infinity;
        for (const nextAction of nextValid) {
          const nextKey = encodeCandidateStateActionKey({
            compactStateKey: nextCompact,
            actionId: nextAction,
            processes: params.nextProcesses,
            availableRamMb: params.nextAvailableRamMb,
          });
          const val = this.getQValue(nextKey);
          if (val > maxNextQ) maxNextQ = val;
        }
        if (!Number.isFinite(maxNextQ)) maxNextQ = 0;
      }
    }

    const tau = Math.max(1, params.elapsedTicks);
    const discountPowTau = Math.pow(this.params.discountFactor, tau);
    const target = params.reward + (params.terminated ? 0 : discountPowTau * maxNextQ);
    const tdError = target - currentQ;
    const updatedQ = currentQ + this.params.learningRate * tdError;

    this.stateSet.add(params.compactStateKey);
    this.qTable.set(params.stateActionKey, Number(updatedQ.toFixed(6)));
    this.totalUpdates += 1;

    return tdError;
  }

  endEpisode(metric: TrainingEpisodeMetric, workloadType: WorkloadType, seed: number): void {
    this.episodesTrained += 1;
    this.lastWorkload = workloadType;
    this.lastSeed = seed;
    if (this.bestReward === null || metric.totalReward > this.bestReward) {
      this.bestReward = metric.totalReward;
    }
    this.history.push(metric);
    if (this.history.length > 500) {
      this.history.shift();
    }
    this.params.epsilon = Math.max(
      this.params.epsilonMin,
      Number((this.params.epsilon * this.params.epsilonDecay).toFixed(6))
    );
  }

  getSummary(): RLAgentSummary {
    const avgReward =
      this.history.length > 0
        ? Number(
            (
              this.history.reduce((acc, m) => acc + m.totalReward, 0) / this.history.length
            ).toFixed(3)
          )
        : null;

    return {
      agentType: 'Q_LEARNING',
      isTrained: this.isTrained(),
      episodesTrained: this.episodesTrained,
      epsilon: Number(this.params.epsilon.toFixed(4)),
      learningRate: this.params.learningRate,
      discountFactor: this.params.discountFactor,
      epsilonDecay: this.params.epsilonDecay,
      epsilonMin: this.params.epsilonMin,
      qTableStates: this.stateSet.size,
      totalUpdates: this.totalUpdates,
      lastLoss: null,
      bestReward: this.bestReward !== null ? Number(this.bestReward.toFixed(3)) : null,
      averageReward: avgReward,
      lastWorkload: this.lastWorkload,
      lastSeed: this.lastSeed,
    };
  }

  serialize(): SerializedQLearningModel {
    const obj: Record<string, number> = {};
    for (const [k, v] of this.qTable.entries()) {
      obj[k] = v;
    }
    return {
      version: 'raira-qtable-v1',
      savedAt: new Date().toISOString(),
      config: { ...this.params },
      episodesTrained: this.episodesTrained,
      totalUpdates: this.totalUpdates,
      bestReward: this.bestReward,
      qTable: obj,
      history: [...this.history],
    };
  }

  deserialize(data: SerializedQLearningModel): void {
    if (!data || data.version !== 'raira-qtable-v1' || typeof data.qTable !== 'object') {
      throw new Error('Invalid Q-Learning model checkpoint format.');
    }
    this.qTable.clear();
    this.stateSet.clear();
    for (const [k, v] of Object.entries(data.qTable)) {
      if (typeof v === 'number' && Number.isFinite(v)) {
        this.qTable.set(k, v);
        const sep = k.indexOf('|');
        if (sep > 0) this.stateSet.add(k.slice(0, sep));
      }
    }
    this.params = { ...DEFAULT_QLEARNING_PARAMS, ...data.config };
    this.episodesTrained = data.episodesTrained ?? 0;
    this.totalUpdates = data.totalUpdates ?? 0;
    this.bestReward = data.bestReward ?? null;
    this.history = Array.isArray(data.history) ? [...data.history] : [];
  }
}
