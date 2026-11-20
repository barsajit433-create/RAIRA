export type ThemeId =
  | 'mission-control'
  | 'academic-research'
  | 'cyber-lab'
  | 'minimal-enterprise';

export type AppearanceMode = 'dark' | 'light';
export type AccentColorId = 'cyan' | 'blue' | 'violet' | 'emerald';
export type LayoutDensity = 'spacious' | 'compact';
export type ChartStyleMode = 'standard' | 'gradient';
export type MotionPreference = 'enabled' | 'reduced';

export interface DesignStudioSettings {
  themeId: ThemeId;
  appearance: AppearanceMode;
  accentColor: AccentColorId;
  sidebarCollapsed: boolean;
  layoutDensity: LayoutDensity;
  chartStyle: ChartStyleMode;
  animations: MotionPreference;
}

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  defaultAppearance: AppearanceMode;
  defaultAccent: AccentColorId;
  supportsAppearanceToggle: boolean;
  appearanceNote: string;
  highlights: string[];
  previewPalette: {
    canvas: string;
    sidebar: string;
    card: string;
    border: string;
    text: string;
    muted: string;
    accent: string;
    secondary: string;
    success: string;
    glow?: string;
  };
}

export interface AccentPalette {
  id: AccentColorId;
  label: string;
  swatchHex: string;
  dark: {
    primary: string;
    hover: string;
    text: string;
    soft: string;
    border: string;
    contrastText: string;
    glow: string;
    chartPrimary: string;
    chartSecondary: string;
  };
  light: {
    primary: string;
    hover: string;
    text: string;
    soft: string;
    border: string;
    contrastText: string;
    glow: string;
    chartPrimary: string;
    chartSecondary: string;
  };
}

export interface ChartThemeTokens {
  appearance: AppearanceMode;
  grid: string;
  axis: string;
  tick: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  tooltipLabel: string;
  primary: string;
  secondary: string;
  tertiary: string;
  success: string;
  warning: string;
  danger: string;
  neutralTrack: string;
  useGradients: boolean;
  animateCharts: boolean;
  barRadius: [number, number, number, number];
}

export const DESIGN_STORAGE_KEY = 'raira_design_studio_v21';

export const DEFAULT_DESIGN_SETTINGS: DesignStudioSettings = {
  themeId: 'mission-control',
  appearance: 'dark',
  accentColor: 'cyan',
  sidebarCollapsed: false,
  layoutDensity: 'spacious',
  chartStyle: 'gradient',
  animations: 'enabled',
};

export const THEME_DEFINITIONS: Record<ThemeId, ThemeDefinition> = {
  'mission-control': {
    id: 'mission-control',
    name: 'AI Mission Control',
    shortName: 'Mission Control',
    tagline: 'High-density dark telemetry & control room',
    description:
      'Dark navy command canvas with electric cyan focus, emerald decision confirmations, blue resource telemetry, and restrained glass surfaces.',
    defaultAppearance: 'dark',
    defaultAccent: 'cyan',
    supportsAppearanceToggle: true,
    appearanceNote: 'Engineered for dark navy control rooms; crisp slate-light variant also available.',
    highlights: ['Dark navy canvas', 'Subtle glassmorphism', 'High-density telemetry'],
    previewPalette: {
      canvas: '#060B14',
      sidebar: '#09101E',
      card: '#0B1221',
      border: '#1E293B',
      text: '#F1F5F9',
      muted: '#94A3B8',
      accent: '#06B6D4',
      secondary: '#3B82F6',
      success: '#10B981',
    },
  },
  'academic-research': {
    id: 'academic-research',
    name: 'Academic Research Studio',
    shortName: 'Academic Studio',
    tagline: 'Publication-grade clarity & crisp typography',
    description:
      'Clean white canvas, soft neutral grey panels, scholarly blue accents, and flat publication-ready tables built for paper figures and peer review.',
    defaultAppearance: 'light',
    defaultAccent: 'blue',
    supportsAppearanceToggle: true,
    appearanceNote: 'Publication white default with optional dark ink reading mode.',
    highlights: ['Clean white paper canvas', 'Publication-style charts', 'Minimal visual effects'],
    previewPalette: {
      canvas: '#FFFFFF',
      sidebar: '#F8FAFC',
      card: '#F8FAFC',
      border: '#D8E0EA',
      text: '#0F172A',
      muted: '#475569',
      accent: '#1D4ED8',
      secondary: '#0369A1',
      success: '#15803D',
    },
  },
  'cyber-lab': {
    id: 'cyber-lab',
    name: 'Cyber Intelligence Lab',
    shortName: 'Cyber Lab',
    tagline: 'Graphite carbon surfaces with violet & neon cyan',
    description:
      'Deep graphite dark laboratory pairing restrained violet and neon cyan accents, luminous hairline borders, sophisticated gradients, and smooth live telemetry.',
    defaultAppearance: 'dark',
    defaultAccent: 'violet',
    supportsAppearanceToggle: false,
    appearanceNote:
      'Dark-locked to preserve violet/cyan border luminance and WCAG chart contrast.',
    highlights: ['Graphite dark surface', 'Subtle glowing borders', 'Animated gradient telemetry'],
    previewPalette: {
      canvas: '#0C0D14',
      sidebar: '#11121D',
      card: '#151726',
      border: '#2A2D46',
      text: '#F3F4FA',
      muted: '#9FA5C2',
      accent: '#8B5CF6',
      secondary: '#22D3EE',
      success: '#34D399',
      glow: 'rgba(139, 92, 246, 0.35)',
    },
  },
  'minimal-enterprise': {
    id: 'minimal-enterprise',
    name: 'Minimal Enterprise',
    shortName: 'Minimal Enterprise',
    tagline: 'Spacious SaaS precision & restrained slate palette',
    description:
      'Airy white and slate-grey dashboard with elevated soft shadows, minimal hairline borders, restrained accent usage, and calm executive hierarchy.',
    defaultAppearance: 'light',
    defaultAccent: 'blue',
    supportsAppearanceToggle: true,
    appearanceNote: 'Supports both crisp light enterprise and neutral slate dark modes.',
    highlights: ['Spacious SaaS layout', 'Subtle soft shadows', 'Restrained colour system'],
    previewPalette: {
      canvas: '#F4F6F9',
      sidebar: '#FFFFFF',
      card: '#FFFFFF',
      border: '#E5E9F0',
      text: '#111827',
      muted: '#64748B',
      accent: '#2563EB',
      secondary: '#0EA5E9',
      success: '#059669',
    },
  },
};

export const THEME_LIST: ThemeDefinition[] = [
  THEME_DEFINITIONS['mission-control'],
  THEME_DEFINITIONS['academic-research'],
  THEME_DEFINITIONS['cyber-lab'],
  THEME_DEFINITIONS['minimal-enterprise'],
];

export const ACCENT_PALETTES: Record<AccentColorId, AccentPalette> = {
  cyan: {
    id: 'cyan',
    label: 'Electric Cyan',
    swatchHex: '#06B6D4',
    dark: {
      primary: '#06B6D4',
      hover: '#22D3EE',
      text: '#22D3EE',
      soft: 'rgba(6, 182, 212, 0.14)',
      border: 'rgba(6, 182, 212, 0.34)',
      contrastText: '#04121C',
      glow: 'rgba(6, 182, 212, 0.28)',
      chartPrimary: '#22D3EE',
      chartSecondary: '#3B82F6',
    },
    light: {
      primary: '#0E7490',
      hover: '#0891B2',
      text: '#0E7490',
      soft: 'rgba(14, 116, 144, 0.10)',
      border: 'rgba(14, 116, 144, 0.30)',
      contrastText: '#FFFFFF',
      glow: 'rgba(14, 116, 144, 0.18)',
      chartPrimary: '#0891B2',
      chartSecondary: '#2563EB',
    },
  },
  blue: {
    id: 'blue',
    label: 'Research Blue',
    swatchHex: '#2563EB',
    dark: {
      primary: '#3B82F6',
      hover: '#60A5FA',
      text: '#60A5FA',
      soft: 'rgba(59, 130, 246, 0.15)',
      border: 'rgba(59, 130, 246, 0.36)',
      contrastText: '#061224',
      glow: 'rgba(59, 130, 246, 0.28)',
      chartPrimary: '#60A5FA',
      chartSecondary: '#22D3EE',
    },
    light: {
      primary: '#1D4ED8',
      hover: '#1E40AF',
      text: '#1D4ED8',
      soft: 'rgba(29, 78, 216, 0.09)',
      border: 'rgba(29, 78, 216, 0.28)',
      contrastText: '#FFFFFF',
      glow: 'rgba(29, 78, 216, 0.16)',
      chartPrimary: '#1D4ED8',
      chartSecondary: '#0284C7',
    },
  },
  violet: {
    id: 'violet',
    label: 'Cyber Violet',
    swatchHex: '#8B5CF6',
    dark: {
      primary: '#7C3AED',
      hover: '#8B5CF6',
      text: '#A78BFA',
      soft: 'rgba(139, 92, 246, 0.16)',
      border: 'rgba(139, 92, 246, 0.38)',
      contrastText: '#FFFFFF',
      glow: 'rgba(139, 92, 246, 0.34)',
      chartPrimary: '#A78BFA',
      chartSecondary: '#22D3EE',
    },
    light: {
      primary: '#6D28D9',
      hover: '#5B21B6',
      text: '#6D28D9',
      soft: 'rgba(109, 40, 217, 0.09)',
      border: 'rgba(109, 40, 217, 0.28)',
      contrastText: '#FFFFFF',
      glow: 'rgba(109, 40, 217, 0.16)',
      chartPrimary: '#7C3AED',
      chartSecondary: '#0891B2',
    },
  },
  emerald: {
    id: 'emerald',
    label: 'Allocation Emerald',
    swatchHex: '#10B981',
    dark: {
      primary: '#10B981',
      hover: '#34D399',
      text: '#34D399',
      soft: 'rgba(16, 185, 129, 0.14)',
      border: 'rgba(16, 185, 129, 0.34)',
      contrastText: '#041C14',
      glow: 'rgba(16, 185, 129, 0.28)',
      chartPrimary: '#34D399',
      chartSecondary: '#38BDF8',
    },
    light: {
      primary: '#047857',
      hover: '#065F46',
      text: '#047857',
      soft: 'rgba(4, 120, 87, 0.10)',
      border: 'rgba(4, 120, 87, 0.28)',
      contrastText: '#FFFFFF',
      glow: 'rgba(4, 120, 87, 0.16)',
      chartPrimary: '#059669',
      chartSecondary: '#0284C7',
    },
  },
};

export const ACCENT_LIST: AccentPalette[] = [
  ACCENT_PALETTES.cyan,
  ACCENT_PALETTES.blue,
  ACCENT_PALETTES.violet,
  ACCENT_PALETTES.emerald,
];

const VALID_THEMES = new Set<ThemeId>([
  'mission-control',
  'academic-research',
  'cyber-lab',
  'minimal-enterprise',
]);
const VALID_APPEARANCES = new Set<AppearanceMode>(['dark', 'light']);
const VALID_ACCENTS = new Set<AccentColorId>(['cyan', 'blue', 'violet', 'emerald']);
const VALID_DENSITIES = new Set<LayoutDensity>(['spacious', 'compact']);
const VALID_CHART_STYLES = new Set<ChartStyleMode>(['standard', 'gradient']);
const VALID_MOTIONS = new Set<MotionPreference>(['enabled', 'reduced']);

export function resolveEffectiveAppearance(
  themeId: ThemeId,
  requestedAppearance: AppearanceMode
): AppearanceMode {
  const def = THEME_DEFINITIONS[themeId];
  if (!def.supportsAppearanceToggle) {
    return def.defaultAppearance;
  }
  return requestedAppearance;
}

export function sanitizeDesignSettings(raw: unknown): DesignStudioSettings {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_DESIGN_SETTINGS };
  }
  const obj = raw as Record<string, unknown>;
  const themeId: ThemeId = VALID_THEMES.has(obj.themeId as ThemeId)
    ? (obj.themeId as ThemeId)
    : DEFAULT_DESIGN_SETTINGS.themeId;

  const requestedAppearance: AppearanceMode = VALID_APPEARANCES.has(
    obj.appearance as AppearanceMode
  )
    ? (obj.appearance as AppearanceMode)
    : THEME_DEFINITIONS[themeId].defaultAppearance;

  const appearance = resolveEffectiveAppearance(themeId, requestedAppearance);

  const accentColor: AccentColorId = VALID_ACCENTS.has(obj.accentColor as AccentColorId)
    ? (obj.accentColor as AccentColorId)
    : THEME_DEFINITIONS[themeId].defaultAccent;

  const sidebarCollapsed =
    typeof obj.sidebarCollapsed === 'boolean'
      ? obj.sidebarCollapsed
      : DEFAULT_DESIGN_SETTINGS.sidebarCollapsed;

  const layoutDensity: LayoutDensity = VALID_DENSITIES.has(obj.layoutDensity as LayoutDensity)
    ? (obj.layoutDensity as LayoutDensity)
    : DEFAULT_DESIGN_SETTINGS.layoutDensity;

  const chartStyle: ChartStyleMode = VALID_CHART_STYLES.has(obj.chartStyle as ChartStyleMode)
    ? (obj.chartStyle as ChartStyleMode)
    : DEFAULT_DESIGN_SETTINGS.chartStyle;

  const animations: MotionPreference = VALID_MOTIONS.has(obj.animations as MotionPreference)
    ? (obj.animations as MotionPreference)
    : DEFAULT_DESIGN_SETTINGS.animations;

  return {
    themeId,
    appearance,
    accentColor,
    sidebarCollapsed,
    layoutDensity,
    chartStyle,
    animations,
  };
}

export function parseDesignSettings(json: string | null): DesignStudioSettings {
  if (!json) return { ...DEFAULT_DESIGN_SETTINGS };
  try {
    return sanitizeDesignSettings(JSON.parse(json));
  } catch {
    return { ...DEFAULT_DESIGN_SETTINGS };
  }
}

export function serializeDesignSettings(settings: DesignStudioSettings): string {
  return JSON.stringify(sanitizeDesignSettings(settings));
}

export function applyThemePreset(
  current: DesignStudioSettings,
  nextThemeId: ThemeId
): DesignStudioSettings {
  const def = THEME_DEFINITIONS[nextThemeId];
  return sanitizeDesignSettings({
    ...current,
    themeId: nextThemeId,
    appearance: def.defaultAppearance,
    accentColor: def.defaultAccent,
    chartStyle:
      nextThemeId === 'academic-research' || nextThemeId === 'minimal-enterprise'
        ? 'standard'
        : 'gradient',
  });
}

interface SurfaceSet {
  canvas: string;
  canvasAccent: string;
  sidebar: string;
  header: string;
  card: string;
  cardHover: string;
  subtle: string;
  input: string;
  borderSubtle: string;
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  cardShadow: string;
  cardRadius: string;
  scrollbarTrack: string;
  scrollbarThumb: string;
}

function getSurfaceTokens(themeId: ThemeId, appearance: AppearanceMode): SurfaceSet {
  if (themeId === 'mission-control') {
    if (appearance === 'dark') {
      return {
        canvas: '#060B14',
        canvasAccent:
          'radial-gradient(ellipse 75% 45% at 50% -15%, rgba(6, 182, 212, 0.08), transparent 70%)',
        sidebar: '#09101E',
        header: 'rgba(6, 11, 20, 0.86)',
        card: 'rgba(11, 18, 33, 0.90)',
        cardHover: 'rgba(15, 23, 42, 0.96)',
        subtle: '#080F1D',
        input: '#070E1A',
        borderSubtle: 'rgba(30, 41, 59, 0.85)',
        borderStrong: '#334155',
        textPrimary: '#F1F5F9',
        textSecondary: '#CBD5E1',
        textMuted: '#94A3B8',
        cardShadow: '0 4px 20px -6px rgba(2, 6, 23, 0.55)',
        cardRadius: '0.75rem',
        scrollbarTrack: '#080F1D',
        scrollbarThumb: '#1E293B',
      };
    }
    return {
      canvas: '#EEF3F9',
      canvasAccent:
        'radial-gradient(ellipse 75% 45% at 50% -15%, rgba(14, 116, 144, 0.07), transparent 70%)',
      sidebar: '#F8FAFD',
      header: 'rgba(248, 250, 253, 0.90)',
      card: '#FFFFFF',
      cardHover: '#F8FAFC',
      subtle: '#F1F5F9',
      input: '#FFFFFF',
      borderSubtle: '#CBD5E1',
      borderStrong: '#94A3B8',
      textPrimary: '#0F172A',
      textSecondary: '#334155',
      textMuted: '#475569',
      cardShadow: '0 2px 10px -2px rgba(15, 23, 42, 0.06)',
      cardRadius: '0.75rem',
      scrollbarTrack: '#E2E8F0',
      scrollbarThumb: '#94A3B8',
    };
  }

  if (themeId === 'academic-research') {
    if (appearance === 'light') {
      return {
        canvas: '#FFFFFF',
        canvasAccent: 'none',
        sidebar: '#F8FAFC',
        header: 'rgba(255, 255, 255, 0.95)',
        card: '#F8FAFC',
        cardHover: '#F1F5F9',
        subtle: '#F1F5F9',
        input: '#FFFFFF',
        borderSubtle: '#D8E0EA',
        borderStrong: '#94A3B8',
        textPrimary: '#0F172A',
        textSecondary: '#334155',
        textMuted: '#475569',
        cardShadow: 'none',
        cardRadius: '0.5rem',
        scrollbarTrack: '#F1F5F9',
        scrollbarThumb: '#CBD5E1',
      };
    }
    return {
      canvas: '#0E1117',
      canvasAccent: 'none',
      sidebar: '#131720',
      header: 'rgba(14, 17, 23, 0.94)',
      card: '#161B26',
      cardHover: '#1D2432',
      subtle: '#11151E',
      input: '#0E1117',
      borderSubtle: '#2A3344',
      borderStrong: '#475569',
      textPrimary: '#F1F5F9',
      textSecondary: '#CBD5E1',
      textMuted: '#94A3B8',
      cardShadow: 'none',
      cardRadius: '0.5rem',
      scrollbarTrack: '#11151E',
      scrollbarThumb: '#334155',
    };
  }

  if (themeId === 'cyber-lab') {
    return {
      canvas: '#0C0D14',
      canvasAccent:
        'radial-gradient(ellipse 80% 48% at 50% -18%, rgba(139, 92, 246, 0.14), rgba(34, 211, 238, 0.04) 45%, transparent 72%)',
      sidebar: '#11121D',
      header: 'rgba(12, 13, 20, 0.88)',
      card: 'linear-gradient(180deg, rgba(23, 25, 42, 0.95) 0%, rgba(17, 19, 32, 0.96) 100%)',
      cardHover: 'rgba(28, 31, 52, 0.98)',
      subtle: '#10121E',
      input: '#0E101B',
      borderSubtle: 'rgba(139, 92, 246, 0.24)',
      borderStrong: 'rgba(34, 211, 238, 0.42)',
      textPrimary: '#F3F4FA',
      textSecondary: '#CED3E8',
      textMuted: '#949BB8',
      cardShadow: '0 0 0 1px rgba(139, 92, 246, 0.10), 0 8px 24px -10px rgba(7, 8, 18, 0.78)',
      cardRadius: '0.875rem',
      scrollbarTrack: '#11121D',
      scrollbarThumb: '#303454',
    };
  }

  // minimal-enterprise
  if (appearance === 'light') {
    return {
      canvas: '#F4F6F9',
      canvasAccent: 'none',
      sidebar: '#FFFFFF',
      header: 'rgba(255, 255, 255, 0.92)',
      card: '#FFFFFF',
      cardHover: '#FAFBFC',
      subtle: '#F8FAFC',
      input: '#FFFFFF',
      borderSubtle: '#E5E9F0',
      borderStrong: '#CBD5E1',
      textPrimary: '#111827',
      textSecondary: '#374151',
      textMuted: '#64748B',
      cardShadow: '0 1px 2px rgba(15, 23, 42, 0.05), 0 6px 16px -6px rgba(15, 23, 42, 0.06)',
      cardRadius: '0.75rem',
      scrollbarTrack: '#F1F5F9',
      scrollbarThumb: '#CBD5E1',
    };
  }

  return {
    canvas: '#0F131A',
    canvasAccent: 'none',
    sidebar: '#141923',
    header: 'rgba(15, 19, 26, 0.92)',
    card: '#181E29',
    cardHover: '#1F2735',
    subtle: '#121720',
    input: '#11161F',
    borderSubtle: '#262F3F',
    borderStrong: '#3B475C',
    textPrimary: '#F3F4F6',
    textSecondary: '#D1D5DB',
    textMuted: '#9CA3AF',
    cardShadow: '0 4px 16px -4px rgba(0, 0, 0, 0.40)',
    cardRadius: '0.75rem',
    scrollbarTrack: '#141923',
    scrollbarThumb: '#334155',
  };
}

export function resolveThemeTokens(
  settings: DesignStudioSettings,
  osPrefersReducedMotion = false
): {
  appearance: AppearanceMode;
  effectiveReducedMotion: boolean;
  cssVars: Record<string, string>;
  chartTheme: ChartThemeTokens;
} {
  const safe = sanitizeDesignSettings(settings);
  const appearance = resolveEffectiveAppearance(safe.themeId, safe.appearance);
  const effectiveReducedMotion = osPrefersReducedMotion || safe.animations === 'reduced';
  const surface = getSurfaceTokens(safe.themeId, appearance);
  const accent = ACCENT_PALETTES[safe.accentColor][appearance];

  const isDark = appearance === 'dark';

  const cssVars: Record<string, string> = {
    '--surface-canvas': surface.canvas,
    '--surface-canvas-accent': surface.canvasAccent,
    '--surface-sidebar': surface.sidebar,
    '--surface-header': surface.header,
    '--surface-card': surface.card,
    '--surface-card-hover': surface.cardHover,
    '--surface-subtle': surface.subtle,
    '--surface-input': surface.input,
    '--border-subtle': surface.borderSubtle,
    '--border-strong': surface.borderStrong,
    '--text-primary': surface.textPrimary,
    '--text-secondary': surface.textSecondary,
    '--text-muted': surface.textMuted,
    '--card-shadow': surface.cardShadow,
    '--radius-card': surface.cardRadius,
    '--scrollbar-track': surface.scrollbarTrack,
    '--scrollbar-thumb': surface.scrollbarThumb,
    '--accent-primary': accent.primary,
    '--accent-hover': accent.hover,
    '--accent-text': accent.text,
    '--accent-soft': accent.soft,
    '--accent-border': accent.border,
    '--accent-contrast-text': accent.contrastText,
    '--accent-glow': accent.glow,
    '--status-success': isDark ? '#34D399' : '#047857',
    '--status-success-soft': isDark ? 'rgba(16, 185, 129, 0.14)' : 'rgba(4, 120, 87, 0.10)',
    '--status-warning': isDark ? '#FBBF24' : '#B45309',
    '--status-warning-soft': isDark ? 'rgba(245, 158, 11, 0.14)' : 'rgba(180, 83, 9, 0.10)',
    '--status-danger': isDark ? '#F87171' : '#B91C1C',
    '--status-danger-soft': isDark ? 'rgba(239, 68, 68, 0.14)' : 'rgba(185, 28, 28, 0.10)',
    '--status-info': isDark ? '#60A5FA' : '#1D4ED8',
    '--status-info-soft': isDark ? 'rgba(59, 130, 246, 0.14)' : 'rgba(29, 78, 216, 0.10)',
    '--space-card': safe.layoutDensity === 'compact' ? '0.875rem' : '1.25rem',
    '--space-section': safe.layoutDensity === 'compact' ? '1rem' : '1.5rem',
    '--space-table-y': safe.layoutDensity === 'compact' ? '0.45rem' : '0.7rem',
  };

  const chartTheme: ChartThemeTokens = {
    appearance,
    grid: isDark
      ? safe.themeId === 'cyber-lab'
        ? '#262A42'
        : '#1E293B'
      : safe.themeId === 'academic-research'
        ? '#E2E8F0'
        : '#E5E7EB',
    axis: isDark ? '#64748B' : '#94A3B8',
    tick: isDark ? '#94A3B8' : '#475569',
    tooltipBg: isDark ? (safe.themeId === 'cyber-lab' ? '#141625' : '#0F172A') : '#FFFFFF',
    tooltipBorder: isDark
      ? safe.themeId === 'cyber-lab'
        ? '#4C3D8F'
        : '#334155'
      : '#CBD5E1',
    tooltipText: isDark ? '#F1F5F9' : '#0F172A',
    tooltipLabel: isDark ? '#94A3B8' : '#475569',
    primary: accent.chartPrimary,
    secondary: accent.chartSecondary,
    tertiary: isDark ? '#A78BFA' : '#7C3AED',
    success: isDark ? '#10B981' : '#059669',
    warning: isDark ? '#F59E0B' : '#D97706',
    danger: isDark ? '#EF4444' : '#DC2626',
    neutralTrack: isDark ? '#1E293B' : '#E2E8F0',
    useGradients: safe.chartStyle === 'gradient',
    animateCharts: !effectiveReducedMotion && safe.themeId === 'cyber-lab',
    barRadius:
      safe.themeId === 'academic-research' ? [2, 2, 0, 0] : [4, 4, 0, 0],
  };

  return {
    appearance,
    effectiveReducedMotion,
    cssVars,
    chartTheme,
  };
}

/**
 * Pure WCAG 2.1 relative luminance and contrast ratio calculator for verifying
 * color accessibility guarantees in automated unit tests.
 */
export function hexToRelativeLuminance(hex: string): number {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const linearize = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

export function contrastRatio(hexA: string, hexB: string): number {
  const lumA = hexToRelativeLuminance(hexA);
  const lumB = hexToRelativeLuminance(hexB);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}
