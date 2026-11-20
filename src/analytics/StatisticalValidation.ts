import type { WorkloadType } from '../types/process.ts';
import {
  DEFAULT_REWARD_WEIGHTS,
  SYSTEM_CONFIG,
  type AlgorithmType,
  type RewardWeights,
} from '../types/simulation.ts';
import type {
  AblationStudyRow,
  StatisticalAlgorithmSummary,
  StatisticalMetricSummary,
  StatisticalValidationConfig,
  StatisticalValidationReport,
  WorkloadGeneralisationRow,
} from '../types/intelligence.ts';
import { QLearningAgent } from '../reinforcement-learning/QLearningAgent.ts';
import { DQNAgent } from '../reinforcement-learning/DQNAgent.ts';
import type { BaselineAlgorithm } from '../simulation/CpuScheduler.ts';
import { SimulationEngine } from '../simulation/SimulationEngine.ts';
import { generateWorkload } from '../simulation/WorkloadGenerator.ts';
import { computeFairnessMonitorSnapshot, REWARD_PRESETS } from '../simulation/FairnessMonitor.ts';

/**
 * Training seeds used to generate RAIRA's bundled pretrained Q-Learning (50 ep) & DQN (25 ep) models:
 * seed(ep) = 42 + (ep - 1) * 17 for ep = 1..50 => [42, 59, 76, ..., 875].
 */
export function getPretrainedTrainingSeeds(episodes: number = 50, baseSeed: number = 42): Set<number> {
  const set = new Set<number>();
  for (let ep = 1; ep <= episodes; ep++) {
    set.add(baseSeed + (ep - 1) * 17);
  }
  return set;
}

export function isDisjointFromTrainingSeeds(
  evalSeeds: number[],
  trainingSeeds: Set<number> = getPretrainedTrainingSeeds()
): boolean {
  return evalSeeds.every((s) => !trainingSeeds.has(s));
}

// Student's t critical values for 95% two-sided CI (alpha = 0.05, df = n - 1)
const T_CRIT_95: Record<number, number> = {
  1: 12.706,
  2: 4.303,
  3: 3.182,
  4: 2.776,
  5: 2.571,
  6: 2.447,
  7: 2.365,
  8: 2.306,
  9: 2.262,
  10: 2.228,
  11: 2.201,
  12: 2.179,
  13: 2.16,
  14: 2.145,
  15: 2.131,
  16: 2.12,
  17: 2.11,
  18: 2.101,
  19: 2.093,
  20: 2.086,
  21: 2.08,
  22: 2.074,
  23: 2.069,
  24: 2.064,
  25: 2.06,
  26: 2.056,
  27: 2.052,
  28: 2.048,
  29: 2.045,
  30: 2.042,
};

export function getTCritical95(sampleSize: number): number {
  const df = sampleSize - 1;
  if (df <= 0) return 0;
  if (df <= 30) return T_CRIT_95[df];
  if (df <= 60) return 2.0;
  if (df <= 120) return 1.98;
  return 1.96;
}

export function computeMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function computeSampleStdDev(values: number[]): number {
  if (values.length <= 1) return 0;
  const avg = computeMean(values);
  const sumSq = values.reduce((acc, v) => acc + (v - avg) * (v - avg), 0);
  return Math.sqrt(sumSq / (values.length - 1));
}

export function computePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const p = Math.max(0, Math.min(100, percentile)) / 100;
  const idx = p * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const frac = idx - lo;
  return sorted[lo] + frac * (sorted[hi] - sorted[lo]);
}

export function summarizeMetricDistribution(
  values: number[],
  decimals: number = 2
): StatisticalMetricSummary {
  if (values.length === 0) {
    return { mean: 0, stdDev: 0, ci95Low: 0, ci95High: 0, median: 0, p95: 0, min: 0, max: 0 };
  }
  const round = (n: number) => Number(n.toFixed(decimals));
  const avg = computeMean(values);
  const sd = computeSampleStdDev(values);
  const se = values.length > 1 ? sd / Math.sqrt(values.length) : 0;
  const tCrit = getTCritical95(values.length);
  const margin = tCrit * se;
  const sorted = [...values].sort((a, b) => a - b);

  return {
    mean: round(avg),
    stdDev: round(sd),
    ci95Low: round(avg - margin),
    ci95High: round(avg + margin),
    median: round(computePercentile(sorted, 50)),
    p95: round(computePercentile(sorted, 95)),
    min: round(sorted[0]),
    max: round(sorted[sorted.length - 1]),
  };
}

interface EpisodeSample {
  waitingTime: number;
  turnaroundTime: number;
  cpuUtil: number;
  ramUtil: number;
  throughput: number;
  jainFairness: number;
  serviceShareFairness: number;
  episodeReward: number;
  invalidActions: number;
  starvationEvents: number;
}

function runEpisodeForPolicy(params: {
  specs: ReturnType<typeof generateWorkload>;
  workloadType: Exclude<WorkloadType, 'CUSTOM'>;
  seed: number;
  algorithm: AlgorithmType;
  rrQuantum: number;
  rewardWeights: RewardWeights;
  starvationThreshold: number;
  qAgent?: QLearningAgent;
  dqnAgent?: DQNAgent;
  fixedQuantumOverride?: 1 | 2 | 4;
}): EpisodeSample {
  const {
    specs,
    workloadType,
    seed,
    algorithm,
    rrQuantum,
    rewardWeights,
    starvationThreshold,
    qAgent,
    dqnAgent,
    fixedQuantumOverride,
  } = params;

  const engine = new SimulationEngine({
    maxTicks: SYSTEM_CONFIG.MAX_EPISODE_TICKS,
    rrQuantum,
    rewardWeights,
  });
  engine.loadWorkload({
    specs,
    workloadType,
    seed,
    algorithm,
    rrQuantum,
  });

  let guard = 0;
  while (!engine.isDone() && guard < SYSTEM_CONFIG.MAX_EPISODE_TICKS) {
    guard++;
    if (algorithm === 'FCFS' || algorithm === 'RR' || algorithm === 'PRIORITY') {
      engine.stepBaselineTick(algorithm as BaselineAlgorithm, false);
    } else if (algorithm === 'Q_LEARNING' && qAgent) {
      const mask = engine.getActionMask();
      const masked = fixedQuantumOverride ? maskToSingleQuantum(mask, fixedQuantumOverride) : mask;
      const chosen = qAgent.selectAction({
        processes: engine.getProcesses(),
        currentTick: engine.getCurrentTick(),
        availableRamMb: engine.resourceManager.getAvailableRamMb(),
        totalRamMb: engine.resourceManager.totalRamMb,
        prevTickCpuBusy: engine.getLastTickCpuBusy(),
        actionMask: masked,
        explore: false,
      });
      engine.stepAction(chosen.actionId, false);
    } else if (algorithm === 'DQN' && dqnAgent) {
      const mask = engine.getActionMask();
      const masked = fixedQuantumOverride ? maskToSingleQuantum(mask, fixedQuantumOverride) : mask;
      const actionId = dqnAgent.selectAction(engine.getObservation(), masked, false);
      engine.stepAction(actionId, false);
    } else {
      break;
    }
  }

  const m = engine.getMetrics();
  const fairness = computeFairnessMonitorSnapshot({
    processes: engine.getProcesses(),
    currentTick: engine.getCurrentTick(),
    rewardWeights,
    starvationThreshold,
  });

  return {
    waitingTime: m.avgWaitingTime,
    turnaroundTime: m.avgTurnaroundTime,
    cpuUtil: m.avgCpuUtilisation,
    ramUtil: m.avgRamUtilisation,
    throughput: m.throughput,
    jainFairness: m.jainFairnessIndex,
    serviceShareFairness: fairness.serviceShareFairnessIndex,
    episodeReward: m.totalEpisodeReward,
    invalidActions: m.invalidActionCount,
    starvationEvents: fairness.exceedingThresholdCount,
  };
}

function maskToSingleQuantum(mask: boolean[], quantum: 1 | 2 | 4): boolean[] {
  const qIdx = quantum === 1 ? 0 : quantum === 2 ? 1 : 2;
  const out = mask.slice();
  for (let slot = 0; slot < SYSTEM_CONFIG.MAX_PROCESSES; slot++) {
    for (let qi = 0; qi < 3; qi++) {
      const actionId = 1 + slot * 3 + qi;
      if (qi !== qIdx) {
        out[actionId] = false;
      }
    }
  }
  return out;
}

/**
 * Statistical Research Validation Laboratory:
 * Evaluates all scheduling algorithms over >=30 independent seeds (strictly disjoint from training seeds)
 * across identical workload instances, computing Mean, SD, 95% CI, Median, P95, trained vs. untrained
 * RL comparison, unseen-workload generalisation, and controlled ablation studies.
 */
export async function runStatisticalValidation(params: {
  config: StatisticalValidationConfig;
  trainedQAgent: QLearningAgent;
  trainedDqnAgent: DQNAgent;
  rewardWeights?: RewardWeights;
}): Promise<StatisticalValidationReport> {
  const t0 = Date.now();
  const { config, trainedQAgent, trainedDqnAgent } = params;
  const rewardWeights = params.rewardWeights ?? { ...DEFAULT_REWARD_WEIGHTS };

  const safeSeedCount = Math.max(5, Math.min(100, Math.floor(config.seedCount || 30)));
  const safeSeedStart = Math.max(1, Math.floor(config.seedStart || 1001));
  const safeProcs = Math.max(4, Math.min(SYSTEM_CONFIG.MAX_PROCESSES, Math.floor(config.numProcesses || 10)));
  const rrQuantum = Math.max(1, Math.min(16, Math.floor(config.rrQuantum || 2)));
  const starvationThreshold = Math.max(3, Math.floor(config.starvationThreshold || 15));

  const workloads: Array<Exclude<WorkloadType, 'CUSTOM'>> =
    config.workloads && config.workloads.length > 0
      ? config.workloads
      : ['CPU_INTENSIVE', 'MEMORY_INTENSIVE', 'MIXED', 'DYNAMIC'];

  // Build deterministic evaluation seeds (default 1001..1030, strictly disjoint from training seeds 42..875)
  const evaluationSeeds: number[] = [];
  for (let i = 0; i < safeSeedCount; i++) {
    evaluationSeeds.push(safeSeedStart + i);
  }
  const trainingSeeds = getPretrainedTrainingSeeds(50, 42);
  const disjoint = isDisjointFromTrainingSeeds(evaluationSeeds, trainingSeeds);

  await trainedDqnAgent.initialize();

  // Construct fresh UNTRAINED reference agents (never mutates the live trained models!)
  let untrainedQ: QLearningAgent | undefined;
  let untrainedDqn: DQNAgent | undefined;
  if (config.includeUntrainedComparison) {
    untrainedQ = new QLearningAgent(undefined, 9999);
    untrainedDqn = new DQNAgent(undefined, 9999);
    await untrainedDqn.initialize(9999);
  }

  interface PolicySpec {
    policyKey: string;
    algorithm: AlgorithmType;
    label: string;
    isTrainedModel: boolean;
    qAgent?: QLearningAgent;
    dqnAgent?: DQNAgent;
  }

  const policies: PolicySpec[] = [
    { policyKey: 'FCFS', algorithm: 'FCFS', label: 'FCFS', isTrainedModel: true },
    { policyKey: 'RR', algorithm: 'RR', label: `Round Robin (q=${rrQuantum})`, isTrainedModel: true },
    { policyKey: 'PRIORITY', algorithm: 'PRIORITY', label: 'Priority', isTrainedModel: true },
    {
      policyKey: 'Q_LEARNING_TRAINED',
      algorithm: 'Q_LEARNING',
      label: trainedQAgent.isTrained() ? 'Q-Learning (Trained)' : 'Q-Learning (Active)',
      isTrainedModel: trainedQAgent.isTrained(),
      qAgent: trainedQAgent,
    },
    {
      policyKey: 'DQN_TRAINED',
      algorithm: 'DQN',
      label: trainedDqnAgent.isTrained() ? 'DQN (Trained)' : 'DQN (Active)',
      isTrainedModel: trainedDqnAgent.isTrained(),
      dqnAgent: trainedDqnAgent,
    },
  ];

  if (config.includeUntrainedComparison && untrainedQ && untrainedDqn) {
    policies.push(
      {
        policyKey: 'Q_LEARNING_UNTRAINED',
        algorithm: 'Q_LEARNING',
        label: 'Q-Learning (Untrained Ref)',
        isTrainedModel: false,
        qAgent: untrainedQ,
      },
      {
        policyKey: 'DQN_UNTRAINED',
        algorithm: 'DQN',
        label: 'DQN (Untrained Ref)',
        isTrainedModel: false,
        dqnAgent: untrainedDqn,
      }
    );
  }

  const samplesByPolicy: Record<string, EpisodeSample[]> = {};
  for (const p of policies) {
    samplesByPolicy[p.policyKey] = [];
  }

  const workloadBreakdown: WorkloadGeneralisationRow[] = [];
  let totalEpisodesExecuted = 0;

  // Evaluate every workload category across all independent seeds using identical ProcessSpec[] per (workload, seed)
  for (const workloadType of workloads) {
    const perPolicyForWorkload: Record<string, EpisodeSample[]> = {};
    for (const p of policies) {
      perPolicyForWorkload[p.policyKey] = [];
    }

    for (const seed of evaluationSeeds) {
      const specs = generateWorkload(workloadType, safeProcs, seed);
      for (const p of policies) {
        const sample = runEpisodeForPolicy({
          specs,
          workloadType,
          seed,
          algorithm: p.algorithm,
          rrQuantum,
          rewardWeights,
          starvationThreshold,
          qAgent: p.qAgent,
          dqnAgent: p.dqnAgent,
        });
        samplesByPolicy[p.policyKey].push(sample);
        perPolicyForWorkload[p.policyKey].push(sample);
        totalEpisodesExecuted += 1;
      }
    }

    const byPolicy: WorkloadGeneralisationRow['byPolicy'] = {};
    for (const p of policies) {
      const list = perPolicyForWorkload[p.policyKey];
      const waitSum = summarizeMetricDistribution(list.map((s) => s.waitingTime), 2);
      const tputMean = Number(computeMean(list.map((s) => s.throughput)).toFixed(2));
      const fairMean = Number(computeMean(list.map((s) => s.jainFairness)).toFixed(4));
      const rewMean = Number(computeMean(list.map((s) => s.episodeReward)).toFixed(2));
      byPolicy[p.policyKey] = {
        avgWaitMean: waitSum.mean,
        avgWaitCi95Half: Number(((waitSum.ci95High - waitSum.ci95Low) / 2).toFixed(2)),
        throughputMean: tputMean,
        jainFairnessMean: fairMean,
        rewardMean: rewMean,
      };
    }

    workloadBreakdown.push({
      workloadType,
      // Pretrained models were trained on MIXED workloads; other 3 workloads test unseen-distribution generalisation
      isUnseenForPretrained: workloadType !== 'MIXED',
      sampleSeeds: evaluationSeeds.length,
      byPolicy,
    });
  }

  const overallSummaries: StatisticalAlgorithmSummary[] = policies.map((p) => {
    const list = samplesByPolicy[p.policyKey];
    return {
      policyKey: p.policyKey,
      algorithm: p.algorithm,
      label: p.label,
      isTrainedModel: p.isTrainedModel,
      sampleCount: list.length,
      waitingTime: summarizeMetricDistribution(list.map((s) => s.waitingTime), 2),
      turnaroundTime: summarizeMetricDistribution(list.map((s) => s.turnaroundTime), 2),
      cpuUtilisation: summarizeMetricDistribution(list.map((s) => s.cpuUtil), 2),
      ramUtilisation: summarizeMetricDistribution(list.map((s) => s.ramUtil), 2),
      throughput: summarizeMetricDistribution(list.map((s) => s.throughput), 2),
      jainFairness: summarizeMetricDistribution(list.map((s) => s.jainFairness), 4),
      serviceShareFairness: summarizeMetricDistribution(list.map((s) => s.serviceShareFairness), 4),
      episodeReward: summarizeMetricDistribution(list.map((s) => s.episodeReward), 2),
      invalidActionsTotal: list.reduce((acc, s) => acc + s.invalidActions, 0),
      starvationEventsTotal: list.reduce((acc, s) => acc + s.starvationEvents, 0),
    };
  });

  // Controlled Ablation Study on MIXED workload across the first 15 evaluation seeds
  const ablationStudy: AblationStudyRow[] = [];
  if (config.includeAblationStudy) {
    const ablationSeeds = evaluationSeeds.slice(0, Math.min(15, evaluationSeeds.length));
    const ablationWorkloads = ablationSeeds.map((seed) => ({
      seed,
      specs: generateWorkload('MIXED', safeProcs, seed),
    }));

    const evalAblation = (
      variantId: string,
      label: string,
      description: string,
      algorithm: AlgorithmType,
      opts: {
        qAgent?: QLearningAgent;
        dqnAgent?: DQNAgent;
        weights?: RewardWeights;
        fixedQuantum?: 1 | 2 | 4;
      }
    ): Omit<AblationStudyRow, 'deltaRewardVsBaseline'> => {
      const list = ablationWorkloads.map(({ seed, specs }) => {
        totalEpisodesExecuted += 1;
        return runEpisodeForPolicy({
          specs,
          workloadType: 'MIXED',
          seed,
          algorithm,
          rrQuantum,
          rewardWeights: opts.weights ?? rewardWeights,
          starvationThreshold,
          qAgent: opts.qAgent,
          dqnAgent: opts.dqnAgent,
          fixedQuantumOverride: opts.fixedQuantum,
        });
      });
      const waitSummary = summarizeMetricDistribution(list.map((s) => s.waitingTime), 2);
      return {
        variantId,
        label,
        description,
        algorithm,
        avgWaitMean: waitSummary.mean,
        avgWaitStd: waitSummary.stdDev,
        throughputMean: Number(computeMean(list.map((s) => s.throughput)).toFixed(2)),
        jainFairnessMean: Number(computeMean(list.map((s) => s.jainFairness)).toFixed(4)),
        rewardMean: Number(computeMean(list.map((s) => s.episodeReward)).toFixed(2)),
      };
    };

    const fullQ = evalAblation(
      'q-full',
      'Q-Learning Full (Adaptive q∈{1,2,4})',
      'Full trained Q-Learning agent with adaptive quantum selection under Balanced reward.',
      'Q_LEARNING',
      { qAgent: trainedQAgent }
    );
    const qFixed1 = evalAblation(
      'q-fixed-q1',
      'Ablation: Q-Learning Fixed q=1',
      'Restricts trained Q-Learning to quantum=1 only (removes multi-tick SMDP flexibility).',
      'Q_LEARNING',
      { qAgent: trainedQAgent, fixedQuantum: 1 }
    );
    const qFixed4 = evalAblation(
      'q-fixed-q4',
      'Ablation: Q-Learning Fixed q=4',
      'Restricts trained Q-Learning to quantum=4 only (coarser preemption granularity).',
      'Q_LEARNING',
      { qAgent: trainedQAgent, fixedQuantum: 4 }
    );
    const qFairReward = evalAblation(
      'q-fairness-eval',
      'Reward Eval: Fairness-Focused Objective',
      'Evaluates identical trained Q-Learning policy under Fairness-Focused reward weights.',
      'Q_LEARNING',
      { qAgent: trainedQAgent, weights: REWARD_PRESETS.FAIRNESS.weights }
    );
    const dqnFull = evalAblation(
      'dqn-full',
      'DQN Full (Adaptive q∈{1,2,4})',
      'Full trained TensorFlow.js DQN with adaptive quantum selection.',
      'DQN',
      { dqnAgent: trainedDqnAgent }
    );
    const dqnFixed1 = evalAblation(
      'dqn-fixed-q1',
      'Ablation: DQN Fixed q=1',
      'Restricts trained DQN to quantum=1 only.',
      'DQN',
      { dqnAgent: trainedDqnAgent, fixedQuantum: 1 }
    );

    const rows = [fullQ, qFixed1, qFixed4, qFairReward, dqnFull, dqnFixed1];
    for (const r of rows) {
      const refReward = r.algorithm === 'DQN' ? dqnFull.rewardMean : fullQ.rewardMean;
      ablationStudy.push({
        ...r,
        deltaRewardVsBaseline: Number((r.rewardMean - refReward).toFixed(2)),
      });
    }
  }

  // Strictly empirical summary findings (never claims unsupported advantages)
  const trainedOrBaseline = overallSummaries.filter((s) => s.isTrainedModel);
  const bestWait = [...trainedOrBaseline].sort((a, b) => a.waitingTime.mean - b.waitingTime.mean)[0];
  const bestReward = [...trainedOrBaseline].sort((a, b) => b.episodeReward.mean - a.episodeReward.mean)[0];
  const bestFair = [...trainedOrBaseline].sort(
    (a, b) => b.serviceShareFairness.mean - a.serviceShareFairness.mean
  )[0];

  const empiricalFindings: string[] = [];
  if (bestWait) {
    empiricalFindings.push(
      `Lowest mean waiting time across ${evaluationSeeds.length} seeds × ${workloads.length} workload(s): ${bestWait.label} at ${bestWait.waitingTime.mean}t (95% CI [${bestWait.waitingTime.ci95Low}, ${bestWait.waitingTime.ci95High}], P95=${bestWait.waitingTime.p95}t).`
    );
  }
  if (bestReward) {
    empiricalFindings.push(
      `Highest mean episode reward: ${bestReward.label} at ${bestReward.episodeReward.mean} (SD=${bestReward.episodeReward.stdDev}).`
    );
  }
  if (bestFair) {
    empiricalFindings.push(
      `Highest service-share fairness index: ${bestFair.label} at ${bestFair.serviceShareFairness.mean} (Jain wait fairness ${bestFair.jainFairness.mean}).`
    );
  }

  const qTrained = overallSummaries.find((s) => s.policyKey === 'Q_LEARNING_TRAINED');
  const qUntrained = overallSummaries.find((s) => s.policyKey === 'Q_LEARNING_UNTRAINED');
  if (qTrained && qUntrained) {
    const diff = Number((qTrained.episodeReward.mean - qUntrained.episodeReward.mean).toFixed(2));
    empiricalFindings.push(
      `Trained vs. untrained Q-Learning reward delta: ${diff >= 0 ? '+' : ''}${diff} (mean wait ${qTrained.waitingTime.mean}t vs. ${qUntrained.waitingTime.mean}t).`
    );
  }

  const dqnTrained = overallSummaries.find((s) => s.policyKey === 'DQN_TRAINED');
  const dqnUntrained = overallSummaries.find((s) => s.policyKey === 'DQN_UNTRAINED');
  if (dqnTrained && dqnUntrained) {
    const diff = Number((dqnTrained.episodeReward.mean - dqnUntrained.episodeReward.mean).toFixed(2));
    empiricalFindings.push(
      `Trained vs. untrained DQN reward delta: ${diff >= 0 ? '+' : ''}${diff} (mean wait ${dqnTrained.waitingTime.mean}t vs. ${dqnUntrained.waitingTime.mean}t).`
    );
  }

  // Dispose temporary untrained DQN tensors cleanly so memory stays spotless
  if (untrainedDqn) {
    untrainedDqn.dispose();
  }

  return {
    id: `statval-${Date.now().toString(36)}`,
    timestamp: new Date().toISOString(),
    config: {
      ...config,
      seedStart: safeSeedStart,
      seedCount: safeSeedCount,
      workloads,
      numProcesses: safeProcs,
      rrQuantum,
      starvationThreshold,
    },
    evaluationSeeds,
    trainingSeedRangeDescription:
      'Bundled pretrained models trained on MIXED workloads using seeds 42 + 17k (42..875).',
    disjointFromTrainingSeeds: disjoint,
    totalEpisodesExecuted,
    durationMs: Date.now() - t0,
    overallSummaries,
    workloadBreakdown,
    ablationStudy,
    empiricalFindings,
  };
}
