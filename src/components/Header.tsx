import React from 'react';
import { Menu, Palette, Play } from 'lucide-react';
import type { NavPageId } from './Sidebar';
import type { SimulationSnapshot } from '../types/simulation';
import { formatAlgorithmName } from '../utils/formatters';
import { useTheme } from '../theme/ThemeContext';

interface HeaderProps {
  activePage: NavPageId;
  simulation: SimulationSnapshot | null;
  onOpenMobileMenu: () => void;
  onLaunchDemo: () => void;
  onNavigate: (page: NavPageId) => void;
  demoLoading: boolean;
}

const PAGE_TITLES: Record<NavPageId, { workspace: string; title: string; subtitle: string }> = {
  overview: {
    workspace: 'Intelligence Lab',
    title: 'Overview Dashboard',
    subtitle: 'Intelligent Resource Allocation Using Reinforcement Learning',
  },
  intelligence: {
    workspace: 'Intelligence Lab',
    title: 'Explainable AI & Counterfactual Lab',
    subtitle:
      'Ground-truth RL Q-value inspection, DQN feature sensitivity, and isolated counterfactual branching',
  },
  training: {
    workspace: 'Intelligence Lab',
    title: 'RL Training Centre',
    subtitle:
      'Train Tabular Q-Learning and TensorFlow.js Deep Q-Network agents with SMDP discounting',
  },
  processes: {
    workspace: 'Simulation Lab',
    title: 'Process Manager',
    subtitle: 'Manual process creation, validation, and deterministic workload generation',
  },
  simulation: {
    workspace: 'Simulation Lab',
    title: 'Live Simulation & Execution Timeline',
    subtitle:
      'Discrete-time CPU scheduling, 4096 MB RAM allocation, and synchronized Gantt & memory timelines',
  },
  'shock-arena': {
    workspace: 'Simulation Lab',
    title: 'Workload Shock Arena',
    subtitle: 'Controlled mid-episode disturbance injection and 5-policy resilience evaluation',
  },
  fairness: {
    workspace: 'Simulation Lab',
    title: 'Fairness & Starvation Monitor',
    subtitle:
      'Processor-sharing service fairness, starvation risk detection, and reward objective tuning',
  },
  comparison: {
    workspace: 'Research Lab',
    title: 'Algorithm Comparison & Statistical Validation',
    subtitle:
      'Head-to-head benchmarking and ≥30-seed confidence interval evaluation across identical workloads',
  },
  analytics: {
    workspace: 'Research Lab',
    title: 'Research Analytics & Ablation Lab',
    subtitle:
      'Learning curves, unseen-workload generalisation, controlled ablations, and CSV/JSON export',
  },
  history: {
    workspace: 'Research Lab',
    title: 'Experiment History',
    subtitle:
      'Browser-persisted experiment logs with reward metadata, seed reproducibility, and export',
  },
  'project-info': {
    workspace: 'Research Lab',
    title: 'Project Information',
    subtitle:
      'Intelligent Resource Allocation Using Reinforcement Learning — Research Documentation',
  },
  'design-studio': {
    workspace: 'Application Settings',
    title: 'Appearance & Design Studio',
    subtitle:
      'Multi-theme switcher, visual density, accent calibration, and chart rendering preferences',
  },
};

export const Header: React.FC<HeaderProps> = ({
  activePage,
  simulation,
  onOpenMobileMenu,
  onLaunchDemo,
  onNavigate,
  demoLoading,
}) => {
  const { activeTheme } = useTheme();
  const meta = PAGE_TITLES[activePage];
  const hasProcesses = (simulation?.processes.length ?? 0) > 0;

  return (
    <header
      className="sticky top-0 z-30 border-b backdrop-blur-md transition-colors duration-200"
      style={{
        backgroundColor: 'var(--surface-header)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      <div className="flex items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Open navigation menu"
            className="lg:hidden inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--border-strong)] bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className="hidden sm:inline text-[10px] font-mono uppercase tracking-[0.12em] whitespace-nowrap"
                style={{ color: 'var(--accent-text)' }}
              >
                {meta.workspace}
              </span>
              <span
                className="hidden sm:inline text-[var(--text-muted)] opacity-50 text-xs"
                aria-hidden="true"
              >
                /
              </span>
              <h1 className="font-display text-base sm:text-lg font-semibold tracking-tight text-[var(--text-primary)] truncate">
                {meta.title}
              </h1>
            </div>
            <p className="text-xs text-[var(--text-muted)] truncate hidden sm:block">
              {meta.subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          {simulation && (
            <div className="hidden xl:flex items-center gap-2 text-xs text-[var(--text-muted)] font-mono tabular-nums">
              <span className="text-[var(--text-secondary)]">
                {formatAlgorithmName(simulation.algorithm)}
              </span>
              <span aria-hidden="true">·</span>
              <span>Tick {simulation.currentTick}</span>
              <span aria-hidden="true">·</span>
              <span
                style={{
                  color:
                    simulation.status === 'RUNNING'
                      ? 'var(--accent-text)'
                      : simulation.status === 'COMPLETED'
                        ? 'var(--status-success)'
                        : simulation.status === 'PAUSED'
                          ? 'var(--status-warning)'
                          : 'var(--text-muted)',
                }}
              >
                {simulation.status}
              </span>
            </div>
          )}

          {/* Neutral Guest Mode Indicator with accessible tooltip */}
          <div className="relative group">
            <span
              data-testid="guest-mode-label"
              tabIndex={0}
              role="note"
              title="Your experiments and preferences are stored locally in this browser."
              aria-label="Guest Mode: Your experiments and preferences are stored locally in this browser."
              className="inline-flex items-center rounded-md border px-2 py-1 text-[10px] font-mono font-medium uppercase tracking-[0.1em] whitespace-nowrap shrink-0 select-none transition-colors cursor-default"
              style={{
                borderColor: 'var(--border-subtle)',
                backgroundColor: 'var(--surface-subtle)',
                color: 'var(--text-muted)',
              }}
            >
              GUEST MODE
            </span>
            <div
              role="tooltip"
              data-testid="guest-mode-tooltip"
              className="pointer-events-none absolute right-0 top-full mt-2 w-64 rounded-lg border px-3 py-2 text-[11px] leading-relaxed shadow-lg opacity-0 translate-y-0.5 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 z-40"
              style={{
                backgroundColor: 'var(--surface-card)',
                borderColor: 'var(--border-strong)',
                color: 'var(--text-secondary)',
              }}
            >
              Your experiments and preferences are stored locally in this browser.
            </div>
          </div>

          {activePage !== 'design-studio' && (
            <button
              type="button"
              onClick={() => onNavigate('design-studio')}
              aria-label={`Open Design Studio (${activeTheme.shortName})`}
              className="raira-btn-secondary inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Palette className="h-3.5 w-3.5 text-[var(--accent-text)]" aria-hidden="true" />
              <span className="hidden sm:inline">{activeTheme.shortName}</span>
            </button>
          )}

          {!hasProcesses && activePage !== 'overview' && activePage !== 'design-studio' && (
            <button
              type="button"
              onClick={onLaunchDemo}
              disabled={demoLoading}
              className="raira-btn-primary inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
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
