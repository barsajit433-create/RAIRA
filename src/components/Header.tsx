import React from 'react';
import { Menu, Play } from 'lucide-react';
import type { NavPageId } from './Sidebar';
import type { SimulationSnapshot } from '../types/simulation';
import { formatAlgorithmName } from '../utils/formatters';

interface HeaderProps {
  activePage: NavPageId;
  simulation: SimulationSnapshot | null;
  onOpenMobileMenu: () => void;
  onLaunchDemo: () => void;
  demoLoading: boolean;
}

const PAGE_TITLES: Record<NavPageId, { title: string; subtitle: string }> = {
  overview: {
    title: 'Overview Dashboard',
    subtitle: 'Intelligent Resource Allocation Using Reinforcement Learning',
  },
  processes: {
    title: 'Process Manager',
    subtitle: 'Manual process creation, validation, and deterministic workload generation',
  },
  simulation: {
    title: 'Live Simulation',
    subtitle: 'Discrete-time single-core CPU scheduling and 4096 MB dynamic RAM allocation',
  },
  training: {
    title: 'RL Training Centre',
    subtitle: 'Train Tabular Q-Learning and TensorFlow.js Deep Q-Network agents with SMDP discounting',
  },
  comparison: {
    title: 'Algorithm Comparison',
    subtitle: 'Controlled head-to-head evaluation across identical workloads and random seeds',
  },
  analytics: {
    title: 'Research Analytics',
    subtitle: 'Empirical learning curves, resource utilisation trends, fairness analysis, and data export',
  },
  history: {
    title: 'Experiment History',
    subtitle: 'Browser-persisted experiment logs with seed reproducibility and JSON/CSV export',
  },
  'project-info': {
    title: 'Project Information',
    subtitle: 'Intelligent Resource Allocation Using Reinforcement Learning — Research Documentation',
  },
};

export const Header: React.FC<HeaderProps> = ({
  activePage,
  simulation,
  onOpenMobileMenu,
  onLaunchDemo,
  demoLoading,
}) => {
  const meta = PAGE_TITLES[activePage];
  const hasProcesses = (simulation?.processes.length ?? 0) > 0;

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#060B14]/85 backdrop-blur-md">
      <div className="flex items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Open navigation menu"
            className="lg:hidden inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-[#0B1221] text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>

          <div className="min-w-0">
            <h1 className="font-display text-lg sm:text-xl font-semibold tracking-tight text-slate-100 truncate">
              {meta.title}
            </h1>
            <p className="text-xs text-slate-400 truncate hidden sm:block">{meta.subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          {simulation && (
            <div className="hidden md:flex items-center gap-2 text-xs text-slate-400 font-mono tabular-nums">
              <span className="text-slate-300">{formatAlgorithmName(simulation.algorithm)}</span>
              <span aria-hidden="true">·</span>
              <span>Tick {simulation.currentTick}</span>
              <span aria-hidden="true">·</span>
              <span
                className={
                  simulation.status === 'RUNNING'
                    ? 'text-cyan-400'
                    : simulation.status === 'COMPLETED'
                      ? 'text-emerald-400'
                      : simulation.status === 'PAUSED'
                        ? 'text-amber-400'
                        : 'text-slate-400'
                }
              >
                {simulation.status}
              </span>
            </div>
          )}

          {!hasProcesses && activePage !== 'overview' && (
            <button
              type="button"
              onClick={onLaunchDemo}
              disabled={demoLoading}
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Play className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{demoLoading ? 'Loading...' : 'Launch Demo Workload'}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
