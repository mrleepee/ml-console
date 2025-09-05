import { test, expect, _electron as electron, ElectronApplication, Page } from '@playwright/test';

async function launchApp(): Promise<{ app: ElectronApplication; win: Page }>{
  const app: ElectronApplication = await electron.launch({
    args: ['.'],
    env: {
      PREVIEW_PORT: process.env.PREVIEW_PORT || '1421',
      MOCK_HTTP: '1', // Always use mock for navigation test
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

test('compact navigation arrows work correctly with multiple records', async () => {
  const { app, win } = await launchApp();
  
  // Ensure Query Console tab is active
  await win.getByText('Query Console').click();
  
  // Ensure Table View is selected
  const viewSelect = win.locator('select.view-mode-select');
  await viewSelect.selectOption('table');
  
  // Execute query to get mock data with 4 records
  const executeButton = win.getByRole('button', { name: /execute/i });
  await executeButton.click();
  
  // Wait for records to load
  await win.waitForSelector('.table-record', { timeout: 15000 });
  
  // Verify we have 4 records
  const records = win.locator('.table-record');
  await expect(records).toHaveCount(4);
  
  // Check that navigation controls are visible
  const navArrows = win.locator('.nav-arrows');
  await expect(navArrows).toBeVisible();
  
  // Check individual arrow buttons
  const upArrow = win.locator('.nav-arrow').first();
  const downArrow = win.locator('.nav-arrow').last();
  await expect(upArrow).toBeVisible();
  await expect(downArrow).toBeVisible();
  
  // Verify arrow symbols
  await expect(upArrow).toHaveText('↑');
  await expect(downArrow).toHaveText('↓');
  
  // Check record counter position and format
  const recordCounter = win.locator('.record-counter');
  await expect(recordCounter).toBeVisible();
  await expect(recordCounter).toHaveText('1 of 4');
  
  // Test navigation: should start with first record active
  await expect(upArrow).toBeDisabled(); // Can't go up from first record
  await expect(downArrow).toBeEnabled();
  
  // Navigate to second record
  await downArrow.click();
  await win.waitForTimeout(500); // Allow for smooth scroll
  await expect(recordCounter).toHaveText('2 of 4');
  await expect(upArrow).toBeEnabled();
  await expect(downArrow).toBeEnabled();
  
  // Navigate to third record  
  await downArrow.click();
  await win.waitForTimeout(500);
  await expect(recordCounter).toHaveText('3 of 4');
  await expect(upArrow).toBeEnabled();
  await expect(downArrow).toBeEnabled();
  
  // Navigate to last record
  await downArrow.click();
  await win.waitForTimeout(500);
  await expect(recordCounter).toHaveText('4 of 4');
  await expect(upArrow).toBeEnabled();
  await expect(downArrow).toBeDisabled(); // Can't go down from last record
  
  // Navigate back up
  await upArrow.click();
  await win.waitForTimeout(500);
  await expect(recordCounter).toHaveText('3 of 4');
  await expect(upArrow).toBeEnabled();
  await expect(downArrow).toBeEnabled();
  
  // Navigate to first record
  await upArrow.click();
  await win.waitForTimeout(500);
  await expect(recordCounter).toHaveText('2 of 4');
  
  await upArrow.click();
  await win.waitForTimeout(500);
  await expect(recordCounter).toHaveText('1 of 4');
  await expect(upArrow).toBeDisabled();
  await expect(downArrow).toBeEnabled();
  
  // Test keyboard shortcuts
  await win.keyboard.press('Control+ArrowDown');
  await win.waitForTimeout(500);
  await expect(recordCounter).toHaveText('2 of 4');
  
  await win.keyboard.press('Control+ArrowUp');
  await win.waitForTimeout(500);
  await expect(recordCounter).toHaveText('1 of 4');
  
  // Verify active record highlighting
  const activeRecord = win.locator('.table-record.active-record');
  await expect(activeRecord).toHaveCount(1);
  
  // Verify different content types are displayed
  await win.keyboard.press('Control+ArrowDown'); // Record 2 (JSON)
  await win.waitForTimeout(500);
  const jsonContent = win.locator('.record-content').nth(1);
  await expect(jsonContent).toContainText('Test Product');
  
  await win.keyboard.press('Control+ArrowDown'); // Record 3 (Text)
  await win.waitForTimeout(500);
  const textContent = win.locator('.record-content').nth(2);
  await expect(textContent).toContainText('simple text record');
  
  await win.keyboard.press('Control+ArrowDown'); // Record 4 (XML)
  await win.waitForTimeout(500);
  const xmlContent = win.locator('.record-content').nth(3);
  await expect(xmlContent).toContainText('<config>');
  
  // Take screenshot of final state
  await win.screenshot({ path: 'navigation-test-complete.png' });
  
  await app.close();
});

test('navigation interface layout is compact and properly positioned', async () => {
  const { app, win } = await launchApp();
  
  await win.getByText('Query Console').click();
  const viewSelect = win.locator('select.view-mode-select');
  await viewSelect.selectOption('table');
  
  const executeButton = win.getByRole('button', { name: /execute/i });
  await executeButton.click();
  await win.waitForSelector('.table-record', { timeout: 15000 });
  
  // Check layout structure
  const recordNavigation = win.locator('.record-navigation');
  await expect(recordNavigation).toBeVisible();
  
  const navArrows = win.locator('.nav-arrows');
  const recordCounter = win.locator('.record-counter');
  
  // Verify arrows are grouped together
  await expect(navArrows).toBeVisible();
  await expect(navArrows.locator('.nav-arrow')).toHaveCount(2);
  
  // Verify counter is separate and to the right
  await expect(recordCounter).toBeVisible();
  
  // Check CSS properties indicate compact layout
  const arrowsBox = await navArrows.boundingBox();
  const counterBox = await recordCounter.boundingBox();
  
  // Counter should be to the right of arrows
  expect(counterBox?.x).toBeGreaterThan((arrowsBox?.x ?? 0) + (arrowsBox?.width ?? 0));
  
  // Arrows should be close together (gap of 2px from CSS)
  const firstArrow = navArrows.locator('.nav-arrow').first();
  const secondArrow = navArrows.locator('.nav-arrow').last();
  
  const firstArrowBox = await firstArrow.boundingBox();
  const secondArrowBox = await secondArrow.boundingBox();
  
  // Gap should be small (2px + borders)
  const gap = (secondArrowBox?.x ?? 0) - ((firstArrowBox?.x ?? 0) + (firstArrowBox?.width ?? 0));
  expect(gap).toBeLessThan(10); // Should be much less than old button layout
  
  await app.close();
});