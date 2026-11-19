import * as tf from '@tensorflow/tfjs';
import { SYSTEM_CONFIG } from '../types/simulation';
import type { DQNDependencyStatus } from '../types/reinforcementLearning';

export const DQN_ARCHITECTURE = {
  inputDim: SYSTEM_CONFIG.OBSERVATION_SIZE, // 262
  hidden1: 256,
  hidden2: 128,
  outputDim: SYSTEM_CONFIG.ACTION_SPACE_SIZE, // 97
} as const;

let tfReadyPromise: Promise<DQNDependencyStatus> | null = null;

/**
 * Ensures TensorFlow.js is initialized cleanly (preferring CPU backend on Node.js
 * or available backend in browser). Never fabricates availability if TF.js fails.
 */
export async function initializeTensorFlow(): Promise<DQNDependencyStatus> {
  if (!tfReadyPromise) {
    tfReadyPromise = (async () => {
      try {
        await tf.ready();
        const backend = tf.getBackend();
        if (!backend) {
          await tf.setBackend('cpu');
          await tf.ready();
        }
        return {
          available: true,
          backend: tf.getBackend() ?? 'cpu',
          version: tf.version?.tfjs ?? 'installed',
          error: null,
          parameterCount: null,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          available: false,
          backend: null,
          version: null,
          error: `TensorFlow.js initialization failed: ${message}`,
          parameterCount: null,
        };
      }
    })();
  }
  return tfReadyPromise;
}

/**
 * Builds the exact RAIRA DQN neural network:
 *   Input(262) -> Dense(256, ReLU) -> Dense(128, ReLU) -> Dense(97, linear)
 */
export function buildDQNModel(seed?: number): tf.Sequential {
  const model = tf.sequential({
    layers: [
      tf.layers.dense({
        inputShape: [DQN_ARCHITECTURE.inputDim],
        units: DQN_ARCHITECTURE.hidden1,
        activation: 'relu',
        kernelInitializer: tf.initializers.heNormal({ seed }),
        biasInitializer: 'zeros',
        name: 'dqn_hidden_1',
      }),
      tf.layers.dense({
        units: DQN_ARCHITECTURE.hidden2,
        activation: 'relu',
        kernelInitializer: tf.initializers.heNormal({ seed: seed !== undefined ? seed + 1 : undefined }),
        biasInitializer: 'zeros',
        name: 'dqn_hidden_2',
      }),
      tf.layers.dense({
        units: DQN_ARCHITECTURE.outputDim,
        activation: 'linear',
        kernelInitializer: tf.initializers.glorotUniform({
          seed: seed !== undefined ? seed + 2 : undefined,
        }),
        biasInitializer: 'zeros',
        name: 'dqn_q_values',
      }),
    ],
  });

  return model;
}

export function copyModelWeights(source: tf.LayersModel, target: tf.LayersModel): void {
  tf.tidy(() => {
    const srcWeights = source.getWeights();
    const cloned = srcWeights.map((w) => w.clone());
    target.setWeights(cloned);
  });
}

export function serializeModelWeights(
  model: tf.LayersModel
): Array<{ shape: number[]; data: number[] }> {
  return model.getWeights().map((tensor) => ({
    shape: [...tensor.shape],
    data: Array.from(tensor.dataSync()),
  }));
}

export function deserializeModelWeights(
  model: tf.LayersModel,
  serialized: Array<{ shape: number[]; data: number[] }>
): void {
  const tensors = serialized.map((entry) => tf.tensor(entry.data, entry.shape, 'float32'));
  try {
    model.setWeights(tensors);
  } finally {
    tensors.forEach((t) => t.dispose());
  }
}

export function getModelParameterCount(model: tf.LayersModel): number {
  return model.countParams();
}

export { tf };
