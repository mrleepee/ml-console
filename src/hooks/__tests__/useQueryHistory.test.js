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
    },
    {
      id: 2,
      content: 'SELECT * FROM documents',
      queryType: 'sql',
      databaseId: 'test-db-2',
      databaseName: 'Test Database 2',
      createdAt: '2024-01-14T09:15:00Z',
      preview: 'SELECT * FROM documents'
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
    vi.restoreAllMocks();
    clearMockElectronAPI();
  });

  describe('initialization', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useQueryHistory());

      expect(result.current.queryHistory).toEqual([]);
      expect(result.current.historyLoading).toBe(false);
      expect(result.current.showHistory).toBe(true);
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
        expect(result.current.queryHistory).toHaveLength(2);
      });

      expect(global.window.electronAPI.database.getRecentQueries).toHaveBeenCalledWith(15);
      expect(result.current.queryHistory).toEqual(mockQueries);
    });

    it('should provide correct computed values', async () => {
      const { result } = renderHook(() => useQueryHistory());

      expect(result.current.hasElectronAPI).toBe(true);
      expect(result.current.canSave).toBe(true);

      await waitFor(() => {
        expect(result.current.hasQueries).toBe(true);
      });
    });
  });

  describe('loading queries', () => {
    it('should load query history with default limit', async () => {
      const { result } = renderHook(() => useQueryHistory());

      let loadResult;
      await act(async () => {
        loadResult = await result.current.loadQueryHistory();
      });

      expect(loadResult.success).toBe(true);
      expect(loadResult.queries).toEqual(mockQueries);
      expect(global.window.electronAPI.database.getRecentQueries).toHaveBeenCalledWith(15);
    });

    it('should load query history with custom limit', async () => {
      const { result } = renderHook(() => useQueryHistory());

      await act(async () => {
        await result.current.loadQueryHistory(25);
      });

      expect(global.window.electronAPI.database.getRecentQueries).toHaveBeenCalledWith(25);
    });

    it('should handle loading errors', async () => {
      global.window.electronAPI.database.getRecentQueries.mockResolvedValue({
        success: false,
        error: 'Database error'
      });

      const { result } = renderHook(() => useQueryHistory());

      await waitFor(() => {
        expect(result.current.queryHistory).toEqual([]);
      });
    });

    it('should handle electron API not available', async () => {
      clearMockElectronAPI();

      const { result } = renderHook(() => useQueryHistory());

      let loadResult;
      await act(async () => {
        loadResult = await result.current.loadQueryHistory();
      });

      expect(loadResult.success).toBe(false);
      expect(loadResult.error).toBe('Electron API not available');
      expect(result.current.hasElectronAPI).toBe(false);
      expect(result.current.canSave).toBe(false);
    });
  });

  describe('saving queries', () => {
    it('should save query to history', async () => {
      const { result } = renderHook(() => useQueryHistory());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.queryHistory).toHaveLength(2);
      });

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

      // Should refresh history after save
      expect(global.window.electronAPI.database.getRecentQueries).toHaveBeenCalledTimes(2);
    });

    it('should handle save errors', async () => {
      global.window.electronAPI.database.saveQuery.mockResolvedValue({
        success: false,
        error: 'Save failed'
      });

      const { result } = renderHook(() => useQueryHistory());

      let saveResult;
      await act(async () => {
        saveResult = await result.current.saveQueryToHistory(
          'test query',
          'xquery',
          mockDatabaseConfig
        );
      });

      expect(saveResult.success).toBe(false);
      expect(saveResult.error).toBe('Save failed');
    });
  });

  describe('loading specific queries', () => {
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

    it('should handle missing database config in loaded query', async () => {
      const queryWithoutDb = { ...mockQueries[0] };
      delete queryWithoutDb.databaseId;

      global.window.electronAPI.database.getQueryById.mockResolvedValue({
        success: true,
        query: queryWithoutDb
      });

      const { result } = renderHook(() => useQueryHistory());

      let loadResult;
      await act(async () => {
        loadResult = await result.current.loadQueryFromHistory(1);
      });

      expect(loadResult.success).toBe(true);
      expect(loadResult.query.databaseConfig).toBe(null);
    });

    it('should handle query not found', async () => {
      global.window.electronAPI.database.getQueryById.mockResolvedValue({
        success: false,
        error: 'Query not found'
      });

      const { result } = renderHook(() => useQueryHistory());

      let loadResult;
      await act(async () => {
        loadResult = await result.current.loadQueryFromHistory(999);
      });

      expect(loadResult.success).toBe(false);
      expect(loadResult.error).toBe('Query not found');
    });
  });

  describe('deleting queries', () => {
    it('should delete query from history', async () => {
      const { result } = renderHook(() => useQueryHistory());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.queryHistory).toHaveLength(2);
      });

      let deleteResult;
      await act(async () => {
        deleteResult = await result.current.deleteQueryFromHistory(1);
      });

      expect(deleteResult.success).toBe(true);
      expect(global.window.electronAPI.database.deleteQuery).toHaveBeenCalledWith(1);

      // Should refresh history after delete
      expect(global.window.electronAPI.database.getRecentQueries).toHaveBeenCalledTimes(2);
    });

    it('should handle delete errors', async () => {
      global.window.electronAPI.database.deleteQuery.mockResolvedValue({
        success: false,
        error: 'Delete failed'
      });

      const { result } = renderHook(() => useQueryHistory());

      let deleteResult;
      await act(async () => {
        deleteResult = await result.current.deleteQueryFromHistory(1);
      });

      expect(deleteResult.success).toBe(false);
      expect(deleteResult.error).toBe('Delete failed');
    });
  });

  describe('history panel management', () => {
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

    it('should set history panel visibility', () => {
      const { result } = renderHook(() => useQueryHistory());

      act(() => {
        result.current.setShowHistory(false);
      });

      expect(result.current.showHistory).toBe(false);
    });
  });

  describe('utility functions', () => {
    it('should refresh history', async () => {
      const { result } = renderHook(() => useQueryHistory());

      await act(async () => {
        await result.current.refreshHistory();
      });

      expect(global.window.electronAPI.database.getRecentQueries).toHaveBeenCalledWith(15);
    });

    it('should clear query history', async () => {
      const { result } = renderHook(() => useQueryHistory());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.queryHistory).toHaveLength(2);
      });

      let clearResult;
      await act(async () => {
        clearResult = await result.current.clearQueryHistory();
      });

      expect(clearResult.success).toBe(true);
      expect(result.current.queryHistory).toEqual([]);
    });
  });

  describe('loading states', () => {
    it('should manage loading state during history load', async () => {
      let resolveQuery;
      global.window.electronAPI.database.getRecentQueries.mockImplementation(() => new Promise((resolve) => {
        resolveQuery = resolve;
      }));

      const { result } = renderHook(() => useQueryHistory());

      expect(result.current.historyLoading).toBe(true);

      await act(async () => {
        resolveQuery({ success: true, queries: mockQueries });
      });

      await waitFor(() => {
        expect(result.current.historyLoading).toBe(false);
      });
    });
  });
});