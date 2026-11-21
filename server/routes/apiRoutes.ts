import { Router } from 'express';
import { rairaService } from '../services/rairaService.ts';
import { generateWorkload, WORKLOAD_SCENARIOS } from '../../src/simulation/WorkloadGenerator.ts';
import { SYSTEM_CONFIG, type AlgorithmType } from '../../src/types/simulation.ts';
import type { ProcessSpec, WorkloadType } from '../../src/types/process.ts';
import type { RLAgentType, RLTrainingConfig } from '../../src/types/reinforcementLearning.ts';
import type {
  ShockScenarioConfig,
  StatisticalValidationConfig,
} from '../../src/types/intelligence.ts';
import {
  apiCorsGuard,
  createRateLimitMiddleware,
  isValidAlgorithm,
  isValidGeneratedWorkloadType,
  isValidShockType,
  isValidWorkloadType,
  validateDQNImportPayload,
  validateMaxProcessCount,
  validateNumericBounds,
  validateQLearningImportPayload,
  validateRewardWeightsInput,
} from '../security/securityMiddleware.ts';

export const apiRouter = Router();

// Enforce explicit same-origin/allowlisted CORS policy & rate limiting across API routes
apiRouter.use(apiCorsGuard);
apiRouter.use(
  createRateLimitMiddleware({
    bucketPrefix: 'api-general',
    windowMs: 60_000,
    maxRequests: 360,
  })
);

const computeRateLimit = createRateLimitMiddleware({
  bucketPrefix: 'api-compute',
  windowMs: 60_000,
  maxRequests: 30,
});

apiRouter.get('/health', async (_req, res) => {
  await rairaService.ensureReady();
  const dqnStatus = await rairaService.dqnAgent.initialize();
  res.json({
    ok: true,
    service: 'RAIRA Backend API',
    dqnStatus,
  });
});

// ---- Workload Generator ----
apiRouter.get('/workloads/scenarios', (_req, res) => {
  res.json({ scenarios: Object.values(WORKLOAD_SCENARIOS) });
});

apiRouter.post('/workloads/generate', (req, res) => {
  try {
    const workloadType = req.body?.workloadType ?? 'MIXED';
    if (!isValidGeneratedWorkloadType(workloadType)) {
      res.status(400).json({ error: 'Unsupported workloadType.' });
      return;
    }

    const procCheck = validateMaxProcessCount(req.body?.numProcesses ?? 10);
    if (!procCheck.valid) {
      res.status(400).json({ error: procCheck.error });
      return;
    }

    const seedCheck = validateNumericBounds(req.body?.seed ?? 42, 'seed', 0, 1_000_000_000, true);
    if (!seedCheck.valid) {
      res.status(400).json({ error: seedCheck.error });
      return;
    }

    const applyToSimulation = Boolean(req.body?.applyToSimulation ?? false);
    const specs = generateWorkload(workloadType, procCheck.value, seedCheck.value);
    let snapshot = undefined;
    if (applyToSimulation) {
      snapshot = rairaService.loadWorkload({
        specs,
        workloadType,
        seed: seedCheck.value,
      });
    }

    res.json({
      workloadType,
      numProcesses: specs.length,
      seed: seedCheck.value,
      specs,
      snapshot,
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid workload request.' });
  }
});

// ---- Simulation Engine ----
apiRouter.get('/simulation/state', async (_req, res) => {
  await rairaService.ensureReady();
  res.json(rairaService.getSimulationSnapshot());
});

apiRouter.post('/simulation/load', (req, res) => {
  try {
    const workloadType = req.body?.workloadType ?? 'MIXED';
    if (!isValidWorkloadType(workloadType, true)) {
      res.status(400).json({ error: 'Unsupported workloadType.' });
      return;
    }

    if (req.body?.algorithm !== undefined && !isValidAlgorithm(req.body.algorithm)) {
      res.status(400).json({ error: 'Unsupported scheduling algorithm.' });
      return;
    }

    if (req.body?.specs !== undefined) {
      if (!Array.isArray(req.body.specs) || req.body.specs.length > SYSTEM_CONFIG.MAX_PROCESSES) {
        res.status(400).json({
          error: `specs must be an array of at most ${SYSTEM_CONFIG.MAX_PROCESSES} processes.`,
        });
        return;
      }
    }

    let numProcesses: number | undefined;
    if (req.body?.numProcesses !== undefined) {
      const check = validateMaxProcessCount(req.body.numProcesses);
      if (!check.valid) {
        res.status(400).json({ error: check.error });
        return;
      }
      numProcesses = check.value;
    }

    const seedCheck = validateNumericBounds(req.body?.seed ?? 42, 'seed', 0, 1_000_000_000, true);
    if (!seedCheck.valid) {
      res.status(400).json({ error: seedCheck.error });
      return;
    }

    let rrQuantum: number | undefined;
    if (req.body?.rrQuantum !== undefined) {
      const qCheck = validateNumericBounds(req.body.rrQuantum, 'rrQuantum', 1, 16, true);
      if (!qCheck.valid) {
        res.status(400).json({ error: qCheck.error });
        return;
      }
      rrQuantum = qCheck.value;
    }

    const snapshot = rairaService.loadWorkload({
      specs: req.body?.specs as ProcessSpec[] | undefined,
      workloadType,
      numProcesses,
      seed: seedCheck.value,
      algorithm: req.body?.algorithm as AlgorithmType | undefined,
      rrQuantum,
    });
    res.json(snapshot);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to load workload.' });
  }
});

apiRouter.put('/simulation/processes', (req, res) => {
  try {
    const specs = req.body?.specs as ProcessSpec[];
    const workloadType = req.body?.workloadType ?? 'CUSTOM';
    if (!isValidWorkloadType(workloadType, true)) {
      res.status(400).json({ error: 'Unsupported workloadType.' });
      return;
    }
    if (!Array.isArray(specs)) {
      res.status(400).json({ error: 'specs array is required.' });
      return;
    }
    if (specs.length > SYSTEM_CONFIG.MAX_PROCESSES) {
      res.status(400).json({
        error: `Maximum ${SYSTEM_CONFIG.MAX_PROCESSES} processes allowed per episode.`,
      });
      return;
    }
    const snapshot = rairaService.updateProcessList(specs, workloadType);
    res.json(snapshot);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid process list.' });
  }
});

apiRouter.post('/simulation/config', (req, res) => {
  try {
    if (req.body?.algorithm !== undefined && !isValidAlgorithm(req.body.algorithm)) {
      res.status(400).json({ error: 'Unsupported scheduling algorithm.' });
      return;
    }

    let rrQuantum: number | undefined;
    if (req.body?.rrQuantum !== undefined) {
      const check = validateNumericBounds(req.body.rrQuantum, 'rrQuantum', 1, 16, true);
      if (!check.valid) {
        res.status(400).json({ error: check.error });
        return;
      }
      rrQuantum = check.value;
    }

    let stepIntervalMs: number | undefined;
    if (req.body?.stepIntervalMs !== undefined) {
      const check = validateNumericBounds(req.body.stepIntervalMs, 'stepIntervalMs', 80, 2000);
      if (!check.valid) {
        res.status(400).json({ error: check.error });
        return;
      }
      stepIntervalMs = check.value;
    }

    let starvationThreshold: number | undefined;
    if (req.body?.starvationThreshold !== undefined) {
      const check = validateNumericBounds(
        req.body.starvationThreshold,
        'starvationThreshold',
        3,
        200,
        true
      );
      if (!check.valid) {
        res.status(400).json({ error: check.error });
        return;
      }
      starvationThreshold = check.value;
    }

    let cleanWeights = undefined;
    if (req.body?.rewardWeights !== undefined) {
      const wCheck = validateRewardWeightsInput(req.body.rewardWeights);
      if (!wCheck.valid) {
        res.status(400).json({ error: wCheck.error });
        return;
      }
      cleanWeights = wCheck.value;
    }

    const snapshot = rairaService.configureSimulation({
      algorithm: req.body?.algorithm,
      rrQuantum,
      stepIntervalMs,
      rewardWeights: cleanWeights,
      starvationThreshold,
    });
    res.json(snapshot);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid configuration.' });
  }
});

apiRouter.post('/simulation/start', async (req, res) => {
  try {
    let speedMs: number | undefined;
    if (req.body?.stepIntervalMs !== undefined) {
      const check = validateNumericBounds(req.body.stepIntervalMs, 'stepIntervalMs', 80, 2000);
      if (!check.valid) {
        res.status(400).json({ error: check.error });
        return;
      }
      speedMs = check.value;
    }
    const snapshot = await rairaService.startSimulation(speedMs);
    res.json(snapshot);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to start simulation.' });
  }
});

apiRouter.post('/simulation/pause', (_req, res) => {
  res.json(rairaService.pauseSimulation());
});

apiRouter.post('/simulation/resume', async (_req, res) => {
  try {
    res.json(await rairaService.resumeSimulation());
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to resume simulation.' });
  }
});

apiRouter.post('/simulation/reset', (_req, res) => {
  res.json(rairaService.resetSimulation());
});

apiRouter.post('/simulation/step', async (_req, res) => {
  try {
    const snapshot = await rairaService.stepSimulationOnce();
    res.json(snapshot);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to step simulation.' });
  }
});

// ---- RL Training Centre ----
apiRouter.get('/rl/status', async (_req, res) => {
  await rairaService.ensureReady();
  res.json(rairaService.getTrainingSnapshot());
});

apiRouter.post('/rl/train/start', computeRateLimit, async (req, res) => {
  try {
    const body = req.body ?? {};
    if (body.agentType !== 'Q_LEARNING' && body.agentType !== 'DQN') {
      res.status(400).json({ error: 'agentType must be Q_LEARNING or DQN.' });
      return;
    }
    if (!isValidWorkloadType(body.workloadType ?? 'MIXED', true)) {
      res.status(400).json({ error: 'Unsupported workloadType.' });
      return;
    }
    const epCheck = validateNumericBounds(body.episodes, 'episodes', 1, 500, true);
    if (!epCheck.valid) {
      res.status(400).json({ error: epCheck.error });
      return;
    }
    const procCheck = validateMaxProcessCount(body.numProcesses ?? 10);
    if (!procCheck.valid) {
      res.status(400).json({ error: procCheck.error });
      return;
    }
    const lrCheck = validateNumericBounds(body.learningRate ?? 0.1, 'learningRate', 0.00001, 1);
    if (!lrCheck.valid) {
      res.status(400).json({ error: lrCheck.error });
      return;
    }
    const gammaCheck = validateNumericBounds(body.discountFactor ?? 0.95, 'discountFactor', 0.1, 0.999);
    if (!gammaCheck.valid) {
      res.status(400).json({ error: gammaCheck.error });
      return;
    }
    const epsStartCheck = validateNumericBounds(body.epsilonStart ?? 1.0, 'epsilonStart', 0, 1);
    if (!epsStartCheck.valid) {
      res.status(400).json({ error: epsStartCheck.error });
      return;
    }
    const epsDecayCheck = validateNumericBounds(body.epsilonDecay ?? 0.95, 'epsilonDecay', 0.5, 1);
    if (!epsDecayCheck.valid) {
      res.status(400).json({ error: epsDecayCheck.error });
      return;
    }
    const epsMinCheck = validateNumericBounds(body.epsilonMin ?? 0.05, 'epsilonMin', 0, 1);
    if (!epsMinCheck.valid) {
      res.status(400).json({ error: epsMinCheck.error });
      return;
    }
    const seedCheck = validateNumericBounds(body.seed ?? 42, 'seed', 0, 1_000_000_000, true);
    if (!seedCheck.valid) {
      res.status(400).json({ error: seedCheck.error });
      return;
    }

    let cleanWeights = undefined;
    if (body.rewardWeights !== undefined) {
      const wCheck = validateRewardWeightsInput(body.rewardWeights);
      if (!wCheck.valid) {
        res.status(400).json({ error: wCheck.error });
        return;
      }
      cleanWeights = wCheck.value;
    }

    const config: RLTrainingConfig = {
      agentType: body.agentType,
      workloadType: body.workloadType ?? 'MIXED',
      numProcesses: procCheck.value,
      episodes: epCheck.value,
      learningRate: lrCheck.value,
      discountFactor: gammaCheck.value,
      epsilonStart: epsStartCheck.value,
      epsilonDecay: epsDecayCheck.value,
      epsilonMin: epsMinCheck.value,
      batchSize: Math.max(8, Math.min(128, Math.floor(Number(body.batchSize ?? 32)))),
      targetUpdateFreq: Math.max(5, Math.min(200, Math.floor(Number(body.targetUpdateFreq ?? 20)))),
      seed: seedCheck.value,
      rewardWeights: cleanWeights as RLTrainingConfig['rewardWeights'],
    };

    const snapshot = await rairaService.startTraining(config);
    res.json(snapshot);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to start training.' });
  }
});

apiRouter.post('/rl/train/both', computeRateLimit, async (req, res) => {
  try {
    const workloadType = req.body?.workloadType ?? 'MIXED';
    if (!isValidWorkloadType(workloadType, true)) {
      res.status(400).json({ error: 'Unsupported workloadType.' });
      return;
    }
    const procCheck = validateMaxProcessCount(req.body?.numProcesses ?? 10);
    if (!procCheck.valid) {
      res.status(400).json({ error: procCheck.error });
      return;
    }
    const qEpCheck = validateNumericBounds(req.body?.qEpisodes ?? 30, 'qEpisodes', 1, 500, true);
    if (!qEpCheck.valid) {
      res.status(400).json({ error: qEpCheck.error });
      return;
    }
    const dqnEpCheck = validateNumericBounds(req.body?.dqnEpisodes ?? 15, 'dqnEpisodes', 1, 500, true);
    if (!dqnEpCheck.valid) {
      res.status(400).json({ error: dqnEpCheck.error });
      return;
    }
    const gammaCheck = validateNumericBounds(req.body?.discountFactor ?? 0.95, 'discountFactor', 0.1, 0.999);
    if (!gammaCheck.valid) {
      res.status(400).json({ error: gammaCheck.error });
      return;
    }
    const seedCheck = validateNumericBounds(req.body?.seed ?? 42, 'seed', 0, 1_000_000_000, true);
    if (!seedCheck.valid) {
      res.status(400).json({ error: seedCheck.error });
      return;
    }

    const snapshot = await rairaService.startTrainBoth({
      workloadType,
      numProcesses: procCheck.value,
      qEpisodes: qEpCheck.value,
      dqnEpisodes: dqnEpCheck.value,
      discountFactor: gammaCheck.value,
      seed: seedCheck.value,
    });
    res.json(snapshot);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to start batch training.' });
  }
});

apiRouter.post('/rl/train/pause', (_req, res) => {
  res.json(rairaService.pauseTraining());
});

apiRouter.post('/rl/train/resume', (_req, res) => {
  res.json(rairaService.resumeTraining());
});

apiRouter.post('/rl/train/stop', (_req, res) => {
  res.json(rairaService.stopTraining());
});

apiRouter.post('/rl/reset', computeRateLimit, async (req, res) => {
  try {
    const agentType = req.body?.agentType ?? 'Q_LEARNING';
    if (agentType !== 'Q_LEARNING' && agentType !== 'DQN') {
      res.status(400).json({ error: 'agentType must be Q_LEARNING or DQN.' });
      return;
    }
    const seedCheck = validateNumericBounds(req.body?.seed ?? 42, 'seed', 0, 1_000_000_000, true);
    if (!seedCheck.valid) {
      res.status(400).json({ error: seedCheck.error });
      return;
    }
    const snapshot = await rairaService.resetRLAgent(agentType as RLAgentType, seedCheck.value);
    res.json(snapshot);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to reset agent.' });
  }
});

apiRouter.get('/rl/model/:agentType', (req, res) => {
  try {
    const agentType = req.params.agentType as RLAgentType;
    if (agentType !== 'Q_LEARNING' && agentType !== 'DQN') {
      res.status(400).json({ error: 'agentType must be Q_LEARNING or DQN.' });
      return;
    }
    const model = rairaService.exportRLModel(agentType);
    res.json(model);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to export model.' });
  }
});

apiRouter.post('/rl/model/:agentType', computeRateLimit, async (req, res) => {
  try {
    const agentType = req.params.agentType as RLAgentType;
    if (agentType !== 'Q_LEARNING' && agentType !== 'DQN') {
      res.status(400).json({ error: 'agentType must be Q_LEARNING or DQN.' });
      return;
    }
    const check =
      agentType === 'Q_LEARNING'
        ? validateQLearningImportPayload(req.body)
        : validateDQNImportPayload(req.body);
    if (!check.valid) {
      res.status(400).json({ error: check.error });
      return;
    }
    const snapshot = await rairaService.importRLModel(agentType, req.body);
    res.json(snapshot);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid model checkpoint.' });
  }
});

// ---- Algorithm Comparison ----
apiRouter.get('/comparison/latest', (_req, res) => {
  res.json({ comparison: rairaService.getLastComparison() });
});

apiRouter.post('/comparison/run', computeRateLimit, async (req, res) => {
  try {
    const workloadType = req.body?.workloadType ?? 'MIXED';
    if (!isValidGeneratedWorkloadType(workloadType)) {
      res.status(400).json({ error: 'Unsupported workloadType for comparison.' });
      return;
    }
    const procCheck = validateMaxProcessCount(req.body?.numProcesses ?? 10);
    if (!procCheck.valid) {
      res.status(400).json({ error: procCheck.error });
      return;
    }
    const rrCheck = validateNumericBounds(req.body?.rrQuantum ?? 2, 'rrQuantum', 1, 16, true);
    if (!rrCheck.valid) {
      res.status(400).json({ error: rrCheck.error });
      return;
    }

    const rawSeeds: unknown[] = Array.isArray(req.body?.seeds)
      ? req.body.seeds
      : [req.body?.seed ?? 42];
    const seeds = rawSeeds
      .slice(0, 10)
      .map(Number)
      .filter((n: number) => Number.isInteger(n) && n >= 0 && n <= 1_000_000_000);
    if (seeds.length === 0) {
      res.status(400).json({ error: 'At least one valid integer seed is required.' });
      return;
    }

    const includeUntrainedRL =
      req.body?.includeUntrainedRL !== undefined ? Boolean(req.body.includeUntrainedRL) : true;

    const batch = await rairaService.runComparison({
      workloadType,
      numProcesses: procCheck.value,
      seeds,
      rrQuantum: rrCheck.value,
      includeUntrainedRL,
    });

    res.json(batch);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to run comparison.' });
  }
});

// ---- RAIRA 2.0: Counterfactual What-If Laboratory ----
apiRouter.get('/counterfactual/latest', (_req, res) => {
  res.json({ report: rairaService.getLastCounterfactual() });
});

apiRouter.post('/counterfactual/run', computeRateLimit, async (req, res) => {
  try {
    const rawHorizon = req.body?.horizonTicks;
    let horizonTicks: number | 'FULL_EPISODE';
    if (rawHorizon === 'FULL_EPISODE') {
      horizonTicks = 'FULL_EPISODE';
    } else {
      const hCheck = validateNumericBounds(rawHorizon ?? 20, 'horizonTicks', 1, 400, true);
      if (!hCheck.valid) {
        res.status(400).json({ error: hCheck.error });
        return;
      }
      horizonTicks = hCheck.value;
    }

    const rlReferenceAgent = req.body?.rlReferenceAgent;
    if (
      rlReferenceAgent !== undefined &&
      rlReferenceAgent !== 'Q_LEARNING' &&
      rlReferenceAgent !== 'DQN'
    ) {
      res.status(400).json({ error: 'rlReferenceAgent must be Q_LEARNING or DQN.' });
      return;
    }

    let alternativeActionId: number | null = null;
    if (req.body?.alternativeActionId !== undefined && req.body?.alternativeActionId !== null) {
      const actCheck = validateNumericBounds(
        req.body.alternativeActionId,
        'alternativeActionId',
        0,
        96,
        true
      );
      if (!actCheck.valid) {
        res.status(400).json({ error: actCheck.error });
        return;
      }
      alternativeActionId = actCheck.value;
    }

    const report = await rairaService.runCounterfactual({
      horizonTicks,
      rlReferenceAgent,
      alternativeActionId,
    });
    res.json(report);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to run counterfactual.' });
  }
});

// ---- RAIRA 2.0: Workload Shock Arena ----
apiRouter.get('/shock/latest', (_req, res) => {
  res.json({ report: rairaService.getLastShockReport() });
});

apiRouter.post('/shock/run', computeRateLimit, async (req, res) => {
  try {
    const body = req.body ?? {};
    if (!isValidShockType(body.shockType)) {
      res.status(400).json({ error: 'Unsupported shockType.' });
      return;
    }
    const baseWorkloadType = body.baseWorkloadType ?? 'MIXED';
    if (!isValidGeneratedWorkloadType(baseWorkloadType)) {
      res.status(400).json({ error: 'Unsupported baseWorkloadType.' });
      return;
    }
    const baseCheck = validateNumericBounds(
      body.baseNumProcesses ?? 10,
      'baseNumProcesses',
      4,
      SYSTEM_CONFIG.MAX_PROCESSES - 1,
      true
    );
    if (!baseCheck.valid) {
      res.status(400).json({ error: baseCheck.error });
      return;
    }
    const tickCheck = validateNumericBounds(body.injectionTick ?? 8, 'injectionTick', 1, 120, true);
    if (!tickCheck.valid) {
      res.status(400).json({ error: tickCheck.error });
      return;
    }
    const addCheck = validateNumericBounds(
      body.additionalProcesses ?? 4,
      'additionalProcesses',
      1,
      16,
      true
    );
    if (!addCheck.valid) {
      res.status(400).json({ error: addCheck.error });
      return;
    }
    const burstCheck = validateNumericBounds(body.cpuBurst ?? 8, 'cpuBurst', 1, 50, true);
    if (!burstCheck.valid) {
      res.status(400).json({ error: burstCheck.error });
      return;
    }
    const ramCheck = validateNumericBounds(
      body.ramDemandMb ?? 512,
      'ramDemandMb',
      16,
      SYSTEM_CONFIG.TOTAL_RAM_MB,
      true
    );
    if (!ramCheck.valid) {
      res.status(400).json({ error: ramCheck.error });
      return;
    }
    const prioCheck = validateNumericBounds(body.priority ?? 3, 'priority', 1, 5, true);
    if (!prioCheck.valid) {
      res.status(400).json({ error: prioCheck.error });
      return;
    }
    const seedCheck = validateNumericBounds(body.seed ?? 42, 'seed', 0, 1_000_000_000, true);
    if (!seedCheck.valid) {
      res.status(400).json({ error: seedCheck.error });
      return;
    }

    const config: ShockScenarioConfig = {
      shockType: body.shockType,
      baseWorkloadType,
      baseNumProcesses: baseCheck.value,
      injectionTick: tickCheck.value,
      additionalProcesses: addCheck.value,
      cpuBurst: burstCheck.value,
      ramDemandMb: ramCheck.value,
      priority: prioCheck.value,
      seed: seedCheck.value,
      rrQuantum: Math.max(1, Math.min(16, Math.floor(Number(body.rrQuantum ?? 2)))),
      starvationThreshold: Math.max(3, Math.min(200, Math.floor(Number(body.starvationThreshold ?? 15)))),
    };

    const report = await rairaService.runShockArena(config);
    res.json(report);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to run shock arena.' });
  }
});

// ---- RAIRA 2.0: Statistical Research Validation Laboratory ----
apiRouter.get('/validation/latest', (_req, res) => {
  res.json({ report: rairaService.getLastValidationReport() });
});

apiRouter.post('/validation/run', computeRateLimit, async (req, res) => {
  try {
    const body = req.body ?? {};
    const seedStartCheck = validateNumericBounds(body.seedStart ?? 1001, 'seedStart', 1, 1_000_000_000, true);
    if (!seedStartCheck.valid) {
      res.status(400).json({ error: seedStartCheck.error });
      return;
    }
    const seedCountCheck = validateNumericBounds(body.seedCount ?? 30, 'seedCount', 5, 100, true);
    if (!seedCountCheck.valid) {
      res.status(400).json({ error: seedCountCheck.error });
      return;
    }
    const procCheck = validateNumericBounds(
      body.numProcesses ?? 10,
      'numProcesses',
      4,
      SYSTEM_CONFIG.MAX_PROCESSES,
      true
    );
    if (!procCheck.valid) {
      res.status(400).json({ error: procCheck.error });
      return;
    }
    const rrCheck = validateNumericBounds(body.rrQuantum ?? 2, 'rrQuantum', 1, 16, true);
    if (!rrCheck.valid) {
      res.status(400).json({ error: rrCheck.error });
      return;
    }

    const rawWorkloads = Array.isArray(body.workloads) ? body.workloads : undefined;
    if (rawWorkloads) {
      if (rawWorkloads.length === 0 || rawWorkloads.length > 4) {
        res.status(400).json({ error: 'workloads must contain between 1 and 4 valid workload categories.' });
        return;
      }
      for (const wl of rawWorkloads) {
        if (!isValidWorkloadType(wl, false)) {
          res.status(400).json({ error: 'Invalid workload category in validation workloads.' });
          return;
        }
      }
    }

    const config: StatisticalValidationConfig = {
      seedStart: seedStartCheck.value,
      seedCount: seedCountCheck.value,
      numProcesses: procCheck.value,
      rrQuantum: rrCheck.value,
      workloads: rawWorkloads ?? ['CPU_INTENSIVE', 'MEMORY_INTENSIVE', 'MIXED', 'DYNAMIC'],
      includeUntrainedComparison: Boolean(body.includeUntrainedComparison ?? true),
      includeAblationStudy: Boolean(body.includeAblationStudy ?? true),
      starvationThreshold: Math.max(3, Math.min(200, Math.floor(Number(body.starvationThreshold ?? 15)))),
    };

    const report = await rairaService.runStatisticalValidationSuite(config);
    res.json(report);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to run statistical validation.' });
  }
});
