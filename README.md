# RAIRA 2.0 / 2.1 — Reinforcement Learning-based Adaptive Intelligent Resource Allocator

RAIRA is a full-stack Operating Systems research platform and discrete-time CPU/RAM scheduling simulator comparing three classical OS schedulers (**FCFS**, **Round Robin**, **Priority**) against two real Reinforcement Learning agents (**Candidate-Aware Tabular Q-Learning** and a **TensorFlow.js Deep Q-Network**).

Built as an academic research demonstration platform, RAIRA combines an authoritative discrete-time OS kernel simulator with six explainable research capabilities (**RAIRA 2.0**) and a calibrated multi-theme interface system (**RAIRA 2.1 Design Studio**).

---

## Simulated Hardware & OS Model

| Parameter | Value | Enforced Invariant |
| :--- | :--- | :--- |
| **CPU Architecture** | Single-Core (`1` core, `100%` capacity) | At most one process executes per discrete tick |
| **Main Memory (RAM)** | `4096 MB` total | Dynamic admission; `allocatedRam <= 4096 MB` strictly enforced |
| **Preemption Memory Policy** | Non-release on preemption | Preempted processes retain reserved RAM until completion |
| **Max Processes / Episode** | `32` slots (`slotIndex` `0..31`) | Fixed-slot observation vector & masked action space |
| **Episode Horizon** | `600` ticks (`MAX_EPISODE_TICKS`) | Distinguishes natural `TERMINATED` vs. time-limit `TRUNCATED` |
| **RL CPU Quantum Choices** | `q ∈ {1, 2, 4}` ticks | Semi-MDP (`SMDP`) multi-tick execution with `γ^τ` discounting |
| **Workload Categories** | 4 seeded generators + Custom | `CPU_INTENSIVE`, `MEMORY_INTENSIVE`, `MIXED`, `DYNAMIC` |

---

## Core Capabilities

### 8 Original Application Modules
1. **Overview Dashboard** — Live CPU/RAM telemetry gauges, KPIs, algorithm selector, process queue summary, recent allocation decisions, and kernel event log.
2. **Process Manager** — Manual process creation/editing with strict validation, deterministic seeded workload generator across all 4 workload types, and JSON import/export.
3. **Live Simulation & Execution Timeline** — Step-by-step and real-time playback (`Start`, `Pause`, `Step`, `Reset`), discrete-time OS queue lanes (`NEW`, `BLOCKED`, `READY`, `RUNNING`, `COMPLETED`), and synchronized tick-by-tick process execution timeline.
4. **RL Training Centre** — Configurable training for Tabular Q-Learning and TensorFlow.js DQN (including sequential Train Both), live reward/loss/epsilon curves, and JSON checkpoint export/import.
5. **Algorithm Comparison** — Controlled head-to-head benchmarking of all 5 policies on identical seeded process workloads with CSV/JSON exports.
6. **Research Analytics** — Cross-run latency, resource efficiency, fairness, and training convergence charts derived strictly from actual executed runs.
7. **Experiment History** — Persistent `localStorage` archive of completed simulation, training, and benchmark runs with search, filtering, and export.
8. **Project Information** — Complete OS scheduling model specification, SMDP formulation, reward equations, and hardware invariants.

### 6 RAIRA 2.0 Research Intelligence Capabilities
1. **Explainable AI Decision Engine** — Inspects ground-truth Q-Learning and DQN decisions: pre-step process state, valid masked action Q-value landscape, individual SMDP reward breakdown, deterministic rule-based feature derivations (zero fabricated natural language), and controlled DQN feature-perturbation sensitivity analysis.
2. **Counterfactual What-If Laboratory** — Snapshots the exact live simulator state into 5 completely isolated clones (`Selected RL`, `FCFS`, `Round Robin`, `Priority`, `Alternative Valid RL Action`) and compares outcomes over a configurable horizon without mutating live simulation state.
3. **Workload Shock Arena** — Injects identical mid-episode workload disturbances (`CPU_SPIKE`, `MEMORY_BURST`, `HIGH_PRIORITY_BURST`, `SIMULTANEOUS_ARRIVALS`, `SEVERE_RAM_PRESSURE`) across all 5 policies to quantify recovery ticks, peak RAM pressure, queue backlog, and starvation resilience.
4. **Fairness & Starvation Prevention Monitor** — Tracks both raw wait-based Jain Fairness and arrival-/demand-aware **Generalized Processor Sharing (GPS) Service-Share Fairness**, monitors configurable starvation wait thresholds, and provides 3 reward presets (`EFFICIENCY`, `BALANCED`, `FAIRNESS`) with explicit model reward-provenance verification.
5. **Live Process Execution Timeline** — Tick-by-tick Gantt and memory timeline recording per-process execution, waiting, RAM blocking, preemption, and completion events.
6. **Statistical Research Validation Laboratory** — Runs `>= 30` independent evaluation seeds strictly disjoint from training seeds (`1001..1030` vs. training `42..875`) across all 4 workloads, computing Mean, Sample SD, Student-*t* 95% Confidence Intervals, Median, P95, trained vs. untrained RL comparisons, unseen-workload generalisation, and controlled quantum/reward ablations.

### RAIRA 2.1 Appearance & Design Studio
- Four WCAG AA contrast-verified themes (**AI Mission Control**, **Academic Research Studio**, **Cyber Intelligence Lab**, **Minimal Enterprise**), accent calibration, layout density, chart rendering preferences, and reduced-motion support persisted to `localStorage`.

---

## Pretrained Model Provenance Summary

Both RL agents ship with deterministic pretrained checkpoints hydrated automatically at server startup from `src/reinforcement-learning/pretrainedModels.ts` (SHA-256: `2f701d88049f9a0636f38de2e1ff39353e1f9ce3724232e10374ebc0a1c08361`):

| Model | Checkpoint ID | Episodes | Training Workload | Training Seeds | Architecture / Size | Reward Profile |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| **Tabular Q-Learning** | `raira-qtable-v1` | `50` | `MIXED` (10 procs) | `42 + 17k` (`42..875`) | `381` compact states · `1,749` keys · `3,182` updates | `BALANCED` (`γ=0.95`, `α=0.15`) |
| **Deep Q-Network (DQN)** | `raira-dqn-v1` | `25` | `MIXED` (10 procs) | `42 + 17k` (`42..450`) | Dense `262→256→128→97` (`112,737` params, TF.js `4.22.0`) | `BALANCED` (`γ=0.95`, `lr=0.001`) |

Full provenance details and empirical 30-seed validation results are documented in [`docs/EXPERIMENTS.md`](docs/EXPERIMENTS.md).

---

## Quick Start & Commands

### Prerequisites
- Node.js `>= 20` and npm

### Install & Run
```bash
npm install
npm run dev
```
The full-stack Express + Vite server runs on `http://localhost:3000`.

### Verification, Type-Checking, Build & Automated Tests
```bash
# TypeScript strict type-checking
npm run lint

# Production frontend bundle
npm run build

# Full automated unit test suite (20 tests across simulation, RAIRA 2.0 labs, and Design Studio)
npx --yes tsx --test src/simulation/simulation.test.ts src/simulation/raira2.test.ts src/theme/themeConfig.test.ts
```

---

## Documentation & Academic Exports

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — System architecture, REST API surface, kernel invariants, and persistence model.
- [`docs/FEATURES.md`](docs/FEATURES.md) — Functional specification of all 12 navigation workspaces and 6 RAIRA 2.0 research labs.
- [`docs/METHODOLOGY.md`](docs/METHODOLOGY.md) — Classical schedulers, SMDP mathematical formulation, Q-Learning & DQN algorithms, GPS fairness, and Student-*t* statistics.
- [`docs/EXPERIMENTS.md`](docs/EXPERIMENTS.md) — Experiment configuration summary, model provenance, empirical 30-seed validation & shock resilience findings, and honest research limitations.
- `exports/` — Machine-readable experimental datasets generated directly from the verified RAIRA backend:
  - `exports/raira_validation_30seeds.json`
  - `exports/raira_validation_30seeds_summary.csv`
  - `exports/raira_per_seed_4workloads_30seeds.csv`
  - `exports/raira_shock_arena_results.json`
  - `exports/raira_shock_arena_results.csv`
