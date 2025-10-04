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
  loader: {
    init: vi.fn(() => Promise.resolve()),
    config: vi.fn()
  },
  useMonaco: () => ({
    editor: {
      defineTheme: vi.fn(),
      setTheme: vi.fn(),
      addKeybindingRules: vi.fn()
    },
    languages: {
      register: vi.fn(),
      setMonarchTokensProvider: vi.fn(),
      setLanguageConfiguration: vi.fn(),
      registerCompletionItemProvider: vi.fn(),
      registerFoldingRangeProvider: vi.fn(),
      registerCodeActionProvider: vi.fn(),
      getLanguages: vi.fn(() => [
        { id: 'javascript' },
        { id: 'json' },
        { id: 'xml' }
      ]),
      // Completion enums used by completion providers
      CompletionItemKind: {
        Method: 0,
        Function: 1,
        Constructor: 2,
        Field: 3,
        Variable: 4,
        Class: 5,
        Struct: 6,
        Interface: 7,
        Module: 8,
        Property: 9,
        Event: 10,
        Operator: 11,
        Unit: 12,
        Value: 13,
        Constant: 14,
        Enum: 15,
        EnumMember: 16,
        Keyword: 17,
        Text: 18,
        Color: 19,
        File: 20,
        Reference: 21,
        Customcolor: 22,
        Folder: 23,
        TypeParameter: 24,
        User: 25,
        Issue: 26,
        Snippet: 27
      },
      CompletionItemInsertTextRule: {
        None: 0,
        KeepWhitespace: 1,
        InsertAsSnippet: 4
      }
    },
    KeyMod: {
      CtrlCmd: 2048,
      Shift: 1024,
      Alt: 512,
      WinCtrl: 256
    },
    KeyCode: {
      Slash: 85,
      KeyA: 31
    }
  })
}));

// Install comprehensive electron mock matching preload.js
import { installElectronMock, resetElectronMock } from './electronMock.js';
import { beforeEach, afterAll } from 'vitest';

// Install the mock globally for all tests
installElectronMock();

// Mock console to capture logs for testing
global.mockConsoleCapture = { logs: [] };
const originalLog = console.log;
console.log = (...args) => {
  global.mockConsoleCapture.logs.push(args);
  originalLog(...args);
};

// Reset electron mock and clear logs before each test for isolation
beforeEach(() => {
  resetElectronMock();
  global.mockConsoleCapture.logs = [];
});

// Restore console.log after all tests
afterAll(() => {
  console.log = originalLog;
});
