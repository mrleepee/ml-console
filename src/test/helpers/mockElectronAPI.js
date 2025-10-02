/**
 * Mock Electron API helper for test files
 *
 * Safely mocks window.electronAPI without wiping DOM constructors
 * that React Testing Library needs (HTMLElement, Element, etc.)
 */

/**
 * Set window.electronAPI while preserving DOM globals
 * @param {Object} electronAPI - Mock electron API object
 */
export function setMockElectronAPI(electronAPI) {
  if (typeof window === 'undefined') {
    throw new Error('setMockElectronAPI can only be called in jsdom environment');
  }

  // Preserve existing window properties
  if (!global.window) {
    global.window = window;
  }

  // Set electronAPI without overwriting window
  if (!global.window.electronAPI) {
    global.window.electronAPI = {};
  }

  Object.assign(global.window.electronAPI, electronAPI);
}

/**
 * Clear electronAPI mock
 */
export function clearMockElectronAPI() {
  if (global.window?.electronAPI) {
    delete global.window.electronAPI;
  }
}
