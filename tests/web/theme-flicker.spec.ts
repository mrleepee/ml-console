import { test, expect } from '@playwright/test';
import { MonacoHelpers } from '../support/monaco-helpers';
import { ThemeHelpers } from '../support/theme-helpers';
import { selectors } from '../support/selectors';

/**
 * Visual Regression Tests for Theme Flicker
 *
 * These tests catch the theme flicker bug that was recently fixed:
 * - Theme temporarily flashing to default (vs-dark) during operations
 * - Theme not persisting after navigation
 * - Default theme visible during page load
 *
 * Uses 50ms sampling intervals per Codex recommendation for accurate flicker detection.
 */

test.describe('Theme Stability - Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:1420');
  });

  test('theme does not flicker during query execution @smoke', async ({ page }) => {
    const monaco = new MonacoHelpers(page);
    const themes = new ThemeHelpers(page);

    // Wait for initial load
    await monaco.waitForMonacoEditor();

    // Navigate to settings and select Night Owl theme
    await page.click(selectors.settingsTab);
    await page.waitForSelector(selectors.settingsTitle, { timeout: 10000 });
    await themes.selectTheme('Night Owl');

    // Go to Query Console
    await page.click(selectors.queryConsoleTab);
    await monaco.waitForMonacoEditor();

    // Get baseline theme color
    const baselineColor = await monaco.getThemeBackgroundColor();
    console.log('Baseline theme color:', baselineColor);

    // Type a query
    await monaco.setEditorValue('1+1');

    // Start monitoring theme stability BEFORE executing query
    const stabilityCheck = monaco.pollThemeStability(3000, 50);

    // Execute query
    await page.click(selectors.executeButton);

    // Wait for execution to settle
    await page.waitForTimeout(2000);

    // Get stability results
    const { isStable, uniqueColors, flickerDetected } = await stabilityCheck;

    console.log('Theme stability results:', {
      isStable,
      uniqueColors,
      flickerDetected,
      sampleCount: uniqueColors.length
    });

    // Assert no flicker occurred
    expect(flickerDetected,
      `Detected flash of white/default theme. Colors seen: ${uniqueColors.join(', ')}`
    ).toBe(false);

    expect(isStable,
      `Theme was not stable during execution. Multiple colors detected: ${uniqueColors.join(', ')}`
    ).toBe(true);

    // Verify we're still on the selected theme
    const finalColor = await monaco.getThemeBackgroundColor();
    expect(finalColor).toBe(baselineColor);
  });

  test('theme persists after navigation between tabs', async ({ page }) => {
    const monaco = new MonacoHelpers(page);
    const themes = new ThemeHelpers(page);

    await page.waitForSelector(selectors.appTitle);

    // Set Dracula theme
    await page.click(selectors.settingsTab);
    await page.waitForSelector(selectors.settingsTitle);
    await themes.selectTheme('Dracula');

    const selectedTheme = await themes.getCurrentTheme();
    console.log('Selected theme:', selectedTheme);
    expect(selectedTheme).toContain('Dracula');

    // Navigate to Query Console
    await page.click(selectors.queryConsoleTab);
    await monaco.waitForMonacoEditor();
    await page.waitForTimeout(1000);

    // Navigate back to Settings
    await page.click(selectors.settingsTab);
    await page.waitForTimeout(1000);

    // Verify theme persisted
    const persistedTheme = await themes.getCurrentTheme();
    console.log('Persisted theme:', persistedTheme);
    expect(persistedTheme).toBe(selectedTheme);

    // Verify in localStorage
    await themes.verifyThemeInLocalStorage(selectedTheme);
  });

  test('no flash of default theme on page load @smoke', async ({ page }) => {
    const monaco = new MonacoHelpers(page);
    const themes = new ThemeHelpers(page);

    // Set dark theme first
    await page.goto('http://localhost:1420');
    await page.click(selectors.settingsTab);
    await page.waitForSelector(selectors.settingsTitle);
    await themes.selectTheme('GitHub Dark');

    // Verify theme is set
    const selectedTheme = await themes.getCurrentTheme();
    console.log('Set theme before reload:', selectedTheme);

    // Start monitoring immediately, then reload
    const colorSamples: string[] = [];
    let monitoringActive = true;

    // Start background monitoring
    const monitoringPromise = (async () => {
      while (monitoringActive) {
        try {
          const color = await monaco.getThemeBackgroundColor();
          colorSamples.push(color);
        } catch (e) {
          // Editor not ready yet, continue monitoring
        }
        await page.waitForTimeout(50);
      }
      return colorSamples;
    })();

    // Reload the page
    await page.reload();

    // Wait for editor to load
    await monaco.waitForMonacoEditor();
    await page.waitForTimeout(2000);

    // Stop monitoring
    monitoringActive = false;
    await monitoringPromise;

    console.log('Color samples during load:', colorSamples);
    console.log('Unique colors:', [...new Set(colorSamples)]);

    // Check if we saw white/light default theme flash
    const hasWhiteFlash = colorSamples.some(color =>
      color.includes('rgb(255, 255, 255)') ||
      color.includes('rgb(250, 250, 250)') ||
      color.includes('rgb(255,255,255)') ||
      color.includes('rgb(250,250,250)')
    );

    expect(hasWhiteFlash,
      `Detected flash of default light theme during page load. Colors: ${[...new Set(colorSamples)].join(', ')}`
    ).toBe(false);
  });

  test('theme remains stable during rapid navigation', async ({ page }) => {
    const monaco = new MonacoHelpers(page);
    const themes = new ThemeHelpers(page);

    // Set a theme
    await page.click(selectors.settingsTab);
    await themes.selectTheme('Monokai Bright');
    const selectedTheme = await themes.getCurrentTheme();

    // Rapidly switch between tabs
    for (let i = 0; i < 5; i++) {
      await page.click(selectors.queryConsoleTab);
      await page.waitForTimeout(100);
      await page.click(selectors.settingsTab);
      await page.waitForTimeout(100);
    }

    // Verify theme is still correct
    const finalTheme = await themes.getCurrentTheme();
    expect(finalTheme).toBe(selectedTheme);
  });

  test('theme stays consistent across multiple query executions', async ({ page }) => {
    const monaco = new MonacoHelpers(page);
    const themes = new ThemeHelpers(page);

    // Set theme
    await page.click(selectors.settingsTab);
    await themes.selectTheme('Nord');

    // Go to query console
    await page.click(selectors.queryConsoleTab);
    await monaco.waitForMonacoEditor();

    const baselineColor = await monaco.getThemeBackgroundColor();

    // Execute multiple queries and check stability each time
    for (let i = 0; i < 3; i++) {
      await monaco.setEditorValue(`${i + 1} + ${i + 1}`);

      const { isStable, flickerDetected } = await monaco.pollThemeStability(1500, 50);

      await page.click(selectors.executeButton);
      await page.waitForTimeout(1000);

      expect(isStable, `Theme flickered during query ${i + 1}`).toBe(true);
      expect(flickerDetected, `White flash detected during query ${i + 1}`).toBe(false);

      const currentColor = await monaco.getThemeBackgroundColor();
      expect(currentColor).toBe(baselineColor);
    }
  });

  test('theme selector dropdown works without errors', async ({ page }) => {
    const themes = new ThemeHelpers(page);

    await page.click(selectors.settingsTab);

    // Verify theme selector is functional
    await themes.verifyThemeSelectorWorking();

    // Try searching for a theme
    await page.click(selectors.themeSelector);
    await page.fill(selectors.themeSearch, 'Dark');
    await page.waitForTimeout(500);

    // Should show multiple dark themes
    const darkThemeCount = await page.locator('button:has-text("Dark")').count();
    expect(darkThemeCount).toBeGreaterThan(0);

    // Close dropdown
    await page.keyboard.press('Escape');
  });
});
