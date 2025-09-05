import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';
import path from 'path';

async function launchApp(): Promise<{ app: ElectronApplication; win: Page }>{
  const app: ElectronApplication = await electron.launch({
    args: ['.'],
    env: {
      PREVIEW_PORT: process.env.PREVIEW_PORT || '1421',
      MOCK_HTTP: process.env.MOCK_HTTP || '1',
      NODE_ENV: 'development'
    }
  });
  
  // Wait for main window to appear (with longer timeout)
  const win: Page = await app.firstWindow({ timeout: 60000 });
  
  // Wait for the page DOM to be ready (networkidle can hang with Monaco/web workers)
  await win.waitForLoadState('domcontentloaded', { timeout: 30000 });
  
  // Log current URL for debugging
  console.log('Current URL:', win.url());
  
  // Wait for the actual content to load (not just the blank page)
  // The app loads from localhost:1421, so wait for that URL
  await win.waitForFunction(() => window.location.href.includes('localhost:1421'), { timeout: 30000 });
  
  // Wait for React to render - try multiple selectors with longer timeout
  try {
    await win.waitForSelector('h1:has-text("ML Console")', { timeout: 30000 });
  } catch (e) {
    console.log('ML Console heading not found, trying fallback selectors...');
    // Fallback: wait for any heading or main content
    await win.waitForSelector('h1, h2, .App, #root', { timeout: 20000 });
  }
  
  // Additional wait to ensure React has fully hydrated
  await win.waitForTimeout(2000);
  
  return { app, win };
}

test('opens main window and has Query Console UI', async () => {
  const { app, win } = await launchApp();
  
  // Check for main heading
  await expect(win.getByRole('heading', { name: 'ML Console' })).toBeVisible();
  
  // Check for Query Console tab/text
  await expect(win.getByText('Query Console')).toBeVisible();
  
  // Check for Query section heading (use exact match to avoid "Query History" confusion)
  await expect(win.getByRole('heading', { name: 'Query', exact: true })).toBeVisible();
  
  await app.close();
});

test('renders a formatted record using mocked HTTP', async () => {
  const { app, win } = await launchApp();

  // Take a screenshot before any actions
  await win.screenshot({ path: 'before-query.png' });

  // Ensure Query Console tab is active (not Test Harness)
  await win.getByText('Query Console').click();

  // Ensure Table View is selected in the view dropdown (use specific class)
  const viewSelect = win.locator('select.view-mode-select');
  await viewSelect.selectOption('table');

  // Trigger a simple query that hits mocked HTTP (empty query is fine with mock)
  const executeButton = win.getByRole('button', { name: /execute/i });
  await executeButton.click();

  // Wait for the mocked response to be processed
  await win.waitForTimeout(3000);

  // Take a screenshot after query execution
  await win.screenshot({ path: 'after-query.png' });

  // Expect at least one record container
  const record = win.locator('.table-record').first();
  await expect(record).toBeVisible({ timeout: 15000 });

  // Take a screenshot of the record area
  await record.screenshot({ path: 'record-detail.png' });

  // Validate presence of metadata and Monaco editor
  await expect(record.locator('.record-metadata')).toBeVisible();
  
  // Wait for Monaco editor to actually render (not just the container)
  await expect(record.locator('.record-content .monaco-editor')).toBeVisible({ timeout: 10000 });
  
  // Wait for Monaco to be fully loaded by checking for editor content
  await win.waitForFunction(() => {
    const editor = document.querySelector('.monaco-editor');
    return editor && editor.querySelector('.view-lines');
  }, { timeout: 15000 });

  // Ensure first record content contains our mock root element
  await expect(win.locator('.record-content').first()).toContainText('<pathway>');

  await app.close();
});

test('prevents duplicate queries in history - updates timestamp instead', async () => {
  const { app, win } = await launchApp();
  
  // Wait for the app to load
  await win.waitForSelector('h1:has-text("ML Console")', { timeout: 15000 });
  
  // Execute the same query multiple times
  const testQuery = 'for $i in 1 to 3 return $i';
  
  // Ensure Query Console tab is active
  await win.getByText('Query Console').click();
  
  // Ensure Table View is selected in the view dropdown
  const viewSelect = win.locator('select.view-mode-select');
  await viewSelect.selectOption('table');
  
  // First execution
  await win.locator('textarea.query-input').fill(testQuery);
  const executeButton = win.getByRole('button', { name: /execute/i });
  await executeButton.click();
  
  // Wait for results and history to update
  await win.waitForSelector('.table-record', { timeout: 15000 });
  
  // Give some time for the query to be saved to history
  await win.waitForTimeout(2000);
  
  // Second execution of the same query
  await win.locator('textarea.query-input').fill(''); // Clear first
  await win.locator('textarea.query-input').fill(testQuery);
  await executeButton.click();
  
  // Wait for results again
  await win.waitForSelector('.table-record', { timeout: 15000 });
  
  // Give additional time for the second query to be processed
  await win.waitForTimeout(2000);
  
  // Ensure query history panel is visible (it should be by default)
  // Check if history panel is collapsed and expand it if needed
  const collapseButton = win.locator('button:has-text("» Expand")');
  const expandButton = win.locator('button:has-text("« Collapse")');
  
  // If we find the expand button, click it to show history
  if (await collapseButton.isVisible()) {
    await collapseButton.click();
  }
  
  await win.waitForSelector('.history-list', { timeout: 5000 });
  
  // Check what's in the history panel first
  const historyExists = await win.locator('.history-list').isVisible();
  console.log(`History list visible: ${historyExists}`);
  
  if (historyExists) {
    const noHistoryMsg = await win.locator('.no-history').isVisible();
    console.log(`No history message visible: ${noHistoryMsg}`);
    
    const loadingMsg = await win.locator('.loading').isVisible();
    console.log(`Loading message visible: ${loadingMsg}`);
  }
  
  // Count history items with our specific query content
  const historyItems = await win.locator('.history-item').count();
  console.log(`Total history items count: ${historyItems}`);
  
  // Count items that contain our specific test query
  const testQueryItems = await win.locator('.history-item-preview:has-text("for $i in 1 to 3 return $i")').count();
  console.log(`Test query items count: ${testQueryItems}`);
  
  // The key test: should only have 1 item with our specific query despite running it twice
  expect(testQueryItems).toBe(1);
  
  // Verify the content is correct
  if (testQueryItems > 0) {
    const historyPreview = await win.locator('.history-item-preview:has-text("for $i in 1 to 3 return $i")').first().textContent();
    expect(historyPreview).toContain('for $i in 1 to 3 return $i');
    console.log(`History preview content: ${historyPreview}`);
  } else {
    console.log('No history items found with our test query - database may not be working in test environment');
  }
  
  await win.screenshot({ path: 'unique-query-history-test.png' });
  await app.close();
});


