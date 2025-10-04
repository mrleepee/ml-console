import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setMockElectronAPI, clearMockElectronAPI } from '../../test/helpers/mockElectronAPI';
import { renderHook, act, waitFor } from '@testing-library/react';
import useDatabaseConfig from '../useDatabaseConfig';

// Mock the dependencies
vi.mock('../../utils/databaseApi');
vi.mock('../../ipc/queryClient');

import { getServers, getDatabases, parseDatabaseConfigs } from '../../utils/databaseApi';
import { checkConnection } from '../../ipc/queryClient';

describe('useDatabaseConfig - Core Functionality', () => {
  const mockConfigs = [
    { id: 'db1', name: 'Database 1', modulesDatabase: 'modules', modulesDatabaseId: '1' },
    { id: 'db2', name: 'Database 2', modulesDatabase: 'modules', modulesDatabaseId: '2' }
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default successful mocks
    getServers.mockResolvedValue([{ name: 'test-server' }]);
    getDatabases.mockResolvedValue([{ name: 'test-db' }]);
    parseDatabaseConfigs.mockReturnValue(mockConfigs);
    checkConnection.mockResolvedValue({ ok: true });

    // Mock window.electronAPI without wiping DOM constructors
    setMockElectronAPI({
      httpRequest: vi.fn().mockResolvedValue({ status: 200, body: 'test' })
    });
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useDatabaseConfig());

    expect(result.current.server).toBe('localhost');
    expect(result.current.username).toBe('admin');
    expect(result.current.password).toBe('admin');
    expect(result.current.connectionStatus).toBe('disconnected');
    expect(result.current.databaseConfigs).toEqual([]);
  });

  it('should initialize with custom options', () => {
    const options = {
      initialServer: 'custom-host',
      initialUsername: 'custom-user',
      initialPassword: 'custom-pass'
    };

    const { result } = renderHook(() => useDatabaseConfig(options));

    expect(result.current.server).toBe('custom-host');
    expect(result.current.username).toBe('custom-user');
    expect(result.current.password).toBe('custom-pass');
  });

  it('should derive serverUrl correctly', () => {
    const { result } = renderHook(() => useDatabaseConfig({ initialServer: 'test-server' }));

    expect(result.current.serverUrl).toBe('http://test-server:8000');
  });

  it('should load database configurations', async () => {
    const { result } = renderHook(() => useDatabaseConfig());

    await waitFor(() => {
      expect(result.current.databaseConfigs).toHaveLength(2);
    }, { timeout: 1000 });

    expect(getServers).toHaveBeenCalled();
    expect(getDatabases).toHaveBeenCalled();
    expect(parseDatabaseConfigs).toHaveBeenCalled();
    expect(result.current.databaseConfigs).toEqual(mockConfigs);
  });

  it('should select database by ID', async () => {
    const { result } = renderHook(() => useDatabaseConfig());

    // Wait for configs to load
    await waitFor(() => {
      expect(result.current.databaseConfigs).toHaveLength(2);
    }, { timeout: 1000 });

    act(() => {
      result.current.selectDatabase('db2');
    });

    expect(result.current.selectedDatabaseConfig).toEqual(mockConfigs[1]);
  });

  it('should update connection settings', () => {
    const { result } = renderHook(() => useDatabaseConfig());

    act(() => {
      result.current.setServer('new-server');
      result.current.setUsername('new-user');
      result.current.setPassword('new-pass');
    });

    expect(result.current.server).toBe('new-server');
    expect(result.current.username).toBe('new-user');
    expect(result.current.password).toBe('new-pass');
  });

  it('should provide computed values', async () => {
    const { result } = renderHook(() => useDatabaseConfig());

    expect(result.current.isConnected).toBe(false);
    expect(result.current.hasConfigs).toBe(false);
    expect(result.current.hasValidSelection).toBe(false);

    // Wait for configs to load
    await waitFor(() => {
      expect(result.current.hasConfigs).toBe(true);
      expect(result.current.hasValidSelection).toBe(true);
    }, { timeout: 1000 });
  });

  it('should handle connection health check', async () => {
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

  it('should handle errors gracefully', async () => {
    getServers.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useDatabaseConfig());

    await waitFor(() => {
      expect(result.current.connectionStatus).toBe('error');
    }, { timeout: 1000 });

    expect(result.current.databaseConfigs).toEqual([]);
  });
});