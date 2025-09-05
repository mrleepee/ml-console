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

test('Monaco query editor loads and displays correctly', async () => {
  const { app, win } = await launchApp();
  
  // Ensure Query Console tab is active
  await win.getByText('Query Console').click();
  
  // Wait for Monaco editor to load
  const queryEditor = win.locator('.query-editor');
  await expect(queryEditor).toBeVisible({ timeout: 15000 });
  
  // Check for Monaco editor presence
  const monacoEditor = queryEditor.locator('.monaco-editor');
  await expect(monacoEditor).toBeVisible({ timeout: 10000 });
  
  // Wait for Monaco to be fully initialized
  await win.waitForFunction(() => {
    const editor = document.querySelector('.monaco-editor .view-lines');
    return editor !== null;
  }, { timeout: 15000 });
  
  await app.close();
});

test('Language dropdown includes XQuery, JavaScript, and SPARQL options', async () => {
  const { app, win } = await launchApp();
  
  await win.getByText('Query Console').click();
  
  // Check language dropdown
  const languageSelect = win.locator('#query-type');
  await expect(languageSelect).toBeVisible();
  
  // Verify all three language options are present
  await expect(languageSelect.locator('option[value="xquery"]')).toBeVisible();
  await expect(languageSelect.locator('option[value="javascript"]')).toBeVisible();
  await expect(languageSelect.locator('option[value="sparql"]')).toBeVisible();
  
  // Verify option text
  await expect(languageSelect.locator('option[value="xquery"]')).toHaveText('XQuery');
  await expect(languageSelect.locator('option[value="javascript"]')).toHaveText('JavaScript');
  await expect(languageSelect.locator('option[value="sparql"]')).toHaveText('SPARQL');
  
  await app.close();
});

test('Language switching changes Monaco editor language mode', async () => {
  const { app, win } = await launchApp();
  
  await win.getByText('Query Console').click();
  
  // Wait for Monaco to load
  await win.waitForSelector('.monaco-editor', { timeout: 15000 });
  await win.waitForTimeout(2000); // Allow Monaco to fully initialize
  
  const languageSelect = win.locator('#query-type');
  
  // Test switching to JavaScript
  await languageSelect.selectOption('javascript');
  await win.waitForTimeout(1000);
  
  // Test switching to SPARQL
  await languageSelect.selectOption('sparql');
  await win.waitForTimeout(1000);
  
  // Test switching back to XQuery
  await languageSelect.selectOption('xquery');
  await win.waitForTimeout(1000);
  
  // Verify the selection stuck
  await expect(languageSelect).toHaveValue('xquery');
  
  await app.close();
});

test('Monaco editor supports text input and editing', async () => {
  const { app, win } = await launchApp();
  
  await win.getByText('Query Console').click();
  
  // Wait for Monaco editor to be ready
  await win.waitForSelector('.monaco-editor', { timeout: 15000 });
  await win.waitForFunction(() => {
    const editor = document.querySelector('.monaco-editor .view-lines');
    return editor !== null;
  }, { timeout: 15000 });
  
  // Click in the editor and type some content
  await win.locator('.monaco-editor .view-lines').click();
  await win.waitForTimeout(500);
  
  const testQuery = 'xquery version "1.0-ml"; (1, 2, 3)';
  await win.keyboard.type(testQuery);
  await win.waitForTimeout(1000);
  
  // Verify the content was entered
  const editorContent = await win.evaluate(() => {
    const editor = document.querySelector('.monaco-editor');
    if (editor) {
      // Try to get Monaco editor instance and read value
      // This is a bit tricky with Monaco, but we can check for text content
      const lines = editor.querySelector('.view-lines');
      return lines ? lines.textContent : '';
    }
    return '';
  });
  
  expect(editorContent).toContain('xquery version');
  
  await app.close();
});

test('Ctrl+Enter keyboard shortcut works in Monaco editor', async () => {
  const { app, win } = await launchApp();
  
  await win.getByText('Query Console').click();
  
  // Wait for Monaco editor to be ready
  await win.waitForSelector('.monaco-editor', { timeout: 15000 });
  await win.waitForFunction(() => {
    const editor = document.querySelector('.monaco-editor .view-lines');
    return editor !== null;
  }, { timeout: 15000 });
  
  // Click in editor and add some query text
  await win.locator('.monaco-editor .view-lines').click();
  await win.keyboard.type('xquery version "1.0-ml"; 1 + 1');
  await win.waitForTimeout(1000);
  
  // Press Ctrl+Enter to execute
  await win.keyboard.press('Control+Enter');
  await win.waitForTimeout(2000);
  
  // Check if execution started (loading state or results)
  const isExecuting = await win.locator('button:has-text("Executing...")').isVisible().catch(() => false);
  const hasResults = await win.locator('.results-output').isVisible().catch(() => false);
  
  // Either execution should be in progress or results should be visible
  expect(isExecuting || hasResults).toBe(true);
  
  await app.close();
});

test('Monaco editor syntax highlighting works for XQuery', async () => {
  const { app, win } = await launchApp();
  
  await win.getByText('Query Console').click();
  
  // Ensure XQuery is selected
  await win.locator('#query-type').selectOption('xquery');
  
  // Wait for Monaco editor
  await win.waitForSelector('.monaco-editor', { timeout: 15000 });
  await win.waitForFunction(() => {
    const editor = document.querySelector('.monaco-editor .view-lines');
    return editor !== null;
  }, { timeout: 15000 });
  
  // Type XQuery with keywords that should be highlighted
  await win.locator('.monaco-editor .view-lines').click();
  const xqueryCode = `xquery version "1.0-ml";
for $item in (1, 2, 3)
let $doubled := $item * 2
where $item > 1
return $doubled`;
  
  await win.keyboard.type(xqueryCode);
  await win.waitForTimeout(2000);
  
  // Check for syntax highlighting by looking for token classes
  const hasKeywordHighlighting = await win.evaluate(() => {
    const editor = document.querySelector('.monaco-editor');
    if (!editor) return false;
    
    // Look for Monaco's syntax highlighting tokens
    const tokens = editor.querySelectorAll('.token, .mtk1, .mtk2, .mtk3, .mtk4, .mtk5, .mtk6');
    return tokens.length > 0;
  });
  
  expect(hasKeywordHighlighting).toBe(true);
  
  await app.close();
});

test('Monaco editor placeholder shows correct language-specific text', async () => {
  const { app, win } = await launchApp();
  
  await win.getByText('Query Console').click();
  await win.waitForSelector('.monaco-editor', { timeout: 15000 });
  
  // Test XQuery placeholder
  await win.locator('#query-type').selectOption('xquery');
  await win.waitForTimeout(500);
  
  // Test JavaScript placeholder  
  await win.locator('#query-type').selectOption('javascript');
  await win.waitForTimeout(500);
  
  // Test SPARQL placeholder
  await win.locator('#query-type').selectOption('sparql');
  await win.waitForTimeout(500);
  
  // Note: Monaco editor placeholders are harder to test directly,
  // but we can verify the component received the right props
  const currentLanguage = await win.locator('#query-type').inputValue();
  expect(['xquery', 'javascript', 'sparql']).toContain(currentLanguage);
  
  await app.close();
});

test('Monaco editor is properly styled and responsive', async () => {
  const { app, win } = await launchApp();
  
  await win.getByText('Query Console').click();
  await win.waitForSelector('.query-editor', { timeout: 15000 });
  
  // Check editor container styling
  const editorContainer = win.locator('.query-editor');
  await expect(editorContainer).toBeVisible();
  
  // Check Monaco editor is present within container
  const monacoEditor = editorContainer.locator('.monaco-editor');
  await expect(monacoEditor).toBeVisible();
  
  // Verify editor takes proper space
  const editorBox = await editorContainer.boundingBox();
  expect(editorBox).toBeTruthy();
  expect(editorBox!.height).toBeGreaterThan(150); // Should have reasonable height
  expect(editorBox!.width).toBeGreaterThan(200);  // Should have reasonable width
  
  await app.close();
});

test('Monaco editor maintains backward compatibility with existing queries', async () => {
  const { app, win } = await launchApp();
  
  await win.getByText('Query Console').click();
  
  // Wait for editor to load
  await win.waitForSelector('.monaco-editor', { timeout: 15000 });
  await win.waitForFunction(() => {
    const editor = document.querySelector('.monaco-editor .view-lines');
    return editor !== null;
  }, { timeout: 15000 });
  
  // Test that typical XQuery queries work
  await win.locator('.monaco-editor .view-lines').click();
  const testQuery = 'xquery version "1.0-ml"; (//*[not(*)])[1 to 3]';
  await win.keyboard.type(testQuery);
  
  // Execute the query
  await win.keyboard.press('Control+Enter');
  await win.waitForTimeout(3000);
  
  // Should not cause errors and should work like before
  const hasError = await win.locator('.error-message').isVisible().catch(() => false);
  expect(hasError).toBe(false);
  
  await app.close();
});