import { DEFAULT_REWARD_WEIGHTS, SYSTEM_CONFIG } from '../../src/types/simulation.ts';
import type { ProcessSpec, WorkloadType } from '../../src/types/process.ts';
import type { AlgorithmType, RewardWeights, SimulationSnapshot } from '../../src/types/simulation.ts';
import type {
  AlgorithmBenchmarkResult,
  SeedComparisonBatch,
} from '../../src/types/experiment.ts';
import type {
  RLAgentType,
  RLTrainingConfig,
  SerializedDQNModel,
  SerializedQLearningModel,
  TrainingSessionSnapshot,
} from '../../src/types/reinforcementLearning.ts';
import { SimulationEngine } from '../../src/simulation/SimulationEngine.ts';
import { generateWorkload } from '../../src/simulation/WorkloadGenerator.ts';
import { formatProcessId, validateProcessInput } from '../../src/simulation/Process.ts';
import { QLearningAgent } from '../../src/reinforcement-learning/QLearningAgent.ts';
import { DQNAgent } from '../../src/reinforcement-learning/DQNAgent.ts';
import { TrainingEngine } from '../../src/reinforcement-learning/TrainingEngine.ts';
import type { BaselineAlgorithm } from '../../src/simulation/CpuScheduler.ts';

export class RairaBackendService {
  readonly simulation: SimulationEngine;
  readonly qAgent: QLearningAgent;
  readonly dqnAgent: DQNAgent;
  readonly training: TrainingEngine;

  private simInterval: ReturnType<typeof setInterval> | null = null;
  private stepIntervalMs: number = 350;
  private lastComparison: SeedComparisonBatch | null = null;

  constructor() {
    this.simulation = new SimulationEngine({
      totalRamMb: SYSTEM_CONFIG.TOTAL_RAM_MB,
      maxTicks: SYSTEM_CONFIG.MAX_EPISODE_TICKS,
      rrQuantum: SYSTEM_CONFIG.DEFAULT_RR_QUANTUM,
      rewardWeights: { ...DEFAULT_REWARD_WEIGHTS },
    });
    this.qAgent = new QLearningAgent(undefined, 42);
    this.dqnAgent = new DQNAgent(undefined, 42);
    this.training = new TrainingEngine(this.qAgent, this.dqnAgent);
    // Warm up TensorFlow.js DQN backend at server startup
    void this.dqnAgent.initialize(42);
  }

  private getTrainedStatus() {
    return {
      qLearningTrained: this.qAgent.isTrained(),
      dqnTrained: this.dqnAgent.isTrained(),
    };
  }

  getSimulationSnapshot(): SimulationSnapshot {
    return this.simulation.getSnapshot(this.getTrainedStatus());
  }

  getLastComparison(): SeedComparisonBatch | null {
    return this.lastComparison;
  }

  loadWorkload(params: {
    specs?: ProcessSpec[];
    workloadType: WorkloadType;
    numProcesses?: number;
    seed: number;
    algorithm?: AlgorithmType;
    rrQuantum?: number;
  }): SimulationSnapshot {
    this.stopAutoLoop();
    const specs =
      params.specs && params.specs.length > 0
        ? params.specs
        : generateWorkload(
            params.workloadType === 'CUSTOM' ? 'MIXED' : params.workloadType,
            params.numProcesses ?? 10,
            params.seed
          );

    this.simulation.loadWorkload({
      specs,
      workloadType: params.workloadType,
      seed: params.seed,
      algorithm: params.algorithm ?? this.simulation.getAlgorithm(),
      rrQuantum: params.rrQuantum,
    });
    return this.getSimulationSnapshot();
  }

  updateProcessList(specs: ProcessSpec[], workloadType: WorkloadType = 'CUSTOM'): SimulationSnapshot {
    if (this.simulation.getStatus() === 'RUNNING') {
      throw new Error('Pause or reset the simulation before editing processes.');
    }
    if (this.simulation.getCurrentTick() > 0) {
      throw new Error('Reset the simulation to tick 0 before modifying process specifications.');
    }

    const capped = specs.slice(0, SYSTEM_CONFIG.MAX_PROCESSES);
    for (const spec of capped) {
      const check = validateProcessInput(spec);
      if (!check.valid) {
        const firstErr = Object.values(check.errors)[0] ?? 'Invalid process specification.';
        throw new Error(`${spec.name || spec.id}: ${firstErr}`);
      }
    }

    const normalized = capped.map((s, idx) => ({
      ...s,
      slotIndex: idx,
      id: formatProcessId(idx),
    }));

    this.simulation.loadWorkload({
      specs: normalized,
      workloadType,
      seed: this.simulation.getSnapshot(this.getTrainedStatus()).seed,
      algorithm: this.simulation.getAlgorithm(),
    });
    return this.getSimulationSnapshot();
  }

  configureSimulation(params: {
    algorithm?: AlgorithmType;
    rrQuantum?: number;
    stepIntervalMs?: number;
    rewardWeights?: Partial<RewardWeights>;
  }): SimulationSnapshot {
    if (params.algorithm) {
      this.simulation.setAlgorithm(params.algorithm);
    }
    if (params.rrQuantum !== undefined) {
      this.simulation.setRRQuantum(params.rrQuantum);
    }
    if (params.rewardWeights) {
      this.simulation.setRewardWeights(params.rewardWeights);
    }
    if (params.stepIntervalMs !== undefined) {
      this.stepIntervalMs = Math.max(80, Math.min(2000, Math.floor(params.stepIntervalMs)));
      if (this.simInterval) {
        this.stopAutoLoop();
        this.startAutoLoop();
      }
    }
    return this.getSimulationSnapshot();
  }

  async stepSimulationOnce(): Promise<SimulationSnapshot> {
    if (this.simulation.getProcesses().length === 0) {
      throw new Error('No processes loaded. Generate a workload or add processes first.');
    }
    if (this.simulation.isDone()) {
      this.stopAutoLoop();
      return this.getSimulationSnapshot();
    }

    const alg = this.simulation.getAlgorithm();

    if (alg === 'FCFS' || alg === 'RR' || alg === 'PRIORITY') {
      this.simulation.stepBaselineTick(alg, true);
    } else if (alg === 'Q_LEARNING') {
      const mask = this.simulation.getActionMask();
      const prevBusy = this.simulation.getMetrics().currentCpuUtilisation > 0;
      const chosen = this.qAgent.selectAction({
        processes: this.simulation.getProcesses(),
        currentTick: this.simulation.getCurrentTick(),
        availableRamMb: this.simulation.resourceManager.getAvailableRamMb(),
        totalRamMb: this.simulation.resourceManager.totalRamMb,
        prevTickCpuBusy: prevBusy,
        actionMask: mask,
        explore: false,
      });
      this.simulation.stepAction(chosen.actionId, true);
    } else if (alg === 'DQN') {
      const dep = await this.dqnAgent.initialize();
      if (!dep.available) {
        this.stopAutoLoop();
        throw new Error(dep.error ?? 'TensorFlow.js DQN is unavailable.');
      }
      const obs = this.simulation.getObservation();
      const mask = this.simulation.getActionMask();
      const actionId = this.dqnAgent.selectAction(obs, mask, false);
      this.simulation.stepAction(actionId, true);
    }

    if (this.simulation.isDone()) {
      this.stopAutoLoop();
    }
    return this.getSimulationSnapshot();
  }

  async startSimulation(stepIntervalMs?: number): Promise<SimulationSnapshot> {
    if (this.simulation.getProcesses().length === 0) {
      throw new Error('No processes loaded. Generate a workload or launch a demo workload first.');
    }
    if (this.simulation.isDone()) {
      this.simulation.resetEpisode();
    }
    if (this.simulation.getAlgorithm() === 'DQN') {
      const dep = await this.dqnAgent.initialize();
      if (!dep.available) {
        throw new Error(dep.error ?? 'TensorFlow.js DQN dependency unavailable.');
      }
    }
    if (stepIntervalMs !== undefined) {
      this.stepIntervalMs = Math.max(80, Math.min(2000, Math.floor(stepIntervalMs)));
    }
    this.simulation.setStatus('RUNNING');
    this.startAutoLoop();
    return this.getSimulationSnapshot();
  }

  pauseSimulation(): SimulationSnapshot {
    this.stopAutoLoop();
    if (this.simulation.getStatus() === 'RUNNING') {
      this.simulation.setStatus('PAUSED');
    }
    return this.getSimulationSnapshot();
  }

  async resumeSimulation(): Promise<SimulationSnapshot> {
    if (this.simulation.isDone()) {
      return this.getSimulationSnapshot();
    }
    this.simulation.setStatus('RUNNING');
    this.startAutoLoop();
    return this.getSimulationSnapshot();
  }

  resetSimulation(): SimulationSnapshot {
    this.stopAutoLoop();
    this.simulation.resetEpisode();
    return this.getSimulationSnapshot();
  }

  private startAutoLoop(): void {
    this.stopAutoLoop();
    this.simInterval = setInterval(() => {
      if (this.simulation.getStatus() !== 'RUNNING' || this.simulation.isDone()) {
        this.stopAutoLoop();
        return;
      }
      void this.stepSimulationOnce().catch(() => {
        this.stopAutoLoop();
        this.simulation.setStatus('PAUSED');
      });
    }, this.stepIntervalMs);
  }

  private stopAutoLoop(): void {
    if (this.simInterval) {
      clearInterval(this.simInterval);
      this.simInterval = null;
    }
  }

  // ---- RL Training Controls ----

  getTrainingSnapshot(): TrainingSessionSnapshot {
    return this.training.getSnapshot();
  }

  async startTraining(config: RLTrainingConfig): Promise<TrainingSessionSnapshot> {
    return this.training.startTraining(config);
  }

  pauseTraining(): TrainingSessionSnapshot {
    return this.training.pause();
  }

  resumeTraining(): TrainingSessionSnapshot {
    return this.training.resume();
  }

  stopTraining(): TrainingSessionSnapshot {
    return this.training.stop();
  }

  async resetRLAgent(agentType: RLAgentType, seed?: number): Promise<TrainingSessionSnapshot> {
    return this.training.resetAgent(agentType, seed);
  }

  exportRLModel(agentType: RLAgentType): SerializedQLearningModel | SerializedDQNModel {
    if (agentType === 'Q_LEARNING') {
      return this.qAgent.serialize();
    }
    return this.dqnAgent.serialize();
  }

  async importRLModel(
    agentType: RLAgentType,
    payload: SerializedQLearningModel | SerializedDQNModel
  ): Promise<TrainingSessionSnapshot> {
    if (agentType === 'Q_LEARNING') {
      this.qAgent.deserialize(payload as SerializedQLearningModel);
    } else {
      await this.dqnAgent.deserialize(payload as SerializedDQNModel);
    }
    return this.training.getSnapshot();
  }

  // ---- 5-Algorithm Benchmark Comparison ----

  async runComparison(params: {
    workloadType: Exclude<WorkloadType, 'CUSTOM'>;
    numProcesses: number;
    seeds: number[];
    rrQuantum: number;
    includeUntrainedRL?: boolean;
  }): Promise<SeedComparisonBatch> {
    const safeProcs = Math.max(1, Math.min(SYSTEM_CONFIG.MAX_PROCESSES, Math.floor(params.numProcesses)));
    const seeds =
      params.seeds.length > 0
        ? params.seeds.slice(0, 10).map((s) => Math.floor(s))
        : [42];
    const rrQuantum = Math.max(1, Math.min(16, Math.floor(params.rrQuantum || 2)));
    const includeUntrained = params.includeUntrainedRL ?? true;

    const dqnDep = await this.dqnAgent.initialize();
    const algorithms: AlgorithmType[] = ['FCFS', 'RR', 'PRIORITY', 'Q_LEARNING', 'DQN'];
    const perSeedResults: Record<number, AlgorithmBenchmarkResult[]> = {};

    for (const seed of seeds) {
      const specs = generateWorkload(params.workloadType, safeProcs, seed);
      const seedRuns: AlgorithmBenchmarkResult[] = [];

      for (const alg of algorithms) {
        if (alg === 'DQN' && !dqnDep.available) {
          seedRuns.push({
            algorithm: 'DQN',
            available: false,
            isTrainedModel: false,
            provenance: 'UNAVAILABLE_UNTRAINED',
            unavailableReason: dqnDep.error ?? 'TensorFlow.js DQN backend unavailable.',
            seed,
            workloadType: params.workloadType,
            numProcesses: safeProcs,
            metrics: new SimulationEngine().getMetrics(),
            telemetrySample: [],
            terminated: false,
            truncated: false,
          });
          continue;
        }

        if (alg === 'Q_LEARNING' && !this.qAgent.isTrained() && !includeUntrained) {
          seedRuns.push({
            algorithm: 'Q_LEARNING',
            available: false,
            isTrainedModel: false,
            provenance: 'UNAVAILABLE_UNTRAINED',
            unavailableReason: 'Q-Learning agent has not been trained yet.',
            seed,
            workloadType: params.workloadType,
            numProcesses: safeProcs,
            metrics: new SimulationEngine().getMetrics(),
            telemetrySample: [],
            terminated: false,
            truncated: false,
          });
          continue;
        }

        if (alg === 'DQN' && !this.dqnAgent.isTrained() && !includeUntrained) {
          seedRuns.push({
            algorithm: 'DQN',
            available: false,
            isTrainedModel: false,
            provenance: 'UNAVAILABLE_UNTRAINED',
            unavailableReason: 'DQN agent has not been trained yet.',
            seed,
            workloadType: params.workloadType,
            numProcesses: safeProcs,
            metrics: new SimulationEngine().getMetrics(),
            telemetrySample: [],
            terminated: false,
            truncated: false,
          });
          continue;
        }

        const evalEngine = new SimulationEngine({
          maxTicks: SYSTEM_CONFIG.MAX_EPISODE_TICKS,
          rrQuantum,
          rewardWeights: this.simulation.getRewardWeights(),
        });

        evalEngine.loadWorkload({
          specs,
          workloadType: params.workloadType,
          seed,
          algorithm: alg,
          rrQuantum,
        });

        let guard = 0;
        while (!evalEngine.isDone() && guard < SYSTEM_CONFIG.MAX_EPISODE_TICKS) {
          guard++;
          if (alg === 'FCFS' || alg === 'RR' || alg === 'PRIORITY') {
            evalEngine.stepBaselineTick(alg as BaselineAlgorithm, false);
          } else if (alg === 'Q_LEARNING') {
            const mask = evalEngine.getActionMask();
            const prevBusy = evalEngine.getMetrics().currentCpuUtilisation > 0;
            const chosen = this.qAgent.selectAction({
              processes: evalEngine.getProcesses(),
              currentTick: evalEngine.getCurrentTick(),
              availableRamMb: evalEngine.resourceManager.getAvailableRamMb(),
              totalRamMb: evalEngine.resourceManager.totalRamMb,
              prevTickCpuBusy: prevBusy,
              actionMask: mask,
              explore: false,
            });
            evalEngine.stepAction(chosen.actionId, false);
          } else {
            const obs = evalEngine.getObservation();
            const mask = evalEngine.getActionMask();
            const actionId = this.dqnAgent.selectAction(obs, mask, false);
            evalEngine.stepAction(actionId, false);
          }
        }

        const isTrained =
          alg === 'Q_LEARNING'
            ? this.qAgent.isTrained()
            : alg === 'DQN'
              ? this.dqnAgent.isTrained()
              : true;

        const snap = evalEngine.getSnapshot(this.getTrainedStatus());
        // Downsample telemetry if huge so payload stays snappy
        const fullTelemetry = snap.telemetryHistory;
        const step = Math.max(1, Math.floor(fullTelemetry.length / 80));
        const sampled = fullTelemetry.filter((_, i) => i % step === 0 || i === fullTelemetry.length - 1);

        seedRuns.push({
          algorithm: alg,
          available: true,
          isTrainedModel: isTrained,
          provenance: isTrained ? 'ACTUAL_GENERATED' : 'UNAVAILABLE_UNTRAINED',
          unavailableReason: isTrained
            ? undefined
            : `${alg === 'Q_LEARNING' ? 'Q-Learning' : 'DQN'} evaluated with untrained weights (train in RL Training Centre for learned policy).`,
          seed,
          workloadType: params.workloadType,
          numProcesses: safeProcs,
          metrics: snap.metrics,
          telemetrySample: sampled,
          terminated: evalEngine.isTerminated(),
          truncated: evalEngine.isTruncated(),
        });
      }

      perSeedResults[seed] = seedRuns;
    }

    // Aggregate across seeds per algorithm
    const aggregated = algorithms.map((alg) => {
      const matching = seeds
        .map((s) => perSeedResults[s].find((r) => r.algorithm === alg)!)
        .filter((r) => r && r.available);

      if (matching.length === 0) {
        const sample = perSeedResults[seeds[0]].find((r) => r.algorithm === alg);
        return {
          algorithm: alg,
          available: false,
          isTrainedModel: false,
          provenance: 'UNAVAILABLE_UNTRAINED' as const,
          unavailableReason: sample?.unavailableReason ?? 'Unavailable',
          avgCpuUtilisation: 0,
          avgRamUtilisation: 0,
          avgWaitingTime: 0,
          avgTurnaroundTime: 0,
          avgResponseTime: 0,
          throughput: 0,
          jainFairnessIndex: 0,
          avgEpisodeReward: 0,
          rankByWaitingTime: null,
          rankByReward: null,
        };
      }

      const avg = (fn: (r: AlgorithmBenchmarkResult) => number) =>
        Number((matching.reduce((acc, r) => acc + fn(r), 0) / matching.length).toFixed(2));

      const isTrained = matching[0].isTrainedModel;

      return {
        algorithm: alg,
        available: true,
        isTrainedModel: isTrained,
        provenance: matching[0].provenance,
        unavailableReason: matching[0].unavailableReason,
        avgCpuUtilisation: avg((r) => r.metrics.avgCpuUtilisation),
        avgRamUtilisation: avg((r) => r.metrics.avgRamUtilisation),
        avgWaitingTime: avg((r) => r.metrics.avgWaitingTime),
        avgTurnaroundTime: avg((r) => r.metrics.avgTurnaroundTime),
        avgResponseTime: avg((r) => r.metrics.avgResponseTime),
        throughput: avg((r) => r.metrics.throughput),
        jainFairnessIndex: Number(
          (
            matching.reduce((acc, r) => acc + r.metrics.jainFairnessIndex, 0) / matching.length
          ).toFixed(4)
        ),
        avgEpisodeReward: avg((r) => r.metrics.totalEpisodeReward),
        rankByWaitingTime: null as number | null,
        rankByReward: null as number | null,
      };
    });

    // Assign real empirical rankings among available entries
    const byWait = aggregated
      .filter((a) => a.available)
      .sort((a, b) => a.avgWaitingTime - b.avgWaitingTime);
    byWait.forEach((item, idx) => {
      item.rankByWaitingTime = idx + 1;
    });

    const byReward = aggregated
      .filter((a) => a.available)
      .sort((a, b) => b.avgEpisodeReward - a.avgEpisodeReward);
    byReward.forEach((item, idx) => {
      item.rankByReward = idx + 1;
    });

    const batch: SeedComparisonBatch = {
      id: `cmp-${Date.now()}`,
      timestamp: new Date().toISOString(),
      workloadType: params.workloadType,
      numProcesses: safeProcs,
      seeds,
      rrQuantum,
      perSeedResults,
      aggregated,
    };

    this.lastComparison = batch;
    return batch;
  }
}

export const rairaService = new RairaBackendService();
