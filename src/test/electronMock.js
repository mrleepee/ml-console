/**
 * Electron API Mock Factory
 *
 * Provides complete mock implementation of window.electronAPI matching electron/preload.js
 * Includes lifecycle management (install/reset) and per-test override capabilities.
 *
 * Phase 1 Features:
 * - Full preload.js API surface coverage
 * - Install/reset lifecycle helpers
 * - Streaming APIs with progress tracking
 * - Complete database operations
 * - Platform/version metadata
 *
 * Phase 2 Features:
 * - Override injection for database methods (setDatabaseOverrides)
 * - Command handler customization (setRunCommandHandler)
 * - Streaming progress emitter helper (emitStreamProgress)
 * - Platform/version override helpers (setPlatform, setAppVersion)
 * - Factory options for initial configuration
 *
 * @example Basic usage
 * ```js
 * import { installElectronMock, resetElectronMock } from './electronMock';
 *
 * beforeEach(() => {
 *   resetElectronMock(); // Reset to defaults
 * });
 * ```
 *
 * @example Override database methods
 * ```js
 * import { setDatabaseOverrides } from './electronMock';
 *
 * test('handles error', async () => {
 *   setDatabaseOverrides({
 *     getRecentQueries: () => Promise.reject(new Error('DB error'))
 *   });
 *   // Test error handling
 * });
 * ```
 *
 * @example Test streaming progress
 * ```js
 * import { emitStreamProgress } from './electronMock';
 *
 * test('shows progress', () => {
 *   const progressSpy = vi.fn();
 *   const cleanup = window.electronAPI.onEvalStreamProgress(progressSpy);
 *   emitStreamProgress(50);
 *   expect(progressSpy).toHaveBeenCalledWith(50);
 *   cleanup();
 * });
 * ```
 */

import { vi } from 'vitest';

// ============================================================================
// Default Mock Responses
// ============================================================================

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

// ============================================================================
// Default Implementations
// ============================================================================

const defaultDatabaseImpls = {
  saveQuery: () => Promise.resolve({
    success: true,
    id: 1,
    changes: 1,
    updated: false,
    message: 'New query saved'
  }),

  getRecentQueries: (limit = 15) => Promise.resolve({
    success: true,
    queries: Array.from({ length: Math.min(limit, 3) }, (_, i) => ({
      id: i + 1,
      content: `xquery version "1.0-ml";\n\nfn:current-dateTime()`,
      preview: 'fn:current-dateTime()',
      queryType: 'xquery',
      databaseName: 'Documents',
      version: 1,
      createdAt: new Date(Date.now() - i * 60000).toISOString(),
      updatedAt: new Date(Date.now() - i * 60000).toISOString(),
      executionTimeMs: 45,
      status: 'executed',
      hasEmbedding: false
    }))
  }),

  getQueryById: (id) => Promise.resolve({
    success: true,
    query: {
      id,
      content: 'xquery version "1.0-ml";\n\nfn:current-dateTime()',
      preview: 'fn:current-dateTime()',
      queryType: 'xquery',
      databaseName: 'Documents',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      executionTimeMs: 45,
      status: 'executed',
      hasEmbedding: false
    }
  }),

  searchQueries: (searchTerm, limit = 15) => Promise.resolve({
    success: true,
    queries: searchTerm ? [{
      id: 1,
      content: `Query matching ${searchTerm}`,
      preview: `Query matching ${searchTerm}`,
      queryType: 'xquery',
      databaseName: 'Documents',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      executionTimeMs: 45,
      status: 'executed',
      hasEmbedding: false
    }] : []
  }),

  getQueriesByType: (queryType, limit = 15) => Promise.resolve({
    success: true,
    queries: [{
      id: 1,
      content: 'Query text',
      preview: 'Query text',
      queryType,
      databaseName: 'Documents',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      executionTimeMs: 45,
      status: 'executed',
      hasEmbedding: false
    }]
  }),

  updateQueryStatus: (id, status, executionTimeMs) => Promise.resolve({
    success: true,
    changes: 1
  }),

  deleteQuery: () => Promise.resolve({
    success: true,
    changes: 1
  }),

  getStats: () => Promise.resolve({
    success: true,
    stats: {
      total_queries: 42,
      xquery_count: 30,
      javascript_count: 8,
      sparql_count: 3,
      optic_count: 1,
      embedded_queries: 0,
      last_query_time: new Date().toISOString()
    }
  })
};

const defaultRunCommand = () => Promise.resolve({
  success: true,
  stdout: 'command output',
  stderr: '',
  exitCode: 0
});

const defaultHttpRequest = ({ url }) => {
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
    return Promise.resolve({
      status: 200,
      headers: { 'content-type': 'multipart/mixed' },
      body: '--test\nContent-Type: text/plain\n\nTest result\n--test--'
    });
  }
};

const defaultEvalStream = () => Promise.resolve({
  success: true,
  data: 'eval stream result'
});

const defaultStreamToDisk = () => {
  const dir = `/tmp/stream-test-${Date.now()}`;
  return Promise.resolve({
    success: true,
    index: {
      dir,
      parts: Array.from({ length: 3 }, (_, i) => ({
        contentType: i === 0 ? 'application/xml' : i === 1 ? 'application/json' : 'text/plain',
        primitive: i === 0 ? 'element()' : i === 1 ? 'object-node()' : 'xs:string',
        uri: `test/mock-${i + 1}`,
        path: `/test[${i + 1}]`,
        bytes: 100 + i * 50,
        file: `part-${i}.txt`
      }))
    }
  });
};

const defaultReadStreamParts = (dir, start = 0, count = 50) => {
  const totalParts = 3;
  const end = Math.min(totalParts, start + count);
  return Promise.resolve({
    success: true,
    records: Array.from({ length: end - start }, (_, i) => ({
      index: start + i,
      contentType: start + i === 0 ? 'application/xml' : start + i === 1 ? 'application/json' : 'text/plain',
      primitive: start + i === 0 ? 'element()' : start + i === 1 ? 'object-node()' : 'xs:string',
      uri: `test/mock-${start + i + 1}`,
      path: `/test[${start + i + 1}]`,
      content: `<result>Part ${start + i} data</result>`
    })),
    total: totalParts
  });
};

// ============================================================================
// Module State
// ============================================================================

/**
 * Module-level state for managing mock overrides and lifecycle.
 * Rebuilt by installElectronMock() and cleared by resetElectronMock().
 */
const mockState = {
  // Vi.fn mock references for database methods
  database: {},
  // Command execution mock
  runCommand: null,
  // HTTP request mock
  httpRequest: null,
  // Streaming mocks
  evalStream: null,
  streamToDisk: null,
  readStreamParts: null,
  // Stream progress listeners
  progressListeners: new Set(),
  // Environment metadata
  platform: process.platform || 'darwin',
  versions: {
    node: process.versions?.node || '18.0.0',
    electron: '27.0.0',
    chrome: '118.0.0'
  }
};

// ============================================================================
// Mock Factory
// ============================================================================

/**
 * Create a complete electronAPI mock matching preload.js
 * @private - Use installElectronMock() instead
 */
function createElectronMock() {
  // Initialize database mocks
  mockState.database = {
    saveQuery: vi.fn().mockImplementation(defaultDatabaseImpls.saveQuery),
    getRecentQueries: vi.fn().mockImplementation(defaultDatabaseImpls.getRecentQueries),
    getQueryById: vi.fn().mockImplementation(defaultDatabaseImpls.getQueryById),
    searchQueries: vi.fn().mockImplementation(defaultDatabaseImpls.searchQueries),
    getQueriesByType: vi.fn().mockImplementation(defaultDatabaseImpls.getQueriesByType),
    updateQueryStatus: vi.fn().mockImplementation(defaultDatabaseImpls.updateQueryStatus),
    deleteQuery: vi.fn().mockImplementation(defaultDatabaseImpls.deleteQuery),
    getStats: vi.fn().mockImplementation(defaultDatabaseImpls.getStats)
  };

  // Initialize other mocks
  mockState.runCommand = vi.fn().mockImplementation(defaultRunCommand);
  mockState.httpRequest = vi.fn().mockImplementation(defaultHttpRequest);
  mockState.evalStream = vi.fn().mockImplementation(defaultEvalStream);
  mockState.streamToDisk = vi.fn().mockImplementation(defaultStreamToDisk);
  mockState.readStreamParts = vi.fn().mockImplementation(defaultReadStreamParts);

  // Clear progress listeners
  mockState.progressListeners.clear();

  const mock = {
    // HTTP request handling
    httpRequest: mockState.httpRequest,

    // Eval stream - direct query execution with streaming
    evalStream: mockState.evalStream,

    // Stream response to disk and get an index
    // Matches electron/main.js:527 writeMultipartToDisk return value
    streamToDisk: mockState.streamToDisk,

    // Read a page of streamed parts from disk
    // Matches electron/main.js:705 response structure
    readStreamParts: mockState.readStreamParts,

    // Stream progress event handler
    onEvalStreamProgress: vi.fn().mockImplementation((callback) => {
      mockState.progressListeners.add(callback);
      // Return cleanup function
      return () => {
        mockState.progressListeners.delete(callback);
      };
    }),

    // Command execution
    runCommand: mockState.runCommand,

    // Database operations - matches electron/database.js format
    database: mockState.database,

    // Platform info
    platform: mockState.platform,

    // Version info
    versions: { ...mockState.versions }
  };

  return mock;
}

// ============================================================================
// Public API - Lifecycle
// ============================================================================

/**
 * Install the electron mock on window.electronAPI
 * Creates a fresh mock instance and installs it globally
 *
 * @param {object} [options] - Optional configuration
 * @param {object} [options.database] - Database method overrides
 * @param {function} [options.runCommand] - Command execution handler
 * @param {string} [options.platform] - Platform string (darwin, win32, linux)
 * @param {object} [options.versions] - Version info overrides
 * @returns {object} The installed mock instance
 *
 * @example
 * // Install with defaults
 * installElectronMock();
 *
 * @example
 * // Install with custom database handlers
 * installElectronMock({
 *   database: {
 *     getRecentQueries: () => Promise.resolve({ success: true, queries: [] })
 *   }
 * });
 */
export function installElectronMock(options = {}) {
  const mock = createElectronMock();

  // Apply factory options if provided
  if (options.database) {
    setDatabaseOverrides(options.database);
  }
  if (options.runCommand) {
    setRunCommandHandler(options.runCommand);
  }
  if (options.platform) {
    setPlatform(options.platform);
    mock.platform = mockState.platform;
  }
  if (options.versions) {
    setAppVersions(options.versions);
    mock.versions = { ...mockState.versions };
  }

  if (typeof window !== 'undefined') {
    window.electronAPI = mock;
  }
  if (typeof global !== 'undefined' && global.window) {
    global.window.electronAPI = mock;
  }

  return mock;
}

/**
 * Reset the electron mock to fresh state
 * Clears all vi.fn() call history, removes overrides, and reinstalls clean mock
 *
 * @returns {object} The reset mock instance
 *
 * @example
 * beforeEach(() => {
 *   resetElectronMock(); // Ensure clean state for each test
 * });
 */
export function resetElectronMock() {
  // Reset platform and versions to defaults
  mockState.platform = process.platform || 'darwin';
  mockState.versions = {
    node: process.versions?.node || '18.0.0',
    electron: '27.0.0',
    chrome: '118.0.0'
  };

  // Reinstall fresh mock
  return installElectronMock();
}

/**
 * Get the current electron mock instance
 * Useful for assertions in tests
 *
 * @returns {object | undefined} The current mock instance
 *
 * @example
 * const mock = getElectronMock();
 * expect(mock.database.getRecentQueries).toHaveBeenCalled();
 */
export function getElectronMock() {
  if (typeof window !== 'undefined') {
    return window.electronAPI;
  }
  if (typeof global !== 'undefined' && global.window) {
    return global.window.electronAPI;
  }
  return undefined;
}

// ============================================================================
// Public API - Database Overrides
// ============================================================================

/**
 * Override database method implementations for test scenarios
 * Preserves vi.fn() mocks for assertions while changing behavior
 * Clears call history when applying new implementation
 *
 * @param {object} overrides - Partial database method overrides
 * @returns {object} The database mock object for chaining/assertions
 *
 * @example
 * // Test error handling
 * setDatabaseOverrides({
 *   getRecentQueries: () => Promise.reject(new Error('Connection failed'))
 * });
 *
 * @example
 * // Test empty state
 * setDatabaseOverrides({
 *   getRecentQueries: () => Promise.resolve({ success: true, queries: [] })
 * });
 *
 * @example
 * // Restore defaults
 * setDatabaseOverrides(); // or pass null/undefined
 */
export function setDatabaseOverrides(overrides) {
  // Guard against null/undefined - treat as "restore defaults"
  if (!overrides) {
    Object.entries(defaultDatabaseImpls).forEach(([name, impl]) => {
      if (mockState.database[name]) {
        mockState.database[name].mockClear();
        mockState.database[name].mockImplementation(impl);
      }
    });
    return mockState.database;
  }

  // Apply overrides and clear call history
  Object.entries(overrides).forEach(([name, impl]) => {
    if (mockState.database[name]) {
      mockState.database[name].mockClear();
      mockState.database[name].mockImplementation(impl);
    }
  });
  return mockState.database;
}

// ============================================================================
// Public API - Command Handler
// ============================================================================

/**
 * Set custom command execution handler for test scenarios
 * Pass null or undefined to restore default
 * Clears call history when applying new implementation
 *
 * @param {function} [handler] - Custom command handler or null for default
 * @returns {object} The runCommand mock for assertions
 *
 * @example
 * // Test command failure
 * setRunCommandHandler(() => Promise.resolve({
 *   success: false,
 *   stdout: '',
 *   stderr: 'Command not found',
 *   exitCode: 127
 * }));
 *
 * @example
 * // Restore default
 * setRunCommandHandler();
 */
export function setRunCommandHandler(handler) {
  // Ensure mock exists before manipulating
  if (!mockState.runCommand) {
    throw new Error('setRunCommandHandler called before installElectronMock()');
  }

  mockState.runCommand.mockClear();
  mockState.runCommand.mockImplementation(handler || defaultRunCommand);
  return mockState.runCommand;
}

// ============================================================================
// Public API - Streaming Progress
// ============================================================================

/**
 * Emit stream progress event to all registered listeners
 * Useful for testing UI components that show progress
 *
 * @param {number} total - Total bytes or progress value
 *
 * @example
 * test('shows progress indicator', () => {
 *   const progressSpy = vi.fn();
 *   const cleanup = window.electronAPI.onEvalStreamProgress(progressSpy);
 *
 *   emitStreamProgress(50);
 *   expect(progressSpy).toHaveBeenCalledWith(50);
 *
 *   cleanup();
 * });
 */
export function emitStreamProgress(total) {
  mockState.progressListeners.forEach(callback => {
    callback(total);
  });
}

// ============================================================================
// Public API - Platform/Version Overrides
// ============================================================================

/**
 * Set platform for test scenarios
 * Affects window.electronAPI.platform
 *
 * @param {string} platform - Platform string (darwin, win32, linux, etc.)
 *
 * @example
 * test('Windows-specific behavior', () => {
 *   setPlatform('win32');
 *   expect(window.electronAPI.platform).toBe('win32');
 * });
 */
export function setPlatform(platform) {
  mockState.platform = platform;
  if (typeof window !== 'undefined' && window.electronAPI) {
    window.electronAPI.platform = platform;
  }
}

/**
 * Set version information for test scenarios
 * Affects window.electronAPI.versions
 *
 * @param {object} versions - Version info overrides
 * @param {string} [versions.node] - Node.js version
 * @param {string} [versions.electron] - Electron version
 * @param {string} [versions.chrome] - Chrome version
 *
 * @example
 * test('Version display', () => {
 *   setAppVersions({ electron: '28.0.0' });
 *   expect(window.electronAPI.versions.electron).toBe('28.0.0');
 * });
 */
export function setAppVersions(versions) {
  mockState.versions = { ...mockState.versions, ...versions };
  if (typeof window !== 'undefined' && window.electronAPI) {
    window.electronAPI.versions = { ...mockState.versions };
  }
}
