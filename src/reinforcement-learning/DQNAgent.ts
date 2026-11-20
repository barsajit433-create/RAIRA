import type { WorkloadType } from '../types/process.ts';
import type {
  DQNDependencyStatus,
  RLAgentSummary,
  SerializedDQNModel,
  TrainingEpisodeMetric,
} from '../types/reinforcementLearning.ts';
import { SeededRNG } from '../simulation/WorkloadGenerator.ts';
import { ACTION_SPACE_SIZE, getValidActionIndices, WAIT_ACTION } from './ActionSpace.ts';
import { OBSERVATION_SIZE } from './StateEncoder.ts';
import { ReplayBuffer, type ReplayTransition } from './ReplayBuffer.ts';
import {
  buildDQNModel,
  copyModelWeights,
  deserializeModelWeights,
  DQN_ARCHITECTURE,
  getModelParameterCount,
  initializeTensorFlow,
  serializeModelWeights,
  tf,
} from './NeuralNetwork.ts';

export interface DQNHyperparams {
  learningRate: number;
  discountFactor: number;
  epsilon: number;
  epsilonDecay: number;
  epsilonMin: number;
  batchSize: number;
  targetUpdateFreq: number;
  gradientClipNorm: number;
  replayCapacity: number;
}

export const DEFAULT_DQN_PARAMS: DQNHyperparams = {
  learningRate: 0.001,
  discountFactor: 0.95,
  epsilon: 1.0,
  epsilonDecay: 0.96,
  epsilonMin: 0.05,
  batchSize: 32,
  targetUpdateFreq: 20,
  gradientClipNorm: 1.0,
  replayCapacity: 8000,
};

export class DQNAgent {
  private onlineNetwork: tf.Sequential | null = null;
  private targetNetwork: tf.Sequential | null = null;
  private optimizer: tf.AdamOptimizer | null = null;
  private replayBuffer: ReplayBuffer;
  private params: DQNHyperparams;
  private rng: SeededRNG;

  private dependencyStatus: DQNDependencyStatus = {
    available: false,
    backend: null,
    version: null,
    error: 'DQN has not been initialized yet.',
    parameterCount: null,
  };

  private episodesTrained: number = 0;
  private totalUpdates: number = 0;
  private lastLoss: number | null = null;
  private bestReward: number | null = null;
  private history: TrainingEpisodeMetric[] = [];
  private lastWorkload: WorkloadType | null = null;
  private lastSeed: number | null = null;
  private initialized: boolean = false;

  constructor(params?: Partial<DQNHyperparams>, seed: number = 42) {
    this.params = { ...DEFAULT_DQN_PARAMS, ...params };
    this.rng = new SeededRNG(seed);
    this.replayBuffer = new ReplayBuffer(this.params.replayCapacity);
  }

  async initialize(seed?: number): Promise<DQNDependencyStatus> {
    if (this.initialized && this.onlineNetwork && this.targetNetwork) {
      return this.dependencyStatus;
    }

    const tfStatus = await initializeTensorFlow();
    if (!tfStatus.available) {
      this.dependencyStatus = tfStatus;
      this.initialized = false;
      return this.dependencyStatus;
    }

    try {
      this.disposeModels();
      this.onlineNetwork = buildDQNModel(seed);
      this.targetNetwork = buildDQNModel(seed);
      copyModelWeights(this.onlineNetwork, this.targetNetwork);
      this.optimizer = tf.train.adam(this.params.learningRate);
      const paramCount = getModelParameterCount(this.onlineNetwork);

      this.dependencyStatus = {
        available: true,
        backend: tfStatus.backend,
        version: tfStatus.version,
        error: null,
        parameterCount: paramCount,
      };
      this.initialized = true;
      return this.dependencyStatus;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.dependencyStatus = {
        available: false,
        backend: tfStatus.backend,
        version: tfStatus.version,
        error: `Failed to construct DQN model in TensorFlow.js: ${msg}`,
        parameterCount: null,
      };
      this.initialized = false;
      return this.dependencyStatus;
    }
  }

  private disposeModels(): void {
    if (this.onlineNetwork) {
      this.onlineNetwork.dispose();
      this.onlineNetwork = null;
    }
    if (this.targetNetwork) {
      this.targetNetwork.dispose();
      this.targetNetwork = null;
    }
    if (this.optimizer) {
      this.optimizer.dispose();
      this.optimizer = null;
    }
  }

  configure(params: Partial<DQNHyperparams>, seed?: number): void {
    const lrChanged = params.learningRate !== undefined && params.learningRate !== this.params.learningRate;
    this.params = { ...this.params, ...params };
    if (seed !== undefined) {
      this.rng = new SeededRNG(seed);
      this.lastSeed = seed;
    }
    if (lrChanged && this.initialized) {
      if (this.optimizer) this.optimizer.dispose();
      this.optimizer = tf.train.adam(this.params.learningRate);
    }
  }

  async reset(seed: number = 42): Promise<DQNDependencyStatus> {
    this.disposeModels();
    this.initialized = false;
    this.params = { ...DEFAULT_DQN_PARAMS };
    this.rng = new SeededRNG(seed);
    this.replayBuffer.clear();
    this.episodesTrained = 0;
    this.totalUpdates = 0;
    this.lastLoss = null;
    this.bestReward = null;
    this.history = [];
    this.lastWorkload = null;
    this.lastSeed = null;
    return this.initialize(seed);
  }

  isAvailable(): boolean {
    return this.initialized && this.dependencyStatus.available && this.onlineNetwork !== null;
  }

  isTrained(): boolean {
    return this.isAvailable() && this.episodesTrained > 0 && this.totalUpdates > 0;
  }

  getDependencyStatus(): DQNDependencyStatus {
    return { ...this.dependencyStatus };
  }

  getEpsilon(): number {
    return this.params.epsilon;
  }

  getHistory(): TrainingEpisodeMetric[] {
    return [...this.history];
  }

  /**
   * Selects a valid action using valid-action masking over online network Q-values.
   * Throws an explicit error if TensorFlow.js / DQN model is not available (never substitutes random actions).
   */
  selectAction(observation: Float32Array, actionMask: boolean[], explore: boolean): number {
    if (!this.isAvailable() || !this.onlineNetwork) {
      throw new Error(
        this.dependencyStatus.error ?? 'DQN dependency unavailable: TensorFlow.js model is not initialized.'
      );
    }

    const validActions = getValidActionIndices(actionMask);
    if (validActions.length === 0) {
      return WAIT_ACTION;
    }

    const processActions = validActions.filter((a) => a !== WAIT_ACTION);

    if (explore && this.rng.next() < this.params.epsilon) {
      const pool = processActions.length > 0 && this.rng.next() < 0.9 ? processActions : validActions;
      return pool[this.rng.nextInt(0, pool.length - 1)];
    }

    const qValues = tf.tidy(() => {
      const inputTensor = tf.tensor2d(observation, [1, OBSERVATION_SIZE], 'float32');
      const output = this.onlineNetwork!.predict(inputTensor) as tf.Tensor;
      return Array.from(output.dataSync());
    });

    const candidateActions = !explore && processActions.length > 0 ? processActions : validActions;
    let bestAction = candidateActions[0];
    let bestValue = -Infinity;
    for (const actionId of candidateActions) {
      const val = qValues[actionId];
      if (val > bestValue) {
        bestValue = val;
        bestAction = actionId;
      }
    }

    return bestAction;
  }

  storeTransition(transition: ReplayTransition): void {
    this.replayBuffer.push(transition);
  }

  /**
   * Performs one SMDP DQN gradient update step using:
   * - Replay buffer sampling (with stored nextActionMask & elapsedTicks)
   * - Target = R_tau + (terminated ? 0 : gamma^tau * max_{a' valid} Q_target(s', a'))
   * - Huber loss
   * - Gradient norm clipping (global L2 norm <= gradientClipNorm)
   * - Adam optimizer
   * - Periodic target network sync
   */
  trainStep(): number | null {
    if (!this.isAvailable() || !this.onlineNetwork || !this.targetNetwork || !this.optimizer) {
      throw new Error(
        this.dependencyStatus.error ?? 'DQN dependency unavailable: cannot execute training step.'
      );
    }

    const batchSize = Math.min(this.params.batchSize, this.replayBuffer.size());
    if (batchSize < Math.min(8, this.params.batchSize)) {
      return null;
    }

    const batch = this.replayBuffer.sample(batchSize, this.rng);

    const statesFlat = new Float32Array(batchSize * OBSERVATION_SIZE);
    const nextStatesFlat = new Float32Array(batchSize * OBSERVATION_SIZE);
    const actions = new Int32Array(batchSize);

    for (let i = 0; i < batchSize; i++) {
      statesFlat.set(batch[i].state, i * OBSERVATION_SIZE);
      nextStatesFlat.set(batch[i].nextState, i * OBSERVATION_SIZE);
      actions[i] = batch[i].action;
    }

    // Compute masked target values using target network without gradient tracking
    const targetQValues = new Float32Array(batchSize);
    tf.tidy(() => {
      const nextStateTensor = tf.tensor2d(nextStatesFlat, [batchSize, OBSERVATION_SIZE], 'float32');
      const nextQPred = this.targetNetwork!.predict(nextStateTensor) as tf.Tensor2D;
      const nextQData = nextQPred.dataSync();

      for (let i = 0; i < batchSize; i++) {
        const tr = batch[i];
        let maxNextValidQ = 0;

        // No bootstrapping on genuinely terminal episodes; bootstrap on time-limit truncation
        if (!tr.terminated) {
          maxNextValidQ = -Infinity;
          const rowOffset = i * ACTION_SPACE_SIZE;
          for (let a = 0; a < ACTION_SPACE_SIZE; a++) {
            if (tr.nextActionMask[a]) {
              const q = nextQData[rowOffset + a];
              if (q > maxNextValidQ) maxNextValidQ = q;
            }
          }
          if (!Number.isFinite(maxNextValidQ)) {
            maxNextValidQ = 0;
          }
        }

        const discountPowTau = Math.pow(this.params.discountFactor, Math.max(1, tr.elapsedTicks));
        targetQValues[i] = tr.reward + (tr.terminated ? 0 : discountPowTau * maxNextValidQ);
      }
    });

    // Compute Huber loss & gradients via tf.variableGrads, apply gradient clipping, update online network
    const lossVal = tf.tidy(() => {
      const stateTensor = tf.tensor2d(statesFlat, [batchSize, OBSERVATION_SIZE], 'float32');
      const actionIndices = tf.tensor1d(actions, 'int32');
      const actionOneHot = tf.oneHot(actionIndices, ACTION_SPACE_SIZE);
      const targetTensor = tf.tensor1d(targetQValues, 'float32');

      const trainableVars = this.onlineNetwork!.trainableWeights.map(
        (w) => (w as unknown as { val: tf.Variable }).val
      );

      const { value: lossTensor, grads } = tf.variableGrads(() => {
        const predictedQAll = this.onlineNetwork!.apply(stateTensor, { training: true }) as tf.Tensor2D;
        const predictedChosenQ = tf.sum(tf.mul(predictedQAll, actionOneHot), 1);
        return tf.losses.huberLoss(targetTensor, predictedChosenQ, undefined, 1.0) as tf.Scalar;
      }, trainableVars);

      // Global L2 norm gradient clipping
      const clipNorm = this.params.gradientClipNorm;
      const gradEntries = Object.entries(grads);
      let globalNormSq = tf.scalar(0);
      for (const [, g] of gradEntries) {
        globalNormSq = tf.add(globalNormSq, tf.sum(tf.square(g)));
      }
      const globalNorm = tf.sqrt(globalNormSq);
      const clipScale = tf.minimum(tf.scalar(1.0), tf.div(tf.scalar(clipNorm), tf.add(globalNorm, tf.scalar(1e-6))));

      const clippedGrads: Array<{ name: string; tensor: tf.Tensor }> = gradEntries.map(
        ([name, g]) => ({
          name,
          tensor: tf.mul(g, clipScale),
        })
      );

      this.optimizer!.applyGradients(clippedGrads);

      return Number(lossTensor.dataSync()[0]);
    });

    this.totalUpdates += 1;
    this.lastLoss = Number.isFinite(lossVal) ? Number(lossVal.toFixed(5)) : this.lastLoss;

    if (this.totalUpdates % this.params.targetUpdateFreq === 0) {
      copyModelWeights(this.onlineNetwork, this.targetNetwork);
    }

    return this.lastLoss;
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
      agentType: 'DQN',
      isTrained: this.isTrained(),
      episodesTrained: this.episodesTrained,
      epsilon: Number(this.params.epsilon.toFixed(4)),
      learningRate: this.params.learningRate,
      discountFactor: this.params.discountFactor,
      epsilonDecay: this.params.epsilonDecay,
      epsilonMin: this.params.epsilonMin,
      qTableStates: 0,
      totalUpdates: this.totalUpdates,
      lastLoss: this.lastLoss,
      bestReward: this.bestReward !== null ? Number(this.bestReward.toFixed(3)) : null,
      averageReward: avgReward,
      lastWorkload: this.lastWorkload,
      lastSeed: this.lastSeed,
      dqnStatus: this.getDependencyStatus(),
    };
  }

  serialize(): SerializedDQNModel {
    if (!this.isAvailable() || !this.onlineNetwork) {
      throw new Error('Cannot save DQN model: TensorFlow.js network is not initialized.');
    }
    return {
      version: 'raira-dqn-v1',
      savedAt: new Date().toISOString(),
      architecture: { ...DQN_ARCHITECTURE },
      config: {
        learningRate: this.params.learningRate,
        discountFactor: this.params.discountFactor,
        epsilon: this.params.epsilon,
        epsilonDecay: this.params.epsilonDecay,
        epsilonMin: this.params.epsilonMin,
        batchSize: this.params.batchSize,
        targetUpdateFreq: this.params.targetUpdateFreq,
      },
      episodesTrained: this.episodesTrained,
      totalUpdates: this.totalUpdates,
      bestReward: this.bestReward,
      lastLoss: this.lastLoss,
      weights: serializeModelWeights(this.onlineNetwork),
      history: [...this.history],
    };
  }

  async deserialize(data: SerializedDQNModel): Promise<void> {
    if (!data || data.version !== 'raira-dqn-v1' || !Array.isArray(data.weights)) {
      throw new Error('Invalid DQN checkpoint format.');
    }
    const status = await this.initialize();
    if (!status.available || !this.onlineNetwork || !this.targetNetwork) {
      throw new Error(status.error ?? 'TensorFlow.js unavailable; cannot load DQN checkpoint.');
    }
    deserializeModelWeights(this.onlineNetwork, data.weights);
    copyModelWeights(this.onlineNetwork, this.targetNetwork);
    this.configure({ ...data.config });
    this.episodesTrained = data.episodesTrained ?? 0;
    this.totalUpdates = data.totalUpdates ?? 0;
    this.bestReward = data.bestReward ?? null;
    this.lastLoss = data.lastLoss ?? null;
    this.history = Array.isArray(data.history) ? [...data.history] : [];
  }
}
