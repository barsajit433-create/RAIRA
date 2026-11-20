import { Router } from 'express';
import { rairaService } from '../services/rairaService.ts';
import { generateWorkload, WORKLOAD_SCENARIOS } from '../../src/simulation/WorkloadGenerator.ts';
import type { ProcessSpec, WorkloadType } from '../../src/types/process.ts';
import type { AlgorithmType } from '../../src/types/simulation.ts';
import type { RLAgentType, RLTrainingConfig } from '../../src/types/reinforcementLearning.ts';
import type {
  ShockScenarioConfig,
  StatisticalValidationConfig,
} from '../../src/types/intelligence.ts';

export const apiRouter = Router();

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
    const workloadType = (req.body?.workloadType ?? 'MIXED') as Exclude<WorkloadType, 'CUSTOM'>;
    const numProcesses = Number(req.body?.numProcesses ?? 10);
    const seed = Number(req.body?.seed ?? 42);
    const applyToSimulation = Boolean(req.body?.applyToSimulation ?? false);

    if (!WORKLOAD_SCENARIOS[workloadType]) {
      res.status(400).json({ error: `Unsupported workloadType: ${workloadType}` });
      return;
    }

    const specs = generateWorkload(workloadType, numProcesses, seed);
    let snapshot = undefined;
    if (applyToSimulation) {
      snapshot = rairaService.loadWorkload({
        specs,
        workloadType,
        seed,
      });
    }

    res.json({ workloadType, numProcesses: specs.length, seed, specs, snapshot });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ---- Simulation Engine ----
apiRouter.get('/simulation/state', async (_req, res) => {
  await rairaService.ensureReady();
  res.json(rairaService.getSimulationSnapshot());
});

apiRouter.post('/simulation/load', (req, res) => {
  try {
    const snapshot = rairaService.loadWorkload({
      specs: req.body?.specs as ProcessSpec[] | undefined,
      workloadType: (req.body?.workloadType ?? 'MIXED') as WorkloadType,
      numProcesses: req.body?.numProcesses !== undefined ? Number(req.body.numProcesses) : undefined,
      seed: Number(req.body?.seed ?? 42),
      algorithm: req.body?.algorithm as AlgorithmType | undefined,
      rrQuantum: req.body?.rrQuantum !== undefined ? Number(req.body.rrQuantum) : undefined,
    });
    res.json(snapshot);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

apiRouter.put('/simulation/processes', (req, res) => {
  try {
    const specs = req.body?.specs as ProcessSpec[];
    const workloadType = (req.body?.workloadType ?? 'CUSTOM') as WorkloadType;
    if (!Array.isArray(specs)) {
      res.status(400).json({ error: 'specs array is required.' });
      return;
    }
    const snapshot = rairaService.updateProcessList(specs, workloadType);
    res.json(snapshot);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

apiRouter.post('/simulation/config', (req, res) => {
  try {
    const snapshot = rairaService.configureSimulation({
      algorithm: req.body?.algorithm,
      rrQuantum: req.body?.rrQuantum !== undefined ? Number(req.body.rrQuantum) : undefined,
      stepIntervalMs:
        req.body?.stepIntervalMs !== undefined ? Number(req.body.stepIntervalMs) : undefined,
      rewardWeights: req.body?.rewardWeights,
      starvationThreshold:
        req.body?.starvationThreshold !== undefined
          ? Number(req.body.starvationThreshold)
          : undefined,
    });
    res.json(snapshot);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

apiRouter.post('/simulation/start', async (req, res) => {
  try {
    const speedMs = req.body?.stepIntervalMs !== undefined ? Number(req.body.stepIntervalMs) : undefined;
    const snapshot = await rairaService.startSimulation(speedMs);
    res.json(snapshot);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

apiRouter.post('/simulation/pause', (_req, res) => {
  res.json(rairaService.pauseSimulation());
});

apiRouter.post('/simulation/resume', async (_req, res) => {
  try {
    res.json(await rairaService.resumeSimulation());
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
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
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ---- RL Training Centre ----
apiRouter.get('/rl/status', async (_req, res) => {
  await rairaService.ensureReady();
  res.json(rairaService.getTrainingSnapshot());
});

apiRouter.post('/rl/train/start', async (req, res) => {
  try {
    const config = req.body as RLTrainingConfig;
    const snapshot = await rairaService.startTraining(config);
    res.json(snapshot);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

apiRouter.post('/rl/train/both', async (req, res) => {
  try {
    const snapshot = await rairaService.startTrainBoth({
      workloadType: (req.body?.workloadType ?? 'MIXED') as WorkloadType,
      numProcesses: Number(req.body?.numProcesses ?? 10),
      qEpisodes: Number(req.body?.qEpisodes ?? 30),
      dqnEpisodes: Number(req.body?.dqnEpisodes ?? 15),
      discountFactor: Number(req.body?.discountFactor ?? 0.95),
      seed: Number(req.body?.seed ?? 42),
    });
    res.json(snapshot);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
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

apiRouter.post('/rl/reset', async (req, res) => {
  try {
    const agentType = (req.body?.agentType ?? 'Q_LEARNING') as RLAgentType;
    const seed = req.body?.seed !== undefined ? Number(req.body.seed) : 42;
    const snapshot = await rairaService.resetRLAgent(agentType, seed);
    res.json(snapshot);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
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
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

apiRouter.post('/rl/model/:agentType', async (req, res) => {
  try {
    const agentType = req.params.agentType as RLAgentType;
    if (agentType !== 'Q_LEARNING' && agentType !== 'DQN') {
      res.status(400).json({ error: 'agentType must be Q_LEARNING or DQN.' });
      return;
    }
    const snapshot = await rairaService.importRLModel(agentType, req.body);
    res.json(snapshot);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ---- Algorithm Comparison ----
apiRouter.get('/comparison/latest', (_req, res) => {
  res.json({ comparison: rairaService.getLastComparison() });
});

apiRouter.post('/comparison/run', async (req, res) => {
  try {
    const workloadType = (req.body?.workloadType ?? 'MIXED') as Exclude<WorkloadType, 'CUSTOM'>;
    const numProcesses = Number(req.body?.numProcesses ?? 10);
    const seeds = Array.isArray(req.body?.seeds)
      ? req.body.seeds.map(Number).filter((n: number) => Number.isFinite(n))
      : [Number(req.body?.seed ?? 42)];
    const rrQuantum = Number(req.body?.rrQuantum ?? 2);
    const includeUntrainedRL =
      req.body?.includeUntrainedRL !== undefined ? Boolean(req.body.includeUntrainedRL) : true;

    const batch = await rairaService.runComparison({
      workloadType,
      numProcesses,
      seeds: seeds.length > 0 ? seeds : [42],
      rrQuantum,
      includeUntrainedRL,
    });

    res.json(batch);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ---- RAIRA 2.0: Counterfactual What-If Laboratory ----
apiRouter.get('/counterfactual/latest', (_req, res) => {
  res.json({ report: rairaService.getLastCounterfactual() });
});

apiRouter.post('/counterfactual/run', async (req, res) => {
  try {
    const rawHorizon = req.body?.horizonTicks;
    const horizonTicks: number | 'FULL_EPISODE' =
      rawHorizon === 'FULL_EPISODE' ? 'FULL_EPISODE' : Math.max(1, Number(rawHorizon ?? 20));
    const rlReferenceAgent = req.body?.rlReferenceAgent as 'Q_LEARNING' | 'DQN' | undefined;
    const alternativeActionId =
      req.body?.alternativeActionId !== undefined && req.body?.alternativeActionId !== null
        ? Number(req.body.alternativeActionId)
        : null;

    const report = await rairaService.runCounterfactual({
      horizonTicks,
      rlReferenceAgent,
      alternativeActionId,
    });
    res.json(report);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ---- RAIRA 2.0: Workload Shock Arena ----
apiRouter.get('/shock/latest', (_req, res) => {
  res.json({ report: rairaService.getLastShockReport() });
});

apiRouter.post('/shock/run', async (req, res) => {
  try {
    const config = req.body as ShockScenarioConfig;
    const report = await rairaService.runShockArena(config);
    res.json(report);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ---- RAIRA 2.0: Statistical Research Validation Laboratory ----
apiRouter.get('/validation/latest', (_req, res) => {
  res.json({ report: rairaService.getLastValidationReport() });
});

apiRouter.post('/validation/run', async (req, res) => {
  try {
    const config = req.body as StatisticalValidationConfig;
    const report = await rairaService.runStatisticalValidationSuite(config);
    res.json(report);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
