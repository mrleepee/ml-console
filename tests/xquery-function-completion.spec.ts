import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';

async function launchApp(): Promise<{ app: ElectronApplication; win: Page }> {
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

async function setEditorContent(win: Page, content: string) {
  await win.evaluate((text) => {
    const editor = (window as any).monacoEditorInstance;
    if (editor) {
      editor.setValue(text);
    }
  }, content);
  await win.waitForTimeout(500); // Allow parser to process
}

async function triggerCompletion(win: Page, line: number, column: number) {
  await win.evaluate(({ line, column }) => {
    const editor = (window as any).monacoEditorInstance;
    if (editor) {
      editor.setPosition({ lineNumber: line, column: column });
      editor.trigger('test', 'editor.action.triggerSuggest', {});
    }
  }, { line, column });
  await win.waitForTimeout(500);
}

test.describe('XQuery Function Completion', () => {
  test('suggests local: functions after typing local:', async () => {
    const { app, win } = await launchApp();

    await win.getByText('Query Console').click();
    await win.waitForSelector('.monaco-editor', { timeout: 15000 });

    const xquery = `declare function local:calc-total($price as xs:decimal, $qty as xs:integer) as xs:decimal {
  $price * $qty
};

local:`;

    await setEditorContent(win, xquery);

    // Trigger completion at line 5, after "local:" (column 7)
    await triggerCompletion(win, 5, 7);

    // Check for completion widget
    const completionWidget = win.locator('.monaco-editor .suggest-widget');
    await expect(completionWidget).toBeVisible({ timeout: 5000 });

    // Check for local:calc-total suggestion
    const suggestion = completionWidget.locator('text=local:calc-total');
    await expect(suggestion).toBeVisible();

    await app.close();
  });

  test('does not suggest functions declared after cursor', async () => {
    const { app, win } = await launchApp();

    await win.getByText('Query Console').click();
    await win.waitForSelector('.monaco-editor', { timeout: 15000 });

    const xquery = `local:

declare function local:calc-total($price as xs:decimal) {
  $price * 1.1
};`;

    await setEditorContent(win, xquery);

    // Trigger completion at line 1, after "local:"
    await triggerCompletion(win, 1, 7);

    await win.waitForTimeout(1000);

    const suggestions = await win.evaluate(() => {
      const widget = document.querySelector('.monaco-editor .suggest-widget');
      if (widget) {
        const items = Array.from(widget.querySelectorAll('.monaco-list-row'));
        return items.map(item => item.textContent);
      }
      return [];
    });

    // Should NOT suggest local:calc-total (declared after)
    expect(suggestions).not.toContain('local:calc-total');

    await app.close();
  });

  test('shows function parameter types in completion details', async () => {
    const { app, win } = await launchApp();

    await win.getByText('Query Console').click();
    await win.waitForSelector('.monaco-editor', { timeout: 15000 });

    const xquery = `declare function local:process-item($item as element(), $index as xs:integer) as element() {
  $item
};

local:`;

    await setEditorContent(win, xquery);

    // Trigger completion at line 5, after "local:"
    await triggerCompletion(win, 5, 7);

    await win.waitForTimeout(1000);

    const suggestions = await win.evaluate(() => {
      const widget = document.querySelector('.monaco-editor .suggest-widget');
      if (widget) {
        const rows = Array.from(widget.querySelectorAll('.monaco-list-row'));
        return rows.map(row => ({
          label: row.querySelector('.label-name')?.textContent || '',
          detail: row.textContent || ''
        }));
      }
      return [];
    });

    const funcSuggestion = suggestions.find(s => s.label === 'local:process-item');
    expect(funcSuggestion).toBeDefined();

    // Should show parameter count and return type
    expect(funcSuggestion?.detail).toContain('2 parameters');
    expect(funcSuggestion?.detail).toContain('returns element()');

    await app.close();
  });

  test('inserts function call with parameter placeholders', async () => {
    const { app, win } = await launchApp();

    await win.getByText('Query Console').click();
    await win.waitForSelector('.monaco-editor', { timeout: 15000 });

    const xquery = `declare function local:add($a as xs:decimal, $b as xs:decimal) {
  $a + $b
};

local:`;

    await setEditorContent(win, xquery);

    // Trigger completion at line 5, after "local:"
    await triggerCompletion(win, 5, 7);

    await win.waitForTimeout(1000);

    // Select the completion item
    await win.evaluate(() => {
      const widget = document.querySelector('.monaco-editor .suggest-widget');
      if (widget) {
        const firstItem = widget.querySelector('.monaco-list-row');
        if (firstItem) {
          (firstItem as HTMLElement).click();
        }
      }
    });

    await win.waitForTimeout(500);

    // Get editor content
    const content = await win.evaluate(() => {
      const editor = (window as any).monacoEditorInstance;
      return editor ? editor.getValue() : '';
    });

    // Should have inserted function call with parameters
    expect(content).toContain('local:add($a, $b)');

    await app.close();
  });

  test('shows function signature in completion documentation', async () => {
    const { app, win } = await launchApp();

    await win.getByText('Query Console').click();
    await win.waitForSelector('.monaco-editor', { timeout: 15000 });

    const xquery = `declare function local:format-name($first as xs:string, $last as xs:string) as xs:string {
  concat($last, ", ", $first)
};

local:`;

    await setEditorContent(win, xquery);

    // Trigger completion at line 5, after "local:"
    await triggerCompletion(win, 5, 7);

    await win.waitForTimeout(1000);

    // Check documentation content
    const hasSignature = await win.evaluate(() => {
      const widget = document.querySelector('.monaco-editor .suggest-widget');
      if (widget) {
        // Look for documentation/details panel
        const docs = widget.querySelector('.docs, .documentation, .suggest-details');
        return docs ? docs.textContent?.includes('local:format-name') : false;
      }
      return false;
    });

    // Documentation should show function signature
    expect(hasSignature).toBeTruthy();

    await app.close();
  });

  test('only suggests local: prefixed functions', async () => {
    const { app, win } = await launchApp();

    await win.getByText('Query Console').click();
    await win.waitForSelector('.monaco-editor', { timeout: 15000 });

    const xquery = `declare function local:my-func() { "local" };
declare function other:func() { "other" };

local:`;

    await setEditorContent(win, xquery);

    // Trigger completion at line 4, after "local:"
    await triggerCompletion(win, 4, 7);

    await win.waitForTimeout(1000);

    const suggestions = await win.evaluate(() => {
      const widget = document.querySelector('.monaco-editor .suggest-widget');
      if (widget) {
        const items = Array.from(widget.querySelectorAll('.monaco-list-row .label-name'));
        return items.map(item => item.textContent);
      }
      return [];
    });

    // Should suggest local:my-func but NOT other:func
    expect(suggestions).toContain('local:my-func');
    expect(suggestions).not.toContain('other:func');

    await app.close();
  });

  test('handles functions with no parameters', async () => {
    const { app, win } = await launchApp();

    await win.getByText('Query Console').click();
    await win.waitForSelector('.monaco-editor', { timeout: 15000 });

    const xquery = `declare function local:get-timestamp() as xs:dateTime {
  current-dateTime()
};

local:`;

    await setEditorContent(win, xquery);

    // Trigger completion at line 5, after "local:"
    await triggerCompletion(win, 5, 7);

    await win.waitForTimeout(1000);

    const suggestions = await win.evaluate(() => {
      const widget = document.querySelector('.monaco-editor .suggest-widget');
      if (widget) {
        const rows = Array.from(widget.querySelectorAll('.monaco-list-row'));
        return rows.map(row => ({
          label: row.querySelector('.label-name')?.textContent || '',
          detail: row.textContent || ''
        }));
      }
      return [];
    });

    const funcSuggestion = suggestions.find(s => s.label === 'local:get-timestamp');
    expect(funcSuggestion).toBeDefined();

    // Should show return type but not mention parameters
    expect(funcSuggestion?.detail).toContain('returns xs:dateTime');
    expect(funcSuggestion?.detail).not.toContain('parameters');

    await app.close();
  });

  test('cache invalidates when document is edited', async () => {
    const { app, win } = await launchApp();

    await win.getByText('Query Console').click();
    await win.waitForSelector('.monaco-editor', { timeout: 15000 });

    // Set initial content with one function
    await setEditorContent(win, `declare function local:first() { 1 };

local:`);

    // Trigger completion
    await triggerCompletion(win, 3, 7);
    await win.waitForTimeout(1000);

    let suggestions = await win.evaluate(() => {
      const widget = document.querySelector('.monaco-editor .suggest-widget');
      if (widget) {
        const items = Array.from(widget.querySelectorAll('.monaco-list-row .label-name'));
        return items.map(item => item.textContent);
      }
      return [];
    });

    expect(suggestions).toContain('local:first');

    // Edit document - add another function
    await setEditorContent(win, `declare function local:first() { 1 };
declare function local:second() { 2 };

local:`);

    // Trigger completion again
    await triggerCompletion(win, 4, 7);
    await win.waitForTimeout(1000);

    suggestions = await win.evaluate(() => {
      const widget = document.querySelector('.monaco-editor .suggest-widget');
      if (widget) {
        const items = Array.from(widget.querySelectorAll('.monaco-list-row .label-name'));
        return items.map(item => item.textContent);
      }
      return [];
    });

    // Should now suggest both functions
    expect(suggestions).toContain('local:first');
    expect(suggestions).toContain('local:second');

    await app.close();
  });
});