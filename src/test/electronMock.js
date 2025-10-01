/**
 * Electron API Mock Factory
 *
 * Provides complete mock implementation of window.electronAPI matching electron/preload.js
 * Includes lifecycle management (install/reset) for deterministic testing.
 *
 * Phase 1 Features:
 * - Full preload.js API surface coverage
 * - Install/reset lifecycle helpers
 * - Streaming APIs with progress tracking
 * - Complete database operations
 * - Query cancellation
 * - Platform/version metadata
 */

import { vi } from 'vitest';

// Default mock responses
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

/**
 * Create a complete electronAPI mock matching preload.js
 */
export function createElectronMock() {
  // Stream progress listeners
  const progressListeners = new Set();

  const mock = {
    // HTTP request handling
    httpRequest: vi.fn().mockImplementation(({ url }) => {
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
    }),

    // Eval stream - direct query execution with streaming
    evalStream: vi.fn().mockResolvedValue({
      success: true,
      data: 'eval stream result'
    }),

    // Stream response to disk and get an index
    streamToDisk: vi.fn().mockImplementation(() => {
      return Promise.resolve({
        success: true,
        index: {
          directory: '/tmp/stream-test',
          totalParts: 10,
          metadata: { contentType: 'multipart/mixed' }
        }
      });
    }),

    // Read a page of streamed parts from disk
    readStreamParts: vi.fn().mockImplementation((dir, start = 0, count = 50) => {
      return Promise.resolve({
        success: true,
        parts: Array.from({ length: Math.min(count, 10) }, (_, i) => ({
          index: start + i,
          contentType: 'text/plain',
          data: `Part ${start + i} data`
        })),
        hasMore: start + count < 10
      });
    }),

    // Stream progress event handler
    onEvalStreamProgress: vi.fn().mockImplementation((callback) => {
      progressListeners.add(callback);
      // Return cleanup function
      return () => {
        progressListeners.delete(callback);
      };
    }),

    // Command execution
    runCommand: vi.fn().mockResolvedValue({
      success: true,
      stdout: 'command output',
      stderr: '',
      exitCode: 0
    }),

    // Database operations - matches electron/database.js format
    database: {
      saveQuery: vi.fn().mockResolvedValue({
        success: true,
        id: 1,
        changes: 1,
        updated: false,
        message: 'New query saved'
      }),

      getRecentQueries: vi.fn().mockImplementation((limit = 15) => {
        return Promise.resolve({
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
        });
      }),

      getQueryById: vi.fn().mockImplementation((id) => {
        return Promise.resolve({
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
        });
      }),

      searchQueries: vi.fn().mockImplementation((searchTerm, limit = 15) => {
        return Promise.resolve({
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
        });
      }),

      getQueriesByType: vi.fn().mockImplementation((queryType, limit = 15) => {
        return Promise.resolve({
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
        });
      }),

      updateQueryStatus: vi.fn().mockImplementation((id, status, executionTimeMs) => {
        return Promise.resolve({
          success: true,
          changes: 1
        });
      }),

      deleteQuery: vi.fn().mockResolvedValue({
        success: true,
        changes: 1
      }),

      getStats: vi.fn().mockResolvedValue({
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
    },

    // Platform info
    platform: process.platform || 'darwin',

    // Version info
    versions: {
      node: process.versions?.node || '18.0.0',
      electron: '27.0.0',
      chrome: '118.0.0'
    },

    // Internal helpers for testing (not part of preload API)
    _progressListeners: progressListeners,
    _emitProgress: (total) => {
      progressListeners.forEach(callback => callback(total));
    }
  };

  return mock;
}

/**
 * Install the electron mock on window.electronAPI
 * Creates a fresh mock instance and installs it globally
 */
export function installElectronMock() {
  const mock = createElectronMock();

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
 * Clears all vi.fn() call history and reinstalls clean mock
 */
export function resetElectronMock() {
  // Clear existing mock if present
  if (typeof window !== 'undefined' && window.electronAPI) {
    // Clear all vi.fn() mocks
    Object.keys(window.electronAPI).forEach(key => {
      if (typeof window.electronAPI[key]?.mockClear === 'function') {
        window.electronAPI[key].mockClear();
      }
    });

    // Clear database namespace mocks
    if (window.electronAPI.database) {
      Object.keys(window.electronAPI.database).forEach(key => {
        if (typeof window.electronAPI.database[key]?.mockClear === 'function') {
          window.electronAPI.database[key].mockClear();
        }
      });
    }

    // Clear progress listeners
    if (window.electronAPI._progressListeners) {
      window.electronAPI._progressListeners.clear();
    }
  }

  // Reinstall fresh mock
  return installElectronMock();
}

/**
 * Get the current electron mock instance
 * Useful for assertions in tests
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
