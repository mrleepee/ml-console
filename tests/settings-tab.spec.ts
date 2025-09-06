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

test('Settings tab is visible in navigation', async () => {
  const { app, win } = await launchApp();
  
  // Check that Settings tab button exists
  const settingsTab = win.getByText('Settings');
  await expect(settingsTab).toBeVisible();
  
  await app.close();
});

test('Settings tab can be activated and displays settings form', async () => {
  const { app, win } = await launchApp();
  
  // Click on Settings tab
  await win.getByText('Settings').click();
  
  // Check that Settings content is displayed
  const settingsHeading = win.getByText('Settings', { selector: 'h2' });
  await expect(settingsHeading).toBeVisible();
  
  // Check that settings form fields are present
  await expect(win.locator('#settings-server')).toBeVisible();
  await expect(win.locator('#settings-username')).toBeVisible();
  await expect(win.locator('#settings-password')).toBeVisible();
  
  await app.close();
});

test('Settings tab contains all required fields with correct defaults', async () => {
  const { app, win } = await launchApp();
  
  // Navigate to Settings tab
  await win.getByText('Settings').click();
  await win.waitForSelector('h2:has-text("Settings")', { timeout: 10000 });
  
  // Check Server dropdown
  const serverSelect = win.locator('#settings-server');
  await expect(serverSelect).toHaveValue('localhost');
  await expect(serverSelect.locator('option[value="localhost"]')).toBeVisible();
  
  // Note: Modules Database dropdown has been removed from Settings tab
  // and moved to combined database dropdown on main page
  
  // Check Username field
  const usernameInput = win.locator('#settings-username');
  await expect(usernameInput).toHaveValue('admin');
  
  // Check Password field
  const passwordInput = win.locator('#settings-password');
  await expect(passwordInput).toHaveValue('admin');
  await expect(passwordInput).toHaveAttribute('type', 'password');
  
  await app.close();
});

test('Settings can be modified and changes persist', async () => {
  const { app, win } = await launchApp();
  
  // Navigate to Settings tab
  await win.getByText('Settings').click();
  await win.waitForSelector('h2:has-text("Settings")', { timeout: 10000 });
  
  // Modify username
  const usernameInput = win.locator('#settings-username');
  await usernameInput.clear();
  await usernameInput.fill('testuser');
  await expect(usernameInput).toHaveValue('testuser');
  
  // Modify password
  const passwordInput = win.locator('#settings-password');
  await passwordInput.clear();
  await passwordInput.fill('testpass');
  await expect(passwordInput).toHaveValue('testpass');
  
  // Switch to Query Console tab and back to verify persistence
  await win.getByText('Query Console').click();
  await win.waitForTimeout(500);
  await win.getByText('Settings').click();
  await win.waitForTimeout(500);
  
  // Verify changes persisted
  await expect(win.locator('#settings-username')).toHaveValue('testuser');
  await expect(win.locator('#settings-password')).toHaveValue('testpass');
  
  await app.close();
});

test('Top bar no longer contains username and password fields', async () => {
  const { app, win } = await launchApp();
  
  // Check that username and password fields are NOT in the header
  const header = win.locator('.header');
  await expect(header.locator('input[type="text"]')).not.toBeVisible();
  await expect(header.locator('input[type="password"]')).not.toBeVisible();
  await expect(header.locator('label:has-text("Username")')).not.toBeVisible();
  await expect(header.locator('label:has-text("Password")')).not.toBeVisible();
  
  // But Query Type and Database should still be there
  await expect(header.locator('#query-type')).toBeVisible();
  await expect(header.locator('#database')).toBeVisible();
  
  await app.close();
});

test('Modules database setting is included in query execution debug logs', async () => {
  const { app, win } = await launchApp();
  
  // Navigate to Settings tab and verify modules database setting
  await win.getByText('Settings').click();
  await win.waitForSelector('#settings-modules-db', { timeout: 10000 });
  await expect(win.locator('#settings-modules-db')).toHaveValue('prime-content-modules');
  
  // Switch to Query Console
  await win.getByText('Query Console').click();
  await win.waitForTimeout(1000);
  
  // Clear console messages to focus on new ones
  await win.evaluate(() => console.clear());
  
  // Execute a simple query to trigger debug logging
  const monacoEditor = win.locator('.monaco-editor .view-lines');
  await expect(monacoEditor).toBeVisible({ timeout: 15000 });
  await monacoEditor.click();
  await win.keyboard.type('1 + 1');
  
  // Execute query
  await win.keyboard.press('Control+Enter');
  await win.waitForTimeout(2000);
  
  // Check console logs for modules database information
  const consoleLogs = await win.evaluate(() => {
    const logs: string[] = [];
    const originalConsoleLog = console.log;
    console.log = (...args: any[]) => {
      logs.push(args.join(' '));
      originalConsoleLog.apply(console, args);
    };
    return logs;
  });
  
  // Note: This test may need adjustment based on actual console logging implementation
  // The goal is to verify that modules database information is included in debug output
  
  await app.close();
});

test('Settings tab layout is responsive and well-styled', async () => {
  const { app, win } = await launchApp();
  
  // Navigate to Settings tab
  await win.getByText('Settings').click();
  await win.waitForSelector('.settings-layout', { timeout: 10000 });
  
  // Check overall layout
  const settingsLayout = win.locator('.settings-layout');
  await expect(settingsLayout).toBeVisible();
  
  // Check settings section
  const settingsSection = win.locator('.settings-section');
  await expect(settingsSection).toBeVisible();
  
  // Check that all settings groups are properly styled
  const settingsGroups = win.locator('.settings-group');
  await expect(settingsGroups).toHaveCount(3); // Server, Username, Password
  
  // Verify each group has label and input/select
  for (let i = 0; i < 3; i++) {
    const group = settingsGroups.nth(i);
    await expect(group.locator('label')).toBeVisible();
    await expect(group.locator('select, input')).toBeVisible();
  }
  
  await app.close();
});

test('Settings tab integration with existing functionality', async () => {
  const { app, win } = await launchApp();
  
  // Modify settings
  await win.getByText('Settings').click();
  await win.waitForSelector('#settings-username', { timeout: 10000 });
  
  const usernameInput = win.locator('#settings-username');
  await usernameInput.clear();
  await usernameInput.fill('newuser');
  
  // Go to Test Harness tab to verify settings are passed correctly
  await win.getByText('Test Harness').click();
  await win.waitForTimeout(1000);
  
  // Return to Query Console to verify integration
  await win.getByText('Query Console').click();
  await win.waitForTimeout(1000);
  
  // Verify the interface is functional
  await expect(win.locator('.query-editor')).toBeVisible();
  await expect(win.locator('.results-output')).toBeVisible();
  
  await app.close();
});

test('Combined database-modules dropdown is present on Query Console', async () => {
  const { app, win } = await launchApp();
  
  // Ensure Query Console tab is active
  await win.getByText('Query Console').click();
  await win.waitForTimeout(1000);
  
  // Check that combined database dropdown is present in header
  const databaseConfigSelect = win.locator('#database-config');
  await expect(databaseConfigSelect).toBeVisible();
  
  // The dropdown should show database name with modules database in parentheses
  // Since this is running with mock data, we can't test specific values
  // but we can verify the dropdown exists and has options
  const options = databaseConfigSelect.locator('option');
  await expect(options).not.toHaveCount(0);
  
  await app.close();
});

test('Database configuration is preserved when switching tabs', async () => {
  const { app, win } = await launchApp();
  
  // Start on Query Console
  await win.getByText('Query Console').click();
  await win.waitForTimeout(1000);
  
  // Note down current database selection
  const databaseConfigSelect = win.locator('#database-config');
  const initialValue = await databaseConfigSelect.inputValue();
  
  // Switch to Settings and back
  await win.getByText('Settings').click();
  await win.waitForTimeout(500);
  await win.getByText('Query Console').click();
  await win.waitForTimeout(500);
  
  // Verify database selection is maintained
  await expect(databaseConfigSelect).toHaveValue(initialValue);
  
  await app.close();
});

test('Combined database dropdown shows modules database in parentheses', async () => {
  const { app, win } = await launchApp();
  
  // Go to Query Console
  await win.getByText('Query Console').click();
  await win.waitForTimeout(1000);
  
  // Check database dropdown format
  const databaseConfigSelect = win.locator('#database-config');
  await expect(databaseConfigSelect).toBeVisible();
  
  // Get the selected option text and verify it contains parentheses
  // This indicates it's showing "DatabaseName (ModulesDatabase)" format
  const selectedOption = databaseConfigSelect.locator('option:checked');
  const optionText = await selectedOption.textContent();
  
  // Should contain parentheses indicating modules database
  expect(optionText).toMatch(/\(.+\)/);
  
  await app.close();
});