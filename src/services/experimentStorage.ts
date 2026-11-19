import type { ExperimentRecord, SeedComparisonBatch } from '../types/experiment';
import type {
  RLAgentType,
  SerializedDQNModel,
  SerializedQLearningModel,
} from '../types/reinforcementLearning';

const HISTORY_KEY = 'raira_experiment_history_v1';
const COMPARISONS_KEY = 'raira_comparisons_v1';
const MODEL_PREFIX = 'raira_saved_model_v1_';
const SETTINGS_KEY = 'raira_settings_v1';

export interface UserSettings {
  stepIntervalMs: number;
  defaultRrQuantum: number;
  defaultSeed: number;
  defaultNumProcesses: number;
}

const DEFAULT_SETTINGS: UserSettings = {
  stepIntervalMs: 350,
  defaultRrQuantum: 2,
  defaultSeed: 42,
  defaultNumProcesses: 10,
};

function safeRead<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWrite(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const experimentStorage = {
  loadHistory(): ExperimentRecord[] {
    return safeRead<ExperimentRecord[]>(HISTORY_KEY, []);
  },

  addHistoryRecord(record: ExperimentRecord): ExperimentRecord[] {
    const current = this.loadHistory();
    const updated = [record, ...current.filter((r) => r.id !== record.id)].slice(0, 200);
    safeWrite(HISTORY_KEY, updated);
    return updated;
  },

  addHistoryRecords(records: ExperimentRecord[]): ExperimentRecord[] {
    const current = this.loadHistory();
    const existingIds = new Set(records.map((r) => r.id));
    const updated = [...records, ...current.filter((r) => !existingIds.has(r.id))].slice(0, 200);
    safeWrite(HISTORY_KEY, updated);
    return updated;
  },

  deleteHistoryRecord(id: string): ExperimentRecord[] {
    const updated = this.loadHistory().filter((r) => r.id !== id);
    safeWrite(HISTORY_KEY, updated);
    return updated;
  },

  clearHistory(): ExperimentRecord[] {
    safeWrite(HISTORY_KEY, []);
    return [];
  },

  loadComparisons(): SeedComparisonBatch[] {
    return safeRead<SeedComparisonBatch[]>(COMPARISONS_KEY, []);
  },

  saveComparison(batch: SeedComparisonBatch): SeedComparisonBatch[] {
    const current = this.loadComparisons();
    const updated = [batch, ...current.filter((b) => b.id !== batch.id)].slice(0, 20);
    safeWrite(COMPARISONS_KEY, updated);
    return updated;
  },

  saveModelCheckpoint(
    agentType: RLAgentType,
    payload: SerializedQLearningModel | SerializedDQNModel
  ): boolean {
    return safeWrite(`${MODEL_PREFIX}${agentType}`, payload);
  },

  loadModelCheckpoint(
    agentType: RLAgentType
  ): SerializedQLearningModel | SerializedDQNModel | null {
    return safeRead<SerializedQLearningModel | SerializedDQNModel | null>(
      `${MODEL_PREFIX}${agentType}`,
      null
    );
  },

  hasSavedModel(agentType: RLAgentType): boolean {
    return this.loadModelCheckpoint(agentType) !== null;
  },

  loadSettings(): UserSettings {
    return { ...DEFAULT_SETTINGS, ...safeRead<Partial<UserSettings>>(SETTINGS_KEY, {}) };
  },

  saveSettings(settings: Partial<UserSettings>): UserSettings {
    const merged = { ...this.loadSettings(), ...settings };
    safeWrite(SETTINGS_KEY, merged);
    return merged;
  },
};
