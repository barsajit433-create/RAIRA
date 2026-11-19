# RAIRA — Reinforcement Learning-based Adaptive Intelligent Resource Allocator

An interactive full-stack Operating Systems research simulator and Reinforcement Learning workbench demonstrating CPU scheduling and dynamic RAM allocation under changing workloads.

## Simulated Machine Configuration

- **CPU:** Single-core (100% ceiling; at most 1 process running per tick)
- **RAM:** 4096 MB dynamic reservation & release (reserved on admission, retained across preemption, released strictly on completion)
- **Episode Capacity:** Up to 32 concurrent process slots with stable slot indices
- **Time Model:** Discrete-time simulation with SMDP multi-tick RL quanta (`1`, `2`, `4` ticks)

## Scheduling Algorithms Compared

1. **First Come First Serve (FCFS)** — Non-preemptive earliest-arrival scheduling
2. **Round Robin (RR)** — Preemptive cyclic scheduling with configurable quantum
3. **Priority Scheduling** — Non-preemptive priority scheduling (Priority 5 highest, arrival tie-breaker)
4. **Tabular Q-Learning** — Sparse candidate-aware Q-table with 9-feature compact state discretisation, valid-action masking, and SMDP `γ^τ` updates
5. **Deep Q-Network (DQN)** — Real TensorFlow.js (`@tensorflow/tfjs`) neural network (`262 → 256 ReLU → 128 ReLU → 97 Q-values`) with online/target networks, experience replay storing next-state masks & elapsed ticks, Adam optimizer, Huber loss, and gradient clipping

## Workload Scenarios

All workloads use a deterministic Mulberry32 seeded PRNG (identical seeds generate identical process lists):

- **CPU-Intensive:** Long bursts (12–34 ticks), modest RAM (128–640 MB)
- **Memory-Intensive:** Large RAM demands (768–2048 MB), moderate bursts (4–14 ticks)
- **Mixed:** Heterogeneous compute-heavy, memory-heavy, and short interactive jobs
- **Dynamic:** Multi-wave staggered arrivals with shifting resource profiles and priorities

## Architecture

- **Frontend (`src/`):** React 19, TypeScript, Tailwind CSS, Recharts, Lucide React
- **Backend (`server.ts`, `server/`):** Node.js, Express REST API (`/api/*`), Vite middleware
- **Simulation & RL (`src/simulation/`, `src/reinforcement-learning/`):** Pure TypeScript modules decoupled from UI components
- **Persistence & Export (`src/services/`):** Browser `localStorage` for experiment history/settings/checkpoints, plus CSV & JSON export

## Installation & Execution

```bash
# Install dependencies
npm install

# Run unit tests (simulation invariants, baselines, Q-Learning, TensorFlow.js DQN)
npx --yes tsx --test src/simulation/simulation.test.ts

# Start development server (Express API + Vite frontend on port 3000)
npm run dev

# Build for production
npm run build
```

Open `http://localhost:3000` in your browser.
