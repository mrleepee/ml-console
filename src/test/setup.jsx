// Test setup for Vitest
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Ensure proper DOM globals are set up for React's instanceof checks
if (typeof window !== 'undefined') {
  if (typeof global.HTMLElement === 'undefined') {
    global.HTMLElement = window.HTMLElement;
  }
  if (typeof global.Element === 'undefined') {
    global.Element = window.Element;
  }
}

// Polyfill ResizeObserver for the jsdom environment
class ResizeObserver {
  constructor(callback) {
    this.callback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof global.ResizeObserver === 'undefined') {
  global.ResizeObserver = ResizeObserver;
}
if (typeof window !== 'undefined' && typeof window.ResizeObserver === 'undefined') {
  window.ResizeObserver = ResizeObserver;
}

// Mock Monaco Editor to prevent issues in jsdom  
vi.mock('@monaco-editor/react', () => ({
  default: vi.fn(({ value, language, height }) => {
    return vi.fn().mockReturnValue(null)();
  }),
  useMonaco: () => ({
    editor: {
      defineTheme: vi.fn(),
      setTheme: vi.fn()
    },
    languages: {
      register: vi.fn(),
      setMonarchTokensProvider: vi.fn(),
      setLanguageConfiguration: vi.fn(),
      registerCompletionItemProvider: vi.fn(),
      getLanguages: vi.fn(() => [
        { id: 'javascript' },
        { id: 'json' },
        { id: 'xml' }
      ])
    }
  })
}));

// Install comprehensive electron mock matching preload.js
import { installElectronMock } from './electronMock.js';

// Install the mock globally for all tests
installElectronMock();

// Mock console to capture logs for testing
global.mockConsoleCapture = { logs: [] };
const originalLog = console.log;
console.log = (...args) => {
  global.mockConsoleCapture.logs.push(args);
  originalLog(...args);
};
