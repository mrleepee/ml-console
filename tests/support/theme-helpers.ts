import { Page, expect } from '@playwright/test';
import { selectors } from './selectors';

/**
 * Helper class for theme-related operations in Playwright tests
 */
export class ThemeHelpers {
  constructor(private page: Page) {}

  /**
   * Select a theme from the theme selector dropdown
   * @param themeName Name of the theme to select (e.g., "Night Owl", "Dracula")
   */
  async selectTheme(themeName: string) {
    // Open theme selector
    await this.page.click(selectors.themeSelector);

    // Wait for search input to appear
    await this.page.waitForSelector(selectors.themeSearch, { timeout: 5000 });

    // Search for the theme
    await this.page.fill(selectors.themeSearch, themeName);
    await this.page.waitForTimeout(300);

    // Click the theme button
    const themeButton = this.page.locator(selectors.themeButton(themeName)).first();
    await expect(themeButton).toBeVisible({ timeout: 2000 });
    await themeButton.click();

    // Wait for theme to apply
    await this.page.waitForTimeout(500);
  }

  /**
   * Get the currently displayed theme name from the theme selector
   */
  async getCurrentTheme(): Promise<string> {
    const themeSelector = this.page.locator(selectors.themeSelector);
    await expect(themeSelector).toBeVisible();

    const themeName = await themeSelector.textContent();
    return themeName?.trim() || '';
  }

  /**
   * Verify theme is persisted in localStorage
   * @param expectedTheme Expected theme name in storage
   */
  async verifyThemeInLocalStorage(expectedTheme: string) {
    const storedTheme = await this.page.evaluate(() => {
      return localStorage.getItem('monacoTheme');
    });

    expect(storedTheme).toBe(expectedTheme);
  }

  /**
   * Clear all theme-related storage
   */
  async clearThemeStorage() {
    await this.page.evaluate(() => {
      localStorage.removeItem('monacoTheme');
      localStorage.removeItem('editorPreferences');
      localStorage.removeItem('appTheme');
    });
  }

  /**
   * Get the current application theme (Light/Dark)
   */
  async getAppTheme(): Promise<'Light' | 'Dark' | null> {
    try {
      const themeDisplay = await this.page.locator(selectors.appThemeDisplay).textContent();
      if (themeDisplay?.includes('Light')) return 'Light';
      if (themeDisplay?.includes('Dark')) return 'Dark';
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Toggle the application theme (Light ↔ Dark)
   */
  async toggleAppTheme() {
    await this.page.click(selectors.appThemeToggle);
    await this.page.waitForTimeout(500);
  }

  /**
   * Get list of available themes from the dropdown
   */
  async getAvailableThemes(): Promise<string[]> {
    // Open theme selector
    await this.page.click(selectors.themeSelector);
    await this.page.waitForSelector(selectors.themeSearch, { timeout: 5000 });

    // Get all theme buttons
    const themeButtons = await this.page.locator('button[role="button"]').allTextContents();

    // Close dropdown
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(300);

    return themeButtons.map(t => t.trim()).filter(t => t.length > 0);
  }

  /**
   * Verify theme selector is functional and shows valid theme
   */
  async verifyThemeSelectorWorking() {
    const themeSelector = this.page.locator(selectors.themeSelector);
    await expect(themeSelector).toBeVisible();

    const displayedTheme = await themeSelector.textContent();
    expect(displayedTheme).toBeTruthy();
    expect(displayedTheme!.length).toBeGreaterThan(0);

    // Verify we can open the dropdown
    await themeSelector.click();
    await expect(this.page.locator(selectors.themeSearch)).toBeVisible({ timeout: 2000 });

    // Close it
    await this.page.keyboard.press('Escape');
  }

  /**
   * Check if a specific theme is available in the dropdown
   * @param themeName Theme name to search for
   */
  async isThemeAvailable(themeName: string): Promise<boolean> {
    // Open theme selector
    await this.page.click(selectors.themeSelector);
    await this.page.waitForSelector(selectors.themeSearch, { timeout: 5000 });

    // Search for the theme
    await this.page.fill(selectors.themeSearch, themeName);
    await this.page.waitForTimeout(300);

    // Check if theme button is visible
    const themeButton = this.page.locator(selectors.themeButton(themeName)).first();
    const isVisible = await themeButton.isVisible().catch(() => false);

    // Close dropdown
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(300);

    return isVisible;
  }

  /**
   * Get the number of themes shown after applying a filter/search
   * @param searchTerm Search term to filter by
   */
  async getFilteredThemeCount(searchTerm: string): Promise<number> {
    // Open theme selector
    await this.page.click(selectors.themeSelector);
    await this.page.waitForSelector(selectors.themeSearch, { timeout: 5000 });

    // Apply search filter
    await this.page.fill(selectors.themeSearch, searchTerm);
    await this.page.waitForTimeout(500);

    // Count visible theme buttons
    const visibleThemes = await this.page.locator('button[role="button"]').count();

    // Close dropdown
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(300);

    return visibleThemes;
  }

  /**
   * Verify theme preview is visible and working
   */
  async verifyThemePreviewVisible() {
    const preview = this.page.locator(selectors.themePreview);
    await expect(preview).toBeVisible({ timeout: 5000 });
  }

  /**
   * Get the computed background color of the theme preview
   */
  async getThemePreviewBackgroundColor(): Promise<string> {
    return await this.page.evaluate(() => {
      const preview = document.querySelector('.monaco-editor.theme-preview') as HTMLElement;
      if (!preview) return '';
      return window.getComputedStyle(preview).backgroundColor;
    });
  }
}
