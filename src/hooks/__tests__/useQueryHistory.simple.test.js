import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import useQueryHistory from '../useQueryHistory';
import { setMockElectronAPI, clearMockElectronAPI } from '../../test/helpers/mockElectronAPI';

describe('useQueryHistory - Core Functionality', () => {
  const mockQueries = [
    {
      id: 1,
      content: 'xquery version "1.0-ml";\n\n(//book)[1 to 5]',
      queryType: 'xquery',
      databaseId: 'test-db',
      databaseName: 'Test Database',
      modulesDatabase: 'modules',
      modulesDatabaseId: '1',
      createdAt: '2024-01-15T10:30:00Z',
      preview: '(//book)[1 to 5]'
    }
  ];

  const mockDatabaseConfig = {
    id: 'test-db',
    name: 'Test Database',
    modulesDatabase: 'modules',
    modulesDatabaseId: '1'
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock window.electronAPI without wiping DOM constructors
    setMockElectronAPI({
      database: {
        getRecentQueries: vi.fn().mockResolvedValue({
          success: true,
          queries: mockQueries
        }),
        saveQuery: vi.fn().mockResolvedValue({
          success: true,
          queryId: 'new-query-123'
        }),
        getQueryById: vi.fn().mockResolvedValue({
          success: true,
          query: mockQueries[0]
        }),
        deleteQuery: vi.fn().mockResolvedValue({
          success: true
        })
      }
    });
  });

  afterEach(() => {
    clearMockElectronAPI();
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useQueryHistory());

    expect(result.current.queryHistory).toEqual([]);
    expect(result.current.historyLoading).toBe(false);
    expect(result.current.showHistory).toBe(true);
    expect(result.current.hasElectronAPI).toBe(true);
    expect(result.current.canSave).toBe(true);
  });

  it('should initialize with custom values', () => {
    const options = {
      initialShowHistory: false,
      defaultLimit: 25
    };

    const { result } = renderHook(() => useQueryHistory(options));

    expect(result.current.showHistory).toBe(false);
  });

  it('should load query history on initialization', async () => {
    const { result } = renderHook(() => useQueryHistory());

    await waitFor(() => {
      expect(result.current.queryHistory).toHaveLength(1);
    }, { timeout: 1000 });

    expect(global.window.electronAPI.database.getRecentQueries).toHaveBeenCalledWith(15);
    expect(result.current.queryHistory).toEqual(mockQueries);
    expect(result.current.hasQueries).toBe(true);
  });

  it('should load query history with custom limit', async () => {
    const { result } = renderHook(() => useQueryHistory());

    await act(async () => {
      await result.current.loadQueryHistory(25);
    });

    expect(global.window.electronAPI.database.getRecentQueries).toHaveBeenCalledWith(25);
  });

  it('should save query to history', async () => {
    const { result } = renderHook(() => useQueryHistory());

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.queryHistory).toHaveLength(1);
    }, { timeout: 1000 });

    let saveResult;
    await act(async () => {
      saveResult = await result.current.saveQueryToHistory(
        'test query',
        'xquery',
        mockDatabaseConfig,
        1500,
        'executed'
      );
    });

    expect(saveResult.success).toBe(true);
    expect(saveResult.queryId).toBe('new-query-123');

    expect(global.window.electronAPI.database.saveQuery).toHaveBeenCalledWith({
      content: 'test query',
      queryType: 'xquery',
      databaseId: 'test-db',
      databaseName: 'Test Database',
      modulesDatabase: 'modules',
      modulesDatabaseId: '1',
      executionTimeMs: 1500,
      status: 'executed'
    });
  });

  it('should load query by ID', async () => {
    const { result } = renderHook(() => useQueryHistory());

    let loadResult;
    await act(async () => {
      loadResult = await result.current.loadQueryFromHistory(1);
    });

    expect(loadResult.success).toBe(true);
    expect(loadResult.query).toEqual({
      content: mockQueries[0].content,
      queryType: mockQueries[0].queryType,
      databaseConfig: {
        id: mockQueries[0].databaseId,
        name: mockQueries[0].databaseName,
        modulesDatabase: mockQueries[0].modulesDatabase,
        modulesDatabaseId: mockQueries[0].modulesDatabaseId
      }
    });

    expect(global.window.electronAPI.database.getQueryById).toHaveBeenCalledWith(1);
  });

  it('should delete query from history', async () => {
    const { result } = renderHook(() => useQueryHistory());

    let deleteResult;
    await act(async () => {
      deleteResult = await result.current.deleteQueryFromHistory(1);
    });

    expect(deleteResult.success).toBe(true);
    expect(global.window.electronAPI.database.deleteQuery).toHaveBeenCalledWith(1);
  });

  it('should toggle history panel visibility', () => {
    const { result } = renderHook(() => useQueryHistory());

    expect(result.current.showHistory).toBe(true);

    act(() => {
      result.current.toggleHistory();
    });

    expect(result.current.showHistory).toBe(false);

    act(() => {
      result.current.toggleHistory();
    });

    expect(result.current.showHistory).toBe(true);
  });

  it('should handle electron API not available', async () => {
    // Clear electronAPI to simulate browser environment
    clearMockElectronAPI();

    const { result } = renderHook(() => useQueryHistory());

    expect(result.current.hasElectronAPI).toBe(false);
    expect(result.current.canSave).toBe(false);

    let loadResult;
    await act(async () => {
      loadResult = await result.current.loadQueryHistory();
    });

    expect(loadResult.success).toBe(false);
    expect(loadResult.error).toBe('Electron API not available');
  });

  it('should handle loading errors', async () => {
    global.window.electronAPI.database.getRecentQueries.mockResolvedValue({
      success: false,
      error: 'Database error'
    });

    const { result } = renderHook(() => useQueryHistory());

    await waitFor(() => {
      expect(result.current.queryHistory).toEqual([]);
    }, { timeout: 1000 });
  });

  it('should refresh history', async () => {
    const { result } = renderHook(() => useQueryHistory());

    await act(async () => {
      await result.current.refreshHistory();
    });

    expect(global.window.electronAPI.database.getRecentQueries).toHaveBeenCalledWith(15);
  });
});