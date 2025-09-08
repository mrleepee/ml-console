// Test setup for Vitest
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Polyfill ResizeObserver for the jsdom environment
class ResizeObserver {
  constructor(callback) {
    // store callback but never invoke in tests
    this.callback = callback;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserver;

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

// Mock JSON responses for MarkLogic Management API
const mockServersResponse = {
  "server-default-list": {
    "list-items": {
      "list-item": [
        {
          "idref": "8000",
          "nameref": "App-Services",
          "typeref": "http",
          "contentDatabase": "7682138842179613689",
          "modulesDatabase": "15944027002351853507"
        }
      ]
    }
  }
};

const mockDatabasesResponse = {
  "database-default-list": {
    "list-items": {
      "list-item": [
        {
          "idref": "7682138842179613689",
          "nameref": "Documents"
        },
        {
          "idref": "15944027002351853507",
          "nameref": "Modules"
        },
        {
          "idref": "123456789",
          "nameref": "prime-content"
        },
        {
          "idref": "987654321",
          "nameref": "prime-content-modules"
        }
      ]
    }
  }
};

// Mock window.electronAPI for tests
global.window.electronAPI = {
  httpRequest: vi.fn().mockImplementation(({ url }) => {
    // Return appropriate JSON responses based on the URL
    if (url.includes('/manage/v2/servers')) {
      return Promise.resolve({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(mockServersResponse)
      });
    } else if (url.includes('/manage/v2/databases')) {
      return Promise.resolve({
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(mockDatabasesResponse)
      });
    } else {
      // Default mock for query execution
      return Promise.resolve({
        status: 200,
        headers: { 'content-type': 'multipart/mixed' },
        body: '--test\nContent-Type: text/plain\n\nTest result\n--test--'
      });
    }
  }),
  database: {
    saveQuery: vi.fn().mockResolvedValue({ success: true }),
    getRecentQueries: vi.fn().mockResolvedValue({ success: true, queries: [] }),
    getQueryById: vi.fn().mockResolvedValue({ success: true, query: null }),
    deleteQuery: vi.fn().mockResolvedValue({ success: true })
  }
};

// Mock console to capture logs for testing
global.mockConsoleCapture = { logs: [] };
const originalLog = console.log;
console.log = (...args) => {
  global.mockConsoleCapture.logs.push(args);
  originalLog(...args);
};