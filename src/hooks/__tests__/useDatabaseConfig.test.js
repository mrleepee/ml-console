import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setMockElectronAPI, clearMockElectronAPI } from '../../test/helpers/mockElectronAPI';
import { renderHook, act, waitFor } from '@testing-library/react';
import useDatabaseConfig from '../useDatabaseConfig';

// Setup minimal DOM environment
Object.defineProperty(window, 'location', {
  value: { href: 'http://localhost:3000' },
  writable: true
});

// Mock the dependencies
vi.mock('../../utils/databaseApi', () => ({
  getServers: vi.fn(),
  getDatabases: vi.fn(),
  parseDatabaseConfigs: vi.fn(),
}));

vi.mock('../../ipc/queryClient', () => ({
  checkConnection: vi.fn(),
}));

// Import mocked modules to access them in tests
import { getServers, getDatabases, parseDatabaseConfigs } from '../../utils/databaseApi';
import { checkConnection } from '../../ipc/queryClient';

describe('useDatabaseConfig', () => {
  // Mock data for tests
  const mockServersData = [{ name: 'test-server' }];
  const mockDatabasesData = [{ name: 'test-db' }];
  const mockParsedConfigs = [
    {
      id: 'db1',
      name: 'Database 1',
      modulesDatabase: 'modules-db',
      modulesDatabaseId: 'modules-1'
    },
    {
      id: 'db2',
      name: 'Database 2',
      modulesDatabase: 'modules-db',
      modulesDatabaseId: 'modules-2'
    }
  ];

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup default mock implementations
    getServers.mockResolvedValue(mockServersData);
    getDatabases.mockResolvedValue(mockDatabasesData);
    parseDatabaseConfigs.mockReturnValue(mockParsedConfigs);
    checkConnection.mockResolvedValue({ ok: true });

    // Mock window.electronAPI without wiping DOM constructors
    setMockElectronAPI({
      httpRequest: vi.fn().mockResolvedValue({ status: 200, body: 'test' })
    });

    // Mock DOM environment for testing
    global.document = global.document || { getElementById: vi.fn() };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default values when no options provided', () => {
      const { result } = renderHook(() => useDatabaseConfig());

      expect(result.current.server).toBe('localhost');
      expect(result.current.username).toBe('admin');
      expect(result.current.password).toBe('admin');
      expect(result.current.connectionStatus).toBe('disconnected');
      expect(result.current.databaseConfigs).toEqual([]);
      expect(result.current.selectedDatabaseConfig).toEqual({
        name: '',
        id: '',
        modulesDatabase: '',
        modulesDatabaseId: ''
      });
    });

    it('should initialize with custom values when options provided', () => {
      const options = {
        initialServer: 'custom-server',
        initialUsername: 'custom-user',
        initialPassword: 'custom-pass'
      };

      const { result } = renderHook(() => useDatabaseConfig(options));

      expect(result.current.server).toBe('custom-server');
      expect(result.current.username).toBe('custom-user');
      expect(result.current.password).toBe('custom-pass');
    });

    it('should derive serverUrl from server hostname', () => {
      const { result } = renderHook(() => useDatabaseConfig({ initialServer: 'test-host' }));

      expect(result.current.serverUrl).toBe('http://test-host:8000');
    });
  });

  describe('database configuration loading', () => {
    it('should load database configurations on initialization', async () => {
      const { result } = renderHook(() => useDatabaseConfig());

      // Wait for the effect to complete
      await waitFor(() => {
        expect(result.current.databaseConfigs).toHaveLength(2);
      });

      expect(getServers).toHaveBeenCalledWith('localhost', 'admin', 'admin', expect.any(Function));
      expect(getDatabases).toHaveBeenCalledWith('localhost', 'admin', 'admin', expect.any(Function));
      expect(parseDatabaseConfigs).toHaveBeenCalledWith(mockServersData, mockDatabasesData);
      expect(result.current.databaseConfigs).toEqual(mockParsedConfigs);
    });

    it('should auto-select first database when none selected and configs available', async () => {
      const { result } = renderHook(() => useDatabaseConfig());

      await waitFor(() => {
        expect(result.current.selectedDatabaseConfig).toEqual(mockParsedConfigs[0]);
      });

      expect(result.current.currentDatabaseConfigRef.current).toEqual(mockParsedConfigs[0]);
    });

    it('should not reload configs when connection parameters are empty', () => {
      const { result } = renderHook(() => useDatabaseConfig({
        initialUsername: '',
        initialPassword: '',
        initialServer: ''
      }));

      expect(getServers).not.toHaveBeenCalled();
      expect(getDatabases).not.toHaveBeenCalled();
    });

    it('should reload configs when connection parameters change', async () => {
      const { result, rerender } = renderHook((props) => useDatabaseConfig(props), {
        initialProps: { initialServer: 'server1' }
      });

      // Wait for initial load
      await waitFor(() => {
        expect(getServers).toHaveBeenCalledTimes(1);
      });

      // Change server
      act(() => {
        result.current.setServer('server2');
      });

      // Wait for reload
      await waitFor(() => {
        expect(getServers).toHaveBeenCalledTimes(2);
      });

      expect(getServers).toHaveBeenLastCalledWith('server2', 'admin', 'admin', expect.any(Function));
    });
  });

  describe('error handling', () => {
    it('should handle database loading errors gracefully', async () => {
      const errorMessage = 'Network error';
      getServers.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useDatabaseConfig());

      await waitFor(() => {
        expect(result.current.connectionStatus).toBe('error');
      });

      expect(result.current.databaseConfigs).toEqual([]);
      expect(result.current.selectedDatabaseConfig).toEqual({
        name: '',
        id: '',
        modulesDatabase: '',
        modulesDatabaseId: ''
      });
    });

    it('should handle cancellation during database loading', async () => {
      // Mock an aborted signal scenario
      const abortError = new Error('Cancelled');
      abortError.name = 'AbortError';
      getServers.mockRejectedValue(abortError);

      const { result } = renderHook(() => useDatabaseConfig());

      // Should not set error status for cancellation
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(result.current.connectionStatus).toBe('disconnected');
    });
  });

  describe('database selection', () => {
    it('should select database by ID', async () => {
      const { result } = renderHook(() => useDatabaseConfig());

      // Wait for configs to load
      await waitFor(() => {
        expect(result.current.databaseConfigs).toHaveLength(2);
      });

      act(() => {
        result.current.selectDatabase('db2');
      });

      expect(result.current.selectedDatabaseConfig).toEqual(mockParsedConfigs[1]);
      expect(result.current.currentDatabaseConfigRef.current).toEqual(mockParsedConfigs[1]);
    });

    it('should select database by config object', async () => {
      const { result } = renderHook(() => useDatabaseConfig());

      // Wait for configs to load
      await waitFor(() => {
        expect(result.current.databaseConfigs).toHaveLength(2);
      });

      act(() => {
        result.current.selectDatabaseConfig(mockParsedConfigs[1]);
      });

      expect(result.current.selectedDatabaseConfig).toEqual(mockParsedConfigs[1]);
      expect(result.current.currentDatabaseConfigRef.current).toEqual(mockParsedConfigs[1]);
    });

    it('should ignore invalid database selection', async () => {
      const { result } = renderHook(() => useDatabaseConfig());

      await waitFor(() => {
        expect(result.current.selectedDatabaseConfig).toEqual(mockParsedConfigs[0]);
      });

      const originalSelection = result.current.selectedDatabaseConfig;

      act(() => {
        result.current.selectDatabase('invalid-id');
      });

      expect(result.current.selectedDatabaseConfig).toEqual(originalSelection);
    });
  });

  describe('connection management', () => {
    it('should update connection parameters individually', () => {
      const { result } = renderHook(() => useDatabaseConfig());

      act(() => {
        result.current.setServer('new-server');
      });
      expect(result.current.server).toBe('new-server');

      act(() => {
        result.current.setUsername('new-user');
      });
      expect(result.current.username).toBe('new-user');

      act(() => {
        result.current.setPassword('new-pass');
      });
      expect(result.current.password).toBe('new-pass');
    });

    it('should update connection parameters in batch', () => {
      const { result } = renderHook(() => useDatabaseConfig());

      act(() => {
        result.current.updateConnection('batch-server', 'batch-user', 'batch-pass');
      });

      expect(result.current.server).toBe('batch-server');
      expect(result.current.username).toBe('batch-user');
      expect(result.current.password).toBe('batch-pass');
    });

    it('should check connection health', async () => {
      const { result } = renderHook(() => useDatabaseConfig());

      await act(async () => {
        await result.current.checkConnectionHealth();
      });

      expect(checkConnection).toHaveBeenCalledWith({
        url: 'http://localhost:7997/LATEST/healthcheck',
        username: 'admin',
        password: 'admin',
        timeout: 10000,
      });
      expect(result.current.connectionStatus).toBe('connected');
    });

    it('should handle connection health check failure', async () => {
      checkConnection.mockRejectedValue(new Error('Connection failed'));

      const { result } = renderHook(() => useDatabaseConfig());

      await act(async () => {
        await result.current.checkConnectionHealth();
      });

      expect(result.current.connectionStatus).toBe('error');
    });
  });

  describe('computed values', () => {
    it('should provide correct computed values', async () => {
      const { result } = renderHook(() => useDatabaseConfig());

      // Initially disconnected with no configs
      expect(result.current.isConnected).toBe(false);
      expect(result.current.hasConfigs).toBe(false);
      expect(result.current.hasValidSelection).toBe(false);

      // Wait for configs to load and auto-select
      await waitFor(() => {
        expect(result.current.hasConfigs).toBe(true);
        expect(result.current.hasValidSelection).toBe(true);
      });

      // Manually check connection
      await act(async () => {
        await result.current.checkConnectionHealth();
      });

      expect(result.current.isConnected).toBe(true);
    });
  });

  describe('refresh functionality', () => {
    it('should refresh database configurations', async () => {
      const { result } = renderHook(() => useDatabaseConfig());

      // Wait for initial load
      await waitFor(() => {
        expect(getServers).toHaveBeenCalledTimes(1);
      });

      // Call refresh
      await act(async () => {
        await result.current.refresh();
      });

      expect(getServers).toHaveBeenCalledTimes(2);
      expect(getDatabases).toHaveBeenCalledTimes(2);
    });

    it('should propagate errors from refresh', async () => {
      const { result } = renderHook(() => useDatabaseConfig());

      getServers.mockRejectedValue(new Error('Refresh failed'));

      await expect(
        act(async () => {
          await result.current.refresh();
        })
      ).rejects.toThrow('Failed to get database configurations: Refresh failed');
    });
  });

  describe('fallback request handling', () => {
    it('should use fetch when electronAPI is not available', async () => {
      // Remove electronAPI
      global.window = {};
      global.fetch = vi.fn().mockResolvedValue({
        text: vi.fn().mockResolvedValue('fetch response'),
        status: 200
      });

      const { result } = renderHook(() => useDatabaseConfig());

      // Wait for makeRequest to be called during config loading
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      expect(global.fetch).toHaveBeenCalled();
    });

    it('should handle fetch errors gracefully', async () => {
      global.window = {};
      global.fetch = vi.fn().mockRejectedValue(new Error('Fetch failed'));

      const { result } = renderHook(() => useDatabaseConfig());

      await waitFor(() => {
        expect(result.current.connectionStatus).toBe('error');
      });
    });
  });
});