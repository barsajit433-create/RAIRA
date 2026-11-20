import React from 'react';
import {
  ArrowRight,
  Compass,
  Cpu,
  HardDrive,
} from 'lucide-react';

interface WelcomeScreenProps {
  onLaunchGuest: () => void;
  onExploreTour: () => void;
  savedExperimentCount: number;
  isReturningUser: boolean;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onLaunchGuest,
  onExploreTour,
  savedExperimentCount,
  isReturningUser,
}) => {
  return (
    <div
      data-testid="welcome-screen"
      className="relative min-h-screen w-full overflow-x-hidden bg-[#060B14] text-[#F1F5F9] flex flex-col justify-between selection:bg-[#06B6D4]/25 selection:text-[#F8FAFC]"
    >
      {/* Subtle animated atmospheric background (compositor-only, reduced-motion safe) */}
      <div
        className="pointer-events-none fixed inset-0 overflow-hidden"
        aria-hidden="true"
      >
        <div className="raira-welcome-grid absolute inset-0 opacity-40" />
        <div
          className="raira-welcome-orb-a absolute -top-32 -left-24 h-[460px] w-[460px] rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(6, 182, 212, 0.16) 0%, rgba(6, 182, 212, 0.04) 48%, transparent 72%)',
          }}
        />
        <div
          className="raira-welcome-orb-b absolute top-1/3 -right-28 h-[520px] w-[520px] rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(16, 185, 129, 0.14) 0%, rgba(6, 182, 212, 0.05) 45%, transparent 72%)',
          }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-56"
          style={{
            background: 'linear-gradient(to top, #060B14 15%, transparent 100%)',
          }}
        />
      </div>

      {/* Top Brand Header */}
      <header className="relative z-10 w-full max-w-6xl mx-auto px-5 sm:px-8 pt-6 sm:pt-8">
        <div className="flex items-center justify-between gap-4 pb-5 border-b border-[#1E293B]/80">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#06B6D4]/35 bg-[#06B6D4]/12 text-[#22D3EE]">
              <Cpu className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="font-display text-lg font-bold tracking-tight text-[#F8FAFC] leading-none">
                RAIRA
              </div>
              <div className="hidden sm:block mt-1 text-[11px] font-mono text-[#94A3B8] truncate">
                Operating Systems &amp; Reinforcement Learning Lab
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-[#94A3B8] whitespace-nowrap">
              Guest Access · No Sign-In
            </span>
          </div>
        </div>
      </header>

      {/* Main Hero & Primary Actions */}
      <main className="relative z-10 flex-1 flex flex-col justify-center w-full max-w-6xl mx-auto px-5 sm:px-8 py-10 sm:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
          {/* Left Column: Identity, Headline, Description & Primary Actions */}
          <div className="lg:col-span-7 space-y-6">
            <div className="space-y-3">
              <p className="text-xs font-mono uppercase tracking-[0.16em] text-[#22D3EE]">
                Reinforcement Learning-based Adaptive Intelligent Resource Allocator
              </p>

              <h1
                className="font-display font-bold tracking-tight text-[#F8FAFC] leading-[1.08]"
                style={{ fontSize: 'clamp(2.25rem, 4.2vw, 3.6rem)' }}
              >
                Intelligence in Every{' '}
                <span className="text-[#22D3EE]">Resource</span>{' '}
                <span className="text-[#34D399]">Decision.</span>
              </h1>

              <p className="text-base sm:text-[17px] text-[#CBD5E1] leading-relaxed max-w-2xl pt-1">
                Explore intelligent CPU scheduling, dynamic memory allocation and reinforcement
                learning through interactive operating-system simulations.
              </p>
            </div>

            {/* Two Primary Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 max-w-2xl">
              {/* Action A: LAUNCH RAIRA */}
              <button
                type="button"
                data-testid="welcome-launch-btn"
                onClick={onLaunchGuest}
                className="group text-left rounded-xl border border-[#22D3EE]/50 bg-[#06B6D4] hover:bg-[#22D3EE] text-[#04121C] px-5 py-4 transition-colors duration-150 cursor-pointer flex items-center justify-between gap-4 shadow-[0_12px_32px_-12px_rgba(6,182,212,0.45)]"
              >
                <div className="min-w-0">
                  <div className="font-display text-sm sm:text-base font-bold tracking-wide uppercase whitespace-nowrap">
                    LAUNCH RAIRA
                  </div>
                  <div className="mt-0.5 text-xs font-medium text-[#042436]">
                    Continue as Guest.
                  </div>
                </div>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#04121C]/12 transition-transform duration-150 group-hover:translate-x-0.5">
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </span>
              </button>

              {/* Action B: EXPLORE RAIRA */}
              <button
                type="button"
                data-testid="welcome-explore-btn"
                onClick={onExploreTour}
                className="group text-left rounded-xl border border-[#10B981]/45 bg-[#0B1424]/90 hover:bg-[#0F1C30] hover:border-[#34D399]/70 text-[#F8FAFC] px-5 py-4 transition-colors duration-150 cursor-pointer flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="font-display text-sm sm:text-base font-bold tracking-wide uppercase text-[#34D399] whitespace-nowrap">
                    EXPLORE RAIRA
                  </div>
                  <div className="mt-0.5 text-xs font-medium text-[#CBD5E1]">
                    Discover the platform.
                  </div>
                </div>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#10B981]/30 bg-[#10B981]/12 text-[#34D399] transition-transform duration-150 group-hover:translate-x-0.5">
                  <Compass className="h-4 w-4" aria-hidden="true" />
                </span>
              </button>
            </div>

            {/* Returning user preservation note */}
            {isReturningUser && savedExperimentCount > 0 && (
              <p className="text-xs font-mono text-[#94A3B8] pt-1">
                {savedExperimentCount} locally saved{' '}
                {savedExperimentCount === 1 ? 'experiment record' : 'experiment records'} ready in
                this browser.
              </p>
            )}
          </div>

          {/* Right Column: Clean Technical Architecture Specification */}
          <aside
            aria-label="Platform Capabilities"
            className="lg:col-span-5 rounded-xl border border-[#1E293B] bg-[#091121]/85 backdrop-blur-sm divide-y divide-[#1E293B]"
          >
            <div className="p-5 flex items-start gap-4">
              <span className="font-mono text-xs font-semibold text-[#22D3EE] tabular-nums pt-0.5">
                01
              </span>
              <div className="min-w-0 space-y-1">
                <h2 className="font-display text-sm font-semibold text-[#F8FAFC]">
                  Discrete-Time OS Simulator
                </h2>
                <p className="text-xs text-[#94A3B8] leading-relaxed">
                  Single-core 100% CPU, 4096 MB dynamic RAM allocation and release, up to 32
                  concurrent processes with synchronized Gantt and memory timelines.
                </p>
              </div>
            </div>

            <div className="p-5 flex items-start gap-4">
              <span className="font-mono text-xs font-semibold text-[#34D399] tabular-nums pt-0.5">
                02
              </span>
              <div className="min-w-0 space-y-1">
                <h2 className="font-display text-sm font-semibold text-[#F8FAFC]">
                  5 Scheduling Policies &amp; Pretrained RL Agents
                </h2>
                <p className="text-xs text-[#94A3B8] leading-relaxed">
                  Benchmark FCFS, Round Robin, and Priority Scheduling against pretrained Tabular
                  Q-Learning and TensorFlow.js DQN agents selecting process and CPU quantum.
                </p>
              </div>
            </div>

            <div className="p-5 flex items-start gap-4">
              <span className="font-mono text-xs font-semibold text-[#60A5FA] tabular-nums pt-0.5">
                03
              </span>
              <div className="min-w-0 space-y-1">
                <h2 className="font-display text-sm font-semibold text-[#F8FAFC]">
                  Explainable AI &amp; Research Laboratories
                </h2>
                <p className="text-xs text-[#94A3B8] leading-relaxed">
                  Inspect ground-truth Q-values, run isolated counterfactual what-if branches,
                  inject workload shocks, monitor starvation fairness, and validate across 30 seeds.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* Quiet Local-First Footer */}
      <footer className="relative z-10 w-full max-w-6xl mx-auto px-5 sm:px-8 pb-6 sm:pb-8">
        <div className="pt-5 border-t border-[#1E293B]/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-[#94A3B8]">
          <div className="flex items-center gap-2">
            <HardDrive className="h-3.5 w-3.5 text-[#34D399] shrink-0" aria-hidden="true" />
            <span>
              Guest-first workspace — experiments, models, and theme settings stay stored locally in
              this browser.
            </span>
          </div>
          <div className="font-mono text-[11px] text-[#64748B] tabular-nums whitespace-nowrap">
            1 Core CPU · 4096 MB RAM · 32 Max Procs
          </div>
        </div>
      </footer>
    </div>
  );
};
