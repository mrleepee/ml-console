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

test.describe('XQuery Scope-Based Completion', () => {
  test('suggests let variables in scope', async () => {
    const { app, win } = await launchApp();

    await win.getByText('Query Console').click();
    await win.waitForSelector('.monaco-editor', { timeout: 15000 });

    // Set XQuery content with let binding
    await setEditorContent(win, `let $myVar := "test"\nreturn $`);

    // Trigger completion at line 2, column 8 (after $)
    await triggerCompletion(win, 2, 8);

    // Check for completion widget
    const completionWidget = win.locator('.monaco-editor .suggest-widget');
    await expect(completionWidget).toBeVisible({ timeout: 5000 });

    // Check for $myVar suggestion
    const suggestion = completionWidget.locator('text=$myVar');
    await expect(suggestion).toBeVisible();

    await app.close();
  });

  test('does not suggest variables out of scope', async () => {
    const { app, win } = await launchApp();

    await win.getByText('Query Console').click();
    await win.waitForSelector('.monaco-editor', { timeout: 15000 });

    // Variable declared inside FLWOR should not be accessible outside
    const xquery = `let $outer := 1
for $item in 1 to 3
let $inner := $item * 2
return $item

(: Try to use $inner here - should not be suggested :)
return $`;

    await setEditorContent(win, xquery);

    // Trigger completion at line 7, after $
    await triggerCompletion(win, 7, 8);

    // Wait for completion widget
    await win.waitForTimeout(1000);

    // Verify $outer is suggested but $inner is not
    const suggestions = await win.evaluate(() => {
      const widget = document.querySelector('.monaco-editor .suggest-widget');
      if (widget) {
        const items = Array.from(widget.querySelectorAll('.monaco-list-row'));
        return items.map(item => item.textContent);
      }
      return [];
    });

    expect(suggestions).toContain('$outer');
    expect(suggestions).not.toContain('$inner');
    expect(suggestions).not.toContain('$item');

    await app.close();
  });

  test('suggests function parameters within function body', async () => {
    const { app, win } = await launchApp();

    await win.getByText('Query Console').click();
    await win.waitForSelector('.monaco-editor', { timeout: 15000 });

    const xquery = `declare function local:process($value as xs:decimal, $flag as xs:boolean) {
  let $doubled := $value * 2
  return $
};`;

    await setEditorContent(win, xquery);

    // Trigger completion inside function body (line 3, after $)
    await triggerCompletion(win, 3, 10);

    await win.waitForTimeout(1000);

    const suggestions = await win.evaluate(() => {
      const widget = document.querySelector('.monaco-editor .suggest-widget');
      if (widget) {
        const items = Array.from(widget.querySelectorAll('.monaco-list-row'));
        return items.map(item => item.textContent);
      }
      return [];
    });

    // Should suggest both function parameters and local variable
    expect(suggestions).toContain('$value');
    expect(suggestions).toContain('$flag');
    expect(suggestions).toContain('$doubled');

    await app.close();
  });

  test('handles variable shadowing correctly', async () => {
    const { app, win } = await launchApp();

    await win.getByText('Query Console').click();
    await win.waitForSelector('.monaco-editor', { timeout: 15000 });

    const xquery = `let $x := 1
return
  let $x := 2
  return
    let $x := 3
    return $`;

    await setEditorContent(win, xquery);

    // Trigger completion at innermost scope (line 6, after $)
    await triggerCompletion(win, 6, 12);

    await win.waitForTimeout(1000);

    // Get completion suggestions
    const suggestions = await win.evaluate(() => {
      const widget = document.querySelector('.monaco-editor .suggest-widget');
      if (widget) {
        const items = Array.from(widget.querySelectorAll('.monaco-list-row'));
        return items.map(item => {
          const label = item.querySelector('.label-name')?.textContent || '';
          const detail = item.querySelector('.details')?.textContent || '';
          return { label, detail };
        });
      }
      return [];
    });

    // Should only show one $x (the innermost one at line 5)
    const xSuggestions = suggestions.filter(s => s.label === '$x');
    expect(xSuggestions.length).toBe(1);

    // Detail should indicate it shadows line 3
    const xDetail = xSuggestions[0].detail;
    expect(xDetail).toContain('shadows');

    await app.close();
  });

  test('shows function parameter with type information', async () => {
    const { app, win } = await launchApp();

    await win.getByText('Query Console').click();
    await win.waitForSelector('.monaco-editor', { timeout: 15000 });

    const xquery = `declare function local:calc($price as xs:decimal) {
  $
};`;

    await setEditorContent(win, xquery);

    // Trigger completion inside function (line 2, after $)
    await triggerCompletion(win, 2, 3);

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

    const priceSuggestion = suggestions.find(s => s.label === '$price');
    expect(priceSuggestion).toBeDefined();

    // Should show type information
    expect(priceSuggestion?.detail).toContain('xs:decimal');
    expect(priceSuggestion?.detail).toContain('parameter');

    await app.close();
  });

  test('distinguishes let, for, and function parameter variables', async () => {
    const { app, win } = await launchApp();

    await win.getByText('Query Console').click();
    await win.waitForSelector('.monaco-editor', { timeout: 15000 });

    const xquery = `declare function local:test($param as xs:string) {
  let $letVar := "test"
  for $forVar in 1 to 5
  return $
};`;

    await setEditorContent(win, xquery);

    // Trigger completion inside for loop (line 4, after $)
    await triggerCompletion(win, 4, 10);

    await win.waitForTimeout(1000);

    const suggestions = await win.evaluate(() => {
      const widget = document.querySelector('.monaco-editor .suggest-widget');
      if (widget) {
        const rows = Array.from(widget.querySelectorAll('.monaco-list-row'));
        return rows.map(row => ({
          label: row.querySelector('.label-name')?.textContent || '',
          detail: row.textContent || '',
          kind: row.getAttribute('aria-label') || ''
        }));
      }
      return [];
    });

    const paramSuggestion = suggestions.find(s => s.label === '$param');
    const letSuggestion = suggestions.find(s => s.label === '$letVar');
    const forSuggestion = suggestions.find(s => s.label === '$forVar');

    // All should be present
    expect(paramSuggestion).toBeDefined();
    expect(letSuggestion).toBeDefined();
    expect(forSuggestion).toBeDefined();

    // Check type distinctions
    expect(paramSuggestion?.detail).toContain('parameter');
    expect(letSuggestion?.detail).toContain('let variable');
    expect(forSuggestion?.detail).toContain('for variable');

    await app.close();
  });

  test('cache invalidates on document edit', async () => {
    const { app, win } = await launchApp();

    await win.getByText('Query Console').click();
    await win.waitForSelector('.monaco-editor', { timeout: 15000 });

    // Set initial content
    await setEditorContent(win, `let $first := 1\nreturn $`);

    // Trigger completion
    await triggerCompletion(win, 2, 8);
    await win.waitForTimeout(1000);

    let suggestions = await win.evaluate(() => {
      const widget = document.querySelector('.monaco-editor .suggest-widget');
      if (widget) {
        const items = Array.from(widget.querySelectorAll('.monaco-list-row .label-name'));
        return items.map(item => item.textContent);
      }
      return [];
    });

    expect(suggestions).toContain('$first');

    // Edit document - add new variable
    await setEditorContent(win, `let $first := 1\nlet $second := 2\nreturn $`);

    // Trigger completion again
    await triggerCompletion(win, 3, 8);
    await win.waitForTimeout(1000);

    suggestions = await win.evaluate(() => {
      const widget = document.querySelector('.monaco-editor .suggest-widget');
      if (widget) {
        const items = Array.from(widget.querySelectorAll('.monaco-list-row .label-name'));
        return items.map(item => item.textContent);
      }
      return [];
    });

    // Should now suggest both variables
    expect(suggestions).toContain('$first');
    expect(suggestions).toContain('$second');

    await app.close();
  });
});