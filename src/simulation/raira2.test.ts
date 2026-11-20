import test from 'node:test';
import assert from 'node:assert/strict';
import { SimulationEngine } from './SimulationEngine.ts';
import { generateWorkload } from './WorkloadGenerator.ts';
import { QLearningAgent } from '../reinforcement-learning/QLearningAgent.ts';
import { DQNAgent } from '../reinforcement-learning/DQNAgent.ts';
import {
  getPretrainedDQNModel,
  getPretrainedQLearningModel,
} from '../reinforcement-learning/pretrainedModels.ts';
import {
  executeExplainedDQNStep,
  executeExplainedQLearningStep,
} from '../reinforcement-learning/ExplainableAI.ts';
import { runCounterfactualAnalysis } from './CounterfactualLab.ts';
import { runShockArenaExperiment } from './ShockArena.ts';
import {
  computeFairnessMonitorSnapshot,
  matchesPretrainedRewardWeights,
  REWARD_PRESETS,
} from './FairnessMonitor.ts';
import {
  computeMean,
  computePercentile,
  computeSampleStdDev,
  isDisjointFromTrainingSeeds,
  runStatisticalValidation,
  summarizeMetricDistribution,
} from '../analytics/StatisticalValidation.ts';
import { DEFAULT_REWARD_WEIGHTS, SYSTEM_CONFIG } from '../types/simulation.ts';

async function loadTrainedAgents() {
  const qAgent = new QLearningAgent(undefined, 42);
  qAgent.deserialize(getPretrainedQLearningModel());
  const dqnAgent = new DQNAgent(undefined, 42);
  await dqnAgent.deserialize(getPretrainedDQNModel());
  return { qAgent, dqnAgent };
}

test('Feature 1 (Explainable AI): Q-Learning and DQN produce real Q-values, alternatives, rule-based reasons, and DQN perturbation sensitivity', async () => {
  const { qAgent, dqnAgent } = await loadTrainedAgents();
  const specs = generateWorkload('MIXED', 8, 1005);

  // Q-Learning explained step
  const qEngine = new SimulationEngine();
  qEngine.loadWorkload({ specs, workloadType: 'MIXED', seed: 1005, algorithm: 'Q_LEARNING' });
  const qRes = executeExplainedQLearningStep({ engine: qEngine, qAgent, recordLogs: true });

  assert.equal(qRes.explanation.algorithm, 'Q_LEARNING');
  assert.equal(qRes.explanation.isTrainedModel, true);
  assert.ok(qRes.explanation.validActionCount > 0);
  assert.ok(qRes.explanation.alternativeActions.length > 0);
  assert.ok(qRes.explanation.alternativeActions.some((a) => a.isSelected));
  assert.ok(qRes.explanation.ruleBasedReasons.length >= 2);
  assert.ok(Number.isFinite(qRes.explanation.selectedQValue));
  assert.equal(qEngine.getExplanationHistory().length, 1);

  // DQN explained step with controlled feature-perturbation sensitivity
  const dqnEngine = new SimulationEngine();
  dqnEngine.loadWorkload({ specs, workloadType: 'MIXED', seed: 1005, algorithm: 'DQN' });
  const dqnRes = executeExplainedDQNStep({ engine: dqnEngine, dqnAgent, recordLogs: true });

  assert.equal(dqnRes.explanation.algorithm, 'DQN');
  assert.equal(dqnRes.explanation.isTrainedModel, true);
  assert.ok(dqnRes.explanation.perturbationSensitivity && dqnRes.explanation.perturbationSensitivity.length >= 3);
  for (const row of dqnRes.explanation.perturbationSensitivity!) {
    assert.ok(Number.isFinite(row.baselineSelectedQ));
    assert.ok(Number.isFinite(row.perturbedSelectedQ));
    assert.ok(Math.abs(row.deltaQ - (row.perturbedSelectedQ - row.baselineSelectedQ)) < 1e-3);
  }
  dqnAgent.dispose();
});

test('Feature 2 (Counterfactual What-If Lab): Branches run on 100% isolated clones without mutating live simulator state', async () => {
  const { qAgent, dqnAgent } = await loadTrainedAgents();
  const specs = generateWorkload('MIXED', 10, 1010);
  const liveEngine = new SimulationEngine({ rrQuantum: 2 });
  liveEngine.loadWorkload({ specs, workloadType: 'MIXED', seed: 1010, algorithm: 'DQN' });

  // Advance live simulation 2 steps, then pause
  executeExplainedDQNStep({ engine: liveEngine, dqnAgent, recordLogs: false });
  executeExplainedDQNStep({ engine: liveEngine, dqnAgent, recordLogs: false });

  const tickBefore = liveEngine.getCurrentTick();
  const ramBefore = liveEngine.resourceManager.getAllocatedRamMb();
  const rewardBefore = liveEngine.getMetrics().totalEpisodeReward;
  const procsBeforeJson = JSON.stringify(liveEngine.getProcesses());

  const report = runCounterfactualAnalysis({
    sourceEngine: liveEngine,
    qAgent,
    dqnAgent,
    rlReferenceAgent: 'DQN',
    horizonTicks: 15,
  });

  // Live engine MUST be completely unchanged
  assert.equal(liveEngine.getCurrentTick(), tickBefore);
  assert.equal(liveEngine.resourceManager.getAllocatedRamMb(), ramBefore);
  assert.equal(liveEngine.getMetrics().totalEpisodeReward, rewardBefore);
  assert.equal(JSON.stringify(liveEngine.getProcesses()), procsBeforeJson);

  // Report must contain all 5 required branches & disclaimer
  assert.equal(report.branches.length, 5);
  assert.deepEqual(
    report.branches.map((b) => b.branchId),
    ['SELECTED_RL', 'FCFS', 'RR', 'PRIORITY', 'ALT_RL']
  );
  assert.match(report.disclaimer.toLowerCase(), /counterfactual/);
  for (const b of report.branches) {
    assert.equal(b.metrics.resourceViolations, 0);
    assert.ok(b.metrics.endTick > tickBefore);
  }
  dqnAgent.dispose();
});

test('Feature 3 (Workload Shock Arena): Injects identical shock processes across all 5 policies and measures recovery & resilience', async () => {
  const { qAgent, dqnAgent } = await loadTrainedAgents();
  const report = await runShockArenaExperiment({
    config: {
      shockType: 'MEMORY_BURST',
      injectionTick: 6,
      additionalProcesses: 4,
      cpuBurst: 6,
      ramDemandMb: 1280,
      priority: 4,
      baseWorkloadType: 'MIXED',
      baseNumProcesses: 8,
      seed: 1042,
      rrQuantum: 2,
      starvationThreshold: 12,
    },
    qAgent,
    dqnAgent,
  });

  assert.equal(report.injectedProcessIds.length, 4);
  assert.equal(report.results.length, 5);
  assert.deepEqual(
    report.results.map((r) => r.algorithm),
    ['FCFS', 'RR', 'PRIORITY', 'Q_LEARNING', 'DQN']
  );

  for (const r of report.results) {
    assert.equal(r.finalMetrics.totalProcesses, 12, `${r.algorithm} must include 8 base + 4 shock processes`);
    assert.equal(r.finalMetrics.completedCount, 12, `${r.algorithm} must complete all processes`);
    assert.equal(r.finalMetrics.invalidActionCount, 0, `${r.algorithm} must have 0 invalid actions`);
    assert.ok(r.peakRamPressurePct > 0 && r.peakRamPressurePct <= 100);
    assert.ok(r.maxQueueLength >= 1);
    assert.ok(r.recoveryTicks !== null && r.recoveryTicks >= 0);
  }
  dqnAgent.dispose();
});

test('Feature 4 (Fairness & Starvation Monitor): Accounts for arrival time & CPU demand via GPS expected service share and flags weight provenance', () => {
  const engine = new SimulationEngine({ rrQuantum: 2 });
  engine.loadWorkload({
    specs: [
      { id: 'P01', slotIndex: 0, name: 'long-early', arrivalTime: 0, cpuBurstTime: 10, priority: 5, memoryDemand: 512 },
      { id: 'P02', slotIndex: 1, name: 'starved-low', arrivalTime: 0, cpuBurstTime: 6, priority: 1, memoryDemand: 512 },
      { id: 'P03', slotIndex: 2, name: 'late-short', arrivalTime: 8, cpuBurstTime: 2, priority: 3, memoryDemand: 512 },
    ],
    workloadType: 'CUSTOM',
    seed: 1,
    algorithm: 'PRIORITY',
  });
  engine.setStarvationThreshold(8);

  // Run 10 ticks under Priority scheduling: P01 runs ticks 0..10 while P02 waits 10 ticks!
  for (let i = 0; i < 10; i++) {
    engine.stepBaselineTick('PRIORITY', false);
  }

  const snap = computeFairnessMonitorSnapshot({
    processes: engine.getProcesses(),
    currentTick: engine.getCurrentTick(),
    rewardWeights: engine.getRewardWeights(),
    starvationThreshold: 8,
  });

  const p2 = snap.perProcess.find((p) => p.processId === 'P02')!;
  const p3 = snap.perProcess.find((p) => p.processId === 'P03')!;

  assert.equal(p2.waitingTime, 10);
  assert.equal(p2.exceedsWaitThreshold, true);
  assert.equal(p2.starvationRisk, 'HIGH');
  assert.ok(p2.expectedServiceShare > p3.expectedServiceShare, 'Earlier arrived process P02 must have higher expected service share than late arrival P03');
  assert.ok(p2.serviceDeficit > 0, 'Unserved process P02 must show positive service deficit');
  assert.equal(snap.exceedingThresholdCount, 1);

  // Reward preset provenance distinction
  assert.equal(matchesPretrainedRewardWeights(DEFAULT_REWARD_WEIGHTS), true);
  assert.equal(matchesPretrainedRewardWeights(REWARD_PRESETS.BALANCED.weights), true);
  assert.equal(matchesPretrainedRewardWeights(REWARD_PRESETS.FAIRNESS.weights), false);
  assert.equal(matchesPretrainedRewardWeights(REWARD_PRESETS.EFFICIENCY.weights), false);
});

test('Feature 5 (Live Process Execution Timeline): Accurately records per-tick statuses, preemptions, completions, and RAM reservations', () => {
  const engine = new SimulationEngine({ rrQuantum: 2 });
  engine.loadWorkload({
    specs: [
      { id: 'P01', slotIndex: 0, name: 'alpha', arrivalTime: 0, cpuBurstTime: 3, priority: 3, memoryDemand: 1024 },
      { id: 'P02', slotIndex: 1, name: 'beta', arrivalTime: 0, cpuBurstTime: 2, priority: 3, memoryDemand: 2048 },
    ],
    workloadType: 'CUSTOM',
    seed: 1,
    algorithm: 'RR',
    rrQuantum: 2,
  });

  while (!engine.isDone()) {
    engine.stepBaselineTick('RR', false);
  }

  const timeline = engine.getTimelineTicks();
  assert.equal(timeline.length, 5, 'Total CPU burst is 5 ticks -> 5 timeline ticks');
  // Tick 2: P01 preempted after quantum=2 while retaining 1024 MB RAM
  assert.equal(timeline[1].runningProcessId, 'P01');
  assert.equal(timeline[1].preemptedProcessId, 'P01');
  assert.equal(timeline[1].cells['P01'].preemptedAtTick, true);
  assert.equal(timeline[1].cells['P01'].allocatedMemoryMb, 1024);
  // Tick 4: P02 completes
  assert.equal(timeline[3].completedProcessId, 'P02');
  // Tick 5: P01 completes and total allocated RAM returns to 0
  assert.equal(timeline[4].completedProcessId, 'P01');
  assert.equal(timeline[4].totalAllocatedRamMb, 0);
});

test('Feature 6 (Statistical Research Validation Lab): Exact CI math, disjoint seed verification, and multi-seed validation execution', async () => {
  // Pure statistical math checks
  const arr = [10, 12, 14, 16, 18];
  assert.equal(computeMean(arr), 14);
  assert.ok(Math.abs(computeSampleStdDev(arr) - Math.sqrt(10)) < 1e-6);
  assert.equal(computePercentile(arr, 50), 14);
  assert.ok(computePercentile(arr, 95) > 17);

  const summary = summarizeMetricDistribution(arr, 3);
  assert.equal(summary.mean, 14);
  assert.ok(summary.ci95Low < 14 && summary.ci95High > 14);

  // Disjoint seed verification against training seeds (42 + 17k)
  const eval30 = Array.from({ length: 30 }, (_, i) => 1001 + i);
  assert.equal(isDisjointFromTrainingSeeds(eval30), true);
  assert.equal(isDisjointFromTrainingSeeds([42, 1001]), false);

  // Live 30-seed statistical validation check on MIXED workload (fast & deterministic)
  const { qAgent, dqnAgent } = await loadTrainedAgents();
  const report = await runStatisticalValidation({
    config: {
      seedStart: 1001,
      seedCount: 30,
      workloads: ['MIXED', 'MEMORY_INTENSIVE'],
      numProcesses: 8,
      rrQuantum: 2,
      includeUntrainedComparison: true,
      includeAblationStudy: true,
      starvationThreshold: 15,
    },
    trainedQAgent: qAgent,
    trainedDqnAgent: dqnAgent,
  });

  assert.equal(report.evaluationSeeds.length, 30);
  assert.equal(report.disjointFromTrainingSeeds, true);
  assert.equal(report.overallSummaries.length, 7); // 5 policies + 2 untrained RL refs
  assert.equal(report.workloadBreakdown.length, 2);
  assert.equal(report.workloadBreakdown[1].isUnseenForPretrained, true);
  assert.ok(report.ablationStudy.length >= 4);
  assert.ok(report.empiricalFindings.length >= 3);
  for (const s of report.overallSummaries) {
    assert.equal(s.sampleCount, 60); // 30 seeds * 2 workloads
    assert.equal(s.invalidActionsTotal, 0);
    assert.ok(s.waitingTime.ci95Low <= s.waitingTime.mean);
    assert.ok(s.waitingTime.ci95High >= s.waitingTime.mean);
  }
  dqnAgent.dispose();
});
