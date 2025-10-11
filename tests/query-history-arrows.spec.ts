import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';

async function launchApp(): Promise<{ app: ElectronApplication; win: Page }>{
  const app: ElectronApplication = await electron.launch({
    args: ['.'],
    env: {
      PREVIEW_PORT: process.env.PREVIEW_PORT || '1421',
      MOCK_HTTP: '1',
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

test('query history arrow directions are correct', async () => {
  const { app, win } = await launchApp();

  // Navigate to Query Console tab
  await win.getByText('Query Console').click();
  await win.waitForTimeout(1000);

  // Initially, history panel should be visible with collapse arrow (→)
  // Use getByRole to find buttons by their accessible text content
  const collapseButton = win.getByRole('button', { name: '→' });

  // Wait for it to be visible with timeout
  await expect(collapseButton).toBeVisible({ timeout: 5000 });

  // Verify we have the collapse functionality
  const collapseTitle = await collapseButton.getAttribute('title');
  expect(collapseTitle).toContain('Collapse');

  // Take screenshot of expanded state
  await win.screenshot({ path: 'query-history-expanded.png' });

  // Click to collapse the history panel
  await collapseButton.click();
  await win.waitForTimeout(500);

  // Now the expand button should be visible with left arrow (←)
  const expandButton = win.getByRole('button', { name: '←' });
  await expect(expandButton).toBeVisible({ timeout: 5000 });

  // Verify we have the expand functionality
  const expandTitle = await expandButton.getAttribute('title');
  expect(expandTitle).toContain('Expand');

  // Take screenshot of collapsed state
  await win.screenshot({ path: 'query-history-collapsed.png' });

  // Click to expand again
  await expandButton.click();
  await win.waitForTimeout(500);

  // Verify collapse button is visible again
  await expect(collapseButton).toBeVisible({ timeout: 5000 });

  await app.close();
});

test('query history panel toggle functionality works correctly', async () => {
  const { app, win } = await launchApp();

  await win.getByText('Query Console').click();
  await win.waitForTimeout(1000);

  // Verify history panel is initially visible
  const historyPanel = win.locator('.card:has-text("Query History")');
  await expect(historyPanel).toBeVisible();

  // Find and verify collapse button
  const collapseButton = win.locator('button[title="Collapse history panel"]');
  await expect(collapseButton).toBeVisible();

  // Collapse the panel
  await collapseButton.click();
  await win.waitForTimeout(500);

  // Verify panel is no longer visible (should show only expand button)
  const expandButton = win.locator('button[title="Expand history panel"]');
  await expect(expandButton).toBeVisible();

  // The full history panel should not be visible
  await expect(historyPanel).not.toBeVisible();

  // Expand the panel
  await expandButton.click();
  await win.waitForTimeout(500);

  // Verify panel is visible again
  await expect(historyPanel).toBeVisible();
  await expect(collapseButton).toBeVisible();

  await app.close();
});

test('query history arrow tooltips are correct', async () => {
  const { app, win } = await launchApp();

  await win.getByText('Query Console').click();
  await win.waitForTimeout(1000);

  // Check collapse button tooltip
  const collapseButton = win.locator('button[title="Collapse history panel"]');
  await expect(collapseButton).toHaveAttribute('title', 'Collapse history panel');

  // Collapse and check expand button tooltip
  await collapseButton.click();
  await win.waitForTimeout(500);

  const expandButton = win.locator('button[title="Expand history panel"]');
  await expect(expandButton).toHaveAttribute('title', 'Expand history panel');

  await app.close();
});
