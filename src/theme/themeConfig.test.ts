import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCENT_LIST,
  applyThemePreset,
  contrastRatio,
  DEFAULT_DESIGN_SETTINGS,
  parseDesignSettings,
  resolveThemeTokens,
  sanitizeDesignSettings,
  serializeDesignSettings,
  THEME_LIST,
} from './themeConfig.ts';

test('defaults to AI Mission Control dark theme with electric cyan accent', () => {
  assert.equal(DEFAULT_DESIGN_SETTINGS.themeId, 'mission-control');
  assert.equal(DEFAULT_DESIGN_SETTINGS.appearance, 'dark');
  assert.equal(DEFAULT_DESIGN_SETTINGS.accentColor, 'cyan');
  assert.equal(THEME_LIST.length, 4);
  assert.equal(ACCENT_LIST.length, 4);
});

test('serialization and parsing preserve all Design Studio settings and recover from corruption', () => {
  const custom = {
    themeId: 'academic-research' as const,
    appearance: 'light' as const,
    accentColor: 'emerald' as const,
    sidebarCollapsed: true,
    layoutDensity: 'compact' as const,
    chartStyle: 'standard' as const,
    animations: 'reduced' as const,
  };
  const json = serializeDesignSettings(custom);
  const restored = parseDesignSettings(json);
  assert.deepEqual(restored, custom);

  assert.deepEqual(parseDesignSettings(null), DEFAULT_DESIGN_SETTINGS);
  assert.deepEqual(parseDesignSettings('{not valid json'), DEFAULT_DESIGN_SETTINGS);
  const sanitized = sanitizeDesignSettings({
    themeId: 'non-existent',
    accentColor: 'neon-pink',
    layoutDensity: 'huge',
  });
  assert.equal(sanitized.themeId, 'mission-control');
  assert.equal(sanitized.accentColor, 'cyan');
  assert.equal(sanitized.layoutDensity, 'spacious');
});

test('Cyber Intelligence Lab enforces dark appearance for contrast safety while other themes support toggling', () => {
  const cyberLightAttempt = sanitizeDesignSettings({
    ...DEFAULT_DESIGN_SETTINGS,
    themeId: 'cyber-lab',
    appearance: 'light',
  });
  assert.equal(cyberLightAttempt.appearance, 'dark');

  const academicDark = sanitizeDesignSettings({
    ...DEFAULT_DESIGN_SETTINGS,
    themeId: 'academic-research',
    appearance: 'dark',
  });
  assert.equal(academicDark.appearance, 'dark');

  const preset = applyThemePreset(DEFAULT_DESIGN_SETTINGS, 'minimal-enterprise');
  assert.equal(preset.themeId, 'minimal-enterprise');
  assert.equal(preset.appearance, 'light');
  assert.equal(preset.chartStyle, 'standard');
});

test('every theme and accent combination guarantees WCAG AA button and chart tooltip contrast (>= 4.5:1)', () => {
  for (const theme of THEME_LIST) {
    const appearances = theme.supportsAppearanceToggle
      ? (['dark', 'light'] as const)
      : ([theme.defaultAppearance] as const);

    for (const appearance of appearances) {
      for (const accent of ACCENT_LIST) {
        const { cssVars, chartTheme } = resolveThemeTokens({
          ...DEFAULT_DESIGN_SETTINGS,
          themeId: theme.id,
          appearance,
          accentColor: accent.id,
        });

        const btnContrast = contrastRatio(
          cssVars['--accent-primary'],
          cssVars['--accent-contrast-text']
        );
        assert.ok(
          btnContrast >= 4.5,
          `Button contrast too low (${btnContrast.toFixed(2)}) for ${theme.id}/${appearance}/${accent.id}`
        );

        const tooltipContrast = contrastRatio(chartTheme.tooltipBg, chartTheme.tooltipText);
        assert.ok(
          tooltipContrast >= 7.0,
          `Tooltip contrast too low (${tooltipContrast.toFixed(2)}) for ${theme.id}/${appearance}`
        );

        const primaryTextContrast = contrastRatio(
          cssVars['--surface-canvas'],
          cssVars['--text-primary']
        );
        assert.ok(
          primaryTextContrast >= 7.0,
          `Canvas text contrast too low (${primaryTextContrast.toFixed(2)}) for ${theme.id}/${appearance}`
        );
      }
    }
  }
});

test('OS reduced motion overrides animation settings cleanly', () => {
  const enabledRes = resolveThemeTokens(
    { ...DEFAULT_DESIGN_SETTINGS, themeId: 'cyber-lab', animations: 'enabled' },
    false
  );
  assert.equal(enabledRes.effectiveReducedMotion, false);
  assert.equal(enabledRes.chartTheme.animateCharts, true);

  const osReducedRes = resolveThemeTokens(
    { ...DEFAULT_DESIGN_SETTINGS, themeId: 'cyber-lab', animations: 'enabled' },
    true
  );
  assert.equal(osReducedRes.effectiveReducedMotion, true);
  assert.equal(osReducedRes.chartTheme.animateCharts, false);
});
