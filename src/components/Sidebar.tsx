import React from 'react';
import {
  Activity,
  BarChart3,
  BookOpen,
  BrainCircuit,
  Cpu,
  History,
  LayoutDashboard,
  ListChecks,
  PanelLeftClose,
  PanelLeftOpen,
  Scale,
  X,
} from 'lucide-react';

export type NavPageId =
  | 'overview'
  | 'processes'
  | 'simulation'
  | 'training'
  | 'comparison'
  | 'analytics'
  | 'history'
  | 'project-info';

export interface NavItem {
  id: NavPageId;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', shortLabel: 'Overview', icon: LayoutDashboard },
  { id: 'processes', label: 'Process Manager', shortLabel: 'Processes', icon: ListChecks },
  { id: 'simulation', label: 'Live Simulation', shortLabel: 'Simulation', icon: Activity },
  { id: 'training', label: 'RL Training Centre', shortLabel: 'RL Training', icon: BrainCircuit },
  { id: 'comparison', label: 'Algorithm Comparison', shortLabel: 'Comparison', icon: Scale },
  { id: 'analytics', label: 'Research Analytics', shortLabel: 'Analytics', icon: BarChart3 },
  { id: 'history', label: 'Experiment History', shortLabel: 'History', icon: History },
  { id: 'project-info', label: 'Project Information', shortLabel: 'Project Info', icon: BookOpen },
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
    <div className="flex h-full flex-col bg-[#09101E] border-r border-slate-800/80">
      {/* Brand Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-400">
            <Cpu className="h-5 w-5" aria-hidden="true" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-display text-base font-bold tracking-tight text-slate-100 leading-tight truncate">
                RAIRA
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                RL Resource Allocator
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="hidden lg:inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800/70 hover:text-slate-100 transition-colors shrink-0"
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
          className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-slate-100"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav aria-label="Primary Navigation" className="flex-1 overflow-y-auto px-2.5 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item.id)}
              aria-current={isActive ? 'page' : undefined}
              title={collapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-cyan-500/12 text-cyan-300 border border-cyan-500/25'
                  : 'text-slate-400 border border-transparent hover:bg-slate-800/50 hover:text-slate-100'
              }`}
            >
              <Icon
                className={`h-4 w-4 shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`}
                aria-hidden="true"
              />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Hardware Envelope Summary (factual spec, not telemetry ticker) */}
      {!collapsed && (
        <div className="px-4 py-3.5 border-t border-slate-800/80 text-xs text-slate-400 space-y-1">
          <div className="font-medium text-slate-300">Simulated Target</div>
          <div className="font-mono tabular-nums text-[11px] text-slate-400">
            1 Core CPU · 4096 MB RAM
          </div>
          <div className="font-mono tabular-nums text-[11px] text-slate-500 whitespace-nowrap">
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
          collapsed ? 'w-[72px]' : 'w-[252px]'
        }`}
      >
        <div className="sticky top-0 h-screen">{sidebarContent}</div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/65 backdrop-blur-xs"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 w-[272px] max-w-[85vw] h-full">{sidebarContent}</div>
        </div>
      )}
    </>
  );
};
