import { test, expect } from '@playwright/test';

const SAMPLE_XQUERY = `
xquery version "3.0-ml";

for $doc in fn:collection("test")
let $meta := $doc//metadata
where $meta/@status = "active"
order by $meta/@created descending
return
  <result>
    <title>{fn:string($doc//title)}</title>
    <count>{fn:count($doc//item)}</count>
  </result>
`;

test.describe('Theme Testing Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3025');
    await page.waitForLoadState('domcontentloaded');

    // Wait for Monaco to be initialized
    await page.waitForFunction(() => window.monaco !== undefined, { timeout: 10000 });

    // Clear any existing content and set test XQuery
    await page.locator('.monaco-editor textarea').fill(SAMPLE_XQUERY);
    await page.waitForTimeout(500); // Allow syntax highlighting to process
  });

  test('should load all available themes without errors', async ({ page }) => {
    // Open theme selector
    await page.locator('[data-testid="theme-selector"]').click();

    // Get all theme options
    const themeOptions = await page.locator('[data-testid="theme-option"]').all();
    expect(themeOptions.length).toBeGreaterThan(50); // Expect 54+ themes

    let successCount = 0;
    let errorCount = 0;

    for (const option of themeOptions) {
      const themeName = await option.getAttribute('data-theme-name');

      // Monitor console errors
      const consoleErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      try {
        // Apply theme
        await option.click();
        await page.waitForTimeout(200);

        // Verify theme applied correctly
        const editorTheme = await page.evaluate(() => {
          const editor = window.monaco?.editor?.getEditors?.()?.[0];
          return editor?._themeService?._theme?.themeName;
        });

        // Check for console errors specific to this theme
        const themeErrors = consoleErrors.filter(error =>
          error.includes(themeName) || error.includes('theme')
        );

        if (themeErrors.length === 0 && editorTheme) {
          successCount++;
          console.log(`✓ Theme "${themeName}" loaded successfully`);
        } else {
          errorCount++;
          console.error(`✗ Theme "${themeName}" failed:`, themeErrors);
        }

        // Reopen selector for next iteration
        if (option !== themeOptions[themeOptions.length - 1]) {
          await page.locator('[data-testid="theme-selector"]').click();
        }

      } catch (error) {
        errorCount++;
        console.error(`✗ Theme "${themeName}" failed with exception:`, error);
      }
    }

    console.log(`Theme testing complete: ${successCount} successful, ${errorCount} failed`);
    expect(errorCount).toBe(0); // No themes should fail to load
    expect(successCount).toBeGreaterThan(50);
  });

  test('should maintain syntax highlighting across theme changes', async ({ page }) => {
    // Test a subset of representative themes
    const testThemes = ['vs', 'vs-dark', 'hc-black', 'monokai', 'github'];

    for (const themeName of testThemes) {
      // Apply theme
      await page.locator('[data-testid="theme-selector"]').click();
      await page.locator(`[data-theme-name="${themeName}"]`).click();
      await page.waitForTimeout(300);

      // Verify XQuery keywords are highlighted
      const keywordElements = await page.locator('.monaco-editor .mtk22, .monaco-editor .keyword').all();
      expect(keywordElements.length).toBeGreaterThan(0);

      // Verify FLWOR keywords specifically
      const editorText = await page.locator('.monaco-editor .view-line').allTextContents();
      const hasFlworKeywords = editorText.some(line =>
        /\b(for|let|where|order|return)\b/.test(line)
      );
      expect(hasFlworKeywords).toBe(true);

      // Verify variables are highlighted
      const variableElements = await page.locator('.monaco-editor .mtk23, .monaco-editor .variable').all();
      expect(variableElements.length).toBeGreaterThan(0);

      console.log(`✓ Syntax highlighting verified for theme: ${themeName}`);
    }
  });

  test('should preserve editor functionality across themes', async ({ page }) => {
    const testThemes = ['vs', 'vs-dark'];

    for (const themeName of testThemes) {
      // Apply theme
      await page.locator('[data-testid="theme-selector"]').click();
      await page.locator(`[data-theme-name="${themeName}"]`).click();
      await page.waitForTimeout(200);

      // Test editing functionality
      await page.locator('.monaco-editor textarea').fill('xquery version "3.0-ml";\nfn:current-dateTime()');
      await page.waitForTimeout(100);

      // Test autocomplete
      await page.locator('.monaco-editor textarea').press('Control+Space');
      await page.waitForTimeout(200);

      // Verify no editor errors
      const hasErrors = await page.locator('.monaco-editor .error, .monaco-editor .squiggly-error').count();
      expect(hasErrors).toBe(0);

      console.log(`✓ Editor functionality verified for theme: ${themeName}`);
    }
  });

  test('should maintain theme when clicking Execute button', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:3025');
    await page.waitForLoadState('domcontentloaded');

    // Wait for Monaco to initialize
    await page.waitForFunction(() => window.monaco !== undefined, { timeout: 10000 });
    await page.waitForTimeout(500);

    // Set Night Owl theme using correct storage key
    await page.evaluate(() => {
      localStorage.setItem('ml-console-monaco-theme', 'Night Owl');
    });
    await page.reload();
    await page.waitForFunction(() => window.monaco !== undefined, { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Verify initial theme is Night Owl
    const initialTheme = await page.evaluate(() => {
      const editor = window.monaco?.editor?.getEditors?.()?.[0];
      return {
        themeName: editor?._themeService?._theme?.themeName,
        backgroundColor: window.getComputedStyle(document.querySelector('.monaco-editor')).backgroundColor
      };
    });

    console.log('Initial theme:', initialTheme);
    expect(initialTheme.themeName).toBe('night-owl');
    expect(initialTheme.backgroundColor).toContain('1, 22, 39'); // Night Owl dark blue

    // Click Execute button
    await page.click('button:has-text("Execute")');
    await page.waitForTimeout(500);

    // Verify theme persisted after Execute click
    const afterExecuteTheme = await page.evaluate(() => {
      const editor = window.monaco?.editor?.getEditors?.()?.[0];
      return {
        themeName: editor?._themeService?._theme?.themeName,
        backgroundColor: window.getComputedStyle(document.querySelector('.monaco-editor')).backgroundColor
      };
    });

    console.log('After Execute theme:', afterExecuteTheme);
    expect(afterExecuteTheme.themeName).toBe('night-owl');
    expect(afterExecuteTheme.backgroundColor).toContain('1, 22, 39');
    expect(afterExecuteTheme.backgroundColor).not.toContain('255, 255'); // Should NOT be white
  });

  test('should maintain theme when navigating between Query Console and Settings', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:3025');
    await page.waitForLoadState('domcontentloaded');

    // Wait for Monaco to initialize
    await page.waitForFunction(() => window.monaco !== undefined, { timeout: 10000 });
    await page.waitForTimeout(500);

    // Set Night Owl theme using correct storage key
    await page.evaluate(() => {
      localStorage.setItem('ml-console-monaco-theme', 'Night Owl');
    });
    await page.reload();
    await page.waitForFunction(() => window.monaco !== undefined, { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Verify initial theme
    const initialTheme = await page.evaluate(() => {
      const editor = window.monaco?.editor?.getEditors?.()?.[0];
      return editor?._themeService?._theme?.themeName;
    });
    expect(initialTheme).toBe('night-owl');

    // Navigate to Settings
    await page.click('button:has-text("Settings")');
    await page.waitForTimeout(500);

    // Navigate back to Query Console
    await page.click('button:has-text("Query Console")');
    await page.waitForTimeout(500);

    // Verify theme persisted after navigation
    const afterNavigationTheme = await page.evaluate(() => {
      const editor = window.monaco?.editor?.getEditors?.()?.[0];
      return {
        themeName: editor?._themeService?._theme?.themeName,
        backgroundColor: window.getComputedStyle(document.querySelector('.monaco-editor')).backgroundColor
      };
    });

    console.log('After navigation theme:', afterNavigationTheme);
    expect(afterNavigationTheme.themeName).toBe('night-owl');
    expect(afterNavigationTheme.backgroundColor).toContain('1, 22, 39');
    expect(afterNavigationTheme.backgroundColor).not.toContain('255, 255');
  });

  test('should generate theme test report', async ({ page }) => {
    // Inject our theme testing framework
    await page.addScriptTag({
      content: `
        window.runThemeTests = async () => {
          if (!window.monaco) return { error: 'Monaco not available' };

          const { createThemeTestSuite } = await import('/src/utils/themeTestFramework.js');
          const suite = createThemeTestSuite(window.monaco);

          await suite.initialize();
          return await suite.runAllThemeTests();
        };
      `
    });

    // Run theme tests
    const report = await page.evaluate(() => window.runThemeTests());

    // Validate report structure
    expect(report).toHaveProperty('summary');
    expect(report.summary).toHaveProperty('totalThemes');
    expect(report.summary).toHaveProperty('successful');
    expect(report.summary).toHaveProperty('failed');

    expect(report).toHaveProperty('tokenStats');
    expect(report).toHaveProperty('snapshots');

    // Verify reasonable success rate
    const successRate = report.summary.successful / report.summary.totalThemes;
    expect(successRate).toBeGreaterThan(0.9); // 90%+ success rate

    console.log('Theme test report:', {
      total: report.summary.totalThemes,
      successful: report.summary.successful,
      failed: report.summary.failed,
      successRate: Math.round(successRate * 100) + '%'
    });
  });
});