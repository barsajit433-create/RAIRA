# RAIRA 2.0 / 2.1 — Feature Documentation

This document details all 8 original RAIRA workspaces, all 6 RAIRA 2.0 Research Intelligence capabilities, and the RAIRA 2.1 Appearance & Design Studio.

---

## Part I — Original Eight Navigation Modules

### 1. Overview Dashboard (`Dashboard.tsx`)
- Displays six live KPI cards: CPU Utilisation, RAM Utilisation, Available RAM, Active Processes (`ready` / `blocked`), Completed Processes, and Current Algorithm.
- Provides one-click algorithm switching (`FCFS`, `RR`, `Priority`, `Q-Learning`, `DQN`) with explicit trained/untrained indicators, plus simulation controls (`Start`, `Step`, `Reset`).
- Includes radial CPU Utilisation Gauge, dynamic 4096 MB RAM Allocation Monitor, Workload & RL Agent Status summary, real-time CPU & RAM history charts, live Process Execution Table, Latest Allocation Decisions, Recent Experiment Results, and Kernel System Event Log.

### 2. Process Manager (`ProcessManager.tsx`)
- Supports **automatic seeded workload generation** across `CPU_INTENSIVE`, `MEMORY_INTENSIVE`, `MIXED`, and `DYNAMIC` scenarios (`1–32` processes, configurable PRNG seed).
- Supports **manual process authoring and inline editing** with strict validation (`arrivalTime >= 0`, `cpuBurstTime ∈ [1, 100]`, `priority ∈ [1, 5]`, `memoryDemand ∈ [64, 4096]`).
- Supports loading workloads directly into the live simulator and exporting/importing process tables.

### 3. Live Simulation & Execution Timeline (`LiveSimulation.tsx`)
- Full interactive kernel control bar (`Start`, `Pause`, `Step`, `Reset`, configurable tick speed `100ms–1000ms`, quick links to XAI Lab & Fairness Monitor, and `Log Run to History`).
- Five discrete-time OS process state lanes (`NEW`, `BLOCKED (Waiting RAM)`, `READY (RAM Reserved)`, `RUNNING (1 Core)`, `COMPLETED`).
- Live SMDP step reward breakdown panel (`R_cpu`, `R_comp`, `R_fair`, `P_wait`, `P_turn`, `P_inv`, Discounted Step Total).
- **RAIRA 2.0 Feature 5 — Live Process Execution Timeline**: Interactive tick-by-tick execution Gantt timeline and synchronized memory utilization strip tracking every process state transition, preemption, RAM reservation, and completion.

### 4. RL Training Centre (`TrainingCentre.tsx`)
- Trains **Tabular Q-Learning**, **TensorFlow.js DQN**, or runs sequential **Train Both** on any workload scenario with full hyperparameter controls (episodes, processes, learning rate `α`, discount `γ`, epsilon decay, DQN batch size, target update frequency, base seed).
- Streams real-time episode reward, rolling 10-episode average, exploration `ε`, Q-table state growth, and DQN Huber training loss.
- Provides one-click checkpoint save/load (`localStorage`), JSON download/upload, and safe agent reset.

### 5. Algorithm Comparison & Statistical Validation (`AlgorithmComparison.tsx`)
- **Controlled Multi-Algorithm Benchmark**: Evaluates `FCFS`, `RR`, `PRIORITY`, `Q_LEARNING`, and `DQN` on identical seeded process workloads (`1–10` seeds per quick batch), with aggregated rankings, latency/reward charts, per-seed result table, and CSV/JSON export.
- **RAIRA 2.0 Feature 6 — Statistical Research Validation Laboratory**: Runs `>= 30` disjoint evaluation seeds (`1001..1030`) across all 4 workloads, reporting Mean ± SD, Student-*t* 95% Confidence Intervals, Median, P95, trained vs. untrained RL deltas, unseen-workload generalisation, and controlled ablation studies.

### 6. Research Analytics (`ResearchAnalytics.tsx`)
- Multi-dimensional research charts aggregating actual logged experiments and training histories: latency trade-offs, fairness vs. waiting time scatter/comparison, resource utilisation efficiency, and RL learning convergence curves.

### 7. Experiment History (`ExperimentHistory.tsx`)
- Searchable, filterable table of all persisted runs stored in `localStorage` (`raira_experiment_history_v1`), preserving algorithm, trained/untrained provenance, workload, seed, reward profile, latency, throughput, fairness, and reward, with individual delete, clear, and CSV/JSON export.

### 8. Project Information (`ProjectInformation.tsx`)
- Embedded academic reference summarizing the single-core/4096 MB machine model, SMDP formulation, observation/action space dimensions, reward weights, and system invariants.

---

## Part II — Six RAIRA 2.0 Research Intelligence Capabilities

### Feature 1: Explainable AI Decision Engine (`IntelligenceLab.tsx`, `ExplainableAI.ts`)
- Captures every live Q-Learning and DQN decision into an inspectable decision trace.
- Displays pre-step process attributes (`PID`, status, priority, remaining CPU, waiting time, RAM demand, allocated RAM, available RAM), selected action & quantum, selected Q-value, ranked valid alternative actions with Q-value gaps, exact SMDP reward breakdown, and post-execution state transitions.
- Generates strictly deterministic **rule-based explanations** derived from actual simulator features and model Q-values (zero generative LLM text fabrication).
- For **DQN**, performs controlled **feature-perturbation sensitivity analysis** on the live 262-dim observation vector (perturbing waiting time, remaining CPU, priority, RAM availability, and memory demand) to report `ΔQ` and whether the argmax action flips.

### Feature 2: Counterfactual What-If Laboratory (`IntelligenceLab.tsx`, `CounterfactualLab.ts`)
- Pauses at any live decision tick and deep-clones the simulator into 5 isolated branches sharing identical future scheduled arrivals:
  1. `Selected RL Policy` (Q-Learning or DQN)
  2. `FCFS Counterfactual`
  3. `Round Robin (q=2) Counterfactual`
  4. `Priority Counterfactual`
  5. `Alternative Valid RL Action` (2nd-highest Q action or user-selected valid action)
- Evaluates configurable horizons (`10`, `20`, `40` ticks, or `FULL_EPISODE`) and reports exact deltas (`ΔWait`, `ΔTurnaround`, `ΔThroughput`, `ΔFairness`, `ΔReward`, `Violations`) with an explicit controlled-counterfactual disclaimer and CSV/JSON export.

### Feature 3: Workload Shock Arena (`ShockArena.tsx`, `ShockArena.ts`)
- Five configurable mid-episode disturbance presets: `CPU_SPIKE`, `MEMORY_BURST`, `HIGH_PRIORITY_BURST`, `SIMULTANEOUS_ARRIVALS`, and `SEVERE_RAM_PRESSURE`.
- Injects identical shock processes (`S01..Sk`) at the exact same tick across all 5 scheduling policies and reports stabilization tick, recovery ticks, maximum queue length, peak waiting time, CPU utilisation drop %, peak RAM pressure %, throughput reduction %, starvation events, final average wait, and episode reward, alongside interactive resilience charts and CSV/JSON export.

### Feature 4: Fairness & Starvation Prevention Monitor (`FairnessMonitorPage.tsx`, `FairnessMonitor.ts`)
- Computes both **GPS Service-Share Fairness (`J_share`)** (accounting for arrival time and CPU burst demand via ideal Generalized Processor Sharing share `E_i`) and **Wait-Based Jain Fairness**.
- Flags processes breaching the configurable starvation waiting threshold (`default: 15 ticks`) with severity classification (`HEALTHY`, `MODERATE`, `CRITICAL`).
- Provides three reward presets (`EFFICIENCY`, `BALANCED`, `FAIRNESS`), custom weight sliders, saved named reward profiles, and a live **Model Reward Provenance Check** alerting the researcher whenever active reward weights diverge from the `BALANCED` objective used to train the bundled models.

### Feature 5: Live Process Execution Timeline (`LiveSimulation.tsx`, `LiveExecutionTimeline.tsx`)
- Embedded directly inside Live Simulation; renders tick-by-tick process state blocks (`RUNNING`, `READY`, `BLOCKED`, `COMPLETED`), preemption markers, and synchronized RAM reservation bars so researchers can inspect convoy effects, preemption cadence, and memory release timing directly.

### Feature 6: Statistical Research Validation Laboratory (`AlgorithmComparison.tsx`, `StatisticalValidation.ts`)
- Enforces strict separation between evaluation seeds (`>= 1001`) and bundled training seeds (`42..875`), displaying an explicit disjointness verification badge.
- Executes identical seeded workloads across all policies (`FCFS`, `RR`, `PRIORITY`, `Q_LEARNING_TRAINED`, `DQN_TRAINED`, plus optional `Q_LEARNING_UNTRAINED` and `DQN_UNTRAINED`) across all 4 workloads, plus a 6-variant controlled ablation study (`q=1`, `q=4`, Fairness reward evaluation), exporting full JSON/CSV artifacts.

---

## Part III — RAIRA 2.1 Appearance & Design Studio (`DesignStudio.tsx`)

- **Four Complete Themes**:
  1. **AI Mission Control** (Dark navy canvas, electric cyan accent, emerald confirmations, subtle glassmorphism)
  2. **Academic Research Studio** (Clean white canvas, soft grey panels, scholarly blue accents, publication-style flat charts)
  3. **Cyber Intelligence Lab** (Graphite dark canvas, violet & neon cyan accents, restrained glowing borders)
  4. **Minimal Enterprise** (White & slate-grey SaaS canvas, generous whitespace, minimal borders)
- Live miniature UI preview cards, instant global theme application across all 12 workspaces and Recharts visualizations, accent hue calibration, layout density toggle, reduced-motion respect, and `localStorage` persistence (`raira_design_studio_v21`).
