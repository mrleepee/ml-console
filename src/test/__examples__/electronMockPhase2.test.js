/**
 * Phase 2 Feature Examples for Electron Mock
 *
 * This file demonstrates the new Phase 2 capabilities:
 * - Database method overrides
 * - Command handler customization
 * - Streaming progress emission
 * - Platform/version overrides
 * - Factory options
 *
 * NOTE: These are examples/documentation, not run as part of the test suite
 */

import { describe, it, expect, vi } from 'vitest';
import {
  resetElectronMock,
  setDatabaseOverrides,
  setRunCommandHandler,
  emitStreamProgress,
  setPlatform,
  setAppVersions,
  installElectronMock
} from '../electronMock';

describe('Phase 2 Examples - Database Overrides', () => {
  it('example: testing error handling', async () => {
    // Override a specific method to simulate error
    setDatabaseOverrides({
      getRecentQueries: () => Promise.reject(new Error('Connection failed'))
    });

    // Test code that handles the error
    try {
      await window.electronAPI.database.getRecentQueries();
      expect.fail('Should have thrown');
    } catch (err) {
      expect(err.message).toBe('Connection failed');
    }
  });

  it('example: testing empty state', async () => {
    // Override to return empty results
    setDatabaseOverrides({
      getRecentQueries: () => Promise.resolve({ success: true, queries: [] })
    });

    const result = await window.electronAPI.database.getRecentQueries();
    expect(result.queries).toHaveLength(0);
  });

  it('example: testing custom data', async () => {
    // Provide custom test data
    const customQuery = {
      id: 999,
      content: 'let $doc := doc("/test.xml")\nreturn $doc',
      queryType: 'xquery',
      status: 'saved'
    };

    setDatabaseOverrides({
      getQueryById: (id) => Promise.resolve({
        success: true,
        query: { ...customQuery, id }
      })
    });

    const result = await window.electronAPI.database.getQueryById(999);
    expect(result.query.content).toContain('test.xml');
  });

  it('example: assertions still work with vi.fn()', async () => {
    // Override doesn't break vi.fn() assertions
    setDatabaseOverrides({
      saveQuery: (content) => Promise.resolve({
        success: true,
        id: 123,
        changes: 1,
        updated: false
      })
    });

    await window.electronAPI.database.saveQuery('test query');

    // Can still assert on the vi.fn()
    expect(window.electronAPI.database.saveQuery).toHaveBeenCalledWith('test query');
    expect(window.electronAPI.database.saveQuery).toHaveBeenCalledTimes(1);
  });
});

describe('Phase 2 Examples - Command Handler', () => {
  it('example: testing command failure', async () => {
    // Simulate command failure
    setRunCommandHandler(() => Promise.resolve({
      success: false,
      stdout: '',
      stderr: 'Command not found: invalid-cmd',
      exitCode: 127
    }));

    const result = await window.electronAPI.runCommand({ command: 'invalid-cmd' });
    expect(result.success).toBe(false);
    expect(result.exitCode).toBe(127);
  });

  it('example: testing command output', async () => {
    // Provide custom stdout
    setRunCommandHandler(({ command }) => Promise.resolve({
      success: true,
      stdout: `Output from ${command}`,
      stderr: '',
      exitCode: 0
    }));

    const result = await window.electronAPI.runCommand({ command: 'echo test' });
    expect(result.stdout).toContain('echo test');
  });

  it('example: restore default handler', async () => {
    // Custom handler
    setRunCommandHandler(() => Promise.resolve({ success: false, exitCode: 1 }));
    let result = await window.electronAPI.runCommand({});
    expect(result.success).toBe(false);

    // Restore default
    setRunCommandHandler();
    result = await window.electronAPI.runCommand({});
    expect(result.success).toBe(true);
    expect(result.stdout).toBe('command output');
  });
});

describe('Phase 2 Examples - Streaming Progress', () => {
  it('example: testing progress updates in UI', () => {
    const progressSpy = vi.fn();
    const cleanup = window.electronAPI.onEvalStreamProgress(progressSpy);

    // Simulate progress updates
    emitStreamProgress(25);
    emitStreamProgress(50);
    emitStreamProgress(100);

    expect(progressSpy).toHaveBeenCalledTimes(3);
    expect(progressSpy).toHaveBeenNthCalledWith(1, 25);
    expect(progressSpy).toHaveBeenNthCalledWith(2, 50);
    expect(progressSpy).toHaveBeenNthCalledWith(3, 100);

    cleanup();
  });

  it('example: testing progress cleanup', () => {
    const spy1 = vi.fn();
    const spy2 = vi.fn();

    const cleanup1 = window.electronAPI.onEvalStreamProgress(spy1);
    const cleanup2 = window.electronAPI.onEvalStreamProgress(spy2);

    emitStreamProgress(50);
    expect(spy1).toHaveBeenCalledWith(50);
    expect(spy2).toHaveBeenCalledWith(50);

    // Cleanup one listener
    cleanup1();
    spy1.mockClear();
    spy2.mockClear();

    emitStreamProgress(100);
    expect(spy1).not.toHaveBeenCalled();
    expect(spy2).toHaveBeenCalledWith(100);

    cleanup2();
  });
});

describe('Phase 2 Examples - Platform/Version Overrides', () => {
  it('example: testing Windows-specific code', () => {
    setPlatform('win32');
    expect(window.electronAPI.platform).toBe('win32');

    // Test code that behaves differently on Windows
    const separator = window.electronAPI.platform === 'win32' ? '\\' : '/';
    expect(separator).toBe('\\');
  });

  it('example: testing version display', () => {
    setAppVersions({
      electron: '28.0.0',
      chrome: '120.0.0'
    });

    expect(window.electronAPI.versions.electron).toBe('28.0.0');
    expect(window.electronAPI.versions.chrome).toBe('120.0.0');
    expect(window.electronAPI.versions.node).toBeDefined(); // Preserved
  });

  it('example: reset clears overrides', () => {
    setPlatform('linux');
    setAppVersions({ electron: '99.0.0' });

    expect(window.electronAPI.platform).toBe('linux');

    resetElectronMock();

    // Back to defaults
    expect(window.electronAPI.platform).toBe(process.platform);
    expect(window.electronAPI.versions.electron).toBe('27.0.0');
  });
});

describe('Phase 2 Examples - Factory Options', () => {
  it('example: install with custom database', () => {
    installElectronMock({
      database: {
        getRecentQueries: () => Promise.resolve({ success: true, queries: [] })
      }
    });

    // Mock is pre-configured
    const result = window.electronAPI.database.getRecentQueries();
    expect(result).resolves.toHaveProperty('queries', []);
  });

  it('example: install with custom platform', () => {
    installElectronMock({
      platform: 'win32',
      versions: {
        electron: '30.0.0'
      }
    });

    expect(window.electronAPI.platform).toBe('win32');
    expect(window.electronAPI.versions.electron).toBe('30.0.0');
  });

  it('example: install with all options', () => {
    installElectronMock({
      database: {
        getStats: () => Promise.resolve({
          success: true,
          stats: { total_queries: 0 }
        })
      },
      runCommand: () => Promise.resolve({
        success: true,
        stdout: 'custom output',
        stderr: '',
        exitCode: 0
      }),
      platform: 'darwin',
      versions: {
        electron: '31.0.0'
      }
    });

    expect(window.electronAPI.platform).toBe('darwin');
    expect(window.electronAPI.versions.electron).toBe('31.0.0');
  });
});

describe('Phase 2 Examples - Integration Patterns', () => {
  it('example: test database error recovery', async () => {
    let attemptCount = 0;

    // Fail first time, succeed second time
    setDatabaseOverrides({
      getRecentQueries: () => {
        attemptCount++;
        if (attemptCount === 1) {
          return Promise.reject(new Error('Timeout'));
        }
        return Promise.resolve({ success: true, queries: [] });
      }
    });

    // Simulate retry logic
    let result;
    try {
      result = await window.electronAPI.database.getRecentQueries();
    } catch (err) {
      // Retry
      result = await window.electronAPI.database.getRecentQueries();
    }

    expect(result.success).toBe(true);
    expect(attemptCount).toBe(2);
  });

  it('example: test streaming with progress', async () => {
    const progressUpdates = [];
    const cleanup = window.electronAPI.onEvalStreamProgress((total) => {
      progressUpdates.push(total);
    });

    // Simulate async streaming operation
    const streamPromise = window.electronAPI.streamToDisk({ url: 'test' });

    // Simulate progress updates during streaming
    emitStreamProgress(1024);
    emitStreamProgress(2048);
    emitStreamProgress(4096);

    const result = await streamPromise;
    expect(result.success).toBe(true);
    expect(progressUpdates).toEqual([1024, 2048, 4096]);

    cleanup();
  });
});
