/**
 * Shared page object selectors for Playwright tests
 *
 * These selectors provide a central location for UI element locators,
 * making tests more maintainable and reducing duplication.
 */

export const selectors = {
  // Navigation
  queryConsoleTab: 'button:has-text("Query Console")',
  settingsTab: 'button:has-text("Settings")',

  // Page titles
  queryConsoleTitle: 'h2:has-text("Query")',
  settingsTitle: 'h2:has-text("Settings")',
  appTitle: 'h1:has-text("ML Console")',

  // Monaco Editor
  monacoEditor: '.monaco-editor',
  editorContent: '.monaco-editor textarea[data-mprt="7"]',
  editorViewLine: '.monaco-editor .view-line',
  queryEditor: '.query-editor .monaco-editor',

  // Theme controls
  themeSelector: '.theme-selector button[aria-haspopup="listbox"]',
  themeDropdown: '.theme-selector [role="listbox"]',
  themeSearch: 'input[placeholder="Search themes..."]',
  themePreview: '.monaco-editor.theme-preview',
  themeButton: (themeName: string) => `button:has-text("${themeName}")`,

  // Application theme
  appThemeToggle: 'button[title*="Switch to"]',
  appThemeDisplay: 'text=/Current: (Light|Dark)/',

  // Editor preferences controls
  fontSizeDisplay: 'text=/\\d+px/',
  increaseFontButton: 'button[title*="Increase font"]',
  decreaseFontButton: 'button[title*="Decrease font"]',
  lineNumbersToggle: 'button[title*="line numbers"]',
  wordWrapToggle: 'button[title*="word wrap"]',
  minimapToggle: 'button[title*="minimap"]',

  // Query execution
  executeButton: 'button:has-text("Execute")',
  resultsPanel: '.results-panel',
  resultsTitle: 'h2:has-text("Results")',

  // Query history
  historyPanel: '.history-panel',
  historyTitle: 'h2:has-text("Query History")',
  historyBackButton: 'button:has-text("←")',
  historyRefreshButton: 'button:has-text("↻")',

  // General UI elements
  errorMessage: '.alert-error',
  successMessage: '.alert-success',
  loadingSpinner: '.loading'
} as const;

/**
 * Helper function to get theme button selector
 */
export function getThemeButtonSelector(themeName: string): string {
  return selectors.themeButton(themeName);
}

/**
 * Common wait conditions
 */
export const waitConditions = {
  monacoReady: () => 'window.monaco && window.monaco.editor && window.monaco.editor.getEditors().length > 0',
  pageLoaded: () => 'document.readyState === "complete"',
  themeApplied: (themeName: string) => `localStorage.getItem('monacoTheme') === '${themeName}'`
} as const;
