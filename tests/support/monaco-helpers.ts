import { Page, expect } from '@playwright/test';
import { selectors, waitConditions } from './selectors';

/**
 * Helper class for interacting with Monaco Editor in Playwright tests
 *
 * IMPORTANT: All methods that access window.monaco include safety guards
 * to ensure Monaco is loaded before attempting to interact with it.
 */
export class MonacoHelpers {
  constructor(private page: Page) {}

  /**
   * Wait for Monaco editor to be fully loaded and ready
   * @param timeout Maximum time to wait in milliseconds
   */
  async waitForMonacoEditor(timeout = 15000) {
    // Wait for Monaco editor DOM element
    await this.page.waitForSelector(selectors.monacoEditor, { timeout });

    // Wait for Monaco API to be available
    await this.page.waitForFunction(waitConditions.monacoReady, { timeout });

    // Small delay to ensure editor is fully initialized
    await this.page.waitForTimeout(500);
  }

  /**
   * Safety guard: Check if Monaco is available
   * @private
   */
  private async ensureMonacoReady() {
    const isReady = await this.page.evaluate(() => {
      return !!(window.monaco?.editor && window.monaco.editor.getEditors().length > 0);
    });

    if (!isReady) {
      throw new Error('Monaco editor is not ready. Call waitForMonacoEditor() first.');
    }
  }

  /**
   * Get the current value/content of the Monaco editor
   */
  async getEditorValue(): Promise<string> {
    await this.ensureMonacoReady();
    return await this.page.evaluate(() => {
      const editor = window.monaco.editor.getEditors()[0];
      return editor?.getValue() || '';
    });
  }

  /**
   * Set the value/content of the Monaco editor
   * @param value Text content to set
   */
  async setEditorValue(value: string) {
    await this.ensureMonacoReady();
    await this.page.evaluate((text) => {
      const editor = window.monaco.editor.getEditors()[0];
      if (editor) {
        editor.setValue(text);
      }
    }, value);
  }

  /**
   * Get the current font size setting from Monaco editor
   */
  async getFontSize(): Promise<number | undefined> {
    await this.ensureMonacoReady();
    return await this.page.evaluate(() => {
      const editor = window.monaco.editor.getEditors()[0];
      if (!editor) return undefined;

      const options = editor.getOptions();
      return options?.get(monaco.editor.EditorOption.fontSize);
    });
  }

  /**
   * Get the background color of the Monaco editor
   * This is useful for detecting theme changes and flicker
   */
  async getThemeBackgroundColor(): Promise<string> {
    const editorElement = await this.page.locator(selectors.monacoEditor).first();
    await expect(editorElement).toBeVisible();

    return await this.page.evaluate(() => {
      const editor = document.querySelector('.monaco-editor') as HTMLElement;
      if (!editor) return '';
      return window.getComputedStyle(editor).backgroundColor;
    });
  }

  /**
   * Get the current theme ID from Monaco
   */
  async getCurrentTheme(): Promise<string | undefined> {
    await this.ensureMonacoReady();
    return await this.page.evaluate(() => {
      // Monaco doesn't expose current theme directly, check DOM classes
      const editor = document.querySelector('.monaco-editor');
      if (!editor) return undefined;

      const classList = Array.from(editor.classList);
      // Theme classes typically follow pattern: vs, vs-dark, or custom theme names
      const themeClass = classList.find(cls => cls.startsWith('vs') || !cls.includes('monaco'));
      return themeClass;
    });
  }

  /**
   * Poll the theme background color over time to detect flicker
   *
   * Samples the background color at regular intervals and returns stability metrics.
   * Useful for detecting visual regressions where theme briefly flashes to default.
   *
   * @param durationMs Total duration to monitor in milliseconds
   * @param sampleIntervalMs Interval between samples in milliseconds (default: 50ms per Codex recommendation)
   * @returns Object with stability metrics and color samples
   */
  async pollThemeStability(durationMs = 2000, sampleIntervalMs = 50): Promise<{
    isStable: boolean;
    samples: string[];
    uniqueColors: string[];
    flickerDetected: boolean;
  }> {
    const samples: string[] = [];
    const startTime = Date.now();

    while (Date.now() - startTime < durationMs) {
      try {
        const bgColor = await this.getThemeBackgroundColor();
        samples.push(bgColor);
      } catch (e) {
        // Editor might not be visible during this sample
        samples.push('error');
      }
      await this.page.waitForTimeout(sampleIntervalMs);
    }

    // Filter out error samples
    const validSamples = samples.filter(s => s !== 'error');
    const uniqueColors = [...new Set(validSamples)];

    // Check for flicker: more than one unique color means theme changed
    const isStable = uniqueColors.length === 1;

    // Check if we saw white/light default theme (common flicker issue)
    const flickerDetected = uniqueColors.some(color =>
      color.includes('rgb(255, 255, 255)') ||
      color.includes('rgb(250, 250, 250)') ||
      color.includes('rgb(255,255,255)') ||
      color.includes('rgb(250,250,250)')
    );

    return {
      isStable,
      samples: validSamples,
      uniqueColors,
      flickerDetected
    };
  }

  /**
   * Get line numbers setting
   */
  async getLineNumbers(): Promise<string | undefined> {
    await this.ensureMonacoReady();
    return await this.page.evaluate(() => {
      const editor = window.monaco.editor.getEditors()[0];
      if (!editor) return undefined;

      const options = editor.getOptions();
      const lineNumbers = options?.get(monaco.editor.EditorOption.lineNumbers);
      return lineNumbers?.renderType === 1 ? 'on' : 'off';
    });
  }

  /**
   * Get word wrap setting
   */
  async getWordWrap(): Promise<string | undefined> {
    await this.ensureMonacoReady();
    return await this.page.evaluate(() => {
      const editor = window.monaco.editor.getEditors()[0];
      if (!editor) return undefined;

      const options = editor.getOptions();
      return options?.get(monaco.editor.EditorOption.wordWrap);
    });
  }

  /**
   * Check if minimap is enabled
   */
  async isMinimapEnabled(): Promise<boolean> {
    await this.ensureMonacoReady();
    return await this.page.evaluate(() => {
      const editor = window.monaco.editor.getEditors()[0];
      if (!editor) return false;

      const options = editor.getOptions();
      const minimap = options?.get(monaco.editor.EditorOption.minimap);
      return minimap?.enabled || false;
    });
  }

  /**
   * Get the number of visible Monaco editors on the page
   */
  async getEditorCount(): Promise<number> {
    return await this.page.evaluate(() => {
      return window.monaco?.editor?.getEditors()?.length || 0;
    });
  }

  /**
   * Take a screenshot of the Monaco editor only
   * @param filename Optional filename for the screenshot
   */
  async screenshotEditor(filename?: string) {
    const editorElement = await this.page.locator(selectors.monacoEditor).first();
    await expect(editorElement).toBeVisible();

    if (filename) {
      return await editorElement.screenshot({ path: filename });
    }
    return await editorElement.screenshot();
  }
}
