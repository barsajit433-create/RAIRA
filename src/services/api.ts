import type { ProcessSpec, WorkloadType } from '../types/process';
import type { AlgorithmType, RewardWeights, SimulationSnapshot } from '../types/simulation';
import type { SeedComparisonBatch } from '../types/experiment';
import type {
  DQNDependencyStatus,
  RLAgentType,
  RLTrainingConfig,
  SerializedDQNModel,
  SerializedQLearningModel,
  TrainingSessionSnapshot,
} from '../types/reinforcementLearning';
import { generateWorkload } from '../simulation/WorkloadGenerator';

type LocalServiceModule = typeof import('../../server/services/rairaService');

let useLocalRuntime = false;
let localServicePromise: Promise<InstanceType<LocalServiceModule['RairaBackendService']>> | null =
  null;

async function getLocalService() {
  if (!localServicePromise) {
    localServicePromise = import('../../server/services/rairaService').then(
      (mod) => new mod.RairaBackendService()
    );
  }
  return localServicePromise;
}

class BackendUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackendUnavailableError';
  }
}

async function fetchBackendJson<T>(path: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers ?? {}),
      },
      ...options,
    });
  } catch (err) {
    throw new BackendUnavailableError(err instanceof Error ? err.message : 'Network error');
  }

  const contentType = res.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');

  // Static previews / unmounted API proxies return 404/405/502/503 or HTML index.html
  if (
    res.status === 404 ||
    res.status === 405 ||
    res.status === 502 ||
    res.status === 503 ||
    (!isJson && res.ok)
  ) {
    throw new BackendUnavailableError(`Backend API route unavailable (${res.status})`);
  }

  const data = isJson ? await res.json().catch(() => ({})) : {};
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data as T;
}

async function callWithFallback<T>(
  remoteCall: () => Promise<T>,
  localCall: (svc: InstanceType<LocalServiceModule['RairaBackendService']>) => Promise<T> | T
): Promise<T> {
  if (useLocalRuntime) {
    const svc = await getLocalService();
    return localCall(svc);
  }

  try {
    return await remoteCall();
  } catch (err) {
    if (err instanceof BackendUnavailableError) {
      useLocalRuntime = true;
      const svc = await getLocalService();
      return localCall(svc);
    }
    throw err;
  }
}

export const rairaApi = {
  getHealth(): Promise<{ ok: boolean; service: string; dqnStatus: DQNDependencyStatus }> {
    return callWithFallback(
      () => fetchBackendJson('/api/health'),
      async (svc) => ({
        ok: true,
        service: 'RAIRA Embedded Isomorphic Engine',
        dqnStatus: await svc.dqnAgent.initialize(),
      })
    );
  },

  generateWorkload(params: {
    workloadType: Exclude<WorkloadType, 'CUSTOM'>;
    numProcesses: number;
    seed: number;
    applyToSimulation?: boolean;
  }): Promise<{
    workloadType: Exclude<WorkloadType, 'CUSTOM'>;
    numProcesses: number;
    seed: number;
    specs: ProcessSpec[];
    snapshot?: SimulationSnapshot;
  }> {
    return callWithFallback(
      () =>
        fetchBackendJson('/api/workloads/generate', {
          method: 'POST',
          body: JSON.stringify(params),
        }),
      (svc) => {
        const specs = generateWorkload(params.workloadType, params.numProcesses, params.seed);
        const snapshot = params.applyToSimulation
          ? svc.loadWorkload({ specs, workloadType: params.workloadType, seed: params.seed })
          : undefined;
        return {
          workloadType: params.workloadType,
          numProcesses: specs.length,
          seed: params.seed,
          specs,
          snapshot,
        };
      }
    );
  },

  getSimulationState(): Promise<SimulationSnapshot> {
    return callWithFallback(
      () => fetchBackendJson('/api/simulation/state'),
      (svc) => svc.getSimulationSnapshot()
    );
  },

  loadWorkload(params: {
    specs?: ProcessSpec[];
    workloadType: WorkloadType;
    numProcesses?: number;
    seed: number;
    algorithm?: AlgorithmType;
    rrQuantum?: number;
  }): Promise<SimulationSnapshot> {
    return callWithFallback(
      () =>
        fetchBackendJson('/api/simulation/load', {
          method: 'POST',
          body: JSON.stringify(params),
        }),
      (svc) => svc.loadWorkload(params)
    );
  },

  updateProcesses(
    specs: ProcessSpec[],
    workloadType: WorkloadType = 'CUSTOM'
  ): Promise<SimulationSnapshot> {
    return callWithFallback(
      () =>
        fetchBackendJson('/api/simulation/processes', {
          method: 'PUT',
          body: JSON.stringify({ specs, workloadType }),
        }),
      (svc) => svc.updateProcessList(specs, workloadType)
    );
  },

  configureSimulation(params: {
    algorithm?: AlgorithmType;
    rrQuantum?: number;
    stepIntervalMs?: number;
    rewardWeights?: Partial<RewardWeights>;
  }): Promise<SimulationSnapshot> {
    return callWithFallback(
      () =>
        fetchBackendJson('/api/simulation/config', {
          method: 'POST',
          body: JSON.stringify(params),
        }),
      (svc) => svc.configureSimulation(params)
    );
  },

  startSimulation(stepIntervalMs?: number): Promise<SimulationSnapshot> {
    return callWithFallback(
      () =>
        fetchBackendJson('/api/simulation/start', {
          method: 'POST',
          body: JSON.stringify({ stepIntervalMs }),
        }),
      (svc) => svc.startSimulation(stepIntervalMs)
    );
  },

  pauseSimulation(): Promise<SimulationSnapshot> {
    return callWithFallback(
      () => fetchBackendJson('/api/simulation/pause', { method: 'POST' }),
      (svc) => svc.pauseSimulation()
    );
  },

  resumeSimulation(): Promise<SimulationSnapshot> {
    return callWithFallback(
      () => fetchBackendJson('/api/simulation/resume', { method: 'POST' }),
      (svc) => svc.resumeSimulation()
    );
  },

  resetSimulation(): Promise<SimulationSnapshot> {
    return callWithFallback(
      () => fetchBackendJson('/api/simulation/reset', { method: 'POST' }),
      (svc) => svc.resetSimulation()
    );
  },

  stepSimulation(): Promise<SimulationSnapshot> {
    return callWithFallback(
      () => fetchBackendJson('/api/simulation/step', { method: 'POST' }),
      (svc) => svc.stepSimulationOnce()
    );
  },

  getTrainingStatus(): Promise<TrainingSessionSnapshot> {
    return callWithFallback(
      () => fetchBackendJson('/api/rl/status'),
      async (svc) => {
        await svc.dqnAgent.initialize();
        return svc.getTrainingSnapshot();
      }
    );
  },

  startTraining(config: RLTrainingConfig): Promise<TrainingSessionSnapshot> {
    return callWithFallback(
      () =>
        fetchBackendJson('/api/rl/train/start', {
          method: 'POST',
          body: JSON.stringify(config),
        }),
      (svc) => svc.startTraining(config)
    );
  },

  pauseTraining(): Promise<TrainingSessionSnapshot> {
    return callWithFallback(
      () => fetchBackendJson('/api/rl/train/pause', { method: 'POST' }),
      (svc) => svc.pauseTraining()
    );
  },

  resumeTraining(): Promise<TrainingSessionSnapshot> {
    return callWithFallback(
      () => fetchBackendJson('/api/rl/train/resume', { method: 'POST' }),
      (svc) => svc.resumeTraining()
    );
  },

  stopTraining(): Promise<TrainingSessionSnapshot> {
    return callWithFallback(
      () => fetchBackendJson('/api/rl/train/stop', { method: 'POST' }),
      (svc) => svc.stopTraining()
    );
  },

  resetRLAgent(agentType: RLAgentType, seed?: number): Promise<TrainingSessionSnapshot> {
    return callWithFallback(
      () =>
        fetchBackendJson('/api/rl/reset', {
          method: 'POST',
          body: JSON.stringify({ agentType, seed }),
        }),
      (svc) => svc.resetRLAgent(agentType, seed)
    );
  },

  exportRLModel(agentType: RLAgentType): Promise<SerializedQLearningModel | SerializedDQNModel> {
    return callWithFallback(
      () => fetchBackendJson(`/api/rl/model/${agentType}`),
      (svc) => svc.exportRLModel(agentType)
    );
  },

  importRLModel(
    agentType: RLAgentType,
    payload: SerializedQLearningModel | SerializedDQNModel
  ): Promise<TrainingSessionSnapshot> {
    return callWithFallback(
      () =>
        fetchBackendJson(`/api/rl/model/${agentType}`, {
          method: 'POST',
          body: JSON.stringify(payload),
        }),
      (svc) => svc.importRLModel(agentType, payload)
    );
  },

  getLatestComparison(): Promise<{ comparison: SeedComparisonBatch | null }> {
    return callWithFallback(
      () => fetchBackendJson('/api/comparison/latest'),
      (svc) => ({ comparison: svc.getLastComparison() })
    );
  },

  runComparison(params: {
    workloadType: Exclude<WorkloadType, 'CUSTOM'>;
    numProcesses: number;
    seeds: number[];
    rrQuantum: number;
    includeUntrainedRL?: boolean;
  }): Promise<SeedComparisonBatch> {
    return callWithFallback(
      () =>
        fetchBackendJson('/api/comparison/run', {
          method: 'POST',
          body: JSON.stringify(params),
        }),
      (svc) => svc.runComparison(params)
    );
  },
};
