# RAIRA 2.0 — Algorithm & Research Methodology

## 1. Discrete-Time OS Kernel & Resource Model

At each discrete tick `t ∈ {0, 1, ..., 599}`:
1. **Process Arrivals**: Any process with `arrivalTime == t` transitions from `NEW` to `BLOCKED` (awaiting RAM admission).
2. **Memory Admission**:
   - Deterministic baselines admit eligible `BLOCKED` processes whose `memoryDemand <= availableRamMb` according to policy ordering (`FCFS` arrival order, `RR` queue order, `PRIORITY` descending priority).
   - RL policies admit a `BLOCKED` process implicitly when selecting action `(slot, q)` for that slot, provided `memoryDemand <= availableRamMb` (enforced via the feasibility action mask).
3. **CPU Execution**: At most one `READY` process transitions to `RUNNING` on the single CPU core, decrementing `remainingCpuTime` by `1` per tick. All other arrived non-completed processes (`READY` and `BLOCKED`) accumulate `+1` tick of `waitingTime`.
4. **Completion vs. Preemption**:
   - If `remainingCpuTime == 0`, the process transitions to `COMPLETED`, records `completionTime = t + 1` and `turnaroundTime = completionTime - arrivalTime`, and **immediately releases** its `allocatedMemory` back to `availableRamMb`.
   - If preempted (quantum expiry or higher-priority arrival), the process returns to `READY` and **retains** its `allocatedMemory` (modeling realistic non-swapping main memory residency).

---

## 2. Classical Baseline Schedulers (`CpuScheduler.ts`)

1. **First Come First Serve (FCFS)**: Non-preemptive. Admits and dispatches processes strictly in ascending `(arrivalTime, slotIndex)` order until completion.
2. **Round Robin (RR)**: Preemptive with fixed time quantum `q_RR` (default `q = 2` ticks). Maintains a FIFO ready queue; upon quantum expiry, the running process is re-enqueued at the tail while retaining allocated RAM.
3. **Priority Scheduling**: Priority-ordered (`5` highest to `1` lowest, tie-broken by earlier `arrivalTime` then lower `slotIndex`). Admits and dispatches the highest-priority feasible process.

---

## 3. Semi-Markov Decision Process (SMDP) Formulation

Because RL policies select both **which process slot** to execute and **how many ticks** (`q ∈ {1, 2, 4}`) to run it, RAIRA formulates scheduling as a discrete-time **Semi-MDP**:

### 3.1 Observation Space (`StateEncoder.ts`, `dim = 262`)
Every state `s_t ∈ [0, 1]^{262}` concatenates:
- **6 Global Features**: normalized current tick (`t / 600`), available RAM ratio (`availableRam / 4096`), used RAM ratio, active process ratio, RAM-blocked ratio, and previous-tick CPU busy indicator (`0` or `1`).
- **32 × 8 Per-Slot Features** (`slot = 0..31`): slot active flag, `READY`/`RUNNING` flag, `BLOCKED` flag, normalized remaining CPU (`remaining / 40`), normalized priority (`priority / 5`), normalized waiting time (`wait / 120`), normalized memory demand (`memDemand / 4096`), and RAM-fit feasibility indicator (`1` if already resident or `memDemand <= availableRam`, else `0`).

### 3.2 Masked Action Space (`ActionSpace.ts`, `|A| = 97`)
- `a = 0`: `WAIT` (advance `1` tick idle; masked out whenever feasible process work exists in greedy evaluation to prevent idle deadlock, allowed when no process can run).
- `a = 1 + 3·slot + qIdx` (`slot ∈ [0..31]`, `qIdx ∈ {0, 1, 2}` mapping to `q ∈ {1, 2, 4}`): execute process in `slot` for up to `q` ticks (early-stopping on completion, yielding actual elapsed ticks `τ ∈ [1..q]`).
- **Feasibility Mask `M(s) ∈ {0, 1}^{97}`**: Action `a > 0` is valid iff `slot` has arrived, is not `COMPLETED`, and either already holds RAM (`READY`) or fits in `availableRamMb` (`BLOCKED` with `memoryDemand <= availableRamMb`). Invalid actions receive `-∞` logit masking and are never executed.

### 3.3 Multi-Objective SMDP Reward Function (`RewardCalculator.ts`)
For each tick `k ∈ {0, ..., τ - 1}` inside an SMDP step of duration `τ`:

$$r_k = w_{\text{cpu}} \cdot \mathbb{I}[\text{CPU busy}] + \mathbb{I}[\text{completed}] \cdot (B_{\text{base}} + B_{\text{prio}} \cdot \text{priority}) - w_{\text{wait}} \cdot N_{\text{waiting}} - \mathbb{I}[\text{completed}] \cdot w_{\text{turn}} \cdot T_{\text{turnaround}} + w_{\text{fair}} \cdot J_{\text{wait}}(t+k) - w_{\text{inv}} \cdot \mathbb{I}[\text{invalid}]$$

Ticks within a multi-tick SMDP step are geometrically discounted by `γ^k` (`γ = 0.95`):

$$R_\tau = \sum_{k=0}^{\tau - 1} \gamma^k r_k$$

Default **Balanced (Pretrained Baseline)** weights:
`w_cpu = 1.0`, `B_base = 10.0`, `B_prio = 2.0`, `w_wait = 0.05`, `w_turn = 0.10`, `w_fair = 0.50`, `w_inv = 10.0`, `γ = 0.95`.

---

## 4. Reinforcement Learning Agents

### 4.1 Candidate-Aware Tabular Q-Learning (`QLearningAgent.ts`)
A naive tabular encoding over `32` slots suffers severe combinatorial state explosion. RAIRA implements **candidate-aware state-action bucketing**:
- **Compact System Key** (`encodeCompactStateKey`): Discretizes global RAM pressure band, ready/blocked queue counts, and previous CPU busy state.
- **Candidate Feature Suffix** (`encodeCandidateStateActionKey`): Encodes the selected process's discretized priority, remaining-CPU bucket, waiting-time bucket, RAM-residency status, and chosen quantum `q ∈ {1, 2, 4}`.
- **SMDP Bellman Update**:

$$Q(s, a) \leftarrow Q(s, a) + \alpha \left[ R_\tau + (1 - \mathbb{I}[\text{terminated}]) \cdot \gamma^\tau \max_{a' \in \mathcal{A}_{\text{valid}}(s')} Q(s', a') - Q(s, a) \right]$$

Note the rigorous bootstrapping rule: genuinely `terminated` episodes set bootstrap to `0`, whereas time-limit `truncated` episodes (`t = 600`) preserve bootstrapping because the underlying OS queue did not naturally empty.

### 4.2 Deep Q-Network (`DQNAgent.ts`, TensorFlow.js `4.22.0`)
- **Network Architecture**: Multilayer perceptron `Input(262) → Dense(256, ReLU) → Dense(128, ReLU) → Dense(97, Linear)`, totaling **`112,737` trainable parameters**.
- **Training Mechanics**:
  - Experience Replay Buffer (`ReplayBuffer.ts`) storing SMDP tuples `(s, a, R_τ, s', M(s'), τ, terminated, truncated)`.
  - Dedicated **Target Network** synchronized every `targetUpdateFreq = 20` gradient steps.
  - **Huber Loss** with Adam optimizer (`lr = 0.001`), mini-batch size `32`, and masked target maximization over `M(s')` discounted by `γ^τ`.
  - **Explainability via Perturbation Sensitivity**: Evaluates exact online network forward passes on controlled feature perturbations of `s_t` (`+50%` wait time, `-50%` remaining CPU, `+2` priority, `-50%` available RAM, `+50%` memory demand) to quantify `ΔQ` and action-flip sensitivity.

---

## 5. Fairness, Shock Resilience & Statistical Validation Methodology

### 5.1 Generalized Processor Sharing (GPS) Service-Share Fairness (`FairnessMonitor.ts`)
Wait-based Jain fairness alone treats short late-arriving jobs identically to long early-arriving jobs. For each arrived process `i` active over residency window `[arrival_i, end_i)`, RAIRA computes its ideal **GPS expected CPU service share**:

$$E_i = \sum_{\tau = \text{arrival}_i}^{\text{end}_i - 1} \frac{1}{|\text{Active}(\tau)|}$$

Service attainment ratio is computed as $x_i = (\text{ServiceReceived}_i + 0.5) / (E_i + 0.5)$, and the **Service-Share Jain Index** is:

$$J_{\text{share}} = \frac{\left(\sum_{i=1}^{n} x_i\right)^2}{n \sum_{i=1}^{n} x_i^2} \in \left[\frac{1}{n}, 1\right]$$

### 5.2 Multi-Seed Statistical Validation (`StatisticalValidation.ts`)
- **Strict Train/Test Seed Separation**: Bundled pretrained models were trained on `MIXED` workloads using seeds `seed(ep) = 42 + 17(ep - 1)` (`42..875` for 50 episodes). Evaluation uses disjoint seeds `1001..1030` (`isDisjointFromTrainingSeeds === true`).
- **Distribution Metrics**: Sample Mean ($\bar{x}$), Bessel-corrected Sample Standard Deviation ($s$, denominator $n - 1$), linear-interpolated Median (`P50`) and 95th Percentile (`P95`), and two-sided **95% Student-*t* Confidence Intervals**:

$$\text{CI}_{95\%} = \bar{x} \pm t_{0.975,\, n-1} \cdot \frac{s}{\sqrt{n}}$$
