import React from 'react';
import {
  Activity,
  BarChart3,
  BookOpen,
  BrainCircuit,
  Cpu,
  Flame,
  History,
  LayoutDashboard,
  ListChecks,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Scale,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';

export type NavPageId =
  | 'overview'
  | 'processes'
  | 'simulation'
  | 'training'
  | 'intelligence'
  | 'shock-arena'
  | 'fairness'
  | 'comparison'
  | 'analytics'
  | 'history'
  | 'project-info'
  | 'design-studio';

export type WorkspaceId =
  | 'INTELLIGENCE_LAB'
  | 'SIMULATION_LAB'
  | 'RESEARCH_LAB'
  | 'APPLICATION_SETTINGS';

export interface NavItem {
  id: NavPageId;
  workspace: WorkspaceId;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const WORKSPACE_GROUPS: Array<{ id: WorkspaceId; title: string; code: string }> = [
  { id: 'INTELLIGENCE_LAB', title: 'Intelligence Lab', code: 'A' },
  { id: 'SIMULATION_LAB', title: 'Simulation Lab', code: 'B' },
  { id: 'RESEARCH_LAB', title: 'Research Lab', code: 'C' },
  { id: 'APPLICATION_SETTINGS', title: 'Application Settings', code: 'S' },
];

export const NAV_ITEMS: NavItem[] = [
  // A. Intelligence Lab
  {
    id: 'overview',
    workspace: 'INTELLIGENCE_LAB',
    label: 'Overview',
    shortLabel: 'Overview',
    icon: LayoutDashboard,
  },
  {
    id: 'intelligence',
    workspace: 'INTELLIGENCE_LAB',
    label: 'XAI & What-If Lab',
    shortLabel: 'XAI Lab',
    icon: Sparkles,
  },
  {
    id: 'training',
    workspace: 'INTELLIGENCE_LAB',
    label: 'RL Training Centre',
    shortLabel: 'RL Training',
    icon: BrainCircuit,
  },

  // B. Simulation Lab
  {
    id: 'processes',
    workspace: 'SIMULATION_LAB',
    label: 'Process Manager',
    shortLabel: 'Processes',
    icon: ListChecks,
  },
  {
    id: 'simulation',
    workspace: 'SIMULATION_LAB',
    label: 'Live Simulation',
    shortLabel: 'Simulation',
    icon: Activity,
  },
  {
    id: 'shock-arena',
    workspace: 'SIMULATION_LAB',
    label: 'Workload Shock Arena',
    shortLabel: 'Shock Arena',
    icon: Flame,
  },
  {
    id: 'fairness',
    workspace: 'SIMULATION_LAB',
    label: 'Fairness & Starvation',
    shortLabel: 'Fairness',
    icon: ShieldCheck,
  },

  // C. Research Lab
  {
    id: 'comparison',
    workspace: 'RESEARCH_LAB',
    label: 'Algorithm Comparison',
    shortLabel: 'Comparison',
    icon: Scale,
  },
  {
    id: 'analytics',
    workspace: 'RESEARCH_LAB',
    label: 'Research Analytics',
    shortLabel: 'Analytics',
    icon: BarChart3,
  },
  {
    id: 'history',
    workspace: 'RESEARCH_LAB',
    label: 'Experiment History',
    shortLabel: 'History',
    icon: History,
  },
  {
    id: 'project-info',
    workspace: 'RESEARCH_LAB',
    label: 'Project Information',
    shortLabel: 'Project Info',
    icon: BookOpen,
  },

  // S. Application Settings
  {
    id: 'design-studio',
    workspace: 'APPLICATION_SETTINGS',
    label: 'Design Studio',
    shortLabel: 'Appearance',
    icon: Palette,
  },
];

interface SidebarProps {
  activePage: NavPageId;
  onNavigate: (page: NavPageId) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activePage,
  onNavigate,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}) => {
  const handleSelect = (id: NavPageId) => {
    onNavigate(id);
    onCloseMobile();
  };

  const sidebarContent = (
    <div
      className="flex h-full flex-col border-r transition-colors duration-200"
      style={{
        backgroundColor: 'var(--surface-sidebar)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      {/* Brand Header */}
      <div
        className="flex items-center justify-between px-4 py-4 border-b"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
            style={{
              backgroundColor: 'var(--accent-soft)',
              borderColor: 'var(--accent-border)',
              color: 'var(--accent-text)',
            }}
          >
            <Cpu className="h-5 w-5" aria-hidden="true" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-display text-base font-bold tracking-tight text-[var(--text-primary)] leading-tight truncate">
                RAIRA{' '}
                <span
                  className="font-mono text-xs font-semibold"
                  style={{ color: 'var(--accent-text)' }}
                >
                  2.1
                </span>
              </div>
              <div className="text-[11px] text-[var(--text-muted)] truncate">
                Research Intelligence OS
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="hidden lg:inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)] transition-colors shrink-0 cursor-pointer"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
          ) : (
            <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
          )}
        </button>

        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation menu"
          className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)] cursor-pointer"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {/* Workspace Navigation */}
      <nav aria-label="Primary Navigation" className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4">
        {WORKSPACE_GROUPS.map((group) => {
          const items = NAV_ITEMS.filter((i) => i.workspace === group.id);
          return (
            <div key={group.id} className="space-y-1">
              {!collapsed ? (
                <div className="px-3 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-[0.11em] text-[var(--text-muted)] flex items-center justify-between">
                  <span>{group.title}</span>
                  <span className="font-mono opacity-65">{group.code}</span>
                </div>
              ) : (
                <div
                  className="border-t my-2"
                  style={{ borderColor: 'var(--border-subtle)' }}
                />
              )}

              {items.map((item) => {
                const Icon = item.icon;
                const isActive = activePage === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(item.id)}
                    aria-current={isActive ? 'page' : undefined}
                    title={collapsed ? `${group.title}: ${item.label}` : undefined}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors whitespace-nowrap cursor-pointer border ${
                      isActive
                        ? 'text-[var(--text-primary)]'
                        : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)]'
                    }`}
                    style={
                      isActive
                        ? {
                            backgroundColor: 'var(--accent-soft)',
                            borderColor: 'var(--accent-border)',
                            color: 'var(--accent-text)',
                          }
                        : undefined
                    }
                  >
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        isActive ? '' : 'text-[var(--text-muted)]'
                      }`}
                      aria-hidden="true"
                    />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Hardware Envelope Summary */}
      {!collapsed && (
        <div
          className="px-4 py-3 border-t text-xs text-[var(--text-muted)] space-y-1"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <div className="font-medium text-[var(--text-secondary)]">Simulated Target</div>
          <div className="font-mono tabular-nums text-[11px] text-[var(--text-muted)]">
            1 Core CPU · 4096 MB RAM
          </div>
          <div className="font-mono tabular-nums text-[11px] opacity-80 whitespace-nowrap">
            Max 32 Procs · Discrete-Time
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:block shrink-0 transition-[width] duration-200 ${
          collapsed ? 'w-[72px]' : 'w-[258px]'
        }`}
      >
        <div className="sticky top-0 h-screen">{sidebarContent}</div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/55 backdrop-blur-xs"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 w-[276px] max-w-[85vw] h-full">{sidebarContent}</div>
        </div>
      )}
    </>
  );
};
