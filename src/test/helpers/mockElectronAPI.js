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

  // CRITICAL: Always point global.window to jsdom's window
  // If a test reassigned it to {} we need to restore the real jsdom window
  if (!global.window || typeof global.window.HTMLElement === 'undefined') {
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
