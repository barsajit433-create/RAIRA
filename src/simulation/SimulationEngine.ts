import {
  DEFAULT_REWARD_WEIGHTS,
  SYSTEM_CONFIG,
} from '../types/simulation.ts';
import type { ProcessRecord, ProcessSpec, WorkloadType } from '../types/process.ts';
import type {
  AlgorithmType,
  AllocationDecision,
  RewardBreakdown,
  RewardWeights,
  SimulationMetrics,
  SimulationSnapshot,
  SimulationStatus,
  SystemEvent,
  TickTelemetry,
} from '../types/simulation.ts';
import { cloneProcessRecord, cloneProcessSpec, createProcessRecord } from './Process.ts';
import { ResourceManager } from './ResourceManager.ts';
import { calculateSimulationMetrics, computeJainFairnessIndex } from './MetricsCalculator.ts';
import {
  admitBlockedProcessesForBaseline,
  createBaselineSchedulerState,
  selectBaselineProcessSlot,
  type BaselineAlgorithm,
  type BaselineSchedulerState,
} from './CpuScheduler.ts';
import {
  computeActionMask,
  decodeAction,
  formatActionLabel,
  WAIT_ACTION,
} from '../reinforcement-learning/ActionSpace.ts';
import { encodeObservation } from '../reinforcement-learning/StateEncoder.ts';
import {
  accumulateDiscountedRewards,
  calculateTickReward,
  emptyRewardBreakdown,
} from '../reinforcement-learning/RewardCalculator.ts';

export interface StepResult {
  reward: number;
  rewardBreakdown: RewardBreakdown;
  elapsedTicks: number;
  terminated: boolean;
  truncated: boolean;
  done: boolean;
  nextObservation: Float32Array;
  nextActionMask: boolean[];
  decision: AllocationDecision;
}

export class SimulationEngine {
  readonly resourceManager: ResourceManager;
  private initialSpecs: ProcessSpec[] = [];
  private processes: ProcessRecord[] = [];
  private status: SimulationStatus = 'IDLE';
  private algorithm: AlgorithmType = 'FCFS';
  private workloadType: WorkloadType = 'MIXED';
  private seed: number = 42;
  private rrQuantum: number = SYSTEM_CONFIG.DEFAULT_RR_QUANTUM;
  private maxTicks: number = SYSTEM_CONFIG.MAX_EPISODE_TICKS;
  private rewardWeights: RewardWeights = { ...DEFAULT_REWARD_WEIGHTS };

  private currentTick: number = 0;
  private cpuBusyTicks: number = 0;
  private lastTickCpuBusy: boolean = false;
  private cumulativeRamUtilPercent: number = 0;
  private runningSlot: number | null = null;
  private lastExecutedSlot: number | null = null;
  private totalEpisodeReward: number = 0;
  private contextSwitches: number = 0;
  private invalidActionCount: number = 0;

  private baselineState: BaselineSchedulerState = createBaselineSchedulerState();
  private telemetryHistory: TickTelemetry[] = [];
  private recentDecisions: AllocationDecision[] = [];
  private eventLog: SystemEvent[] = [];
  private eventCounter: number = 0;

  constructor(options?: {
    totalRamMb?: number;
    maxTicks?: number;
    rrQuantum?: number;
    rewardWeights?: RewardWeights;
  }) {
    this.resourceManager = new ResourceManager(options?.totalRamMb ?? SYSTEM_CONFIG.TOTAL_RAM_MB);
    if (options?.maxTicks) this.maxTicks = options.maxTicks;
    if (options?.rrQuantum) this.rrQuantum = options.rrQuantum;
    if (options?.rewardWeights) this.rewardWeights = { ...options.rewardWeights };
  }

  loadWorkload(params: {
    specs: ProcessSpec[];
    workloadType: WorkloadType;
    seed: number;
    algorithm?: AlgorithmType;
    rrQuantum?: number;
    rewardWeights?: RewardWeights;
  }): void {
    const capped = params.specs.slice(0, SYSTEM_CONFIG.MAX_PROCESSES).map((s, idx) => ({
      ...cloneProcessSpec(s),
      slotIndex: idx,
      id: s.id || `P${String(idx + 1).padStart(2, '0')}`,
    }));

    this.initialSpecs = capped;
    this.workloadType = params.workloadType;
    this.seed = params.seed;
    if (params.algorithm) this.algorithm = params.algorithm;
    if (params.rrQuantum !== undefined) this.rrQuantum = Math.max(1, Math.min(16, params.rrQuantum));
    if (params.rewardWeights) this.rewardWeights = { ...params.rewardWeights };

    this.resetEpisode();
  }

  setAlgorithm(algorithm: AlgorithmType): void {
    this.algorithm = algorithm;
  }

  setRRQuantum(quantum: number): void {
    this.rrQuantum = Math.max(1, Math.min(16, Math.floor(quantum)));
  }

  setRewardWeights(weights: Partial<RewardWeights>): void {
    this.rewardWeights = { ...this.rewardWeights, ...weights };
  }

  setStatus(status: SimulationStatus): void {
    this.status = status;
  }

  getStatus(): SimulationStatus {
    return this.status;
  }

  getAlgorithm(): AlgorithmType {
    return this.algorithm;
  }

  getCurrentTick(): number {
    return this.currentTick;
  }

  getProcesses(): ProcessRecord[] {
    return this.processes;
  }

  getInitialSpecs(): ProcessSpec[] {
    return this.initialSpecs.map(cloneProcessSpec);
  }

  getRewardWeights(): RewardWeights {
    return { ...this.rewardWeights };
  }

  resetEpisode(): void {
    this.resourceManager.reset();
    this.processes = this.initialSpecs.map(createProcessRecord);
    this.status = 'IDLE';
    this.currentTick = 0;
    this.cpuBusyTicks = 0;
    this.lastTickCpuBusy = false;
    this.cumulativeRamUtilPercent = 0;
    this.runningSlot = null;
    this.lastExecutedSlot = null;
    this.totalEpisodeReward = 0;
    this.contextSwitches = 0;
    this.invalidActionCount = 0;
    this.baselineState = createBaselineSchedulerState();
    this.telemetryHistory = [];
    this.recentDecisions = [];
    this.eventLog = [];
    this.eventCounter = 0;

    // Process arrivals at t = 0 so initial state shows arrived processes ready/blocked
    this.processArrivalsAtCurrentTick();

    if (this.processes.length > 0) {
      this.logEvent(
        'info',
        'SYSTEM',
        `Loaded ${this.processes.length} processes (${this.workloadType}, seed ${this.seed}) for ${this.algorithm}.`
      );
    }
  }

  isTerminated(): boolean {
    return this.processes.length > 0 && this.processes.every((p) => p.status === 'COMPLETED');
  }

  isTruncated(): boolean {
    return !this.isTerminated() && this.currentTick >= this.maxTicks;
  }

  isDone(): boolean {
    return this.isTerminated() || this.isTruncated();
  }

  getObservation(): Float32Array {
    return encodeObservation({
      processes: this.processes,
      currentTick: this.currentTick,
      availableRamMb: this.resourceManager.getAvailableRamMb(),
      totalRamMb: this.resourceManager.totalRamMb,
      prevTickCpuBusy: this.lastTickCpuBusy,
    });
  }

  getActionMask(): boolean[] {
    return computeActionMask(this.processes, this.resourceManager.getAvailableRamMb());
  }

  private processArrivalsAtCurrentTick(): ProcessRecord[] {
    const arrived: ProcessRecord[] = [];
    for (const proc of this.processes) {
      if (proc.status === 'NEW' && proc.arrivalTime <= this.currentTick) {
        proc.status = 'BLOCKED';
        arrived.push(proc);
      }
    }
    return arrived;
  }

  private logEvent(
    level: SystemEvent['level'],
    category: SystemEvent['category'],
    message: string
  ): void {
    this.eventCounter += 1;
    this.eventLog.unshift({
      id: `evt-${this.eventCounter}`,
      tick: this.currentTick,
      level,
      category,
      message,
    });
    if (this.eventLog.length > 150) {
      this.eventLog.length = 150;
    }
  }

  private recordTickTelemetry(runningProcId: string | null, stepReward: number): void {
    const ramUsedMb = this.resourceManager.getAllocatedRamMb();
    const ramUtilPercent = this.resourceManager.getRamUtilisationPercent();
    this.cumulativeRamUtilPercent += ramUtilPercent;

    const arrived = this.processes.filter((p) => p.status !== 'NEW');
    const avgWait =
      arrived.length > 0
        ? arrived.reduce((acc, p) => acc + p.waitingTime, 0) / arrived.length
        : 0;

    this.telemetryHistory.push({
      tick: this.currentTick,
      cpuUtil: runningProcId ? 100 : 0,
      ramUsedMb,
      ramUtilPercent: Number(ramUtilPercent.toFixed(2)),
      availableRamMb: this.resourceManager.getAvailableRamMb(),
      readyCount: this.processes.filter((p) => p.status === 'READY').length,
      blockedCount: this.processes.filter((p) => p.status === 'BLOCKED').length,
      runningProcessId: runningProcId,
      completedCount: this.processes.filter((p) => p.status === 'COMPLETED').length,
      avgWaitingTime: Number(avgWait.toFixed(2)),
      fairnessIndex: Number(computeJainFairnessIndex(this.processes).toFixed(4)),
      stepReward: Number(stepReward.toFixed(3)),
    });

    if (this.telemetryHistory.length > 600) {
      this.telemetryHistory.shift();
    }
  }

  /**
   * Executes one Discrete(97) RL action using SMDP multi-tick execution.
   * Processes new arrivals on every tick, enforces strict CPU (single-core) & RAM (4096 MB)
   * constraints, reserves RAM when admitting BLOCKED processes, never releases RAM on preemption,
   * and releases RAM immediately on completion.
   */
  stepAction(actionId: number, recordLogs: boolean = true): StepResult {
    if (this.processes.length === 0 || this.isDone()) {
      const terminated = this.isTerminated();
      const truncated = this.isTruncated();
      return {
        reward: 0,
        rewardBreakdown: emptyRewardBreakdown(),
        elapsedTicks: 0,
        terminated,
        truncated,
        done: true,
        nextObservation: this.getObservation(),
        nextActionMask: this.getActionMask(),
        decision: {
          tick: this.currentTick,
          algorithm: this.algorithm,
          actionId,
          actionLabel: 'DONE',
          processId: null,
          processName: null,
          quantum: 0,
          elapsedTicks: 0,
          ramAllocatedMb: 0,
          reward: 0,
          rewardBreakdown: emptyRewardBreakdown(),
          admittedFromBlocked: false,
          preempted: false,
          completed: false,
          invalidAttempt: false,
        },
      };
    }

    // Ensure arrivals at current tick are present before mask check
    this.processArrivalsAtCurrentTick();

    const startTick = this.currentTick;
    const mask = this.getActionMask();
    const isValid = actionId >= 0 && actionId < mask.length && mask[actionId];
    const decoded = decodeAction(actionId);

    // Preempt any previously running process that differs from newly chosen slot
    if (this.runningSlot !== null) {
      const prevRunning = this.processes.find((p) => p.slotIndex === this.runningSlot);
      if (prevRunning && prevRunning.status === 'RUNNING') {
        prevRunning.status = 'READY'; // Preemption MUST NOT release RAM
      }
      this.runningSlot = null;
    }

    // Handle invalid action safely without violating capacity
    if (!isValid) {
      this.invalidActionCount += 1;
      const waitingProcs = this.processes.filter(
        (p) => p.status === 'READY' || p.status === 'BLOCKED'
      );
      for (const wp of waitingProcs) {
        wp.waitingTime += 1;
      }
      this.lastTickCpuBusy = false;
      this.currentTick += 1;
      this.processArrivalsAtCurrentTick();

      const tickReward = calculateTickReward({
        cpuBusy: false,
        completedProcess: null,
        waitingProcessCount: waitingProcs.length,
        processes: this.processes,
        invalidAction: true,
        weights: this.rewardWeights,
      });

      this.totalEpisodeReward += tickReward.total;
      this.recordTickTelemetry(null, tickReward.total);

      if (recordLogs) {
        this.logEvent(
          'error',
          'SYSTEM',
          `Blocked invalid action #${actionId} (insufficient RAM or ineligible process). Applied penalty -${this.rewardWeights.invalidActionPenalty}.`
        );
      }

      const decision: AllocationDecision = {
        tick: startTick,
        algorithm: this.algorithm,
        actionId,
        actionLabel: `INVALID (#${actionId})`,
        processId: null,
        processName: null,
        quantum: 1,
        elapsedTicks: 1,
        ramAllocatedMb: 0,
        reward: tickReward.total,
        rewardBreakdown: tickReward,
        admittedFromBlocked: false,
        preempted: false,
        completed: false,
        invalidAttempt: true,
      };
      this.pushDecision(decision);
      this.updateTerminalStatus();

      return {
        reward: tickReward.total,
        rewardBreakdown: tickReward,
        elapsedTicks: 1,
        terminated: this.isTerminated(),
        truncated: this.isTruncated(),
        done: this.isDone(),
        nextObservation: this.getObservation(),
        nextActionMask: this.getActionMask(),
        decision,
      };
    }

    // Handle WAIT action (actionId === 0)
    if (decoded.type === 'WAIT' || decoded.slotIndex === null) {
      const waitingProcs = this.processes.filter(
        (p) => p.status === 'READY' || p.status === 'BLOCKED'
      );
      for (const wp of waitingProcs) {
        wp.waitingTime += 1;
      }
      this.lastTickCpuBusy = false;
      this.currentTick += 1;
      this.processArrivalsAtCurrentTick();

      const tickReward = calculateTickReward({
        cpuBusy: false,
        completedProcess: null,
        waitingProcessCount: waitingProcs.length,
        processes: this.processes,
        invalidAction: false,
        weights: this.rewardWeights,
      });

      this.totalEpisodeReward += tickReward.total;
      this.recordTickTelemetry(null, tickReward.total);

      if (recordLogs) {
        this.logEvent('info', 'IDLE', `CPU idle (WAIT) for 1 tick at t=${startTick}.`);
      }

      const decision: AllocationDecision = {
        tick: startTick,
        algorithm: this.algorithm,
        actionId: WAIT_ACTION,
        actionLabel: 'WAIT (1 tick)',
        processId: null,
        processName: null,
        quantum: 1,
        elapsedTicks: 1,
        ramAllocatedMb: 0,
        reward: tickReward.total,
        rewardBreakdown: tickReward,
        admittedFromBlocked: false,
        preempted: false,
        completed: false,
        invalidAttempt: false,
      };
      this.pushDecision(decision);
      this.updateTerminalStatus();

      return {
        reward: tickReward.total,
        rewardBreakdown: tickReward,
        elapsedTicks: 1,
        terminated: this.isTerminated(),
        truncated: this.isTruncated(),
        done: this.isDone(),
        nextObservation: this.getObservation(),
        nextActionMask: this.getActionMask(),
        decision,
      };
    }

    // Valid SCHEDULE action on slotIndex with quantum ticks (1, 2, or 4)
    const targetProc = this.processes.find((p) => p.slotIndex === decoded.slotIndex)!;
    let admittedFromBlocked = false;
    let ramAllocatedMb = 0;

    if (targetProc.status === 'BLOCKED') {
      const ok = this.resourceManager.allocate(targetProc);
      if (!ok) {
        // Should never happen because action mask guarantees fit
        throw new Error(`RAM invariant violation attempting to admit ${targetProc.id}`);
      }
      targetProc.status = 'READY';
      admittedFromBlocked = true;
      ramAllocatedMb = targetProc.memoryDemand;
      if (recordLogs) {
        this.logEvent(
          'success',
          'ADMISSION',
          `Admitted ${targetProc.id} (${targetProc.name}) — reserved ${targetProc.memoryDemand} MB RAM (${this.resourceManager.getAvailableRamMb()} MB free).`
        );
      }
    }

    if (this.lastExecutedSlot !== null && this.lastExecutedSlot !== targetProc.slotIndex) {
      this.contextSwitches += 1;
    }

    targetProc.status = 'RUNNING';
    this.runningSlot = targetProc.slotIndex;
    this.lastExecutedSlot = targetProc.slotIndex;

    const tickBreakdowns: RewardBreakdown[] = [];
    let elapsedTicks = 0;
    let completedThisAction = false;

    for (let step = 0; step < decoded.quantum; step++) {
      if (this.currentTick >= this.maxTicks) {
        break;
      }

      // Process new arrivals at the start of every tick inside multi-tick execution
      const newlyArrived = this.processArrivalsAtCurrentTick();
      if (recordLogs && newlyArrived.length > 0) {
        this.logEvent(
          'info',
          'SYSTEM',
          `Arrived at t=${this.currentTick}: ${newlyArrived.map((p) => p.id).join(', ')}.`
        );
      }

      if (targetProc.startTime === null) {
        targetProc.startTime = this.currentTick;
        targetProc.responseTime = this.currentTick - targetProc.arrivalTime;
      }

      // Execute 1 tick on the single CPU core
      targetProc.remainingCpuTime = Math.max(0, targetProc.remainingCpuTime - 1);
      this.cpuBusyTicks += 1;
      this.lastTickCpuBusy = true;

      // Increment waiting time for all other arrived non-completed processes
      let waitingCount = 0;
      for (const other of this.processes) {
        if (
          other.slotIndex !== targetProc.slotIndex &&
          (other.status === 'READY' || other.status === 'BLOCKED')
        ) {
          other.waitingTime += 1;
          waitingCount += 1;
        }
      }

      this.currentTick += 1;
      elapsedTicks += 1;

      let completedProc: ProcessRecord | null = null;
      if (targetProc.remainingCpuTime === 0) {
        targetProc.status = 'COMPLETED';
        targetProc.completionTime = this.currentTick;
        targetProc.turnaroundTime = targetProc.completionTime - targetProc.arrivalTime;
        const released = this.resourceManager.release(targetProc);
        this.runningSlot = null;
        completedProc = targetProc;
        completedThisAction = true;

        if (recordLogs) {
          this.logEvent(
            'success',
            'COMPLETE',
            `Completed ${targetProc.id} (${targetProc.name}) at t=${this.currentTick} (TT=${targetProc.turnaroundTime}, WT=${targetProc.waitingTime}), released ${released} MB RAM.`
          );
        }
      }

      const tickBreakdown = calculateTickReward({
        cpuBusy: true,
        completedProcess: completedProc,
        waitingProcessCount: waitingCount,
        processes: this.processes,
        invalidAction: false,
        weights: this.rewardWeights,
      });

      tickBreakdowns.push(tickBreakdown);
      this.recordTickTelemetry(targetProc.id, tickBreakdown.total);

      // Process arrivals that happen at the newly reached tick
      this.processArrivalsAtCurrentTick();

      if (completedThisAction) {
        break;
      }
    }

    // If unfinished after quantum, preempt back to READY WITHOUT releasing RAM
    let preempted = false;
    if (!completedThisAction && targetProc.status === 'RUNNING') {
      targetProc.status = 'READY';
      this.runningSlot = null;
      preempted = true;
      if (recordLogs) {
        this.logEvent(
          'warning',
          'PREEMPT',
          `Preempted ${targetProc.id} after ${elapsedTicks}t (${targetProc.remainingCpuTime}t remaining; ${targetProc.allocatedMemory} MB RAM retained).`
        );
      }
    }

    const discounted = accumulateDiscountedRewards(tickBreakdowns, this.rewardWeights.gamma);
    // Track undiscounted episode sum of per-tick rewards for transparent comparison across all algorithms
    const rawStepSum = tickBreakdowns.reduce((acc, b) => acc + b.total, 0);
    this.totalEpisodeReward += rawStepSum;

    const decision: AllocationDecision = {
      tick: startTick,
      algorithm: this.algorithm,
      actionId,
      actionLabel: formatActionLabel(actionId, this.processes),
      processId: targetProc.id,
      processName: targetProc.name,
      quantum: decoded.quantum,
      elapsedTicks,
      ramAllocatedMb,
      reward: discounted.total,
      rewardBreakdown: discounted,
      admittedFromBlocked,
      preempted,
      completed: completedThisAction,
      invalidAttempt: false,
    };
    this.pushDecision(decision);
    this.updateTerminalStatus();

    return {
      reward: discounted.total,
      rewardBreakdown: discounted,
      elapsedTicks,
      terminated: this.isTerminated(),
      truncated: this.isTruncated(),
      done: this.isDone(),
      nextObservation: this.getObservation(),
      nextActionMask: this.getActionMask(),
      decision,
    };
  }

  /**
   * Executes exactly 1 tick using one of the three conventional baseline algorithms:
   * FCFS, Round Robin (RR), or Priority Scheduling.
   * Uses the exact same hardware constraints, RAM manager, and reward function.
   */
  stepBaselineTick(algorithm: BaselineAlgorithm, recordLogs: boolean = true): StepResult {
    this.algorithm = algorithm;
    if (this.processes.length === 0 || this.isDone()) {
      return {
        reward: 0,
        rewardBreakdown: emptyRewardBreakdown(),
        elapsedTicks: 0,
        terminated: this.isTerminated(),
        truncated: this.isTruncated(),
        done: true,
        nextObservation: this.getObservation(),
        nextActionMask: this.getActionMask(),
        decision: {
          tick: this.currentTick,
          algorithm,
          actionId: null,
          actionLabel: 'DONE',
          processId: null,
          processName: null,
          quantum: 0,
          elapsedTicks: 0,
          ramAllocatedMb: 0,
          reward: 0,
          rewardBreakdown: emptyRewardBreakdown(),
          admittedFromBlocked: false,
          preempted: false,
          completed: false,
          invalidAttempt: false,
        },
      };
    }

    const startTick = this.currentTick;
    const arrivedNow = this.processArrivalsAtCurrentTick();
    if (recordLogs && arrivedNow.length > 0) {
      this.logEvent(
        'info',
        'SYSTEM',
        `Arrived at t=${startTick}: ${arrivedNow.map((p) => p.id).join(', ')}.`
      );
    }

    // Admit any BLOCKED processes whose RAM demand fits available RAM
    const admitted = admitBlockedProcessesForBaseline(
      algorithm,
      this.processes,
      this.resourceManager,
      this.baselineState
    );
    let ramAllocatedNow = 0;
    for (const ap of admitted) {
      ramAllocatedNow += ap.memoryDemand;
      if (recordLogs) {
        this.logEvent(
          'success',
          'ADMISSION',
          `[${algorithm}] Admitted ${ap.id} (${ap.name}) — reserved ${ap.memoryDemand} MB RAM (${this.resourceManager.getAvailableRamMb()} MB free).`
        );
      }
    }

    const selectedSlot = selectBaselineProcessSlot({
      algorithm,
      processes: this.processes,
      currentRunningSlot: this.runningSlot,
      rrQuantum: this.rrQuantum,
      schedulerState: this.baselineState,
    });

    if (selectedSlot === null) {
      // Idle CPU tick
      const waitingProcs = this.processes.filter(
        (p) => p.status === 'READY' || p.status === 'BLOCKED'
      );
      for (const wp of waitingProcs) {
        wp.waitingTime += 1;
      }
      this.lastTickCpuBusy = false;
      this.currentTick += 1;
      this.processArrivalsAtCurrentTick();

      const tickBreakdown = calculateTickReward({
        cpuBusy: false,
        completedProcess: null,
        waitingProcessCount: waitingProcs.length,
        processes: this.processes,
        invalidAction: false,
        weights: this.rewardWeights,
      });

      this.totalEpisodeReward += tickBreakdown.total;
      this.recordTickTelemetry(null, tickBreakdown.total);

      if (recordLogs) {
        const blockedCount = this.processes.filter((p) => p.status === 'BLOCKED').length;
        this.logEvent(
          blockedCount > 0 ? 'warning' : 'info',
          blockedCount > 0 ? 'BLOCKED' : 'IDLE',
          blockedCount > 0
            ? `[${algorithm}] CPU idle at t=${startTick}; ${blockedCount} process(es) blocked on RAM.`
            : `[${algorithm}] CPU idle at t=${startTick}; awaiting next arrival.`
        );
      }

      const decision: AllocationDecision = {
        tick: startTick,
        algorithm,
        actionId: null,
        actionLabel: `${algorithm} IDLE`,
        processId: null,
        processName: null,
        quantum: 1,
        elapsedTicks: 1,
        ramAllocatedMb: ramAllocatedNow,
        reward: tickBreakdown.total,
        rewardBreakdown: tickBreakdown,
        admittedFromBlocked: admitted.length > 0,
        preempted: false,
        completed: false,
        invalidAttempt: false,
      };
      this.pushDecision(decision);
      this.updateTerminalStatus();

      return {
        reward: tickBreakdown.total,
        rewardBreakdown: tickBreakdown,
        elapsedTicks: 1,
        terminated: this.isTerminated(),
        truncated: this.isTruncated(),
        done: this.isDone(),
        nextObservation: this.getObservation(),
        nextActionMask: this.getActionMask(),
        decision,
      };
    }

    const proc = this.processes.find((p) => p.slotIndex === selectedSlot)!;

    if (this.lastExecutedSlot !== null && this.lastExecutedSlot !== proc.slotIndex) {
      this.contextSwitches += 1;
    }

    proc.status = 'RUNNING';
    this.runningSlot = proc.slotIndex;
    this.lastExecutedSlot = proc.slotIndex;

    if (proc.startTime === null) {
      proc.startTime = this.currentTick;
      proc.responseTime = this.currentTick - proc.arrivalTime;
    }

    proc.remainingCpuTime = Math.max(0, proc.remainingCpuTime - 1);
    this.cpuBusyTicks += 1;
    this.lastTickCpuBusy = true;

    let waitingCount = 0;
    for (const other of this.processes) {
      if (
        other.slotIndex !== proc.slotIndex &&
        (other.status === 'READY' || other.status === 'BLOCKED')
      ) {
        other.waitingTime += 1;
        waitingCount += 1;
      }
    }

    this.currentTick += 1;

    let completedProc: ProcessRecord | null = null;
    let preempted = false;

    if (proc.remainingCpuTime === 0) {
      proc.status = 'COMPLETED';
      proc.completionTime = this.currentTick;
      proc.turnaroundTime = proc.completionTime - proc.arrivalTime;
      const released = this.resourceManager.release(proc);
      this.runningSlot = null;
      this.baselineState.rrSliceRemaining = 0;
      completedProc = proc;

      if (recordLogs) {
        this.logEvent(
          'success',
          'COMPLETE',
          `[${algorithm}] Completed ${proc.id} (${proc.name}) at t=${this.currentTick} (TT=${proc.turnaroundTime}, WT=${proc.waitingTime}), released ${released} MB RAM.`
        );
      }
    } else if (algorithm === 'RR') {
      this.baselineState.rrSliceRemaining -= 1;
      if (this.baselineState.rrSliceRemaining <= 0) {
        // Admit any arrivals at the new tick before requeuing preempted process
        this.processArrivalsAtCurrentTick();
        admitBlockedProcessesForBaseline(
          algorithm,
          this.processes,
          this.resourceManager,
          this.baselineState
        );
        // Preempt without releasing RAM
        proc.status = 'READY';
        this.runningSlot = null;
        this.baselineState.rrQueue.push(proc.slotIndex);
        preempted = true;
        if (recordLogs) {
          this.logEvent(
            'warning',
            'PREEMPT',
            `[RR] Quantum expired for ${proc.id} (${proc.remainingCpuTime}t remaining; ${proc.allocatedMemory} MB RAM retained).`
          );
        }
      }
    }

    const tickBreakdown = calculateTickReward({
      cpuBusy: true,
      completedProcess: completedProc,
      waitingProcessCount: waitingCount,
      processes: this.processes,
      invalidAction: false,
      weights: this.rewardWeights,
    });

    this.totalEpisodeReward += tickBreakdown.total;
    this.recordTickTelemetry(proc.id, tickBreakdown.total);
    this.processArrivalsAtCurrentTick();

    const decision: AllocationDecision = {
      tick: startTick,
      algorithm,
      actionId: null,
      actionLabel: `${algorithm} RUN ${proc.id}`,
      processId: proc.id,
      processName: proc.name,
      quantum: algorithm === 'RR' ? this.rrQuantum : 1,
      elapsedTicks: 1,
      ramAllocatedMb: ramAllocatedNow,
      reward: tickBreakdown.total,
      rewardBreakdown: tickBreakdown,
      admittedFromBlocked: admitted.length > 0,
      preempted,
      completed: completedProc !== null,
      invalidAttempt: false,
    };
    this.pushDecision(decision);
    this.updateTerminalStatus();

    return {
      reward: tickBreakdown.total,
      rewardBreakdown: tickBreakdown,
      elapsedTicks: 1,
      terminated: this.isTerminated(),
      truncated: this.isTruncated(),
      done: this.isDone(),
      nextObservation: this.getObservation(),
      nextActionMask: this.getActionMask(),
      decision,
    };
  }

  private pushDecision(decision: AllocationDecision): void {
    this.recentDecisions.unshift(decision);
    if (this.recentDecisions.length > 40) {
      this.recentDecisions.length = 40;
    }
  }

  private updateTerminalStatus(): void {
    if (this.isTerminated()) {
      this.status = 'COMPLETED';
    } else if (this.isTruncated()) {
      this.status = 'TRUNCATED';
    }
  }

  getMetrics(): SimulationMetrics {
    return calculateSimulationMetrics({
      processes: this.processes,
      currentTick: this.currentTick,
      cpuBusyTicks: this.cpuBusyTicks,
      lastTickCpuBusy: this.lastTickCpuBusy,
      cumulativeRamUtilPercent: this.cumulativeRamUtilPercent,
      currentRamUsedMb: this.resourceManager.getAllocatedRamMb(),
      totalRamMb: this.resourceManager.totalRamMb,
      totalEpisodeReward: this.totalEpisodeReward,
      contextSwitches: this.contextSwitches,
      invalidActionCount: this.invalidActionCount,
    });
  }

  getSnapshot(rlTrainedStatus: { qLearningTrained: boolean; dqnTrained: boolean }): SimulationSnapshot {
    return {
      status: this.status,
      algorithm: this.algorithm,
      workloadType: this.workloadType,
      seed: this.seed,
      rrQuantum: this.rrQuantum,
      maxTicks: this.maxTicks,
      currentTick: this.currentTick,
      runningSlot: this.runningSlot,
      processes: this.processes.map(cloneProcessRecord),
      initialSpecs: this.initialSpecs.map(cloneProcessSpec),
      metrics: this.getMetrics(),
      telemetryHistory: [...this.telemetryHistory],
      recentDecisions: [...this.recentDecisions],
      eventLog: [...this.eventLog],
      rewardWeights: { ...this.rewardWeights },
      rlTrainedStatus,
    };
  }
}
