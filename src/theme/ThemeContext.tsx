import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  applyThemePreset,
  DEFAULT_DESIGN_SETTINGS,
  DESIGN_STORAGE_KEY,
  parseDesignSettings,
  resolveThemeTokens,
  sanitizeDesignSettings,
  serializeDesignSettings,
  THEME_DEFINITIONS,
  type AppearanceMode,
  type ChartThemeTokens,
  type DesignStudioSettings,
  type ThemeDefinition,
  type ThemeId,
} from './themeConfig';

interface ThemeContextValue {
  settings: DesignStudioSettings;
  activeTheme: ThemeDefinition;
  resolvedAppearance: AppearanceMode;
  osPrefersReducedMotion: boolean;
  effectiveReducedMotion: boolean;
  chartTheme: ChartThemeTokens;
  selectTheme: (themeId: ThemeId) => void;
  updateSettings: (partial: Partial<DesignStudioSettings>) => void;
  resetToDefaults: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readInitialSettings(): DesignStudioSettings {
  if (typeof window === 'undefined') {
    return { ...DEFAULT_DESIGN_SETTINGS };
  }
  try {
    return parseDesignSettings(window.localStorage.getItem(DESIGN_STORAGE_KEY));
  } catch {
    return { ...DEFAULT_DESIGN_SETTINGS };
  }
}

function readOsReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<DesignStudioSettings>(readInitialSettings);
  const [osPrefersReducedMotion, setOsPrefersReducedMotion] =
    useState<boolean>(readOsReducedMotion);

  // Sync OS prefers-reduced-motion live changes
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (event: MediaQueryListEvent) => setOsPrefersReducedMotion(event.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const resolved = useMemo(
    () => resolveThemeTokens(settings, osPrefersReducedMotion),
    [settings, osPrefersReducedMotion]
  );

  // Persist to localStorage and apply tokens/attributes to <html>
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.dataset.theme = settings.themeId;
    root.dataset.appearance = resolved.appearance;
    root.dataset.accent = settings.accentColor;
    root.dataset.density = settings.layoutDensity;
    root.dataset.chartStyle = settings.chartStyle;
    root.dataset.motion = resolved.effectiveReducedMotion ? 'reduced' : 'enabled';
    root.classList.toggle('dark', resolved.appearance === 'dark');
    root.style.colorScheme = resolved.appearance;

    for (const [key, value] of Object.entries(resolved.cssVars)) {
      root.style.setProperty(key, value);
    }

    try {
      window.localStorage.setItem(DESIGN_STORAGE_KEY, serializeDesignSettings(settings));
    } catch {
      // Ignore storage quota errors
    }
  }, [settings, resolved]);

  const selectTheme = useCallback((themeId: ThemeId) => {
    setSettings((prev) => applyThemePreset(prev, themeId));
  }, []);

  const updateSettings = useCallback((partial: Partial<DesignStudioSettings>) => {
    setSettings((prev) => sanitizeDesignSettings({ ...prev, ...partial }));
  }, []);

  const resetToDefaults = useCallback(() => {
    setSettings({ ...DEFAULT_DESIGN_SETTINGS });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      settings,
      activeTheme: THEME_DEFINITIONS[settings.themeId],
      resolvedAppearance: resolved.appearance,
      osPrefersReducedMotion,
      effectiveReducedMotion: resolved.effectiveReducedMotion,
      chartTheme: resolved.chartTheme,
      selectTheme,
      updateSettings,
      resetToDefaults,
    }),
    [
      settings,
      resolved,
      osPrefersReducedMotion,
      selectTheme,
      updateSettings,
      resetToDefaults,
    ]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used inside ThemeProvider');
  }
  return ctx;
}
