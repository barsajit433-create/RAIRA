import React from 'react';

export const ProjectInformation: React.FC = () => {
  return (
    <div className="space-y-6 max-w-5xl">
      {/* Title Card */}
      <section className="rounded-xl border border-slate-800/80 bg-[#0B1221] p-6 space-y-2">
        <div className="text-xs font-mono text-cyan-400">
          Third-Semester Operating Systems Research Mini-Project
        </div>
        <h2 className="font-display text-2xl font-bold text-slate-100">
          Intelligent Resource Allocation Using Reinforcement Learning
        </h2>
        <p className="text-sm text-slate-300 leading-relaxed">
          RAIRA (Reinforcement Learning-based Adaptive Intelligent Resource Allocator) is an
          interactive, discrete-time operating system simulator and reinforcement learning research
          workbench comparing classical schedulers (FCFS, Round Robin, Priority) against SMDP
          Tabular Q-Learning and a TensorFlow.js Deep Q-Network (DQN) under strict single-core CPU
          and 4096 MB dynamic RAM constraints.
        </p>
      </section>

      {/* 1 & 2: Project Overview + Problem Statement */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="rounded-xl border border-slate-800/80 bg-[#0B1221] p-5 space-y-2.5">
          <h3 className="font-display text-base font-semibold text-slate-100">
            01. Project Overview
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            Modern operating systems must jointly arbitrate CPU execution slices and dynamic memory
            admissions across heterogeneous, time-varying process workloads. RAIRA models a
            deterministic single-core machine with 100% CPU ceiling, 4096 MB RAM, and up to 32
            concurrent process slots, exposing both classical OS scheduling baselines and real
            Reinforcement Learning agents within a reproducible experimental environment.
          </p>
        </section>

        <section className="rounded-xl border border-slate-800/80 bg-[#0B1221] p-5 space-y-2.5">
          <h3 className="font-display text-base font-semibold text-slate-100">
            02. Problem Statement
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            Static scheduling heuristics optimize a single narrow rule—arrival order (FCFS), fixed
            time-slicing (Round Robin), or static priority—without jointly accounting for RAM
            fragmentation, memory-blocked queues, burst length heterogeneity, or multi-objective
            fairness. When memory pressure spikes or workloads shift dynamically, static policies
            suffer from convoy effects, excessive waiting times, or starvation.
          </p>
        </section>
      </div>

      {/* 3 & 4: Existing System + Proposed System */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="rounded-xl border border-slate-800/80 bg-[#0B1221] p-5 space-y-2.5">
          <h3 className="font-display text-base font-semibold text-slate-100">
            03. Existing System
          </h3>
          <ul className="text-xs text-slate-300 space-y-2 list-disc pl-4 leading-relaxed">
            <li>
              <strong className="text-slate-100">First Come First Serve (FCFS):</strong> Non-preemptive
              arrival-ordered dispatch; vulnerable to the convoy effect when long CPU-bound jobs
              block short interactive processes.
            </li>
            <li>
              <strong className="text-slate-100">Round Robin (RR):</strong> Preemptive cyclic
              time-slicing using a fixed quantum; improves responsiveness but increases context
              switching and ignores memory-release order.
            </li>
            <li>
              <strong className="text-slate-100">Priority Scheduling:</strong> Non-preemptive
              highest-priority dispatch (Priority 5 highest); risks low-priority starvation under
              sustained high-priority arrivals.
            </li>
          </ul>
        </section>

        <section className="rounded-xl border border-slate-800/80 bg-[#0B1221] p-5 space-y-2.5">
          <h3 className="font-display text-base font-semibold text-slate-100">
            04. Proposed System (RAIRA)
          </h3>
          <ul className="text-xs text-slate-300 space-y-2 list-disc pl-4 leading-relaxed">
            <li>
              Formulates joint RAM admission, process selection, and CPU quantum sizing (1, 2, or 4
              ticks) as a Semi-Markov Decision Process (SMDP) over a Discrete(97) masked action
              space.
            </li>
            <li>
              Provides a candidate-aware Tabular Q-Learning agent and a TensorFlow.js Deep Q-Network
              (262 → 256 → 128 → 97) trained via Huber loss, gradient clipping, and experience
              replay.
            </li>
            <li>
              Enforces hard hardware invariants via action masking so invalid actions can never
              over-allocate RAM (&gt; 4096 MB) or violate single-core CPU exclusivity.
            </li>
          </ul>
        </section>
      </div>

      {/* 5 & 6: Research Objectives + Research Gaps (Explicitly Marked as Hypotheses) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="rounded-xl border border-slate-800/80 bg-[#0B1221] p-5 space-y-2.5">
          <h3 className="font-display text-base font-semibold text-slate-100">
            05. Research Objectives
          </h3>
          <ol className="text-xs text-slate-300 space-y-1.5 list-decimal pl-4 leading-relaxed">
            <li>Build a verifiable discrete-time OS simulator with strict CPU &amp; RAM invariants.</li>
            <li>Implement reproducible multi-scenario workloads via seeded PRNG generation.</li>
            <li>Design an inspectable multi-objective reward balancing utilisation, latency, priority, and Jain fairness.</li>
            <li>Train and benchmark Tabular Q-Learning and DQN against FCFS, RR, and Priority under identical seeds.</li>
            <li>Provide transparent provenance labeling and CSV/JSON data export for empirical analysis.</li>
          </ol>
        </section>

        <section className="rounded-xl border border-amber-500/30 bg-[#0B1221] p-5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-base font-semibold text-slate-100">
              06. Research Gaps
            </h3>
            <span className="text-[11px] font-mono text-amber-400">
              Hypotheses Requiring Literature Validation
            </span>
          </div>
          <p className="text-[11px] text-amber-300/90 leading-relaxed">
            Note: The statements below are proposed research hypotheses scoped for this student
            mini-project and require formal systematic literature review for publication-grade
            validation.
          </p>
          <ul className="text-xs text-slate-300 space-y-1.5 list-disc pl-4 leading-relaxed">
            <li>
              <em>Hypothesis H1:</em> Jointly coupling dynamic RAM admission with variable CPU
              quantum selection may reduce memory-blocking latency compared to decoupled schedulers.
            </li>
            <li>
              <em>Hypothesis H2:</em> SMDP geometric discounting (γ^τ) over multi-tick quanta may
              stabilize value estimates relative to naive single-step discounting.
            </li>
            <li>
              <em>Hypothesis H3:</em> Candidate-aware compact Q-tables may converge faster on small
              episodes while deep neural Q-approximators may scale better to richer 262-feature
              observations.
            </li>
          </ul>
        </section>
      </div>

      {/* 07. Visual System Architecture Diagram */}
      <section className="rounded-xl border border-slate-800/80 bg-[#0B1221] p-5 space-y-4">
        <div>
          <h3 className="font-display text-base font-semibold text-slate-100">
            07. System Architecture
          </h3>
          <p className="text-xs text-slate-400">
            Decoupled discrete-time OS kernel, SMDP RL environment, Express REST API, and React
            analytics dashboard
          </p>
        </div>

        <div className="overflow-x-auto">
          <svg
            viewBox="0 0 920 330"
            className="w-full min-w-[680px] h-auto"
            role="img"
            aria-label="RAIRA System Architecture Diagram"
          >
            <defs>
              <marker
                id="arrow"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#38BDF8" />
              </marker>
            </defs>

            {/* Frontend Layer */}
            <rect x="20" y="20" width="230" height="290" rx="10" fill="#081020" stroke="#1E293B" strokeWidth="1.5" />
            <text x="36" y="46" fill="#38BDF8" fontSize="12" fontWeight="700">Frontend Layer (React + TS)</text>
            <rect x="36" y="64" width="198" height="44" rx="6" fill="#0F1B33" stroke="#334155" />
            <text x="48" y="84" fill="#E2E8F0" fontSize="11" fontWeight="600">Overview &amp; Live Simulation</text>
            <text x="48" y="99" fill="#94A3B8" fontSize="10">Gauges, Queues, Recharts</text>

            <rect x="36" y="120" width="198" height="44" rx="6" fill="#0F1B33" stroke="#334155" />
            <text x="48" y="140" fill="#E2E8F0" fontSize="11" fontWeight="600">Process Manager &amp; Generator</text>
            <text x="48" y="155" fill="#94A3B8" fontSize="10">Manual CRUD + 4 Seeded Scenarios</text>

            <rect x="36" y="176" width="198" height="44" rx="6" fill="#0F1B33" stroke="#334155" />
            <text x="48" y="196" fill="#E2E8F0" fontSize="11" fontWeight="600">RL Centre &amp; Comparison</text>
            <text x="48" y="211" fill="#94A3B8" fontSize="10">Training Curves + 5-Way Benchmark</text>

            <rect x="36" y="232" width="198" height="60" rx="6" fill="#0F1B33" stroke="#334155" />
            <text x="48" y="252" fill="#E2E8F0" fontSize="11" fontWeight="600">Browser Persistence &amp; Export</text>
            <text x="48" y="268" fill="#94A3B8" fontSize="10">localStorage History &amp; Models</text>
            <text x="48" y="282" fill="#10B981" fontSize="10">CSV / JSON Research Export</text>

            {/* Backend REST API Layer */}
            <rect x="295" y="20" width="265" height="290" rx="10" fill="#081020" stroke="#1E293B" strokeWidth="1.5" />
            <text x="311" y="46" fill="#38BDF8" fontSize="12" fontWeight="700">Node.js Backend + OS Kernel</text>

            <rect x="311" y="64" width="233" height="48" rx="6" fill="#0F1B33" stroke="#06B6D4" strokeOpacity="0.45" />
            <text x="323" y="84" fill="#E2E8F0" fontSize="11" fontWeight="600">Express REST API (/api/*)</text>
            <text x="323" y="100" fill="#94A3B8" fontSize="10">Polling, Control, Benchmark &amp; Checkpoints</text>

            <rect x="311" y="128" width="233" height="72" rx="6" fill="#0F1B33" stroke="#334155" />
            <text x="323" y="148" fill="#E2E8F0" fontSize="11" fontWeight="600">Discrete-Time SimulationEngine</text>
            <text x="323" y="164" fill="#94A3B8" fontSize="10">1-Core CPU (100%) · 4096 MB RAM</text>
            <text x="323" y="179" fill="#94A3B8" fontSize="10">ResourceManager (Reserve / Release)</text>
            <text x="323" y="193" fill="#10B981" fontSize="10">MetricsCalculator + Jain Fairness</text>

            <rect x="311" y="216" width="233" height="76" rx="6" fill="#0F1B33" stroke="#334155" />
            <text x="323" y="236" fill="#E2E8F0" fontSize="11" fontWeight="600">Baseline Schedulers</text>
            <text x="323" y="252" fill="#94A3B8" fontSize="10">FCFS (Non-Preemptive)</text>
            <text x="323" y="267" fill="#94A3B8" fontSize="10">Round Robin (Configurable Quantum)</text>
            <text x="323" y="282" fill="#94A3B8" fontSize="10">Priority (5 Highest, Arrival Tie-Break)</text>

            {/* Reinforcement Learning Engine */}
            <rect x="605" y="20" width="295" height="290" rx="10" fill="#081020" stroke="#1E293B" strokeWidth="1.5" />
            <text x="621" y="46" fill="#10B981" fontSize="12" fontWeight="700">SMDP Reinforcement Learning</text>

            <rect x="621" y="64" width="263" height="58" rx="6" fill="#0F1B33" stroke="#334155" />
            <text x="633" y="83" fill="#E2E8F0" fontSize="11" fontWeight="600">StateEncoder &amp; ActionSpace</text>
            <text x="633" y="99" fill="#94A3B8" fontSize="10">262 Float32 Obs · Discrete(97) Masked</text>
            <text x="633" y="113" fill="#94A3B8" fontSize="10">RewardCalculator: R_tau = Σ γ^k · r_k</text>

            <rect x="621" y="136" width="263" height="68" rx="6" fill="#0F1B33" stroke="#06B6D4" strokeOpacity="0.45" />
            <text x="633" y="156" fill="#E2E8F0" fontSize="11" fontWeight="600">Tabular Q-Learning Agent</text>
            <text x="633" y="172" fill="#94A3B8" fontSize="10">9-Dim Compact State + Candidate Key</text>
            <text x="633" y="187" fill="#94A3B8" fontSize="10">Sparse Q-Table · ε-Greedy · SMDP TD</text>

            <rect x="621" y="218" width="263" height="74" rx="6" fill="#0F1B33" stroke="#10B981" strokeOpacity="0.45" />
            <text x="633" y="238" fill="#E2E8F0" fontSize="11" fontWeight="600">Deep Q-Network (TensorFlow.js)</text>
            <text x="633" y="254" fill="#94A3B8" fontSize="10">262 → 256 ReLU → 128 ReLU → 97 Q</text>
            <text x="633" y="269" fill="#94A3B8" fontSize="10">ReplayBuffer + Target Net + Huber Loss</text>
            <text x="633" y="283" fill="#10B981" fontSize="10">Adam Optimizer + Gradient Clipping</text>

            {/* Arrows */}
            <line x1="250" y1="88" x2="293" y2="88" stroke="#38BDF8" strokeWidth="1.5" markerEnd="url(#arrow)" />
            <line x1="295" y1="104" x2="252" y2="104" stroke="#38BDF8" strokeWidth="1.5" markerEnd="url(#arrow)" />
            <line x1="560" y1="158" x2="603" y2="158" stroke="#38BDF8" strokeWidth="1.5" markerEnd="url(#arrow)" />
            <line x1="605" y1="176" x2="562" y2="176" stroke="#38BDF8" strokeWidth="1.5" markerEnd="url(#arrow)" />
          </svg>
        </div>
      </section>

      {/* 08 & 09: Q-Learning & DQN Methodologies */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="rounded-xl border border-slate-800/80 bg-[#0B1221] p-5 space-y-2.5">
          <h3 className="font-display text-base font-semibold text-slate-100">
            08. Q-Learning Methodology
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            The tabular agent encodes the system state into 9 compact features (RAM tier, ready &amp;
            blocked queue tiers, CPU busy flag, max waiting tier, highest ready priority, shortest
            burst tier, admissible-blocked indicator, and upcoming arrival tier) paired with a
            candidate-aware action descriptor so different process slots are never indistinguishable.
          </p>
          <div className="rounded-lg border border-slate-800 bg-[#080F1D] p-3 font-mono text-[11px] text-cyan-300 overflow-x-auto">
            Q(s, a) ← Q(s, a) + α [ R_τ + (1 − term) · γ^τ · max_(a&apos; valid) Q(s&apos;, a&apos;) − Q(s, a) ]
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Bootstrapping rule: genuinely terminal episodes (all processes completed) set the future
            bootstrap term to 0; time-limit truncations retain bootstrapping because the underlying
            process stream has not terminated.
          </p>
        </section>

        <section className="rounded-xl border border-slate-800/80 bg-[#0B1221] p-5 space-y-2.5">
          <h3 className="font-display text-base font-semibold text-slate-100">
            09. Deep Q-Network (DQN) Methodology
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            Implemented in TensorFlow.js using an online and target multi-layer perceptron mapping
            the 262-dimensional normalized observation vector (6 global features + 32 slots × 8
            features, clamped to [0, 1]) to 97 Q-values corresponding to WAIT (action 0) and 32
            process slots × 3 CPU quanta (1, 2, 4 ticks).
          </p>
          <div className="rounded-lg border border-slate-800 bg-[#080F1D] p-3 font-mono text-[11px] text-emerald-300 overflow-x-auto">
            Target = R_τ + (1 − term) · γ^τ · max_(a&apos; ∈ mask(s&apos;)) Q_target(s&apos;, a&apos;)
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Trained with Adam, Huber loss (δ=1.0), global L2 gradient clipping (1.0), experience
            replay storing next-state masks and actual elapsed ticks τ, and periodic target syncing.
          </p>
        </section>
      </div>

      {/* 10 & 11: Performance Metrics + Future Scope */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="rounded-xl border border-slate-800/80 bg-[#0B1221] p-5 space-y-2.5">
          <h3 className="font-display text-base font-semibold text-slate-100">
            10. Performance Metrics
          </h3>
          <ul className="text-xs text-slate-300 space-y-1.5 list-disc pl-4 leading-relaxed">
            <li><strong className="text-slate-100">CPU &amp; RAM Utilisation (%):</strong> Fraction of busy CPU ticks and average reserved RAM across the episode.</li>
            <li><strong className="text-slate-100">Waiting, Turnaround &amp; Response Time:</strong> Measured in discrete ticks directly from process state transitions.</li>
            <li><strong className="text-slate-100">Throughput:</strong> Completed processes per 100 simulation ticks.</li>
            <li>
              <strong className="text-slate-100">Jain&apos;s Fairness Index:</strong> Computed over smoothed
              waiting-to-burst ratios <code className="font-mono text-cyan-300">x_i = (w_i + ε)/(b_i + ε)</code>{' '}
              with documented smoothing constant <code className="font-mono text-cyan-300">ε = 1.0</code>.
            </li>
            <li><strong className="text-slate-100">Multi-Objective Episode Reward:</strong> Inspectable sum of CPU, completion, priority, fairness, waiting, turnaround, and invalid terms.</li>
          </ul>
        </section>

        <section className="rounded-xl border border-slate-800/80 bg-[#0B1221] p-5 space-y-2.5">
          <h3 className="font-display text-base font-semibold text-slate-100">
            11. Future Scope
          </h3>
          <ul className="text-xs text-slate-300 space-y-1.5 list-disc pl-4 leading-relaxed">
            <li>Extend the simulator to symmetric multi-core CPUs with core affinity and migration penalties.</li>
            <li>Model virtual memory paging, swap latency, and I/O-bound blocking states.</li>
            <li>Evaluate Double DQN, Dueling DQN, and Proximal Policy Optimization (PPO) on larger process queues.</li>
            <li>Import real Linux kernel trace datasets (e.g. eBPF / sched_switch traces) for trace-driven replay benchmarks.</li>
          </ul>
        </section>
      </div>
    </div>
  );
};
