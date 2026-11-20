import test from 'node:test';
import assert from 'node:assert/strict';
import { generateWorkload } from './WorkloadGenerator';
import { SimulationEngine } from './SimulationEngine';
import { validateProcessInput } from './Process';
import { computeJainFairnessIndex } from './MetricsCalculator';
import {
  ACTION_SPACE_SIZE,
  computeActionMask,
  decodeAction,
  encodeAction,
  WAIT_ACTION,
} from '../reinforcement-learning/ActionSpace';
import {
  encodeCandidateStateActionKey,
  encodeCompactStateKey,
  encodeObservation,
  OBSERVATION_SIZE,
} from '../reinforcement-learning/StateEncoder';
import {
  accumulateDiscountedRewards,
  calculateTickReward,
} from '../reinforcement-learning/RewardCalculator';
import { QLearningAgent } from '../reinforcement-learning/QLearningAgent';
import { DQNAgent } from '../reinforcement-learning/DQNAgent';
import {
  getPretrainedDQNModel,
  getPretrainedQLearningModel,
} from '../reinforcement-learning/pretrainedModels';
import { TrainingEngine } from '../reinforcement-learning/TrainingEngine';
import { DEFAULT_REWARD_WEIGHTS, SYSTEM_CONFIG } from '../types/simulation';

test('Seeded WorkloadGenerator produces identical workloads for identical seeds across all 4 scenarios', () => {
  const scenarios = ['CPU_INTENSIVE', 'MEMORY_INTENSIVE', 'MIXED', 'DYNAMIC'] as const;
  for (const scenario of scenarios) {
    const a = generateWorkload(scenario, 12, 1337);
    const b = generateWorkload(scenario, 12, 1337);
    const c = generateWorkload(scenario, 12, 7331);
    assert.deepEqual(a, b, `Scenario ${scenario} must be reproducible for identical seed`);
    assert.notDeepEqual(a, c, `Scenario ${scenario} should vary for different seeds`);
    assert.equal(a.length, 12);
    for (let i = 0; i < a.length; i++) {
      assert.equal(a[i].slotIndex, i);
      assert.ok(a[i].memoryDemand >= 64 && a[i].memoryDemand <= SYSTEM_CONFIG.TOTAL_RAM_MB);
      assert.ok(a[i].priority >= 1 && a[i].priority <= 5);
    }
  }
});

test('Process input validation rejects invalid burst, priority, arrival, and memory values', () => {
  const bad = validateProcessInput({
    name: '',
    arrivalTime: -1,
    cpuBurstTime: 0,
    priority: 7,
    memoryDemand: 8192,
  });
  assert.equal(bad.valid, false);
  assert.ok(bad.errors.name);
  assert.ok(bad.errors.arrivalTime);
  assert.ok(bad.errors.cpuBurstTime);
  assert.ok(bad.errors.priority);
  assert.ok(bad.errors.memoryDemand);

  const good = validateProcessInput({
    name: 'worker-01',
    arrivalTime: 0,
    cpuBurstTime: 10,
    priority: 4,
    memoryDemand: 1024,
  });
  assert.equal(good.valid, true);
});

test('Baseline schedulers enforce single-core CPU, 4096 MB RAM cap, non-release on preemption, and full completion', () => {
  const specs = generateWorkload('MEMORY_INTENSIVE', 10, 42);
  const algorithms = ['FCFS', 'RR', 'PRIORITY'] as const;

  for (const alg of algorithms) {
    const engine = new SimulationEngine({ rrQuantum: 2 });
    engine.loadWorkload({ specs, workloadType: 'MEMORY_INTENSIVE', seed: 42, algorithm: alg });

    let steps = 0;
    while (!engine.isDone() && steps < 600) {
      engine.stepBaselineTick(alg, false);
      steps++;

      const procs = engine.getProcesses();
      const runningCount = procs.filter((p) => p.status === 'RUNNING').length;
      assert.ok(runningCount <= 1, `[${alg}] Never more than 1 running process`);

      const inv = engine.resourceManager.verifyInvariants(procs);
      assert.equal(inv.ok, true, `[${alg}] RAM invariant failed: ${inv.reason}`);
      assert.ok(
        engine.resourceManager.getAllocatedRamMb() <= SYSTEM_CONFIG.TOTAL_RAM_MB,
        `[${alg}] Allocated RAM must never exceed 4096 MB`
      );
    }

    assert.equal(engine.isTerminated(), true, `[${alg}] Should complete all processes`);
    assert.equal(engine.resourceManager.getAllocatedRamMb(), 0, `[${alg}] All RAM released on completion`);
    const metrics = engine.getMetrics();
    assert.equal(metrics.completedCount, 10);
    assert.ok(metrics.avgCpuUtilisation > 0 && metrics.avgCpuUtilisation <= 100);
    assert.ok(metrics.avgTurnaroundTime > 0);
  }
});

test('Round Robin preemption retains allocated RAM until completion', () => {
  const engine = new SimulationEngine({ rrQuantum: 2 });
  engine.loadWorkload({
    specs: [
      { id: 'P01', slotIndex: 0, name: 'job-a', arrivalTime: 0, cpuBurstTime: 5, priority: 3, memoryDemand: 2048 },
      { id: 'P02', slotIndex: 1, name: 'job-b', arrivalTime: 0, cpuBurstTime: 4, priority: 3, memoryDemand: 2048 },
      { id: 'P03', slotIndex: 2, name: 'job-c', arrivalTime: 0, cpuBurstTime: 3, priority: 5, memoryDemand: 1024 },
    ],
    workloadType: 'CUSTOM',
    seed: 1,
    algorithm: 'RR',
    rrQuantum: 2,
  });

  // Tick 1 and 2: P01 runs for quantum=2 and gets preempted
  engine.stepBaselineTick('RR', false);
  engine.stepBaselineTick('RR', false);

  const p1 = engine.getProcesses()[0];
  const p2 = engine.getProcesses()[1];
  const p3 = engine.getProcesses()[2];

  assert.equal(p1.status, 'READY', 'P01 should be preempted back to READY after quantum=2');
  assert.equal(p1.allocatedMemory, 2048, 'Preemption must NOT release P01 RAM');
  assert.equal(p2.allocatedMemory, 2048, 'P02 holds the remaining 2048 MB RAM');
  assert.equal(p3.status, 'BLOCKED', 'P03 must remain BLOCKED because 4096 MB is full');
  assert.equal(p3.allocatedMemory, 0);
});

test('Observation encoder produces 262 float32 features clamped to [0, 1] and ActionSpace masks invalid actions', () => {
  const engine = new SimulationEngine();
  engine.loadWorkload({
    specs: [
      { id: 'P01', slotIndex: 0, name: 'fit-now', arrivalTime: 0, cpuBurstTime: 6, priority: 5, memoryDemand: 3072 },
      { id: 'P02', slotIndex: 1, name: 'too-big-after-p1', arrivalTime: 0, cpuBurstTime: 4, priority: 2, memoryDemand: 2048 },
      { id: 'P03', slotIndex: 2, name: 'future-proc', arrivalTime: 10, cpuBurstTime: 5, priority: 4, memoryDemand: 512 },
    ],
    workloadType: 'CUSTOM',
    seed: 1,
    algorithm: 'Q_LEARNING',
  });

  const obs = engine.getObservation();
  assert.equal(obs.length, OBSERVATION_SIZE);
  assert.equal(obs.length, 262);
  for (let i = 0; i < obs.length; i++) {
    assert.ok(obs[i] >= 0 && obs[i] <= 1, `Feature ${i} out of [0,1]: ${obs[i]}`);
  }
  // Future NEW process P03 is observable
  const p3Offset = 6 + 2 * 8;
  assert.equal(obs[p3Offset], 1.0); // slotOccupied
  assert.ok(Math.abs(obs[p3Offset + 1] - 0.2) < 1e-5); // NEW status
  assert.ok(obs[p3Offset + 7] > 0); // timeToArrival > 0

  // Action encoding round-trip
  assert.equal(ACTION_SPACE_SIZE, 97);
  const aP0Q4 = encodeAction(0, 2);
  assert.equal(aP0Q4, 3);
  const decoded = decodeAction(aP0Q4);
  assert.equal(decoded.slotIndex, 0);
  assert.equal(decoded.quantum, 4);

  // Execute P01 for 2 ticks -> reserves 3072 MB RAM -> 1024 MB left
  const step1 = engine.stepAction(encodeAction(0, 1), false);
  assert.equal(step1.elapsedTicks, 2);
  assert.equal(engine.resourceManager.getAvailableRamMb(), 1024);

  // P02 needs 2048 MB > 1024 MB -> MUST be masked out!
  const mask = computeActionMask(engine.getProcesses(), engine.resourceManager.getAvailableRamMb());
  assert.equal(mask[WAIT_ACTION], true);
  assert.equal(mask[encodeAction(0, 0)], true, 'P01 already has RAM reserved so it is valid');
  assert.equal(mask[encodeAction(1, 0)], false, 'P02 must be masked due to insufficient RAM');
  assert.equal(mask[encodeAction(2, 0)], false, 'Future NEW P03 must be masked');

  // Directly forcing an invalid action must apply invalid penalty without over-allocating RAM
  const invalidStep = engine.stepAction(encodeAction(1, 0), false);
  assert.equal(invalidStep.decision.invalidAttempt, true);
  assert.equal(invalidStep.rewardBreakdown.pInvalid, DEFAULT_REWARD_WEIGHTS.invalidActionPenalty);
  assert.equal(engine.resourceManager.getAllocatedRamMb(), 3072);
});

test('Reward calculator charges waiting incrementally, turnaround once, zero CPU reward on idle, and discounts SMDP rewards', () => {
  const specs = generateWorkload('MIXED', 4, 9);
  const engine = new SimulationEngine();
  engine.loadWorkload({ specs, workloadType: 'MIXED', seed: 9, algorithm: 'Q_LEARNING' });

  const idleBreakdown = calculateTickReward({
    cpuBusy: false,
    completedProcess: null,
    waitingProcessCount: 2,
    processes: engine.getProcesses(),
    invalidAction: false,
  });
  assert.equal(idleBreakdown.rCpu, 0, 'Idle CPU must never earn positive CPU reward');
  assert.equal(idleBreakdown.pWaiting, 0.1);
  assert.equal(idleBreakdown.pTurnaround, 0);

  const discounted = accumulateDiscountedRewards([idleBreakdown, idleBreakdown], 0.95);
  const expected = Number((idleBreakdown.total + 0.95 * idleBreakdown.total).toFixed(4));
  assert.ok(Math.abs(discounted.total - expected) < 1e-3);

  const jain = computeJainFairnessIndex(engine.getProcesses());
  assert.ok(jain > 0 && jain <= 1);
});

test('Candidate-aware Tabular Q-Learning trains, differentiates slots, and serializes/deserializes cleanly', () => {
  const qAgent = new QLearningAgent(undefined, 42);
  const dqnAgent = new DQNAgent(undefined, 42);
  const trainer = new TrainingEngine(qAgent, dqnAgent);

  // Verify candidate-aware keys differentiate distinct slots
  const specs = generateWorkload('MIXED', 6, 42);
  const env = new SimulationEngine();
  env.loadWorkload({ specs, workloadType: 'MIXED', seed: 42, algorithm: 'Q_LEARNING' });
  const compact = encodeCompactStateKey({
    processes: env.getProcesses(),
    currentTick: 0,
    availableRamMb: 4096,
    totalRamMb: 4096,
    prevTickCpuBusy: false,
  });
  const k0 = encodeCandidateStateActionKey({
    compactStateKey: compact,
    actionId: encodeAction(0, 0),
    processes: env.getProcesses(),
    availableRamMb: 4096,
  });
  const k1 = encodeCandidateStateActionKey({
    compactStateKey: compact,
    actionId: encodeAction(1, 2),
    processes: env.getProcesses(),
    availableRamMb: 4096,
  });
  assert.notEqual(k0, k1, 'Candidate-aware keys should distinguish distinct process/quantum actions');

  const metric = trainer.runSingleEpisode(
    {
      agentType: 'Q_LEARNING',
      workloadType: 'MIXED',
      numProcesses: 6,
      episodes: 2,
      learningRate: 0.15,
      discountFactor: 0.95,
      epsilonStart: 0.5,
      epsilonDecay: 0.9,
      epsilonMin: 0.05,
      batchSize: 32,
      targetUpdateFreq: 20,
      seed: 42,
    },
    1
  );

  assert.ok(qAgent.getStateCount() > 0);
  assert.ok(qAgent.getQTableEntryCount() > 0);
  assert.equal(metric.completedCount, 6);

  const saved = qAgent.serialize();
  const restored = new QLearningAgent(undefined, 99);
  restored.deserialize(saved);
  assert.equal(restored.getQTableEntryCount(), qAgent.getQTableEntryCount());
  assert.equal(restored.isTrained(), true);
});

test('TensorFlow.js DQN initializes (262 -> 256 -> 128 -> 97), runs SMDP training step, and checkpoints cleanly', async () => {
  const dqn = new DQNAgent({ batchSize: 8, targetUpdateFreq: 4 }, 42);
  const status = await dqn.initialize(42);
  assert.equal(status.available, true, `TF.js should be available: ${status.error}`);
  // Exact parameter count: (262*256 + 256) + (256*128 + 128) + (128*97 + 97) = 67328 + 32896 + 12513 = 112737
  assert.equal(status.parameterCount, 112737);

  const qAgent = new QLearningAgent(undefined, 42);
  const trainer = new TrainingEngine(qAgent, dqn);
  const metric = trainer.runSingleEpisode(
    {
      agentType: 'DQN',
      workloadType: 'MIXED',
      numProcesses: 5,
      episodes: 1,
      learningRate: 0.001,
      discountFactor: 0.95,
      epsilonStart: 0.4,
      epsilonDecay: 0.95,
      epsilonMin: 0.05,
      batchSize: 8,
      targetUpdateFreq: 4,
      seed: 42,
    },
    1
  );

  assert.equal(dqn.isTrained(), true);
  assert.ok(metric.dqnLoss !== null && metric.dqnLoss !== undefined && Number.isFinite(metric.dqnLoss));

  const checkpoint = dqn.serialize();
  assert.equal(checkpoint.weights.length, 6);
  const restored = new DQNAgent(undefined, 99);
  await restored.deserialize(checkpoint);
  assert.equal(restored.isTrained(), true);
});

test('Pretrained Q-Learning (50 ep) and DQN (25 ep) checkpoints hydrate cleanly and complete 10-process Mixed workload', async () => {
  const qAgent = new QLearningAgent(undefined, 42);
  qAgent.deserialize(getPretrainedQLearningModel());
  assert.equal(qAgent.isTrained(), true);
  assert.equal(qAgent.getSummary().episodesTrained, 50);
  assert.equal(qAgent.getHistory().length, 50);

  const dqnAgent = new DQNAgent(undefined, 42);
  await dqnAgent.deserialize(getPretrainedDQNModel());
  assert.equal(dqnAgent.isTrained(), true);
  assert.equal(dqnAgent.getSummary().episodesTrained, 25);
  assert.equal(dqnAgent.getHistory().length, 25);

  const specs = generateWorkload('MIXED', 10, 42);
  for (const alg of ['Q_LEARNING', 'DQN'] as const) {
    const sim = new SimulationEngine();
    sim.loadWorkload({ specs, workloadType: 'MIXED', seed: 42, algorithm: alg });
    while (!sim.isDone()) {
      if (alg === 'Q_LEARNING') {
        const chosen = qAgent.selectAction({
          processes: sim.getProcesses(),
          currentTick: sim.getCurrentTick(),
          availableRamMb: sim.resourceManager.getAvailableRamMb(),
          totalRamMb: sim.resourceManager.totalRamMb,
          prevTickCpuBusy: sim.getMetrics().currentCpuUtilisation > 0,
          actionMask: sim.getActionMask(),
          explore: false,
        });
        sim.stepAction(chosen.actionId, false);
      } else {
        const actionId = dqnAgent.selectAction(sim.getObservation(), sim.getActionMask(), false);
        sim.stepAction(actionId, false);
      }
    }
    const met = sim.getMetrics();
    assert.equal(met.completedCount, 10, `${alg} should complete all 10 processes`);
    assert.equal(met.invalidActionCount, 0, `${alg} must never emit invalid actions`);
    assert.equal(met.currentRamUsedMb, 0, `${alg} must release all RAM upon completion`);
  }
});

