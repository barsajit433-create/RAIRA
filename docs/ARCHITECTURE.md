# RAIRA 2.0 / 2.1 — System Architecture Documentation

## 1. Architectural Overview

RAIRA is structured as a decoupled full-stack TypeScript application running an authoritative **Node.js + Express** simulation and reinforcement learning backend alongside a **React 19 + Tailwind CSS + Recharts** research frontend served through Vite on port `3000`.

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    React 19 Frontend (Vite + Tailwind)                  │
│  12 Workspaces · Recharts Telemetry · Design Studio Theme Engine (v2.1) │
│  Persistence: localStorage (History, Comparisons, Reports, Checkpoints) │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ REST JSON API (/api/*)
┌───────────────────────────────▼─────────────────────────────────────────┐
│                   Express Backend (server.ts / apiRoutes.ts)            │
│                 Singleton Orchestrator (rairaService.ts)                │
├──────────────────┬────────────────────────┬─────────────────────────────┤
│ Discrete-Time OS │ Reinforcement Learning │ RAIRA 2.0 Research Modules  │
│ Kernel Simulator │ & Pretrained Models    │                             │
│                  │                        │ • ExplainableAI.ts          │
│ • SimulationEng  │ • QLearningAgent.ts    │ • CounterfactualLab.ts      │
│ • ResourceMgr    │ • DQNAgent.ts (TF.js)  │ • ShockArena.ts             │
│ • CpuScheduler   │ • TrainingEngine.ts    │ • FairnessMonitor.ts        │
│ • WorkloadGen    │ • pretrainedModels.ts  │ • StatisticalValidation.ts  │
│ • StateEncoder   │ • ActionSpace.ts       │ • ReplayBuffer.ts           │
│ • RewardCalc     │                        │                             │
└──────────────────┴────────────────────────┴─────────────────────────────┘
```

All scheduling physics, memory reservation enforcement, neural network inference, counterfactual cloning, shock injection, and statistical aggregations execute deterministically inside the TypeScript domain modules (`src/simulation/`, `src/reinforcement-learning/`, `src/analytics/`). The UI never fabricates telemetry or metrics.

---

## 2. Directory & Module Inventory

### Backend Entry & Service Layer (`server/`)
- `server.ts` — Express server entry point mounting `/api` routes and Vite dev middleware (or static `dist/` in production) on port `3000`.
- `server/routes/apiRoutes.ts` — Complete REST API surface across health, workloads, simulation control, RL training/checkpoints, algorithm comparison, counterfactual branching, shock arena, and statistical validation.
- `server/services/rairaService.ts` — Authoritative singleton holding the live `SimulationEngine`, `QLearningAgent`, `DQNAgent`, `TrainingEngine`, and latest cached reports. Hydrates bundled pretrained Q-Learning synchronously and pretrained TensorFlow.js DQN asynchronously at startup (`ensureReady()`).

### Simulation Kernel & RAIRA 2.0 Engines (`src/simulation/`)
- `SimulationEngine.ts` — Core discrete-time OS kernel (`1` CPU core, `4096 MB` RAM, max `32` processes, `600` tick cap), supporting both baseline ticking (`stepBaselineTick`) and SMDP RL execution (`stepAction`), deep state cloning (`clone()`), mid-episode shock injection (`injectShockProcesses`), and timeline recording.
- `ResourceManager.ts` — Dynamic RAM allocator enforcing `0 <= usedRamMb <= 4096`, strict non-release upon preemption, and release strictly upon `COMPLETED` transition.
- `CpuScheduler.ts` — Deterministic baseline schedulers (`FCFS`, `RR` with configurable quantum, `PRIORITY` with deterministic arrival/slot tie-breaking).
- `WorkloadGenerator.ts` — Mulberry32 `SeededRNG` and 4 workload profile generators (`CPU_INTENSIVE`, `MEMORY_INTENSIVE`, `MIXED`, `DYNAMIC`) plus strict process parameter validation.
- `StateEncoder.ts` — Fixed-length `262`-dimensional float32 observation encoder (`6` global scalars + `32 × 8` per-slot features, clamped to `[0, 1]`).
- `ActionSpace.ts` — Discrete `97`-action encoding (`0 = WAIT`, `1..96 = (slot ∈ [0..31], quantum ∈ {1,2,4})`) with exact hardware feasibility action masking.
- `RewardCalculator.ts` — Multi-objective per-tick and SMDP `γ^τ`-discounted reward calculator (`R_cpu`, `R_comp`, `P_wait`, `P_turn`, `R_fair`, `P_inv`).
- `ExplainableAI.ts` — Ground-truth Q-value inspection, rule-based feature derivations, and controlled DQN observation-perturbation sensitivity analysis.
- `CounterfactualLab.ts` — Deep-clones the live `SimulationEngine` into 5 isolated branches (`SELECTED_RL`, `FCFS`, `RR`, `PRIORITY`, `ALT_RL`) without mutating live simulator memory.
- `ShockArena.ts` — Injects identical mid-episode process bursts across all 5 policies and measures stabilization tick, recovery time, queue backlog, RAM pressure, throughput delta, and starvation count.
- `FairnessMonitor.ts` — Computes Generalized Processor Sharing (`GPS`) expected CPU service share `E_i`, service-share Jain index `J_share`, wait-based Jain index, starvation risk alerts, and reward-weight provenance checks.

### Reinforcement Learning & Analytics (`src/reinforcement-learning/`, `src/analytics/`)
- `QLearningAgent.ts` — Candidate-aware compact-state tabular SMDP Q-Learning agent with JSON serialization/deserialization.
- `DQNAgent.ts` — TensorFlow.js (`@tensorflow/tfjs` `4.22.0`, CPU backend) Deep Q-Network (`262 → 256 → 128 → 97`, `112,737` parameters) with online + target networks, Huber loss, Adam optimizer, masked target maximization, and float32 weight checkpointing.
- `ReplayBuffer.ts` — Fixed-capacity circular experience replay buffer for SMDP transitions `(s, a, R_τ, s', mask', τ, terminated, truncated)`.
- `TrainingEngine.ts` — Non-blocking episode training loop supporting single-agent training, sequential `Train Both`, pause/resume/stop, and per-episode telemetry.
- `pretrainedModels.ts` — Bundled verified Q-Learning (`raira-qtable-v1`, 50 episodes) and DQN (`raira-dqn-v1`, 25 episodes) checkpoints (`747,641` bytes).
- `src/analytics/StatisticalValidation.ts` — Disjoint-seed (`>= 30` seeds) statistical validation suite computing Mean, Sample SD, Student-*t* 95% CIs, Median, P95, trained vs. untrained comparisons, unseen-workload generalisation, and ablation studies.

### Frontend Presentation & Persistence (`src/pages/`, `src/components/`, `src/services/`, `src/theme/`)
- 12 page modules under `src/pages/` mapped from `src/App.tsx` and `src/components/Sidebar.tsx`.
- `src/services/api.ts` — Typed HTTP client wrapping all `/api/*` endpoints.
- `src/services/experimentStorage.ts` — Browser `localStorage` persistence across 7 versioned keys (`raira_experiment_history_v1`, `raira_comparisons_v1`, `raira_saved_model_v1_*`, `raira_settings_v1`, `raira_shock_reports_v2`, `raira_validation_reports_v2`, `raira_reward_configs_v2`).
- `src/theme/` — RAIRA 2.1 Design Studio token registry (`themeConfig.ts`, `ThemeContext.tsx`) persisted under `raira_design_studio_v21`, verified for WCAG AA (`>= 4.5:1`) contrast across all 4 themes.

---

## 3. REST API Surface

| Group | Endpoints | Responsibility |
| :--- | :--- | :--- |
| **Health** | `GET /api/health` | Backend readiness + TensorFlow.js DQN backend & parameter count |
| **Workloads** | `GET /api/workloads/scenarios`, `POST /api/workloads/generate` | Scenario metadata & deterministic seeded process generation |
| **Simulation** | `GET /api/simulation/state`, `POST /api/simulation/{load,config,start,pause,resume,reset,step}`, `PUT /api/simulation/processes` | Authoritative simulator lifecycle, stepping, and custom process edits |
| **RL Agents** | `GET /api/rl/status`, `POST /api/rl/train/{start,both,pause,resume,stop}`, `POST /api/rl/reset`, `GET/POST /api/rl/model/:agentType` | Training control and JSON model checkpoint import/export |
| **Benchmarks** | `GET /api/comparison/latest`, `POST /api/comparison/run` | Multi-seed controlled 5-algorithm head-to-head benchmarking |
| **RAIRA 2.0 Labs** | `GET/POST /api/counterfactual/{latest,run}`, `GET/POST /api/shock/{latest,run}`, `GET/POST /api/validation/{latest,run}` | Isolated counterfactual branching, shock arena, and `>= 30`-seed statistical validation |

---

## 4. Non-Negotiable Kernel Invariants

1. **Single-Core Mutual Exclusion**: Exactly 0 or 1 process runs per tick (`cpuUtil ∈ {0, 100}`).
2. **Hard Memory Ceiling**: Total reserved RAM across `READY` + `RUNNING` processes never exceeds `4096 MB`.
3. **Preemption Memory Retention**: Preempting a `RUNNING` process transitions it to `READY` without freeing its allocated RAM; memory is released only upon `COMPLETED`.
4. **Action Mask Safety**: Both Q-Learning and DQN evaluate strictly over hardware-feasible masked actions (`invalidActionsTotal = 0` across all 930 validated episodes).
5. **Counterfactual State Isolation**: `CounterfactualLab` deep-clones the `SimulationEngine` before running any branch; live simulator tick, queues, metrics, and timelines are provably invariant.
