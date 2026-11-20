import { SYSTEM_CONFIG } from '../types/simulation.ts';
import type {
  AlternativeActionQ,
  CounterfactualBranchId,
  CounterfactualBranchMetrics,
  CounterfactualBranchResult,
  CounterfactualReport,
} from '../types/intelligence.ts';
import {
  decodeAction,
  formatActionLabel,
  getValidActionIndices,
  WAIT_ACTION,
} from '../reinforcement-learning/ActionSpace.ts';
import type { QLearningAgent } from '../reinforcement-learning/QLearningAgent.ts';
import type { DQNAgent } from '../reinforcement-learning/DQNAgent.ts';
import type { BaselineAlgorithm } from './CpuScheduler.ts';
import type { SimulationEngine } from './SimulationEngine.ts';

function stepRLAgentOnClone(
  clone: SimulationEngine,
  rlAgent: 'Q_LEARNING' | 'DQN',
  qAgent: QLearningAgent,
  dqnAgent: DQNAgent
): number {
  const mask = clone.getActionMask();
  if (rlAgent === 'Q_LEARNING') {
    const chosen = qAgent.selectAction({
      processes: clone.getProcesses(),
      currentTick: clone.getCurrentTick(),
      availableRamMb: clone.resourceManager.getAvailableRamMb(),
      totalRamMb: clone.resourceManager.totalRamMb,
      prevTickCpuBusy: clone.getLastTickCpuBusy(),
      actionMask: mask,
      explore: false,
    });
    clone.stepAction(chosen.actionId, false);
    return chosen.actionId;
  }
  const obs = clone.getObservation();
  const actionId = dqnAgent.selectAction(obs, mask, false);
  clone.stepAction(actionId, false);
  return actionId;
}

function extractBranchMetrics(
  clone: SimulationEngine,
  startTick: number
): CounterfactualBranchMetrics {
  const m = clone.getMetrics();
  return {
    endTick: m.currentTick,
    ticksSimulated: Math.max(0, m.currentTick - startTick),
    avgCpuUtilisation: m.avgCpuUtilisation,
    avgRamUtilisation: m.avgRamUtilisation,
    avgWaitingTime: m.avgWaitingTime,
    avgTurnaroundTime: m.avgTurnaroundTime,
    throughput: m.throughput,
    resourceViolations: m.invalidActionCount,
    jainFairnessIndex: m.jainFairnessIndex,
    completedCount: m.completedCount,
    totalProcesses: m.totalProcesses,
    totalEpisodeReward: m.totalEpisodeReward,
  };
}

function extractTrace(clone: SimulationEngine, startTick: number) {
  const snap = clone.getSnapshot({ qLearningTrained: true, dqnTrained: true });
  const tail = snap.telemetryHistory.filter((t) => t.tick > startTick);
  const step = Math.max(1, Math.floor(tail.length / 40));
  return tail
    .filter((_, idx) => idx % step === 0 || idx === tail.length - 1)
    .map((t) => ({
      tick: t.tick,
      cpuUtil: t.cpuUtil,
      ramUtilPercent: t.ramUtilPercent,
      avgWaitingTime: t.avgWaitingTime,
      completedCount: t.completedCount,
    }));
}

/**
 * Counterfactual What-If Laboratory:
 * Creates completely isolated clones from the live simulator's exact current tick,
 * keeps all future process arrivals identical, and evaluates five alternative decisions:
 *  1. Selected RL action
 *  2. FCFS decision
 *  3. Round Robin decision
 *  4. Priority decision
 *  5. Another valid RL action (runner-up or user-selected valid action)
 *
 * Guarantees zero mutation to the source SimulationEngine.
 */
export function runCounterfactualAnalysis(params: {
  sourceEngine: SimulationEngine;
  qAgent: QLearningAgent;
  dqnAgent: DQNAgent;
  rlReferenceAgent?: 'Q_LEARNING' | 'DQN';
  horizonTicks: number | 'FULL_EPISODE';
  alternativeActionId?: number | null;
}): CounterfactualReport {
  const { sourceEngine, qAgent, dqnAgent, horizonTicks } = params;
  if (sourceEngine.getProcesses().length === 0) {
    throw new Error('Load a workload before running Counterfactual What-If analysis.');
  }
  if (sourceEngine.isDone()) {
    throw new Error('Simulation has already finished. Reset or pause mid-episode to compare counterfactual branches.');
  }

  const startTick = sourceEngine.getCurrentTick();
  const targetEndTick =
    horizonTicks === 'FULL_EPISODE'
      ? SYSTEM_CONFIG.MAX_EPISODE_TICKS
      : Math.min(SYSTEM_CONFIG.MAX_EPISODE_TICKS, startTick + Math.max(1, Math.floor(horizonTicks)));

  // Pick which RL agent anchors the Selected RL & Alt RL branches
  const sourceAlg = sourceEngine.getAlgorithm();
  const rlRef: 'Q_LEARNING' | 'DQN' =
    params.rlReferenceAgent ??
    (sourceAlg === 'DQN' && dqnAgent.isAvailable()
      ? 'DQN'
      : sourceAlg === 'Q_LEARNING'
        ? 'Q_LEARNING'
        : dqnAgent.isAvailable() && dqnAgent.isTrained()
          ? 'DQN'
          : 'Q_LEARNING');

  // Inspect valid actions and Q-values on a read-only probe clone at the exact branch point
  const probe = sourceEngine.clone();
  const processesAtBranch = probe.getProcesses();
  const availableRamAtBranch = probe.resourceManager.getAvailableRamMb();
  const mask = probe.getActionMask();
  const validIndices = getValidActionIndices(mask);

  let rankedActions: Array<{ actionId: number; qValue: number }> = [];
  if (rlRef === 'DQN' && dqnAgent.isAvailable()) {
    const qAll = dqnAgent.predictQValues(probe.getObservation());
    rankedActions = validIndices
      .map((a) => ({ actionId: a, qValue: qAll[a] ?? 0 }))
      .sort((a, b) => b.qValue - a.qValue || a.actionId - b.actionId);
  } else {
    const res = qAgent.evaluateValidActions({
      processes: processesAtBranch,
      currentTick: startTick,
      availableRamMb: availableRamAtBranch,
      totalRamMb: probe.resourceManager.totalRamMb,
      prevTickCpuBusy: probe.getLastTickCpuBusy(),
      actionMask: mask,
    });
    rankedActions = res.validActionQValues.map((e) => ({
      actionId: e.actionId,
      qValue: e.qValue,
    }));
  }

  // Prefer non-WAIT if available, matching greedy RL selection
  const nonWaitRanked = rankedActions.filter((a) => a.actionId !== WAIT_ACTION);
  const selectedEntry = nonWaitRanked[0] ?? rankedActions[0] ?? { actionId: WAIT_ACTION, qValue: 0 };

  // Choose an alternative valid RL action (user choice if valid and distinct, else runner-up)
  let altEntry =
    params.alternativeActionId !== undefined &&
    params.alternativeActionId !== null &&
    mask[params.alternativeActionId] &&
    params.alternativeActionId !== selectedEntry.actionId
      ? rankedActions.find((a) => a.actionId === params.alternativeActionId) ?? null
      : null;

  if (!altEntry) {
    altEntry =
      nonWaitRanked.find((a) => a.actionId !== selectedEntry.actionId) ??
      rankedActions.find((a) => a.actionId !== selectedEntry.actionId) ??
      selectedEntry;
  }

  const validActionsAtBranch: AlternativeActionQ[] = rankedActions.slice(0, 14).map((e) => {
    const dec = decodeAction(e.actionId);
    const proc =
      dec.slotIndex !== null
        ? processesAtBranch.find((p) => p.slotIndex === dec.slotIndex) ?? null
        : null;
    return {
      actionId: e.actionId,
      label: formatActionLabel(e.actionId, processesAtBranch),
      slotIndex: dec.slotIndex,
      processId: proc?.id ?? null,
      processName: proc?.name ?? null,
      quantum: dec.quantum,
      qValue: Number(e.qValue.toFixed(4)),
      qGapFromSelected: Number((selectedEntry.qValue - e.qValue).toFixed(4)),
      processPriority: proc?.priority ?? null,
      remainingCpuTime: proc?.remainingCpuTime ?? null,
      waitingTime: proc?.waitingTime ?? null,
      memoryDemand: proc?.memoryDemand ?? null,
      isSelected: e.actionId === selectedEntry.actionId,
    };
  });

  const runBranch = (
    branchId: CounterfactualBranchId,
    label: string,
    policyDescription: string,
    runner: (clone: SimulationEngine) => { initialActionId: number | null; initialActionLabel: string }
  ): CounterfactualBranchResult => {
    const clone = sourceEngine.clone();
    const { initialActionId, initialActionLabel } = runner(clone);
    const metrics = extractBranchMetrics(clone, startTick);
    const telemetryTrace = extractTrace(clone, startTick);
    return {
      branchId,
      label,
      policyDescription,
      initialActionId,
      initialActionLabel,
      metrics,
      deltasVsSelected: {
        cpuUtilDelta: 0,
        ramUtilDelta: 0,
        waitingTimeDelta: 0,
        turnaroundTimeDelta: 0,
        throughputDelta: 0,
        violationsDelta: 0,
        fairnessDelta: 0,
        rewardDelta: 0,
      },
      telemetryTrace,
    };
  };

  const runRLContinuation = (clone: SimulationEngine, firstActionId: number) => {
    clone.setAlgorithm(rlRef);
    const firstLabel = formatActionLabel(firstActionId, clone.getProcesses());
    clone.stepAction(firstActionId, false);
    let guard = 0;
    while (!clone.isDone() && clone.getCurrentTick() < targetEndTick && guard < SYSTEM_CONFIG.MAX_EPISODE_TICKS) {
      guard++;
      stepRLAgentOnClone(clone, rlRef, qAgent, dqnAgent);
    }
    return { initialActionId: firstActionId, initialActionLabel: firstLabel };
  };

  const runBaselineContinuation = (clone: SimulationEngine, alg: BaselineAlgorithm) => {
    clone.setAlgorithm(alg);
    const firstStep = clone.stepBaselineTick(alg, false);
    let guard = 0;
    while (!clone.isDone() && clone.getCurrentTick() < targetEndTick && guard < SYSTEM_CONFIG.MAX_EPISODE_TICKS) {
      guard++;
      clone.stepBaselineTick(alg, false);
    }
    return {
      initialActionId: null,
      initialActionLabel: firstStep.decision.actionLabel,
    };
  };

  const branches: CounterfactualBranchResult[] = [
    runBranch(
      'SELECTED_RL',
      `Selected RL (${rlRef === 'DQN' ? 'DQN' : 'Q-Learning'})`,
      `Executes greedy ${rlRef === 'DQN' ? 'DQN' : 'Q-Learning'} action at t=${startTick} and continues under ${rlRef}.`,
      (clone) => runRLContinuation(clone, selectedEntry.actionId)
    ),
    runBranch(
      'FCFS',
      'FCFS Counterfactual',
      `Switches to non-preemptive First Come First Serve from t=${startTick} over identical future arrivals.`,
      (clone) => runBaselineContinuation(clone, 'FCFS')
    ),
    runBranch(
      'RR',
      `Round Robin (q=${sourceEngine.getRRQuantum()})`,
      `Switches to preemptive Round Robin (q=${sourceEngine.getRRQuantum()}) from t=${startTick}.`,
      (clone) => runBaselineContinuation(clone, 'RR')
    ),
    runBranch(
      'PRIORITY',
      'Priority Counterfactual',
      `Switches to highest-priority-first scheduling from t=${startTick}.`,
      (clone) => runBaselineContinuation(clone, 'PRIORITY')
    ),
    runBranch(
      'ALT_RL',
      `Alternative RL Action`,
      `Forces alternative valid action #${altEntry.actionId} at t=${startTick}, then resumes ${rlRef === 'DQN' ? 'DQN' : 'Q-Learning'} policy.`,
      (clone) => runRLContinuation(clone, altEntry!.actionId)
    ),
  ];

  const base = branches[0].metrics;
  for (const b of branches) {
    b.deltasVsSelected = {
      cpuUtilDelta: Number((b.metrics.avgCpuUtilisation - base.avgCpuUtilisation).toFixed(2)),
      ramUtilDelta: Number((b.metrics.avgRamUtilisation - base.avgRamUtilisation).toFixed(2)),
      waitingTimeDelta: Number((b.metrics.avgWaitingTime - base.avgWaitingTime).toFixed(2)),
      turnaroundTimeDelta: Number((b.metrics.avgTurnaroundTime - base.avgTurnaroundTime).toFixed(2)),
      throughputDelta: Number((b.metrics.throughput - base.throughput).toFixed(2)),
      violationsDelta: b.metrics.resourceViolations - base.resourceViolations,
      fairnessDelta: Number((b.metrics.jainFairnessIndex - base.jainFairnessIndex).toFixed(4)),
      rewardDelta: Number((b.metrics.totalEpisodeReward - base.totalEpisodeReward).toFixed(2)),
    };
  }

  return {
    id: `cf-${Date.now().toString(36)}`,
    timestamp: new Date().toISOString(),
    disclaimer:
      'Counterfactual simulation on isolated simulator clones with identical known workload arrivals — not a guaranteed future prediction under unobserved external disturbances.',
    sourceAlgorithm: sourceAlg,
    rlReferenceAgent: rlRef,
    startTick,
    horizonTicks,
    workloadType: sourceEngine.getWorkloadType(),
    seed: sourceEngine.getSeed(),
    availableRamAtBranchMb: availableRamAtBranch,
    validActionsAtBranch,
    selectedAlternativeActionId: altEntry.actionId,
    branches,
  };
}
