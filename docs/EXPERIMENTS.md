# RAIRA 2.0 — Experiment Configuration, Model Provenance & Empirical Findings

All experimental tables in this document are derived **strictly from actual execution outputs** produced by the verified RAIRA 2.0 backend and saved verbatim in `exports/`. No metrics are estimated or fabricated.

---

## 1. Model Provenance Registry

Both reinforcement learning agents are hydrated automatically from the preserved pretrained checkpoint bundle at `src/reinforcement-learning/pretrainedModels.ts` (`747,641` bytes, SHA-256: `2f701d88049f9a0636f38de2e1ff39353e1f9ce3724232e10374ebc0a1c08361`). Neither checkpoint was altered or retrained during release verification.

| Provenance Field | Tabular Q-Learning | Deep Q-Network (DQN) |
| :--- | :--- | :--- |
| **Status** | Pretrained (bundled, preserved untouched) | Pretrained (bundled, preserved untouched) |
| **Checkpoint Identifier** | `raira-qtable-v1` | `raira-dqn-v1` |
| **Checkpoint Timestamp** | `2026-11-20T07:42:44.328Z` | `2026-11-20T07:42:44.329Z` |
| **Training Episodes** | `50` | `25` |
| **Training Workload** | `MIXED` (`10` processes / episode) | `MIXED` (`10` processes / episode) |
| **Training Seeds** | `42 + 17(ep - 1)` for `ep = 1..50` (`42..875`) | `42 + 17(ep - 1)` for `ep = 1..25` (`42..450`) |
| **Reward Configuration** | `BALANCED` (`w_cpu=1.0`, `B_base=10.0`, `B_prio=2.0`, `w_wait=0.05`, `w_turn=0.10`, `w_fair=0.50`, `w_inv=10.0`, `γ=0.95`) | `BALANCED` (identical reward vector, `γ=0.95`) |
| **Hyperparameters** | `α=0.15`, `γ=0.95`, `ε: 1.0 → 0.05` (`decay=0.93`) | `lr=0.001` (Adam), `γ=0.95`, `ε: 1.0 → 0.0543` (`decay=0.89`), `batch=32`, `targetSync=20` |
| **Model Capacity / Updates** | `381` compact states · `1,749` Q-keys · `3,182` TD updates | `262→256→128→97` (`112,737` float32 params) · `955` updates · final Huber loss `1.28128` |
| **Training Reward Summary** | Best `259.313` · Mean `219.858` (ep 1: `223.063`, ep 50: `183.888`) | Best `266.970` · Mean `236.865` (ep 1: `216.596`, ep 25: `233.092`) |
| **Evaluation Seeds (Disjoint)** | `1001..1030` (`30` seeds × `4` workloads = `120` episodes) | `1001..1030` (`30` seeds × `4` workloads = `120` episodes) |
| **Train/Eval Seed Overlap** | `0` (`disjointFromTrainingSeeds = true`) | `0` (`disjointFromTrainingSeeds = true`) |

---

## 2. Experiment Configuration Summary

### Experiment A — 30-Seed Statistical Research Validation (`exports/raira_validation_30seeds.*`)
- **Workloads**: All 4 categories — `CPU_INTENSIVE` (unseen), `MEMORY_INTENSIVE` (unseen), `MIXED` (in-distribution), `DYNAMIC` (unseen).
- **Evaluation Seeds**: `1001..1030` (`30` independent seeds per workload; identical `ProcessSpec[]` fed to every algorithm on each `(workload, seed)` pair).
- **Processes / Episode**: `10` (RR quantum `q = 2`, starvation threshold `15` ticks, max horizon `600` ticks).
- **Policies Evaluated**: 5 primary policies (`FCFS`, `RR`, `PRIORITY`, `Q_LEARNING_TRAINED`, `DQN_TRAINED`) + 2 fresh untrained reference agents (`Q_LEARNING_UNTRAINED`, `DQN_UNTRAINED`, seed `9999`) + 6 ablation variants on `MIXED` (first `15` eval seeds).
- **Total Episodes Executed**: `930` episodes (`22,795 ms` wall time).

### Experiment B — Workload Shock Arena (`exports/raira_shock_arena_results.*`)
- **Base Workload**: `MIXED` (`8` base processes, seed `1005`, RR `q = 2`, starvation threshold `15` ticks).
- **Injection Tick**: `t = 12` (identical shock process specs `S01..Sk` injected into all 5 policies).
- **Shock Scenarios**: All 5 disturbance types (`MEMORY_BURST`, `CPU_SPIKE`, `HIGH_PRIORITY_BURST`, `SIMULTANEOUS_ARRIVALS`, `SEVERE_RAM_PRESSURE`) = `25` controlled shock episodes.

---

## 3. Empirical Results — 30-Seed Statistical Validation (`n = 120` Episodes / Policy)

Source: `exports/raira_validation_30seeds_summary.csv` and `exports/raira_validation_30seeds.json`.

| Policy | Wait Mean ± SD (t) | Wait 95% CI (t) | Wait Med / P95 (t) | Turnaround Mean (t) | CPU / RAM Util (%) | Throughput (p/100t) | Jain Wait / GPS Share | Reward Mean ± SD | Invalid / Starv |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **FCFS** | `53.67 ± 27.38` | `[48.72, 58.61]` | `41.15 / 108.63` | `67.60` | `99.83 / 64.71` | `8.15` | `0.6338 / 0.8008` | **`255.05 ± 35.89`** | `0 / 991` |
| **Round Robin (q=2)** | `75.35 ± 51.52` | `[66.03, 84.66]` | `51.95 / 177.80` | `89.28` | `99.83 / 75.59` | `8.15` | **`0.8470 / 0.9182`** | `233.97 ± 15.47` | `0 / 1108` |
| **Priority** | **`53.19 ± 27.18`** | `[48.28, 58.10]` | `40.80 / 106.80` | **`67.12`** | `99.83 / 64.74` | `8.15` | `0.5726 / 0.7902` | `252.54 ± 36.87` | `0 / 863` |
| **Q-Learning (Trained)** | `73.25 ± 45.79` | `[64.98, 81.53]` | `51.85 / 161.56` | `87.19` | `99.59 / 65.02` | `8.13` | `0.7493 / 0.8358` | `232.49 ± 20.69` | `0 / 1082` |
| **DQN (Trained)** | `56.17 ± 29.28` | `[50.87, 61.46]` | `42.95 / 114.03` | `70.10` | `99.83 / 31.25` | `8.15` | `0.5726 / 0.7889` | `247.97 ± 34.27` | `0 / 877` |
| *Q-Learning (Untrained Ref)* | `71.51 ± 46.55` | `[63.09, 79.92]` | `48.85 / 160.36` | `85.44` | `99.83 / 64.87` | `8.15` | `0.7731 / 0.8549` | `236.17 ± 19.15` | `0 / 1043` |
| *DQN (Untrained Ref)* | `55.02 ± 27.54` | `[50.04, 60.00]` | `44.00 / 109.74` | `68.95` | `99.83 / 30.51` | `8.15` | `0.5800 / 0.7886` | `249.92 ± 36.11` | `0 / 905` |

### Per-Workload Breakdown (`30` Seeds Each) — Mean Waiting Time (`t`) / Mean Episode Reward

| Workload Category | Distribution | FCFS | RR (q=2) | Priority | Q-Learning (Trained) | DQN (Trained) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **CPU-Intensive** | Unseen | `97.11t` / `308.40` | `161.10t` / `234.10` | `96.27t` / `306.59` | `148.00t` / `249.73` | `103.37t` / `298.14` |
| **Memory-Intensive** | Unseen | `33.94t` / `224.22` | `38.76t` / `220.00` | `34.28t` / `220.93` | `39.95t` / `216.25` | `36.96t` / `217.04` |
| **Mixed** | **In-Dist** | `51.46t` / `234.83` | `57.93t` / `237.68` | `49.75t` / `235.33` | `62.03t` / `222.81` | `50.08t` / `234.63` |
| **Dynamic** | Unseen | `32.15t` / `252.76` | `43.60t` / `244.10` | `32.46t` / `247.30` | `43.04t` / `241.17` | `34.26t` / `242.06` |

### Controlled Ablation Study (`MIXED`, Seeds `1001..1015`)

| Variant | Avg Wait ± SD (t) | Jain Fairness | Mean Reward | Δ Reward vs. Full |
| :--- | :---: | :---: | :---: | :---: |
| **Q-Learning Full (Adaptive `q ∈ {1,2,4}`)** | `56.62 ± 9.97` | `0.6979` | `231.79` | `0.00` |
| **Q-Learning Fixed `q = 1`** | `56.36 ± 8.24` | `0.7677` | `235.25` | `+3.46` |
| **Q-Learning Fixed `q = 4`** | `55.85 ± 7.26` | `0.6137` | `228.80` | `-2.99` |
| **Q-Learning Evaluated under `FAIRNESS` Objective** | `58.74 ± 9.80` | `0.6770` | `185.13` | `-46.66` |
| **DQN Full (Adaptive `q ∈ {1,2,4}`)** | `49.65 ± 6.82` | `0.4913` | `233.10` | `0.00` |
| **DQN Fixed `q = 1`** | `50.53 ± 6.54` | `0.4774` | `231.73` | `-1.37` |

---

## 4. Empirical Results — Workload Shock Arena (Seed `1005`, `t = 12`)

Source: `exports/raira_shock_arena_results.csv` (all 25 runs achieved `100%` process completion without truncation).

| Shock Scenario | Metric | FCFS | RR (q=2) | Priority | Q-Learning | DQN |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **MEMORY_BURST** (`+4` procs, `1536 MB`) | Recovery / Peak RAM / Starv | `112t` / `93.8%` / `11` | `91t` / `100%` / `11` | `86t` / `100%` / `10` | `85t` / `90.6%` / `11` | **`73t` / `54.7%` / `9`** |
| **CPU_SPIKE** (`+4` procs, `16t` burst) | Recovery / Peak RAM / Starv | **`89t`** / `98.4%` / `11` | `129t` / `96.9%` / `11` | `128t` / `100%` / `10` | `122t` / `100%` / `12` | `92t` / **`48.4%`** / `10` |
| **HIGH_PRIORITY_BURST** (`+4` P5 procs) | Recovery / Avg Wait / Starv | `89t` / `64.50t` / `11` | `84t` / `64.58t` / `11` | `83t` / **`46.50t`** / `9` | **`62t`** / `56.67t` / `12` | `70t` / `55.83t` / `9` |
| **SIMULTANEOUS_ARRIVALS** (`+6` procs) | Recovery / Avg Wait / Starv | `106t` / `71.00t` / `13` | `110t` / `72.71t` / `13` | `88t` / **`54.79t`** / `11` | **`63t`** / `59.93t` / `13` | `83t` / `63.43t` / `11` |
| **SEVERE_RAM_PRESSURE** (`+3` `2304 MB`) | Recovery / Peak RAM / Starv | `76t` / `93.8%` / `10` | `99t` / `92.2%` / `10` | `56t` / `100%` / `9` | `56t` / `98.4%` / `10` | **`44t` / `73.4%` / `8`** |

**Key Shock Observation**: Because DQN learns a conservative sequential memory-admission policy (`31.25%` mean RAM footprint across 120 episodes vs. `64.7–75.6%` for baselines), it exhibits **lowest peak RAM pressure across all 5 shock types** (`40.6–73.4%`), **fastest recovery on both memory-bound shocks** (`73t` on `MEMORY_BURST`, `44t` on `SEVERE_RAM_PRESSURE`), and **fewest starvation events** under memory stress.

---

## 5. Honest Research Limitations

1. **Modest Pretrained Training Budgets**: The bundled pretrained checkpoints were trained for `50` episodes (Tabular Q-Learning) and `25` episodes (DQN) on `MIXED` workloads only to keep interactive bundle sizes and CPU training times lightweight. As the 30-seed statistical validation candidly demonstrates, these modest budgets are **not sufficient for RL to outperform Priority/FCFS in overall mean waiting time or aggregate reward across unseen workload distributions** (`DQN: 56.17t` vs. `Priority: 53.19t`, `FCFS: 53.67t`; `Q-Learning: 73.25t`). Substantially longer multi-workload curriculum training (`500–2000+` episodes) would be required for converged superiority.
2. **Tabular Q-Learning Tie-Breaking Variance on Unseen States**: When Tabular Q-Learning encounters unseen `(state, action)` keys tied at `Q = 0`, it breaks exact ties using its internal PRNG (`this.rng`), introducing minor (~`0.5%`, `0.38t`) run-to-run variance across sequential evaluations unless the tie-breaking RNG is re-seeded per episode. Deterministic baselines (`FCFS`, `RR`, `PRIORITY`) and continuous `DQN` showed `<= 0.004t` (rounding-only) variance across independent runs.
3. **Single-Core Non-Swapping Idealization**: The simulated OS models a single CPU core (`100%`), zero context-switch overhead, non-swapping contiguous RAM reservation (`4096 MB`), and no I/O blocking or cache locality effects. Results reflect controlled discrete-time scheduling dynamics rather than full Linux kernel CFS behavior.
4. **Known-Arrival Counterfactual Horizon**: As explicitly disclosed in the Counterfactual What-If UI banner, counterfactual branches evaluate identical deterministic future arrivals from the paused snapshot; they represent controlled causal comparisons rather than predictions of stochastic real-world arrivals.
5. **Client-Side Persistence**: Experiment histories, saved reward profiles, and UI theme preferences persist in browser `localStorage` rather than a multi-user remote database.
