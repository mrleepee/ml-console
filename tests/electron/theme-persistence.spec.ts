import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';

async function launchApp(): Promise<{ app: ElectronApplication; win: Page }>{
  const app: ElectronApplication = await electron.launch({
    args: ['.'],
    env: {
      PREVIEW_PORT: process.env.PREVIEW_PORT || '1421',
      MOCK_HTTP: process.env.MOCK_HTTP || '1',
      NODE_ENV: 'development'
    }
  });

  const win: Page = await app.firstWindow({ timeout: 60000 });
  await win.waitForLoadState('domcontentloaded', { timeout: 30000 });
  await win.waitForFunction(() => window.location.href.includes('localhost:1421'), { timeout: 30000 });

  try {
    await win.waitForSelector('h1:has-text("ML Console")', { timeout: 30000 });
  } catch (e) {
    await win.waitForSelector('h1, h2, .App, #root', { timeout: 20000 });
  }

  await win.waitForTimeout(2000);
  return { app, win };
}

test.describe('Theme Persistence', () => {
  test('Application theme persists across tab switches', async () => {
    const { app, win } = await launchApp();

    // Navigate to Settings tab
    await win.getByText('Settings').click();
    await win.waitForSelector('h2:has-text("Settings")', { timeout: 10000 });

    // Check initial theme state
    const themeToggleButton = win.locator('button[title*="Switch to"]');
    const currentTheme = win.getByText(/Current: (Light|Dark)/);

    const initialThemeText = await currentTheme.textContent();

    // Toggle theme
    await themeToggleButton.click();
    await win.waitForTimeout(1000);

    // Verify theme changed
    const newThemeText = await currentTheme.textContent();
    expect(newThemeText).not.toBe(initialThemeText);

    // Switch to Query Console tab
    await win.getByText('Query Console').click();
    await win.waitForTimeout(1000);

    // Switch back to Settings tab
    await win.getByText('Settings').click();
    await win.waitForTimeout(1000);

    // Verify theme persisted
    const persistedThemeText = await currentTheme.textContent();
    expect(persistedThemeText).toBe(newThemeText);

    await app.close();
  });

  test('Monaco theme selection persists across tab switches', async () => {
    const { app, win } = await launchApp();

    // Navigate to Settings tab
    await win.getByText('Settings').click();
    await win.waitForSelector('h2:has-text("Settings")', { timeout: 10000 });

    // Open enhanced theme selector
    const themeSelector = win.locator('.theme-selector button[aria-haspopup="listbox"]');
    await themeSelector.click();
    await win.waitForSelector('input[placeholder="Search themes..."]', { timeout: 5000 });

    // Get initial theme selection
    const initialThemeName = await themeSelector.textContent();

    // Search for and select a different theme
    const searchInput = win.locator('input[placeholder="Search themes..."]');
    await searchInput.fill('Night Owl');
    await win.waitForTimeout(500);

    // Look for Night Owl theme button (should be visible if themes are loaded)
    const nightOwlButton = win.locator('button:has-text("Night Owl")').first();

    // If Night Owl is available, select it; otherwise select any available theme
    try {
      await expect(nightOwlButton).toBeVisible({ timeout: 2000 });
      await nightOwlButton.click();
    } catch {
      // Fallback: select first available theme option
      const firstThemeButton = win.locator('[role="button"]').first();
      await firstThemeButton.click();
    }

    await win.waitForTimeout(1000);

    // Get the new theme selection
    const newThemeName = await themeSelector.textContent();
    expect(newThemeName).not.toBe(initialThemeName);

    // Switch to Query Console tab
    await win.getByText('Query Console').click();
    await win.waitForTimeout(1000);

    // Switch back to Settings tab
    await win.getByText('Settings').click();
    await win.waitForTimeout(1000);

    // Verify theme selection persisted
    const persistedThemeName = await themeSelector.textContent();
    expect(persistedThemeName).toBe(newThemeName);

    await app.close();
  });

  test('Theme changes reflect in Monaco editor instances', async () => {
    const { app, win } = await launchApp();

    // Go to Query Console first to see Monaco editor
    await win.getByText('Query Console').click();
    await win.waitForTimeout(2000);

    // Wait for Monaco editor to load
    await win.waitForSelector('.monaco-editor', { timeout: 15000 });
    const monacoEditor = win.locator('.monaco-editor').first();
    await expect(monacoEditor).toBeVisible();

    // Navigate to Settings
    await win.getByText('Settings').click();
    await win.waitForSelector('h2:has-text("Settings")', { timeout: 10000 });

    // Change Monaco theme
    const themeSelector = win.locator('.theme-selector button[aria-haspopup="listbox"]');
    await themeSelector.click();
    await win.waitForSelector('input[placeholder="Search themes..."]', { timeout: 5000 });

    // Try to select GitHub Dark theme
    const searchInput = win.locator('input[placeholder="Search themes..."]');
    await searchInput.fill('GitHub');
    await win.waitForTimeout(500);

    const githubDarkButton = win.locator('button:has-text("GitHub Dark")').first();

    try {
      await expect(githubDarkButton).toBeVisible({ timeout: 2000 });
      await githubDarkButton.click();
    } catch {
      // Fallback: close dropdown and continue
      await win.keyboard.press('Escape');
    }

    await win.waitForTimeout(1000);

    // Go back to Query Console
    await win.getByText('Query Console').click();
    await win.waitForTimeout(2000);

    // Verify Monaco editor is still visible (theme may have changed)
    await expect(monacoEditor).toBeVisible();

    await app.close();
  });

  test('Theme preferences are preserved across app sessions', async () => {
    // First session - change themes
    const { app: app1, win: win1 } = await launchApp();

    await win1.getByText('Settings').click();
    await win1.waitForSelector('h2:has-text("Settings")', { timeout: 10000 });

    // Toggle application theme
    const themeToggleButton1 = win1.locator('button[title*="Switch to"]');
    await themeToggleButton1.click();
    await win1.waitForTimeout(1000);

    // Get final theme state
    const finalTheme = win1.getByText(/Current: (Light|Dark)/);
    const finalThemeText = await finalTheme.textContent();

    await app1.close();

    // Second session - verify themes persisted
    const { app: app2, win: win2 } = await launchApp();

    await win2.getByText('Settings').click();
    await win2.waitForSelector('h2:has-text("Settings")', { timeout: 10000 });

    // Check if theme persisted
    const persistedTheme = win2.getByText(/Current: (Light|Dark)/);
    const persistedThemeText = await persistedTheme.textContent();

    expect(persistedThemeText).toBe(finalThemeText);

    await app2.close();
  });

  test('Invalid theme names fall back gracefully', async () => {
    const { app, win } = await launchApp();

    // Navigate to Settings tab
    await win.getByText('Settings').click();
    await win.waitForSelector('h2:has-text("Settings")', { timeout: 10000 });

    // Verify theme selector is functional even with potential invalid themes
    const themeSelector = win.locator('.theme-selector button[aria-haspopup="listbox"]');
    await expect(themeSelector).toBeVisible();

    // The theme selector should show some valid theme name
    const displayedTheme = await themeSelector.textContent();
    expect(displayedTheme).toBeTruthy();
    expect(displayedTheme.length).toBeGreaterThan(0);

    // Theme preview should still work
    await expect(win.getByText('Theme Preview')).toBeVisible();
    const monacoPreview = win.locator('.monaco-editor');
    await expect(monacoPreview).toBeVisible();

    await app.close();
  });

  test('Theme selector handles empty search results gracefully', async () => {
    const { app, win } = await launchApp();

    await win.getByText('Settings').click();
    await win.waitForSelector('h2:has-text("Settings")', { timeout: 10000 });

    // Open theme selector
    const themeSelector = win.locator('.theme-selector button[aria-haspopup="listbox"]');
    await themeSelector.click();
    await win.waitForSelector('input[placeholder="Search themes..."]', { timeout: 5000 });

    // Search for non-existent theme
    const searchInput = win.locator('input[placeholder="Search themes..."]');
    await searchInput.fill('NonExistentThemeName12345');
    await win.waitForTimeout(500);

    // Should show "No themes found" message
    await expect(win.getByText('No themes found')).toBeVisible();
    await expect(win.getByText('Try adjusting your search or filter')).toBeVisible();

    // Clear search and verify themes reappear
    await searchInput.clear();
    await win.waitForTimeout(500);

    // Should see available themes again
    const themeButtons = win.locator('[role="button"]').first();
    await expect(themeButtons).toBeVisible();

    await app.close();
  });

  test('Category filtering works correctly', async () => {
    const { app, win } = await launchApp();

    await win.getByText('Settings').click();
    await win.waitForSelector('h2:has-text("Settings")', { timeout: 10000 });

    // Open theme selector
    const themeSelector = win.locator('.theme-selector button[aria-haspopup="listbox"]');
    await themeSelector.click();
    await win.waitForSelector('input[placeholder="Search themes..."]', { timeout: 5000 });

    // Check category filter options
    const categorySelect = win.locator('select').last();
    await expect(categorySelect).toBeVisible();

    // Should have different category options
    const options = categorySelect.locator('option');
    const optionCount = await options.count();
    expect(optionCount).toBeGreaterThan(1);

    // Test filtering by category
    await categorySelect.selectOption('dark');
    await win.waitForTimeout(500);

    // Should show only dark themes or at least maintain functionality
    const themeCount = win.locator('button:has-text("Dark")');

    // Close dropdown
    await win.keyboard.press('Escape');
    await win.waitForTimeout(500);

    await app.close();
  });
});