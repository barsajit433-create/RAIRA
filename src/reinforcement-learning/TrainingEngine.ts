import type { WorkloadType } from '../types/process.ts';
import type {
  RLAgentType,
  RLTrainingConfig,
  TrainingEpisodeMetric,
  TrainingRunState,
  TrainingSessionSnapshot,
} from '../types/reinforcementLearning.ts';
import { DEFAULT_REWARD_WEIGHTS, SYSTEM_CONFIG } from '../types/simulation.ts';
import { SimulationEngine } from '../simulation/SimulationEngine.ts';
import { generateWorkload } from '../simulation/WorkloadGenerator.ts';
import { QLearningAgent } from './QLearningAgent.ts';
import { DQNAgent } from './DQNAgent.ts';

export class TrainingEngine {
  readonly qAgent: QLearningAgent;
  readonly dqnAgent: DQNAgent;

  private state: TrainingRunState = 'IDLE';
  private activeConfig: RLTrainingConfig | null = null;
  private queuedConfigs: RLTrainingConfig[] = [];
  private batchActive: boolean = false;
  private batchStageIndex: number = 0;
  private batchTotalStages: number = 1;
  private currentEpisode: number = 0;
  private totalEpisodes: number = 0;
  private history: TrainingEpisodeMetric[] = [];
  private errorMessage: string | null = null;
  private pauseRequested: boolean = false;
  private stopRequested: boolean = false;
  private loopRunning: boolean = false;

  constructor(qAgent: QLearningAgent, dqnAgent: DQNAgent) {
    this.qAgent = qAgent;
    this.dqnAgent = dqnAgent;
  }

  getSnapshot(): TrainingSessionSnapshot {
    const qHist = this.qAgent.getHistory();
    const dqnHist = this.dqnAgent.getHistory();
    const latest = this.history.length > 0 ? this.history[this.history.length - 1] : null;
    const avgReward =
      this.history.length > 0
        ? Number(
            (
              this.history.reduce((acc, item) => acc + item.totalReward, 0) / this.history.length
            ).toFixed(3)
          )
        : null;
    const bestReward =
      this.history.length > 0
        ? Number(Math.max(...this.history.map((item) => item.totalReward)).toFixed(3))
        : null;

    const activeAgentType = this.activeConfig?.agentType ?? 'Q_LEARNING';
    const epsilon =
      activeAgentType === 'DQN' ? this.dqnAgent.getEpsilon() : this.qAgent.getEpsilon();

    const batchStageLabel =
      this.batchActive && this.activeConfig
        ? `Stage ${this.batchStageIndex}/${this.batchTotalStages}: ${
            this.activeConfig.agentType === 'DQN' ? 'Deep Q-Network (DQN)' : 'Tabular Q-Learning'
          }`
        : null;

    return {
      state: this.state,
      config: this.activeConfig ? { ...this.activeConfig } : null,
      currentEpisode: this.currentEpisode,
      totalEpisodes: this.totalEpisodes,
      currentReward: latest ? latest.totalReward : null,
      averageReward: avgReward,
      bestReward,
      epsilon: Number(epsilon.toFixed(4)),
      qTableStates: this.qAgent.getStateCount(),
      lastLoss: this.dqnAgent.getSummary().lastLoss,
      history: [...this.history],
      qLearningHistory: qHist,
      dqnHistory: dqnHist,
      batchActive: this.batchActive,
      batchStageLabel,
      error: this.errorMessage,
      qLearningSummary: this.qAgent.getSummary(),
      dqnSummary: this.dqnAgent.getSummary(),
    };
  }

  private async prepareAgentForConfig(config: RLTrainingConfig): Promise<string | null> {
    if (config.agentType === 'DQN') {
      const status = await this.dqnAgent.initialize(config.seed);
      if (!status.available) {
        return status.error ?? 'TensorFlow.js DQN backend unavailable; cannot train DQN.';
      }
      this.dqnAgent.configure(
        {
          learningRate: config.learningRate,
          discountFactor: config.discountFactor,
          epsilon: config.epsilonStart,
          epsilonDecay: config.epsilonDecay,
          epsilonMin: config.epsilonMin,
          batchSize: config.batchSize,
          targetUpdateFreq: config.targetUpdateFreq || 20,
        },
        config.seed
      );
    } else {
      this.qAgent.configure(
        {
          learningRate: config.learningRate,
          discountFactor: config.discountFactor,
          epsilon: config.epsilonStart,
          epsilonDecay: config.epsilonDecay,
          epsilonMin: config.epsilonMin,
        },
        config.seed
      );
    }
    return null;
  }

  async startTraining(config: RLTrainingConfig): Promise<TrainingSessionSnapshot> {
    if (this.loopRunning) {
      this.stopRequested = true;
      await new Promise((r) => setTimeout(r, 30));
    }

    const safeEpisodes = Math.max(1, Math.min(500, Math.floor(config.episodes)));
    const safeProcs = Math.max(1, Math.min(SYSTEM_CONFIG.MAX_PROCESSES, Math.floor(config.numProcesses)));

    this.activeConfig = {
      ...config,
      episodes: safeEpisodes,
      numProcesses: safeProcs,
    };
    this.queuedConfigs = [];
    this.batchActive = false;
    this.batchStageIndex = 1;
    this.batchTotalStages = 1;
    this.currentEpisode = 0;
    this.totalEpisodes = safeEpisodes;
    this.history = [];
    this.errorMessage = null;
    this.pauseRequested = false;
    this.stopRequested = false;

    const initErr = await this.prepareAgentForConfig(this.activeConfig);
    if (initErr) {
      this.state = 'ERROR';
      this.errorMessage = initErr;
      return this.getSnapshot();
    }

    this.state = 'TRAINING';
    void this.runTrainingLoop();
    return this.getSnapshot();
  }

  async startTrainBoth(params: {
    workloadType: WorkloadType;
    numProcesses: number;
    qEpisodes: number;
    dqnEpisodes: number;
    discountFactor: number;
    seed: number;
  }): Promise<TrainingSessionSnapshot> {
    if (this.loopRunning) {
      this.stopRequested = true;
      await new Promise((r) => setTimeout(r, 30));
    }

    const safeProcs = Math.max(1, Math.min(SYSTEM_CONFIG.MAX_PROCESSES, Math.floor(params.numProcesses || 10)));
    const safeQEp = Math.max(1, Math.min(500, Math.floor(params.qEpisodes || 30)));
    const safeDqnEp = Math.max(1, Math.min(500, Math.floor(params.dqnEpisodes || 15)));
    const gamma = Math.max(0.1, Math.min(0.999, Number(params.discountFactor || 0.95)));
    const seed = Math.floor(params.seed || 42);

    const qCfg: RLTrainingConfig = {
      agentType: 'Q_LEARNING',
      workloadType: params.workloadType,
      numProcesses: safeProcs,
      episodes: safeQEp,
      learningRate: 0.15,
      discountFactor: gamma,
      epsilonStart: 1.0,
      epsilonDecay: 0.93,
      epsilonMin: 0.05,
      batchSize: 32,
      targetUpdateFreq: 20,
      seed,
    };

    const dqnCfg: RLTrainingConfig = {
      agentType: 'DQN',
      workloadType: params.workloadType,
      numProcesses: safeProcs,
      episodes: safeDqnEp,
      learningRate: 0.001,
      discountFactor: gamma,
      epsilonStart: 1.0,
      epsilonDecay: 0.89,
      epsilonMin: 0.05,
      batchSize: 32,
      targetUpdateFreq: 20,
      seed,
    };

    this.activeConfig = qCfg;
    this.queuedConfigs = [dqnCfg];
    this.batchActive = true;
    this.batchStageIndex = 1;
    this.batchTotalStages = 2;
    this.currentEpisode = 0;
    this.totalEpisodes = qCfg.episodes;
    this.history = [];
    this.errorMessage = null;
    this.pauseRequested = false;
    this.stopRequested = false;

    const initErr = await this.prepareAgentForConfig(qCfg);
    if (initErr) {
      this.state = 'ERROR';
      this.errorMessage = initErr;
      this.batchActive = false;
      return this.getSnapshot();
    }

    this.state = 'TRAINING';
    void this.runTrainingLoop();
    return this.getSnapshot();
  }

  pause(): TrainingSessionSnapshot {
    if (this.state === 'TRAINING') {
      this.pauseRequested = true;
      this.state = 'PAUSED';
    }
    return this.getSnapshot();
  }

  resume(): TrainingSessionSnapshot {
    if (this.state === 'PAUSED' && this.activeConfig && this.currentEpisode < this.totalEpisodes) {
      this.pauseRequested = false;
      this.state = 'TRAINING';
      if (!this.loopRunning) {
        void this.runTrainingLoop();
      }
    }
    return this.getSnapshot();
  }

  stop(): TrainingSessionSnapshot {
    this.stopRequested = true;
    this.pauseRequested = false;
    this.queuedConfigs = [];
    this.batchActive = false;
    if (this.state === 'TRAINING' || this.state === 'PAUSED') {
      this.state = 'STOPPED';
    }
    return this.getSnapshot();
  }

  async resetAgent(agentType: RLAgentType, seed: number = 42): Promise<TrainingSessionSnapshot> {
    this.stopRequested = true;
    this.pauseRequested = false;
    this.queuedConfigs = [];
    this.batchActive = false;
    if (agentType === 'DQN') {
      await this.dqnAgent.reset(seed);
    } else {
      this.qAgent.reset(seed);
    }
    if (this.activeConfig?.agentType === agentType) {
      this.history = [];
      this.currentEpisode = 0;
      this.totalEpisodes = 0;
      this.state = 'IDLE';
      this.errorMessage = null;
    }
    return this.getSnapshot();
  }

  private async runTrainingLoop(): Promise<void> {
    if (!this.activeConfig) return;
    this.loopRunning = true;

    try {
      while (this.activeConfig) {
        while (this.currentEpisode < this.totalEpisodes) {
          if (this.stopRequested) {
            this.state = 'STOPPED';
            this.batchActive = false;
            return;
          }
          if (this.pauseRequested) {
            this.state = 'PAUSED';
            return;
          }

          const episodeNumber = this.currentEpisode + 1;
          const metric = this.runSingleEpisode(this.activeConfig, episodeNumber);
          this.currentEpisode = episodeNumber;
          this.history.push(metric);

          // Yield to event loop so REST polling and live simulation stay responsive
          await new Promise((resolve) => setTimeout(resolve, 4));
        }

        if (this.queuedConfigs.length > 0 && !this.stopRequested && !this.pauseRequested) {
          const nextCfg = this.queuedConfigs.shift()!;
          this.batchStageIndex += 1;
          this.activeConfig = nextCfg;
          this.currentEpisode = 0;
          this.totalEpisodes = nextCfg.episodes;
          this.history = [];

          const initErr = await this.prepareAgentForConfig(nextCfg);
          if (initErr) {
            this.state = 'ERROR';
            this.errorMessage = initErr;
            this.batchActive = false;
            return;
          }
          continue;
        }

        break;
      }

      if (!this.stopRequested && !this.pauseRequested && this.currentEpisode >= this.totalEpisodes) {
        this.state = 'COMPLETED';
        this.batchActive = false;
      }
    } catch (err) {
      this.state = 'ERROR';
      this.errorMessage = err instanceof Error ? err.message : String(err);
      this.batchActive = false;
    } finally {
      this.loopRunning = false;
    }
  }

  /**
   * Executes one full episode synchronously for either Q-Learning or DQN.
   * Public so unit tests can also run deterministic single-episode training directly.
   */
  runSingleEpisode(config: RLTrainingConfig, episodeNumber: number): TrainingEpisodeMetric {
    const workloadType: Exclude<WorkloadType, 'CUSTOM'> =
      config.workloadType === 'CUSTOM' ? 'MIXED' : config.workloadType;

    // Deterministic per-episode seed derived from base seed so training exposes varied workloads
    // while remaining 100% reproducible given the same seed.
    const episodeSeed = config.seed + (episodeNumber - 1) * 17;
    const specs = generateWorkload(workloadType, config.numProcesses, episodeSeed);

    const engine = new SimulationEngine({
      maxTicks: SYSTEM_CONFIG.MAX_EPISODE_TICKS,
      rewardWeights: {
        ...(config.rewardWeights ?? DEFAULT_REWARD_WEIGHTS),
        gamma: config.discountFactor,
      },
    });

    engine.loadWorkload({
      specs,
      workloadType,
      seed: episodeSeed,
      algorithm: config.agentType,
    });

    let lastLoss: number | null = null;
    let steps = 0;
    const maxActionSteps = SYSTEM_CONFIG.MAX_EPISODE_TICKS;

    while (!engine.isDone() && steps < maxActionSteps) {
      steps += 1;

      if (config.agentType === 'Q_LEARNING') {
        const mask = engine.getActionMask();
        const prevBusy = engine.getMetrics().currentCpuUtilisation > 0;
        const chosen = this.qAgent.selectAction({
          processes: engine.getProcesses(),
          currentTick: engine.getCurrentTick(),
          availableRamMb: engine.resourceManager.getAvailableRamMb(),
          totalRamMb: engine.resourceManager.totalRamMb,
          prevTickCpuBusy: prevBusy,
          actionMask: mask,
          explore: true,
        });

        const stepRes = engine.stepAction(chosen.actionId, false);
        const nextBusy = engine.getMetrics().currentCpuUtilisation > 0;

        this.qAgent.update({
          compactStateKey: chosen.compactStateKey,
          stateActionKey: chosen.stateActionKey,
          reward: stepRes.reward,
          elapsedTicks: stepRes.elapsedTicks,
          terminated: stepRes.terminated,
          truncated: stepRes.truncated,
          nextProcesses: engine.getProcesses(),
          nextTick: engine.getCurrentTick(),
          nextAvailableRamMb: engine.resourceManager.getAvailableRamMb(),
          totalRamMb: engine.resourceManager.totalRamMb,
          nextPrevTickCpuBusy: nextBusy,
          nextActionMask: stepRes.nextActionMask,
        });
      } else {
        const obs = engine.getObservation();
        const mask = engine.getActionMask();
        const actionId = this.dqnAgent.selectAction(obs, mask, true);
        const stepRes = engine.stepAction(actionId, false);

        this.dqnAgent.storeTransition({
          state: obs,
          action: actionId,
          reward: stepRes.reward,
          nextState: stepRes.nextObservation,
          nextActionMask: stepRes.nextActionMask,
          elapsedTicks: stepRes.elapsedTicks,
          terminated: stepRes.terminated,
          truncated: stepRes.truncated,
        });

        // Train every 2 SMDP steps to balance learning speed and responsiveness
        if (steps % 2 === 0 || stepRes.done) {
          const loss = this.dqnAgent.trainStep();
          if (loss !== null) lastLoss = loss;
        }
      }
    }

    const metrics = engine.getMetrics();
    const recentSlice = [...this.history.slice(-9), { totalReward: metrics.totalEpisodeReward }];
    const avgRewardLast10 = Number(
      (recentSlice.reduce((acc, item) => acc + item.totalReward, 0) / recentSlice.length).toFixed(3)
    );

    const episodeMetric: TrainingEpisodeMetric = {
      episode: episodeNumber,
      totalReward: metrics.totalEpisodeReward,
      avgRewardLast10,
      epsilon:
        config.agentType === 'DQN'
          ? Number(this.dqnAgent.getEpsilon().toFixed(4))
          : Number(this.qAgent.getEpsilon().toFixed(4)),
      avgWaitingTime: metrics.avgWaitingTime,
      avgTurnaroundTime: metrics.avgTurnaroundTime,
      avgCpuUtil: metrics.avgCpuUtilisation,
      avgRamUtil: metrics.avgRamUtilisation,
      jainFairness: metrics.jainFairnessIndex,
      completedCount: metrics.completedCount,
      totalProcesses: metrics.totalProcesses,
      ticks: metrics.currentTick,
      terminated: engine.isTerminated(),
      truncated: engine.isTruncated(),
      qTableStates: config.agentType === 'Q_LEARNING' ? this.qAgent.getStateCount() : undefined,
      dqnLoss: config.agentType === 'DQN' ? lastLoss : undefined,
    };

    if (config.agentType === 'Q_LEARNING') {
      this.qAgent.endEpisode(episodeMetric, workloadType, episodeSeed);
    } else {
      this.dqnAgent.endEpisode(episodeMetric, workloadType, episodeSeed);
    }

    return episodeMetric;
  }
}
