import type { ProcessRecord } from '../types/process.ts';
import type {
  AlternativeActionQ,
  DecisionExplanation,
  DecisionProcessSnapshot,
  DQNPerturbationSensitivity,
} from '../types/intelligence.ts';
import {
  decodeAction,
  formatActionLabel,
  getValidActionIndices,
  WAIT_ACTION,
} from './ActionSpace.ts';
import type { QLearningAgent } from './QLearningAgent.ts';
import type { DQNAgent } from './DQNAgent.ts';
import type { SimulationEngine, StepResult } from '../simulation/SimulationEngine.ts';

function toProcessSnapshot(p: ProcessRecord): DecisionProcessSnapshot {
  return {
    id: p.id,
    slotIndex: p.slotIndex,
    name: p.name,
    status: p.status,
    priority: p.priority,
    arrivalTime: p.arrivalTime,
    cpuBurstTime: p.cpuBurstTime,
    remainingCpuTime: p.remainingCpuTime,
    waitingTime: p.waitingTime,
    memoryDemand: p.memoryDemand,
    allocatedMemory: p.allocatedMemory,
  };
}

function buildAlternativeActions(
  validEntries: Array<{ actionId: number; qValue: number }>,
  selectedActionId: number,
  selectedQValue: number,
  processes: ProcessRecord[],
  limit: number = 12
): AlternativeActionQ[] {
  const sorted = [...validEntries].sort((a, b) => b.qValue - a.qValue || a.actionId - b.actionId);
  const top = sorted.slice(0, limit);
  if (!top.some((e) => e.actionId === selectedActionId)) {
    const sel = sorted.find((e) => e.actionId === selectedActionId);
    if (sel) {
      top.pop();
      top.push(sel);
    }
  }

  return top.map((entry) => {
    const decoded = decodeAction(entry.actionId);
    const proc =
      decoded.slotIndex !== null
        ? processes.find((p) => p.slotIndex === decoded.slotIndex) ?? null
        : null;
    return {
      actionId: entry.actionId,
      label: formatActionLabel(entry.actionId, processes),
      slotIndex: decoded.slotIndex,
      processId: proc?.id ?? null,
      processName: proc?.name ?? null,
      quantum: decoded.quantum,
      qValue: Number(entry.qValue.toFixed(4)),
      qGapFromSelected: Number((selectedQValue - entry.qValue).toFixed(4)),
      processPriority: proc?.priority ?? null,
      remainingCpuTime: proc?.remainingCpuTime ?? null,
      waitingTime: proc?.waitingTime ?? null,
      memoryDemand: proc?.memoryDemand ?? null,
      isSelected: entry.actionId === selectedActionId,
    };
  });
}

/**
 * Generates strictly deterministic, rule-based explanations derived solely from actual
 * simulator state features, action mask, Q-values, and post-execution transitions.
 * Never fabricates natural-language claims unsupported by numeric values.
 */
function deriveRuleBasedReasons(params: {
  algorithm: 'Q_LEARNING' | 'DQN';
  isTrainedModel: boolean;
  selectedActionId: number;
  selectedQValue: number;
  selectedProcess: DecisionProcessSnapshot | null;
  selectedQuantum: number;
  alternatives: AlternativeActionQ[];
  availableRamBeforeMb: number;
  processesBefore: ProcessRecord[];
  stepResult: StepResult;
}): string[] {
  const reasons: string[] = [];
  const {
    algorithm,
    isTrainedModel,
    selectedActionId,
    selectedQValue,
    selectedProcess,
    selectedQuantum,
    alternatives,
    availableRamBeforeMb,
    processesBefore,
    stepResult,
  } = params;

  const runnerUp = alternatives.find((a) => a.actionId !== selectedActionId);
  if (runnerUp) {
    const margin = Number((selectedQValue - runnerUp.qValue).toFixed(4));
    reasons.push(
      `${algorithm === 'Q_LEARNING' ? 'Tabular Q-Learning' : 'DQN'} (${isTrainedModel ? 'trained policy' : 'untrained weights'}) ranked action #${selectedActionId} highest among ${alternatives.length} inspected valid actions with Q=${selectedQValue.toFixed(4)} (${margin >= 0 ? '+' : ''}${margin.toFixed(4)} vs runner-up ${runnerUp.label} at Q=${runnerUp.qValue.toFixed(4)}).`
    );
  } else {
    reasons.push(
      `Only 1 valid action (#${selectedActionId}) was permitted by the hardware action mask at this tick (Q=${selectedQValue.toFixed(4)}).`
    );
  }

  if (!selectedProcess || selectedActionId === WAIT_ACTION) {
    const blockedCount = processesBefore.filter((p) => p.status === 'BLOCKED').length;
    const readyCount = processesBefore.filter((p) => p.status === 'READY').length;
    reasons.push(
      `Selected WAIT (1 tick) with ${readyCount} READY and ${blockedCount} BLOCKED process(es) and ${availableRamBeforeMb} MB RAM free.`
    );
    return reasons;
  }

  const eligiblePeers = processesBefore.filter(
    (p) =>
      p.status === 'READY' ||
      (p.status === 'BLOCKED' && p.memoryDemand <= availableRamBeforeMb)
  );

  // Priority ranking check
  const maxPriority = Math.max(...eligiblePeers.map((p) => p.priority), selectedProcess.priority);
  if (selectedProcess.priority === maxPriority && eligiblePeers.length > 1) {
    reasons.push(
      `${selectedProcess.id} holds the highest priority (P${selectedProcess.priority}) among ${eligiblePeers.length} RAM-eligible processes.`
    );
  } else if (selectedProcess.priority < maxPriority) {
    reasons.push(
      `${selectedProcess.id} (P${selectedProcess.priority}) was chosen ahead of higher-priority peer(s) up to P${maxPriority} based on learned Q-value trade-offs.`
    );
  }

  // Remaining CPU / completion opportunity
  const minRemaining = Math.min(
    ...eligiblePeers.map((p) => p.remainingCpuTime),
    selectedProcess.remainingCpuTime
  );
  if (selectedProcess.remainingCpuTime <= selectedQuantum) {
    reasons.push(
      `Quantum q=${selectedQuantum} covers remaining burst (${selectedProcess.remainingCpuTime}t), enabling immediate completion bonus (+${stepResult.rewardBreakdown.rCompletion.toFixed(2)}) and releasing ${selectedProcess.memoryDemand} MB RAM.`
    );
  } else if (selectedProcess.remainingCpuTime === minRemaining && eligiblePeers.length > 1) {
    reasons.push(
      `${selectedProcess.id} has the shortest remaining CPU time (${selectedProcess.remainingCpuTime}t) among eligible peers, reducing turnaround overhead.`
    );
  } else {
    reasons.push(
      `Assigned q=${selectedQuantum}t slice to ${selectedProcess.id} (${selectedProcess.remainingCpuTime}t remaining before step, ${stepResult.decision.preempted ? 'preempted after slice while retaining RAM' : 'executed without preemption'}).`
    );
  }

  // Waiting time / starvation pressure check
  const maxWait = Math.max(...eligiblePeers.map((p) => p.waitingTime), selectedProcess.waitingTime);
  if (selectedProcess.waitingTime > 0 && selectedProcess.waitingTime === maxWait && eligiblePeers.length > 1) {
    reasons.push(
      `${selectedProcess.id} had the longest accumulated waiting time (${selectedProcess.waitingTime}t) among eligible processes, mitigating starvation risk.`
    );
  }

  // RAM admission / reuse check
  if (stepResult.decision.admittedFromBlocked) {
    reasons.push(
      `Admitted ${selectedProcess.id} from BLOCKED state by reserving ${selectedProcess.memoryDemand} MB out of ${availableRamBeforeMb} MB available RAM.`
    );
  } else if (selectedProcess.allocatedMemory > 0) {
    reasons.push(
      `${selectedProcess.id} already held ${selectedProcess.allocatedMemory} MB reserved RAM (zero additional RAM allocation required).`
    );
  }

  return reasons;
}

/**
 * Controlled feature-perturbation sensitivity analysis for DQN.
 * Perturbs interpretable indices in the actual 262-feature observation vector and re-evaluates
 * the live TensorFlow.js online network to measure exact Q-value sensitivity and decision stability.
 */
export function runDQNPerturbationAnalysis(params: {
  dqnAgent: DQNAgent;
  observation: Float32Array;
  actionMask: boolean[];
  selectedActionId: number;
  selectedSlotIndex: number | null;
  processes: ProcessRecord[];
}): DQNPerturbationSensitivity[] {
  const { dqnAgent, observation, actionMask, selectedActionId, selectedSlotIndex, processes } = params;
  if (!dqnAgent.isAvailable()) return [];

  const validActions = getValidActionIndices(actionMask);
  const processActions = validActions.filter((a) => a !== WAIT_ACTION);
  const candidateActions = processActions.length > 0 ? processActions : validActions;

  const baseQ = dqnAgent.predictQValues(observation);
  const baselineSelectedQ = baseQ[selectedActionId] ?? 0;

  const pickBest = (qArr: number[]) => {
    let bestId = candidateActions[0] ?? WAIT_ACTION;
    let bestVal = -Infinity;
    for (const a of candidateActions) {
      if (qArr[a] > bestVal) {
        bestVal = qArr[a];
        bestId = a;
      }
    }
    return bestId;
  };

  // Observation layout:
  // [0]: availableRam / totalRam
  // [1]: readyCount / 32
  // [2]: blockedCount / 32
  // [3]: completedCount / 32
  // [4]: prevTickCpuBusy
  // [5]: normalizedTick
  // For slot i: offset = 6 + i * 8:
  //   +0 occupied, +1 status, +2 priority/5, +3 remainingCpu/20, +4 memDemand/4096, +5 allocMem/4096, +6 wait/100, +7 timeToArrival/60
  const perturbations: Array<{
    featureName: string;
    perturbationDescription: string;
    apply: (vec: Float32Array) => void;
  }> = [
    {
      featureName: 'Available RAM Ratio',
      perturbationDescription: 'Simulate tight RAM pressure (−0.30 available RAM ratio)',
      apply: (v) => {
        v[0] = Math.max(0, v[0] - 0.3);
      },
    },
    {
      featureName: 'Ready Queue Congestion',
      perturbationDescription: 'Increase ready queue load (+0.25 normalized ready count)',
      apply: (v) => {
        v[1] = Math.min(1, v[1] + 0.25);
      },
    },
    {
      featureName: 'Blocked Queue Pressure',
      perturbationDescription: 'Increase memory-blocked queue (+0.25 normalized blocked count)',
      apply: (v) => {
        v[2] = Math.min(1, v[2] + 0.25);
      },
    },
  ];

  if (selectedSlotIndex !== null && selectedSlotIndex >= 0 && selectedSlotIndex < 32) {
    const off = 6 + selectedSlotIndex * 8;
    const procId = processes.find((p) => p.slotIndex === selectedSlotIndex)?.id ?? `Slot ${selectedSlotIndex}`;
    perturbations.push(
      {
        featureName: `${procId} Priority`,
        perturbationDescription: 'Lower selected process priority (−0.40, i.e., −2 priority tiers)',
        apply: (v) => {
          v[off + 2] = Math.max(0.2, v[off + 2] - 0.4);
        },
      },
      {
        featureName: `${procId} Remaining CPU`,
        perturbationDescription: 'Increase selected process remaining burst (+0.35 normalized burst)',
        apply: (v) => {
          v[off + 3] = Math.min(1, v[off + 3] + 0.35);
        },
      },
      {
        featureName: `${procId} Waiting Time`,
        perturbationDescription: 'Increase selected process accumulated wait (+0.35 normalized wait)',
        apply: (v) => {
          v[off + 6] = Math.min(1, v[off + 6] + 0.35);
        },
      },
      {
        featureName: `${procId} Memory Demand`,
        perturbationDescription: 'Increase selected process RAM demand (+0.30 of 4096 MB)',
        apply: (v) => {
          v[off + 4] = Math.min(1, v[off + 4] + 0.3);
        },
      }
    );
  }

  return perturbations.map((p) => {
    const perturbedVec = new Float32Array(observation);
    p.apply(perturbedVec);
    const perturbedQAll = dqnAgent.predictQValues(perturbedVec);
    const perturbedSelectedQ = perturbedQAll[selectedActionId] ?? 0;
    const newBestId = pickBest(perturbedQAll);
    return {
      featureName: p.featureName,
      perturbationDescription: p.perturbationDescription,
      baselineSelectedQ: Number(baselineSelectedQ.toFixed(4)),
      perturbedSelectedQ: Number(perturbedSelectedQ.toFixed(4)),
      deltaQ: Number((perturbedSelectedQ - baselineSelectedQ).toFixed(4)),
      actionChanged: newBestId !== selectedActionId,
      newBestActionId: newBestId,
      newBestActionLabel: formatActionLabel(newBestId, processes),
    };
  });
}

/**
 * Executes one Q-Learning decision on the provided SimulationEngine AND returns
 * a complete, ground-truth Explainable AI DecisionExplanation derived from real Q-values.
 */
export function executeExplainedQLearningStep(params: {
  engine: SimulationEngine;
  qAgent: QLearningAgent;
  recordLogs?: boolean;
}): { stepResult: StepResult; explanation: DecisionExplanation } {
  const { engine, qAgent, recordLogs = true } = params;
  const tickBefore = engine.getCurrentTick();
  const processesBefore = engine.getProcesses().map((p) => ({ ...p }));
  const availableRamBefore = engine.resourceManager.getAvailableRamMb();
  const totalRamMb = engine.resourceManager.totalRamMb;
  const prevBusy = engine.getLastTickCpuBusy();
  const mask = engine.getActionMask();

  const evalRes = qAgent.evaluateValidActions({
    processes: processesBefore,
    currentTick: tickBefore,
    availableRamMb: availableRamBefore,
    totalRamMb,
    prevTickCpuBusy: prevBusy,
    actionMask: mask,
  });

  const chosen = qAgent.selectAction({
    processes: processesBefore,
    currentTick: tickBefore,
    availableRamMb: availableRamBefore,
    totalRamMb,
    prevTickCpuBusy: prevBusy,
    actionMask: mask,
    explore: false,
  });

  const selectedEntry = evalRes.validActionQValues.find((e) => e.actionId === chosen.actionId);
  const selectedQValue = selectedEntry?.qValue ?? qAgent.getQValue(chosen.stateActionKey);

  const decoded = decodeAction(chosen.actionId);
  const selectedProcBefore =
    decoded.slotIndex !== null
      ? processesBefore.find((p) => p.slotIndex === decoded.slotIndex) ?? null
      : null;
  const selectedProcessSnap = selectedProcBefore ? toProcessSnapshot(selectedProcBefore) : null;

  const stepResult = engine.stepAction(chosen.actionId, recordLogs);
  const postProc =
    decoded.slotIndex !== null
      ? engine.getProcesses().find((p) => p.slotIndex === decoded.slotIndex) ?? null
      : null;

  const alternatives = buildAlternativeActions(
    evalRes.validActionQValues,
    chosen.actionId,
    selectedQValue,
    processesBefore,
    12
  );

  const ruleBasedReasons = deriveRuleBasedReasons({
    algorithm: 'Q_LEARNING',
    isTrainedModel: qAgent.isTrained(),
    selectedActionId: chosen.actionId,
    selectedQValue,
    selectedProcess: selectedProcessSnap,
    selectedQuantum: decoded.quantum,
    alternatives,
    availableRamBeforeMb: availableRamBefore,
    processesBefore,
    stepResult,
  });

  const explanation: DecisionExplanation = {
    id: `xai-q-${tickBefore}-${Date.now().toString(36)}`,
    tick: tickBefore,
    algorithm: 'Q_LEARNING',
    isTrainedModel: qAgent.isTrained(),
    selectedActionId: chosen.actionId,
    selectedActionLabel: formatActionLabel(chosen.actionId, processesBefore),
    selectedQuantum: decoded.quantum,
    selectedProcess: selectedProcessSnap,
    availableRamBeforeMb: availableRamBefore,
    totalRamMb,
    readyCountBefore: processesBefore.filter((p) => p.status === 'READY').length,
    blockedCountBefore: processesBefore.filter((p) => p.status === 'BLOCKED').length,
    selectedQValue: Number(selectedQValue.toFixed(4)),
    validActionCount: evalRes.validActionQValues.length,
    alternativeActions: alternatives,
    rewardBreakdown: { ...stepResult.rewardBreakdown },
    postExecution: {
      newTick: engine.getCurrentTick(),
      elapsedTicks: stepResult.elapsedTicks,
      processNewStatus: postProc?.status ?? null,
      processRemainingCpuAfter: postProc?.remainingCpuTime ?? null,
      processAllocatedMemoryAfter: postProc?.allocatedMemory ?? null,
      availableRamAfterMb: engine.resourceManager.getAvailableRamMb(),
      admittedFromBlocked: stepResult.decision.admittedFromBlocked,
      preempted: stepResult.decision.preempted,
      completed: stepResult.decision.completed,
      invalidAttempt: stepResult.decision.invalidAttempt,
    },
    ruleBasedReasons,
    compactStateKey: evalRes.compactStateKey,
  };

  engine.recordDecisionExplanation(explanation);
  return { stepResult, explanation };
}

/**
 * Executes one DQN decision on the provided SimulationEngine AND returns
 * a complete, ground-truth Explainable AI DecisionExplanation with real network Q-values
 * and controlled feature-perturbation sensitivity analysis.
 */
export function executeExplainedDQNStep(params: {
  engine: SimulationEngine;
  dqnAgent: DQNAgent;
  recordLogs?: boolean;
}): { stepResult: StepResult; explanation: DecisionExplanation } {
  const { engine, dqnAgent, recordLogs = true } = params;
  const tickBefore = engine.getCurrentTick();
  const processesBefore = engine.getProcesses().map((p) => ({ ...p }));
  const availableRamBefore = engine.resourceManager.getAvailableRamMb();
  const totalRamMb = engine.resourceManager.totalRamMb;
  const observation = engine.getObservation();
  const mask = engine.getActionMask();

  const allQ = dqnAgent.predictQValues(observation);
  const validIndices = getValidActionIndices(mask);
  const processActions = validIndices.filter((a) => a !== WAIT_ACTION);
  const candidateActions = processActions.length > 0 ? processActions : validIndices;

  let selectedActionId = candidateActions[0] ?? WAIT_ACTION;
  let selectedQValue = -Infinity;
  for (const a of candidateActions) {
    if (allQ[a] > selectedQValue) {
      selectedQValue = allQ[a];
      selectedActionId = a;
    }
  }
  if (!Number.isFinite(selectedQValue)) {
    selectedQValue = allQ[selectedActionId] ?? 0;
  }

  const decoded = decodeAction(selectedActionId);
  const selectedProcBefore =
    decoded.slotIndex !== null
      ? processesBefore.find((p) => p.slotIndex === decoded.slotIndex) ?? null
      : null;
  const selectedProcessSnap = selectedProcBefore ? toProcessSnapshot(selectedProcBefore) : null;

  const perturbationSensitivity = runDQNPerturbationAnalysis({
    dqnAgent,
    observation,
    actionMask: mask,
    selectedActionId,
    selectedSlotIndex: decoded.slotIndex,
    processes: processesBefore,
  });

  const stepResult = engine.stepAction(selectedActionId, recordLogs);
  const postProc =
    decoded.slotIndex !== null
      ? engine.getProcesses().find((p) => p.slotIndex === decoded.slotIndex) ?? null
      : null;

  const validEntries = validIndices.map((actionId) => ({
    actionId,
    qValue: allQ[actionId] ?? 0,
  }));
  const alternatives = buildAlternativeActions(
    validEntries,
    selectedActionId,
    selectedQValue,
    processesBefore,
    12
  );

  const ruleBasedReasons = deriveRuleBasedReasons({
    algorithm: 'DQN',
    isTrainedModel: dqnAgent.isTrained(),
    selectedActionId,
    selectedQValue,
    selectedProcess: selectedProcessSnap,
    selectedQuantum: decoded.quantum,
    alternatives,
    availableRamBeforeMb: availableRamBefore,
    processesBefore,
    stepResult,
  });

  const explanation: DecisionExplanation = {
    id: `xai-dqn-${tickBefore}-${Date.now().toString(36)}`,
    tick: tickBefore,
    algorithm: 'DQN',
    isTrainedModel: dqnAgent.isTrained(),
    selectedActionId,
    selectedActionLabel: formatActionLabel(selectedActionId, processesBefore),
    selectedQuantum: decoded.quantum,
    selectedProcess: selectedProcessSnap,
    availableRamBeforeMb: availableRamBefore,
    totalRamMb,
    readyCountBefore: processesBefore.filter((p) => p.status === 'READY').length,
    blockedCountBefore: processesBefore.filter((p) => p.status === 'BLOCKED').length,
    selectedQValue: Number(selectedQValue.toFixed(4)),
    validActionCount: validIndices.length,
    alternativeActions: alternatives,
    rewardBreakdown: { ...stepResult.rewardBreakdown },
    postExecution: {
      newTick: engine.getCurrentTick(),
      elapsedTicks: stepResult.elapsedTicks,
      processNewStatus: postProc?.status ?? null,
      processRemainingCpuAfter: postProc?.remainingCpuTime ?? null,
      processAllocatedMemoryAfter: postProc?.allocatedMemory ?? null,
      availableRamAfterMb: engine.resourceManager.getAvailableRamMb(),
      admittedFromBlocked: stepResult.decision.admittedFromBlocked,
      preempted: stepResult.decision.preempted,
      completed: stepResult.decision.completed,
      invalidAttempt: stepResult.decision.invalidAttempt,
    },
    ruleBasedReasons,
    perturbationSensitivity,
  };

  engine.recordDecisionExplanation(explanation);
  return { stepResult, explanation };
}
