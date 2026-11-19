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

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
    ...options,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const rairaApi = {
  getHealth(): Promise<{ ok: boolean; service: string; dqnStatus: DQNDependencyStatus }> {
    return requestJson('/api/health');
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
    return requestJson('/api/workloads/generate', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  getSimulationState(): Promise<SimulationSnapshot> {
    return requestJson('/api/simulation/state');
  },

  loadWorkload(params: {
    specs?: ProcessSpec[];
    workloadType: WorkloadType;
    numProcesses?: number;
    seed: number;
    algorithm?: AlgorithmType;
    rrQuantum?: number;
  }): Promise<SimulationSnapshot> {
    return requestJson('/api/simulation/load', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  updateProcesses(specs: ProcessSpec[], workloadType: WorkloadType = 'CUSTOM'): Promise<SimulationSnapshot> {
    return requestJson('/api/simulation/processes', {
      method: 'PUT',
      body: JSON.stringify({ specs, workloadType }),
    });
  },

  configureSimulation(params: {
    algorithm?: AlgorithmType;
    rrQuantum?: number;
    stepIntervalMs?: number;
    rewardWeights?: Partial<RewardWeights>;
  }): Promise<SimulationSnapshot> {
    return requestJson('/api/simulation/config', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  startSimulation(stepIntervalMs?: number): Promise<SimulationSnapshot> {
    return requestJson('/api/simulation/start', {
      method: 'POST',
      body: JSON.stringify({ stepIntervalMs }),
    });
  },

  pauseSimulation(): Promise<SimulationSnapshot> {
    return requestJson('/api/simulation/pause', { method: 'POST' });
  },

  resumeSimulation(): Promise<SimulationSnapshot> {
    return requestJson('/api/simulation/resume', { method: 'POST' });
  },

  resetSimulation(): Promise<SimulationSnapshot> {
    return requestJson('/api/simulation/reset', { method: 'POST' });
  },

  stepSimulation(): Promise<SimulationSnapshot> {
    return requestJson('/api/simulation/step', { method: 'POST' });
  },

  getTrainingStatus(): Promise<TrainingSessionSnapshot> {
    return requestJson('/api/rl/status');
  },

  startTraining(config: RLTrainingConfig): Promise<TrainingSessionSnapshot> {
    return requestJson('/api/rl/train/start', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  },

  pauseTraining(): Promise<TrainingSessionSnapshot> {
    return requestJson('/api/rl/train/pause', { method: 'POST' });
  },

  resumeTraining(): Promise<TrainingSessionSnapshot> {
    return requestJson('/api/rl/train/resume', { method: 'POST' });
  },

  stopTraining(): Promise<TrainingSessionSnapshot> {
    return requestJson('/api/rl/train/stop', { method: 'POST' });
  },

  resetRLAgent(agentType: RLAgentType, seed?: number): Promise<TrainingSessionSnapshot> {
    return requestJson('/api/rl/reset', {
      method: 'POST',
      body: JSON.stringify({ agentType, seed }),
    });
  },

  exportRLModel(agentType: RLAgentType): Promise<SerializedQLearningModel | SerializedDQNModel> {
    return requestJson(`/api/rl/model/${agentType}`);
  },

  importRLModel(
    agentType: RLAgentType,
    payload: SerializedQLearningModel | SerializedDQNModel
  ): Promise<TrainingSessionSnapshot> {
    return requestJson(`/api/rl/model/${agentType}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getLatestComparison(): Promise<{ comparison: SeedComparisonBatch | null }> {
    return requestJson('/api/comparison/latest');
  },

  runComparison(params: {
    workloadType: Exclude<WorkloadType, 'CUSTOM'>;
    numProcesses: number;
    seeds: number[];
    rrQuantum: number;
    includeUntrainedRL?: boolean;
  }): Promise<SeedComparisonBatch> {
    return requestJson('/api/comparison/run', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },
};
