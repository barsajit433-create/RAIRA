import React, { useState } from 'react';
import {
  Check,
  Columns2,
  Maximize2,
  Minimize2,
  Moon,
  Palette,
  Play,
  RotateCcw,
  Sliders,
  Sparkles,
  Sun,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ACCENT_LIST,
  THEME_LIST,
  type ThemeDefinition,
} from '../theme/themeConfig';
import { useTheme } from '../theme/ThemeContext';
import type { SimulationSnapshot } from '../types/simulation';
import { formatAlgorithmName } from '../utils/formatters';

interface DesignStudioProps {
  simulation: SimulationSnapshot | null;
  busy: boolean;
  onLaunchDemo: () => void;
}

const ThemeMiniaturePreview: React.FC<{ theme: ThemeDefinition }> = ({ theme }) => {
  const p = theme.previewPalette;
  const isCyber = theme.id === 'cyber-lab';
  const isEnterprise = theme.id === 'minimal-enterprise';
  const isAcademic = theme.id === 'academic-research';

  return (
    <div
      className="relative h-36 w-full overflow-hidden rounded-lg border select-none"
      style={{
        backgroundColor: p.canvas,
        borderColor: p.border,
        boxShadow: isCyber && p.glow ? `inset 0 0 22px -12px ${p.glow}` : undefined,
      }}
      aria-hidden="true"
    >
      {/* Subtle top ambient glow for Mission Control & Cyber Lab */}
      {(theme.id === 'mission-control' || isCyber) && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-14 opacity-50"
          style={{
            background: `radial-gradient(ellipse 80% 100% at 50% 0%, ${p.accent}33, transparent 75%)`,
          }}
        />
      )}

      <div className="relative flex h-full w-full">
        {/* Miniature Sidebar */}
        <div
          className="flex w-[22%] flex-col justify-between border-r p-2"
          style={{ backgroundColor: p.sidebar, borderColor: p.border }}
        >
          <div className="space-y-1.5">
            <div className="flex items-center gap-1">
              <div
                className="h-2.5 w-2.5 rounded-xs"
                style={{ backgroundColor: p.accent }}
              />
              <div
                className="h-1.5 w-8 rounded-xs opacity-80"
                style={{ backgroundColor: p.text }}
              />
            </div>
            <div className="pt-1 space-y-1">
              <div
                className="h-2 w-full rounded-xs"
                style={{ backgroundColor: `${p.accent}30`, border: `1px solid ${p.accent}66` }}
              />
              <div
                className="h-1.5 w-4/5 rounded-xs opacity-25"
                style={{ backgroundColor: p.muted }}
              />
              <div
                className="h-1.5 w-3/4 rounded-xs opacity-25"
                style={{ backgroundColor: p.muted }}
              />
              <div
                className="h-1.5 w-5/6 rounded-xs opacity-25"
                style={{ backgroundColor: p.muted }}
              />
            </div>
          </div>
          <div className="space-y-1">
            <div
              className="h-1 w-full rounded-xs opacity-20"
              style={{ backgroundColor: p.muted }}
            />
            <div
              className="h-1 w-2/3 rounded-xs opacity-20"
              style={{ backgroundColor: p.muted }}
            />
          </div>
        </div>

        {/* Miniature Main Workspace */}
        <div className="flex-1 flex flex-col p-2.5 gap-2">
          {/* Top bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div
                className="h-1.5 w-10 rounded-xs"
                style={{ backgroundColor: p.accent }}
              />
              <div
                className="h-1.5 w-14 rounded-xs opacity-75"
                style={{ backgroundColor: p.text }}
              />
            </div>
            <div
              className="h-3 w-11 rounded-xs"
              style={{ backgroundColor: p.accent }}
            />
          </div>

          {/* 3 KPI blocks */}
          <div className="grid grid-cols-3 gap-1.5">
            {[p.accent, p.success, p.secondary].map((tone, i) => (
              <div
                key={i}
                className="rounded p-1.5 border"
                style={{
                  backgroundColor: p.card,
                  borderColor: p.border,
                  boxShadow: isEnterprise
                    ? '0 2px 6px rgba(15, 23, 42, 0.06)'
                    : isCyber
                      ? `0 0 8px -4px ${p.accent}66`
                      : undefined,
                }}
              >
                <div
                  className="h-1 w-7 rounded-xs opacity-40 mb-1"
                  style={{ backgroundColor: p.muted }}
                />
                <div
                  className="h-2 w-9 rounded-xs"
                  style={{ backgroundColor: tone }}
                />
              </div>
            ))}
          </div>

          {/* Mini Chart + Table Split */}
          <div className="grid grid-cols-5 gap-1.5 flex-1 min-h-0">
            <div
              className="col-span-3 rounded p-1.5 border flex flex-col justify-between"
              style={{
                backgroundColor: p.card,
                borderColor: p.border,
                boxShadow: isEnterprise ? '0 2px 6px rgba(15, 23, 42, 0.06)' : undefined,
              }}
            >
              <div
                className="h-1 w-10 rounded-xs opacity-45"
                style={{ backgroundColor: p.text }}
              />
              <svg viewBox="0 0 120 34" className="w-full h-9 overflow-visible">
                <line
                  x1="0"
                  y1="10"
                  x2="120"
                  y2="10"
                  stroke={p.border}
                  strokeWidth="0.7"
                  strokeDasharray="2 2"
                />
                <line
                  x1="0"
                  y1="22"
                  x2="120"
                  y2="22"
                  stroke={p.border}
                  strokeWidth="0.7"
                  strokeDasharray="2 2"
                />
                {!isAcademic && (
                  <path
                    d="M0,28 L18,24 L36,19 L54,21 L72,12 L92,15 L120,6 L120,34 L0,34 Z"
                    fill={p.accent}
                    fillOpacity="0.16"
                  />
                )}
                <polyline
                  fill="none"
                  stroke={p.accent}
                  strokeWidth="1.8"
                  points="0,28 18,24 36,19 54,21 72,12 92,15 120,6"
                />
                <polyline
                  fill="none"
                  stroke={p.secondary}
                  strokeWidth="1.3"
                  strokeDasharray={isAcademic ? '3 2' : undefined}
                  points="0,30 22,27 46,23 70,18 96,17 120,12"
                />
              </svg>
            </div>

            <div
              className="col-span-2 rounded p-1.5 border flex flex-col justify-between"
              style={{
                backgroundColor: p.card,
                borderColor: p.border,
                boxShadow: isEnterprise ? '0 2px 6px rgba(15, 23, 42, 0.06)' : undefined,
              }}
            >
              {[0, 1, 2, 3].map((row) => (
                <div
                  key={row}
                  className="flex items-center justify-between py-0.5 border-b last:border-b-0"
                  style={{ borderColor: `${p.border}90` }}
                >
                  <div
                    className="h-1 w-7 rounded-xs opacity-60"
                    style={{ backgroundColor: p.text }}
                  />
                  <div
                    className="h-1.5 w-4 rounded-xs"
                    style={{
                      backgroundColor: row === 0 ? p.success : row === 1 ? p.accent : p.secondary,
                      opacity: 0.85,
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const DesignStudio: React.FC<DesignStudioProps> = ({
  simulation,
  busy,
  onLaunchDemo,
}) => {
  const {
    settings,
    activeTheme,
    resolvedAppearance,
    osPrefersReducedMotion,
    effectiveReducedMotion,
    chartTheme,
    selectTheme,
    updateSettings,
    resetToDefaults,
  } = useTheme();

  const [resetFeedback, setResetFeedback] = useState(false);

  const handleReset = () => {
    resetToDefaults();
    setResetFeedback(true);
    window.setTimeout(() => setResetFeedback(false), 2400);
  };

  const telemetry = simulation?.telemetryHistory ?? [];
  const hasTelemetry = telemetry.length > 0;

  return (
    <div className="raira-section-stack">
      {/* Studio Overview Banner */}
      <section
        aria-label="Design Studio Summary"
        className="raira-card raira-card-pad flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
      >
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2 text-xs font-mono text-[var(--accent-text)]">
            <Palette className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Appearance &amp; Design Studio</span>
            <span aria-hidden="true">·</span>
            <span className="text-[var(--text-muted)]">Persisted to browser localStorage</span>
          </div>
          <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">
            Active Theme: {activeTheme.name}
          </h2>
          <p className="text-xs text-[var(--text-muted)] max-w-2xl leading-relaxed">
            Switch between four calibrated visual themes and fine-tune layout density, accent
            colour, chart rendering, and motion preferences. All visual changes apply immediately
            without modifying simulation state, RL models, or experiment data.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {resetFeedback && (
            <span
              role="status"
              className="text-xs font-medium text-[var(--status-success)] whitespace-nowrap"
            >
              Restored AI Mission Control defaults
            </span>
          )}
          <button
            type="button"
            onClick={handleReset}
            className="raira-btn-secondary inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold whitespace-nowrap cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Reset to Default</span>
          </button>
        </div>
      </section>

      {/* Four Live Theme Preview Cards */}
      <section aria-labelledby="theme-gallery-heading" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h3
              id="theme-gallery-heading"
              className="font-display text-sm font-semibold text-[var(--text-primary)]"
            >
              Visual Theme Gallery
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              Select a theme to immediately restyle every workspace, table, and research chart.
            </p>
          </div>
          <div className="text-xs text-[var(--text-muted)] font-mono tabular-nums">
            4 complete themes · WCAG AA contrast verified
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {THEME_LIST.map((theme) => {
            const isSelected = settings.themeId === theme.id;
            return (
              <article
                key={theme.id}
                data-testid={`theme-card-${theme.id}`}
                className="raira-card raira-card-pad flex flex-col justify-between gap-4 transition-all"
                style={{
                  borderColor: isSelected ? 'var(--accent-primary)' : undefined,
                  boxShadow: isSelected
                    ? '0 0 0 1px var(--accent-primary), var(--card-shadow)'
                    : undefined,
                }}
              >
                <div className="space-y-3">
                  <ThemeMiniaturePreview theme={theme} />

                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="font-display text-base font-semibold text-[var(--text-primary)] leading-snug">
                        {theme.name}
                      </h4>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">{theme.tagline}</p>
                    </div>

                    {isSelected && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent-text)] whitespace-nowrap shrink-0">
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Active Theme</span>
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    {theme.description}
                  </p>

                  {/* Unboxed typographic highlights + palette swatches */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-[var(--text-muted)]">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {theme.highlights.map((item, idx) => (
                        <React.Fragment key={item}>
                          {idx > 0 && <span aria-hidden="true">·</span>}
                          <span>{item}</span>
                        </React.Fragment>
                      ))}
                    </div>

                    <div className="flex items-center gap-1" aria-label={`${theme.name} colour swatches`}>
                      {[
                        theme.previewPalette.canvas,
                        theme.previewPalette.card,
                        theme.previewPalette.accent,
                        theme.previewPalette.secondary,
                        theme.previewPalette.success,
                      ].map((hex, i) => (
                        <span
                          key={i}
                          className="h-3 w-3 rounded-xs border"
                          style={{
                            backgroundColor: hex,
                            borderColor: 'var(--border-strong)',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-3 border-t border-[var(--border-subtle)]">
                  <span className="text-[11px] font-mono text-[var(--text-muted)]">
                    Default: {theme.defaultAppearance === 'dark' ? 'Dark' : 'Light'} ·{' '}
                    {theme.defaultAccent}
                  </span>

                  <button
                    type="button"
                    onClick={() => selectTheme(theme.id)}
                    aria-pressed={isSelected}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                      isSelected ? 'raira-btn-secondary' : 'raira-btn-primary'
                    }`}
                  >
                    {isSelected ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-[var(--accent-text)]" aria-hidden="true" />
                        <span>Selected</span>
                      </>
                    ) : (
                      <span>Select Theme</span>
                    )}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Customisation Controls */}
      <section aria-labelledby="customisation-heading" className="raira-card raira-card-pad space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-[var(--accent-text)]" aria-hidden="true" />
            <div>
              <h3
                id="customisation-heading"
                className="font-display text-sm font-semibold text-[var(--text-primary)]"
              >
                Workspace &amp; Visual Customisation
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Fine-tune layout rhythm, accents, chart styling, and accessibility controls without
                compromising chart legibility.
              </p>
            </div>
          </div>
          <span className="text-xs font-mono text-[var(--text-muted)]">
            Auto-saved on change
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {/* 1. Accent Colour */}
          <div className="space-y-2.5">
            <div>
              <div className="text-xs font-semibold text-[var(--text-primary)]">Accent Colour</div>
              <div className="text-[11px] text-[var(--text-muted)]">
                Contrast-calibrated automatically for {resolvedAppearance} surfaces
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Accent colour selection">
              {ACCENT_LIST.map((accent) => {
                const active = settings.accentColor === accent.id;
                return (
                  <button
                    key={accent.id}
                    type="button"
                    onClick={() => updateSettings({ accentColor: accent.id })}
                    aria-pressed={active}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)] text-[var(--text-primary)]'
                        : 'raira-subtle text-[var(--text-secondary)] hover:border-[var(--border-strong)]'
                    }`}
                  >
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: accent.swatchHex }}
                      aria-hidden="true"
                    />
                    <span className="truncate">{accent.label.split(' ')[1] ?? accent.label}</span>
                    {active && (
                      <Check
                        className="h-3.5 w-3.5 ml-auto text-[var(--accent-text)] shrink-0"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Light / Dark Appearance */}
          <div className="space-y-2.5">
            <div>
              <div className="text-xs font-semibold text-[var(--text-primary)]">
                Appearance Mode
              </div>
              <div className="text-[11px] text-[var(--text-muted)]">
                {activeTheme.appearanceNote}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Appearance mode">
              <button
                type="button"
                disabled={!activeTheme.supportsAppearanceToggle}
                onClick={() => updateSettings({ appearance: 'dark' })}
                aria-pressed={resolvedAppearance === 'dark'}
                className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium border transition-colors whitespace-nowrap ${
                  resolvedAppearance === 'dark'
                    ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)] text-[var(--text-primary)]'
                    : 'raira-subtle text-[var(--text-secondary)]'
                } ${
                  !activeTheme.supportsAppearanceToggle
                    ? 'opacity-65 cursor-not-allowed'
                    : 'cursor-pointer hover:border-[var(--border-strong)]'
                }`}
              >
                <Moon className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Dark</span>
              </button>
              <button
                type="button"
                disabled={!activeTheme.supportsAppearanceToggle}
                onClick={() => updateSettings({ appearance: 'light' })}
                aria-pressed={resolvedAppearance === 'light'}
                className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium border transition-colors whitespace-nowrap ${
                  resolvedAppearance === 'light'
                    ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)] text-[var(--text-primary)]'
                    : 'raira-subtle text-[var(--text-secondary)]'
                } ${
                  !activeTheme.supportsAppearanceToggle
                    ? 'opacity-50 cursor-not-allowed'
                    : 'cursor-pointer hover:border-[var(--border-strong)]'
                }`}
              >
                <Sun className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Light</span>
              </button>
            </div>
          </div>

          {/* 3. Layout Density */}
          <div className="space-y-2.5">
            <div>
              <div className="text-xs font-semibold text-[var(--text-primary)]">Layout Density</div>
              <div className="text-[11px] text-[var(--text-muted)]">
                Adjust panel padding, grid rhythm, and data table row height
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Layout density">
              <button
                type="button"
                onClick={() => updateSettings({ layoutDensity: 'spacious' })}
                aria-pressed={settings.layoutDensity === 'spacious'}
                className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                  settings.layoutDensity === 'spacious'
                    ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)] text-[var(--text-primary)]'
                    : 'raira-subtle text-[var(--text-secondary)] hover:border-[var(--border-strong)]'
                }`}
              >
                <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Spacious</span>
              </button>
              <button
                type="button"
                onClick={() => updateSettings({ layoutDensity: 'compact' })}
                aria-pressed={settings.layoutDensity === 'compact'}
                className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                  settings.layoutDensity === 'compact'
                    ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)] text-[var(--text-primary)]'
                    : 'raira-subtle text-[var(--text-secondary)] hover:border-[var(--border-strong)]'
                }`}
              >
                <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Compact</span>
              </button>
            </div>
          </div>

          {/* 4. Sidebar State */}
          <div className="space-y-2.5">
            <div>
              <div className="text-xs font-semibold text-[var(--text-primary)]">
                Navigation Sidebar
              </div>
              <div className="text-[11px] text-[var(--text-muted)]">
                Expand full workspace labels or collapse to compact icon rail
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Sidebar layout">
              <button
                type="button"
                onClick={() => updateSettings({ sidebarCollapsed: false })}
                aria-pressed={!settings.sidebarCollapsed}
                className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                  !settings.sidebarCollapsed
                    ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)] text-[var(--text-primary)]'
                    : 'raira-subtle text-[var(--text-secondary)] hover:border-[var(--border-strong)]'
                }`}
              >
                <Columns2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Expanded</span>
              </button>
              <button
                type="button"
                onClick={() => updateSettings({ sidebarCollapsed: true })}
                aria-pressed={settings.sidebarCollapsed}
                className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                  settings.sidebarCollapsed
                    ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)] text-[var(--text-primary)]'
                    : 'raira-subtle text-[var(--text-secondary)] hover:border-[var(--border-strong)]'
                }`}
              >
                <Columns2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Collapsed</span>
              </button>
            </div>
          </div>

          {/* 5. Chart Style */}
          <div className="space-y-2.5">
            <div>
              <div className="text-xs font-semibold text-[var(--text-primary)]">
                Chart Visual Style
              </div>
              <div className="text-[11px] text-[var(--text-muted)]">
                Toggle flat publication fills or subtle translucent gradient fills
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Chart visual style">
              <button
                type="button"
                onClick={() => updateSettings({ chartStyle: 'standard' })}
                aria-pressed={settings.chartStyle === 'standard'}
                className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                  settings.chartStyle === 'standard'
                    ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)] text-[var(--text-primary)]'
                    : 'raira-subtle text-[var(--text-secondary)] hover:border-[var(--border-strong)]'
                }`}
              >
                <span>Standard</span>
              </button>
              <button
                type="button"
                onClick={() => updateSettings({ chartStyle: 'gradient' })}
                aria-pressed={settings.chartStyle === 'gradient'}
                className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                  settings.chartStyle === 'gradient'
                    ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)] text-[var(--text-primary)]'
                    : 'raira-subtle text-[var(--text-secondary)] hover:border-[var(--border-strong)]'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Gradient</span>
              </button>
            </div>
          </div>

          {/* 6. Motion & Reduced Motion */}
          <div className="space-y-2.5">
            <div>
              <div className="text-xs font-semibold text-[var(--text-primary)]">
                Motion &amp; Transitions
              </div>
              <div className="text-[11px] text-[var(--text-muted)]">
                {osPrefersReducedMotion
                  ? 'OS prefers-reduced-motion is active and honoured.'
                  : 'Restrained transitions; disables chart and UI animations when reduced.'}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Animation preference">
              <button
                type="button"
                onClick={() => updateSettings({ animations: 'enabled' })}
                aria-pressed={settings.animations === 'enabled'}
                className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                  settings.animations === 'enabled'
                    ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)] text-[var(--text-primary)]'
                    : 'raira-subtle text-[var(--text-secondary)] hover:border-[var(--border-strong)]'
                }`}
              >
                <span>Enabled</span>
              </button>
              <button
                type="button"
                onClick={() => updateSettings({ animations: 'reduced' })}
                aria-pressed={settings.animations === 'reduced'}
                className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                  settings.animations === 'reduced'
                    ? 'bg-[var(--accent-soft)] border-[var(--accent-primary)] text-[var(--text-primary)]'
                    : 'raira-subtle text-[var(--text-secondary)] hover:border-[var(--border-strong)]'
                }`}
              >
                <span>Reduced</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Live Simulator Telemetry Preview (Zero Hardcoded Decorative Data) */}
      <section aria-labelledby="live-preview-heading" className="raira-card raira-card-pad space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3
              id="live-preview-heading"
              className="font-display text-sm font-semibold text-[var(--text-primary)]"
            >
              Live Data &amp; Chart Contrast Verification
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              Renders actual telemetry from the active simulator session—never hardcoded placeholder
              series—so you can inspect live chart legibility under your chosen theme.
            </p>
          </div>
          {simulation && (
            <div className="text-xs font-mono tabular-nums text-[var(--text-muted)]">
              {formatAlgorithmName(simulation.algorithm)} · Tick {simulation.currentTick} ·{' '}
              {simulation.processes.length} processes
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="raira-subtle rounded-lg p-3">
            <div className="text-[11px] text-[var(--text-muted)]">Avg CPU Utilisation</div>
            <div className="mt-1 font-mono tabular-nums text-lg font-semibold text-[var(--accent-text)]">
              {(simulation?.metrics.avgCpuUtilisation ?? 0).toFixed(1)}%
            </div>
          </div>
          <div className="raira-subtle rounded-lg p-3">
            <div className="text-[11px] text-[var(--text-muted)]">Allocated RAM</div>
            <div className="mt-1 font-mono tabular-nums text-lg font-semibold text-[var(--status-success)]">
              {simulation?.metrics.currentRamUsedMb ?? 0} MB
            </div>
          </div>
          <div className="raira-subtle rounded-lg p-3">
            <div className="text-[11px] text-[var(--text-muted)]">Avg Waiting Time</div>
            <div className="mt-1 font-mono tabular-nums text-lg font-semibold text-[var(--text-primary)]">
              {(simulation?.metrics.avgWaitingTime ?? 0).toFixed(2)}t
            </div>
          </div>
          <div className="raira-subtle rounded-lg p-3">
            <div className="text-[11px] text-[var(--text-muted)]">Motion State</div>
            <div className="mt-1 font-mono text-sm font-semibold text-[var(--text-secondary)]">
              {effectiveReducedMotion ? 'Reduced Motion' : 'Smooth (≤200ms)'}
            </div>
          </div>
        </div>

        <div className="h-52 w-full">
          {!hasTelemetry ? (
            <div className="raira-empty-state h-full flex flex-col items-center justify-center gap-3 px-4 text-center">
              <p className="text-xs max-w-md">
                No simulator ticks recorded yet. Load a deterministic workload and step or run the
                simulator to inspect live CPU and RAM chart contrast in this theme.
              </p>
              <button
                type="button"
                onClick={onLaunchDemo}
                disabled={busy}
                className="raira-btn-primary inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                <Play className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{busy ? 'Loading...' : 'Load Demo Workload'}</span>
              </button>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={telemetry} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="studioRamGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartTheme.primary} stopOpacity={0.32} />
                    <stop offset="95%" stopColor={chartTheme.primary} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                <XAxis
                  dataKey="tick"
                  stroke={chartTheme.axis}
                  tick={{ fontSize: 11, fill: chartTheme.tick }}
                  tickFormatter={(v) => `t${v}`}
                />
                <YAxis
                  domain={[0, 100]}
                  stroke={chartTheme.axis}
                  tick={{ fontSize: 11, fill: chartTheme.tick }}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: chartTheme.tooltipBg,
                    borderColor: chartTheme.tooltipBorder,
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: chartTheme.tooltipText,
                  }}
                  labelStyle={{ color: chartTheme.tooltipLabel }}
                  formatter={(value: unknown, name: unknown) => [
                    `${Number(value).toFixed(1)}%`,
                    name === 'cpuUtil' ? 'CPU Utilisation' : 'RAM Utilisation',
                  ]}
                  labelFormatter={(label) => `Tick ${label}`}
                />
                <Area
                  type="stepAfter"
                  dataKey="cpuUtil"
                  stroke={chartTheme.primary}
                  strokeWidth={2}
                  fill={chartTheme.useGradients ? 'url(#studioRamGrad)' : chartTheme.primary}
                  fillOpacity={chartTheme.useGradients ? 1 : 0.12}
                  isAnimationActive={chartTheme.animateCharts}
                />
                <Area
                  type="monotone"
                  dataKey="ramUtilPercent"
                  stroke={chartTheme.secondary}
                  strokeWidth={2}
                  fill="none"
                  isAnimationActive={chartTheme.animateCharts}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>
    </div>
  );
};
