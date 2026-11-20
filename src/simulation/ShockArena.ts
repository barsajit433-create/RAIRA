import type { ProcessSpec } from '../types/process.ts';
import {
  DEFAULT_REWARD_WEIGHTS,
  SYSTEM_CONFIG,
  type AlgorithmType,
  type RewardWeights,
} from '../types/simulation.ts';
import type {
  ShockAlgorithmResult,
  ShockArenaReport,
  ShockScenarioConfig,
  ShockType,
} from '../types/intelligence.ts';
import type { QLearningAgent } from '../reinforcement-learning/QLearningAgent.ts';
import type { DQNAgent } from '../reinforcement-learning/DQNAgent.ts';
import type { BaselineAlgorithm } from './CpuScheduler.ts';
import { SimulationEngine } from './SimulationEngine.ts';
import { generateWorkload, SeededRNG } from './WorkloadGenerator.ts';

export const SHOCK_TYPE_PRESETS: Record<
  ShockType,
  {
    label: string;
    description: string;
    defaultAdditionalProcesses: number;
    defaultCpuBurst: number;
    defaultRamDemandMb: number;
    defaultPriority: number;
  }
> = {
  CPU_SPIKE: {
    label: 'CPU Demand Spike',
    description: 'Injects heavy compute-bound bursts simultaneously to saturate the single CPU core.',
    defaultAdditionalProcesses: 4,
    defaultCpuBurst: 16,
    defaultRamDemandMb: 384,
    defaultPriority: 3,
  },
  MEMORY_BURST: {
    label: 'Sudden Memory-Intensive Arrivals',
    description: 'Drops multiple large-footprint jobs that compete fiercely for the 4096 MB RAM ceiling.',
    defaultAdditionalProcesses: 4,
    defaultCpuBurst: 8,
    defaultRamDemandMb: 1536,
    defaultPriority: 3,
  },
  HIGH_PRIORITY_BURST: {
    label: 'High-Priority Process Burst',
    description: 'Injects urgent priority-5 processes mid-episode, testing responsiveness vs. low-priority starvation.',
    defaultAdditionalProcesses: 4,
    defaultCpuBurst: 7,
    defaultRamDemandMb: 512,
    defaultPriority: 5,
  },
  SIMULTANEOUS_ARRIVALS: {
    label: 'Multiple Simultaneous Arrivals',
    description: 'Sudden convoy of mixed-demand processes arriving on the exact same tick.',
    defaultAdditionalProcesses: 6,
    defaultCpuBurst: 6,
    defaultRamDemandMb: 640,
    defaultPriority: 3,
  },
  SEVERE_RAM_PRESSURE: {
    label: 'Severe RAM Pressure',
    description: 'Injects near-ceiling memory jobs (up to 2560 MB each) forcing memory admission queuing.',
    defaultAdditionalProcesses: 3,
    defaultCpuBurst: 9,
    defaultRamDemandMb: 2304,
    defaultPriority: 4,
  },
};

export function generateShockProcesses(config: ShockScenarioConfig, startSlotIndex: number): ProcessSpec[] {
  const rng = new SeededRNG(config.seed * 31 + config.injectionTick * 7 + 19);
  const maxAllowed = Math.max(0, SYSTEM_CONFIG.MAX_PROCESSES - startSlotIndex);
  const count = Math.max(1, Math.min(maxAllowed, Math.floor(config.additionalProcesses)));
  const specs: ProcessSpec[] = [];

  for (let i = 0; i < count; i++) {
    const jitterCpu = rng.nextInt(-1, 2);
    const jitterRam = rng.nextInt(-1, 1) * 128;

    let cpuBurst = Math.max(1, Math.min(20, Math.round(config.cpuBurst + jitterCpu)));
    let ramMb = Math.max(64, Math.min(SYSTEM_CONFIG.TOTAL_RAM_MB, Math.round(config.ramDemandMb + jitterRam)));
    let priority = Math.max(1, Math.min(5, Math.round(config.priority)));
    let namePrefix = 'shock';

    if (config.shockType === 'CPU_SPIKE') {
      cpuBurst = Math.max(8, Math.min(20, Math.round(config.cpuBurst + rng.nextInt(0, 3))));
      namePrefix = 'cpu-spike';
    } else if (config.shockType === 'MEMORY_BURST') {
      ramMb = Math.max(768, Math.min(3072, Math.round(config.ramDemandMb + rng.nextInt(0, 2) * 128)));
      namePrefix = 'mem-burst';
    } else if (config.shockType === 'HIGH_PRIORITY_BURST') {
      priority = Math.max(4, Math.min(5, Math.round(config.priority)));
      namePrefix = 'urgent-p5';
    } else if (config.shockType === 'SIMULTANEOUS_ARRIVALS') {
      priority = rng.nextInt(1, 5);
      namePrefix = 'convoy';
    } else if (config.shockType === 'SEVERE_RAM_PRESSURE') {
      ramMb = Math.max(1536, Math.min(3584, Math.round(config.ramDemandMb + rng.nextInt(0, 2) * 128)));
      namePrefix = 'ram-press';
    }

    const slotIndex = startSlotIndex + i;
    specs.push({
      id: `S${String(i + 1).padStart(2, '0')}`,
      slotIndex,
      name: `${namePrefix}-${i + 1}`,
      arrivalTime: Math.max(1, Math.floor(config.injectionTick)),
      cpuBurstTime: cpuBurst,
      priority,
      memoryDemand: ramMb,
    });
  }

  return specs;
}

/**
 * Runs all five scheduling policies (FCFS, RR, Priority, Q-Learning, DQN) on the exact same
 * base workload + identical mid-episode shock injection and computes empirical resilience metrics.
 */
export async function runShockArenaExperiment(params: {
  config: ShockScenarioConfig;
  qAgent: QLearningAgent;
  dqnAgent: DQNAgent;
  rewardWeights?: RewardWeights;
}): Promise<ShockArenaReport> {
  const { config, qAgent, dqnAgent } = params;
  const rewardWeights = params.rewardWeights ?? { ...DEFAULT_REWARD_WEIGHTS };
  const safeBaseCount = Math.max(
    4,
    Math.min(SYSTEM_CONFIG.MAX_PROCESSES - 1, Math.floor(config.baseNumProcesses))
  );
  const safeInjectionTick = Math.max(1, Math.min(120, Math.floor(config.injectionTick)));
  const rrQuantum = Math.max(1, Math.min(16, Math.floor(config.rrQuantum || 2)));
  const starvationThreshold = Math.max(3, Math.floor(config.starvationThreshold || 15));

  const baseSpecs = generateWorkload(config.baseWorkloadType, safeBaseCount, config.seed);
  const shockSpecs = generateShockProcesses(
    { ...config, injectionTick: safeInjectionTick },
    baseSpecs.length
  );

  await dqnAgent.initialize();
  const algorithms: AlgorithmType[] = ['FCFS', 'RR', 'PRIORITY', 'Q_LEARNING', 'DQN'];
  const results: ShockAlgorithmResult[] = [];

  for (const alg of algorithms) {
    const engine = new SimulationEngine({
      maxTicks: SYSTEM_CONFIG.MAX_EPISODE_TICKS,
      rrQuantum,
      rewardWeights,
    });
    engine.setStarvationThreshold(starvationThreshold);
    engine.loadWorkload({
      specs: baseSpecs,
      workloadType: config.baseWorkloadType,
      seed: config.seed,
      algorithm: alg,
      rrQuantum,
    });

    let injected = false;
    let guard = 0;

    while (!engine.isDone() && guard < SYSTEM_CONFIG.MAX_EPISODE_TICKS) {
      guard++;

      if (!injected && engine.getCurrentTick() >= safeInjectionTick) {
        engine.injectShockProcesses(
          shockSpecs.map((s) => ({ ...s, arrivalTime: engine.getCurrentTick() })),
          `Workload shock (${config.shockType}) injected at t=${engine.getCurrentTick()}: +${shockSpecs.length} processes.`
        );
        injected = true;
      }

      if (alg === 'FCFS' || alg === 'RR' || alg === 'PRIORITY') {
        engine.stepBaselineTick(alg as BaselineAlgorithm, false);
      } else if (alg === 'Q_LEARNING') {
        const mask = engine.getActionMask();
        const chosen = qAgent.selectAction({
          processes: engine.getProcesses(),
          currentTick: engine.getCurrentTick(),
          availableRamMb: engine.resourceManager.getAvailableRamMb(),
          totalRamMb: engine.resourceManager.totalRamMb,
          prevTickCpuBusy: engine.getLastTickCpuBusy(),
          actionMask: mask,
          explore: false,
        });
        engine.stepAction(chosen.actionId, false);
      } else {
        const actionId = dqnAgent.selectAction(engine.getObservation(), engine.getActionMask(), false);
        engine.stepAction(actionId, false);
      }
    }

    // If base workload finished before injectionTick, inject at final tick and continue
    if (!injected) {
      engine.injectShockProcesses(
        shockSpecs.map((s) => ({ ...s, arrivalTime: engine.getCurrentTick() })),
        `Workload shock (${config.shockType}) injected at t=${engine.getCurrentTick()}.`
      );
      injected = true;
      while (!engine.isDone() && guard < SYSTEM_CONFIG.MAX_EPISODE_TICKS) {
        guard++;
        if (alg === 'FCFS' || alg === 'RR' || alg === 'PRIORITY') {
          engine.stepBaselineTick(alg as BaselineAlgorithm, false);
        } else if (alg === 'Q_LEARNING') {
          const chosen = qAgent.selectAction({
            processes: engine.getProcesses(),
            currentTick: engine.getCurrentTick(),
            availableRamMb: engine.resourceManager.getAvailableRamMb(),
            totalRamMb: engine.resourceManager.totalRamMb,
            prevTickCpuBusy: engine.getLastTickCpuBusy(),
            actionMask: engine.getActionMask(),
            explore: false,
          });
          engine.stepAction(chosen.actionId, false);
        } else {
          const actionId = dqnAgent.selectAction(engine.getObservation(), engine.getActionMask(), false);
          engine.stepAction(actionId, false);
        }
      }
    }

    const snap = engine.getSnapshot({
      qLearningTrained: qAgent.isTrained(),
      dqnTrained: dqnAgent.isTrained(),
    });
    const telemetry = snap.telemetryHistory;

    const preTicks = telemetry.filter((t) => t.tick <= safeInjectionTick);
    const postTicks = telemetry.filter((t) => t.tick > safeInjectionTick);

    const preShockCpuUtil =
      preTicks.length > 0
        ? Number((preTicks.reduce((acc, t) => acc + t.cpuUtil, 0) / preTicks.length).toFixed(2))
        : 0;
    const postShockCpuUtil =
      postTicks.length > 0
        ? Number((postTicks.reduce((acc, t) => acc + t.cpuUtil, 0) / postTicks.length).toFixed(2))
        : 0;
    const cpuUtilDropPct = Number(Math.max(0, preShockCpuUtil - postShockCpuUtil).toFixed(2));

    const preCompleted = preTicks.length > 0 ? preTicks[preTicks.length - 1].completedCount : 0;
    const preDuration = Math.max(1, preTicks.length);
    const preShockThroughput = Number(((preCompleted / preDuration) * 100).toFixed(2));

    const postCompleted = Math.max(0, snap.metrics.completedCount - preCompleted);
    const postDuration = Math.max(1, postTicks.length);
    const postShockThroughput = Number(((postCompleted / postDuration) * 100).toFixed(2));
    const throughputReductionPct =
      preShockThroughput > 0
        ? Number(
            Math.max(
              0,
              ((preShockThroughput - postShockThroughput) / preShockThroughput) * 100
            ).toFixed(2)
          )
        : 0;

    let maxQueueLength = 0;
    let peakRamPressurePct = 0;
    for (const t of postTicks.length > 0 ? postTicks : telemetry) {
      const qLen = t.readyCount + t.blockedCount;
      if (qLen > maxQueueLength) maxQueueLength = qLen;
      if (t.ramUtilPercent > peakRamPressurePct) peakRamPressurePct = t.ramUtilPercent;
    }

    const maxWaitingTime = snap.processes.reduce((m, p) => Math.max(m, p.waitingTime), 0);
    const starvationEvents = snap.processes.filter((p) => p.waitingTime >= starvationThreshold).length;

    // Stability criterion after shock: queue length <= 2 and RAM utilisation <= 60% for 2 consecutive ticks,
    // or episode completes all processes.
    const baselineQueueRef = Math.max(
      2,
      preTicks.length > 0
        ? Math.ceil(
            preTicks.reduce((acc, t) => acc + t.readyCount + t.blockedCount, 0) / preTicks.length
          )
        : 2
    );

    let stabilizedTick: number | null = null;
    let consecutiveStable = 0;
    for (const t of postTicks) {
      const qLen = t.readyCount + t.blockedCount;
      if (qLen <= baselineQueueRef && t.ramUtilPercent <= 65) {
        consecutiveStable += 1;
        if (consecutiveStable >= 2) {
          stabilizedTick = t.tick;
          break;
        }
      } else {
        consecutiveStable = 0;
      }
    }
    if (stabilizedTick === null && engine.isTerminated()) {
      stabilizedTick = snap.currentTick;
    }

    const recoveryTicks =
      stabilizedTick !== null ? Math.max(0, stabilizedTick - safeInjectionTick) : null;

    // Downsample telemetry cleanly to <= 120 points for chart clarity
    const step = Math.max(1, Math.floor(telemetry.length / 120));
    const sampledTelemetry = telemetry.filter(
      (_, idx) => idx % step === 0 || idx === telemetry.length - 1
    );

    const isTrained =
      alg === 'Q_LEARNING'
        ? qAgent.isTrained()
        : alg === 'DQN'
          ? dqnAgent.isTrained()
          : true;

    results.push({
      algorithm: alg,
      isTrainedModel: isTrained,
      injectionTick: safeInjectionTick,
      stabilizedTick,
      recoveryTicks,
      maxQueueLength,
      maxWaitingTime,
      preShockCpuUtil,
      postShockCpuUtil,
      cpuUtilDropPct,
      peakRamPressurePct: Number(peakRamPressurePct.toFixed(2)),
      preShockThroughput,
      postShockThroughput,
      throughputReductionPct,
      starvationEvents,
      finalMetrics: snap.metrics,
      telemetry: sampledTelemetry,
    });
  }

  return {
    id: `shock-${Date.now().toString(36)}`,
    timestamp: new Date().toISOString(),
    config: {
      ...config,
      baseNumProcesses: safeBaseCount,
      injectionTick: safeInjectionTick,
      rrQuantum,
      starvationThreshold,
    },
    injectedProcessIds: shockSpecs.map((s) => s.id),
    results,
  };
}
