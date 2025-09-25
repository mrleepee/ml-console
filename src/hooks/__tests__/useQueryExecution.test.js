import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import useQueryExecution from '../useQueryExecution';

// Mock the dependencies
vi.mock('../../services/queryService', () => ({
  default: {
    executeQuery: vi.fn(),
  }
}));

vi.mock('../../services/responseService', () => ({
  default: {
    toResultEnvelope: vi.fn(),
  }
}));

import queryService from '../../services/queryService';
import responseService from '../../services/responseService';

describe('useQueryExecution - Core Functionality', () => {
  const mockDatabaseConfig = {
    id: 'test-db',
    name: 'Test Database',
    modulesDatabase: 'modules',
    modulesDatabaseId: 'modules-1'
  };

  const mockAuth = { username: 'admin', password: 'admin' };
  const mockServerUrl = 'http://localhost:8000';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useQueryExecution());

      expect(result.current.query).toBe('xquery version "1.0-ml";\n\n(//*[not(*)])[1 to 3]');
      expect(result.current.queryType).toBe('xquery');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBe('');
      expect(result.current.results).toBe('');
      expect(result.current.rawResults).toBe('');
    });

    it('should initialize with custom values', () => {
      const options = {
        initialQuery: 'SELECT * FROM table',
        initialQueryType: 'sql'
      };

      const { result } = renderHook(() => useQueryExecution(options));

      expect(result.current.query).toBe('SELECT * FROM table');
      expect(result.current.queryType).toBe('sql');
    });

    it('should provide correct computed values', () => {
      const { result } = renderHook(() => useQueryExecution());

      expect(result.current.canExecute).toBe(true);
      expect(result.current.hasResults).toBe(false);
      expect(result.current.hasError).toBe(false);
    });
  });

  describe('query management', () => {
    it('should update query content', () => {
      const { result } = renderHook(() => useQueryExecution());

      act(() => {
        result.current.setQuery('new query content');
      });

      expect(result.current.query).toBe('new query content');
    });

    it('should clear error when query changes', () => {
      const { result } = renderHook(() => useQueryExecution());

      // Set an error first
      act(() => {
        result.current.executeQuery({
          databaseConfig: null,
          serverUrl: mockServerUrl,
          auth: mockAuth
        });
      });

      expect(result.current.error).toBeTruthy();

      // Change query should clear error
      act(() => {
        result.current.setQuery('new query');
      });

      expect(result.current.error).toBe('');
    });

    it('should update query type', () => {
      const { result } = renderHook(() => useQueryExecution());

      act(() => {
        result.current.setQueryType('javascript');
      });

      expect(result.current.queryType).toBe('javascript');
    });
  });

  describe('result management', () => {
    it('should clear results and errors', () => {
      const { result } = renderHook(() => useQueryExecution());

      // Set some state first
      act(() => {
        result.current.setQuery('test');
      });

      act(() => {
        result.current.clearResults();
      });

      expect(result.current.error).toBe('');
      expect(result.current.results).toBe('');
      expect(result.current.rawResults).toBe('');
    });
  });

  describe('validation', () => {
    it('should reject empty query', async () => {
      const { result } = renderHook(() => useQueryExecution());

      act(() => {
        result.current.setQuery('   ');
      });

      let executionResult;
      await act(async () => {
        executionResult = await result.current.executeQuery({
          databaseConfig: mockDatabaseConfig,
          serverUrl: mockServerUrl,
          auth: mockAuth
        });
      });

      expect(executionResult.success).toBe(false);
      expect(executionResult.error).toBe('Please enter a query');
      expect(result.current.error).toBe('Please enter a query');
    });

    it('should reject missing database config', async () => {
      const { result } = renderHook(() => useQueryExecution());

      let executionResult;
      await act(async () => {
        executionResult = await result.current.executeQuery({
          databaseConfig: null,
          serverUrl: mockServerUrl,
          auth: mockAuth
        });
      });

      expect(executionResult.success).toBe(false);
      expect(executionResult.error).toBe('Please select a database. Check your server connection and credentials.');
    });

    it('should reject database config without id', async () => {
      const { result } = renderHook(() => useQueryExecution());

      let executionResult;
      await act(async () => {
        executionResult = await result.current.executeQuery({
          databaseConfig: { name: 'test' }, // missing id
          serverUrl: mockServerUrl,
          auth: mockAuth
        });
      });

      expect(executionResult.success).toBe(false);
    });
  });

  describe('static query execution', () => {
    it('should handle successful static response', async () => {
      const mockResponse = { mode: 'static', data: 'test-data' };
      const mockEnvelope = {
        rawText: 'raw result',
        formattedText: 'formatted result',
        rows: [{ data: 'row1' }]
      };

      queryService.executeQuery.mockResolvedValue(mockResponse);
      responseService.toResultEnvelope.mockReturnValue(mockEnvelope);

      const onStaticResults = vi.fn();
      const onQuerySave = vi.fn();

      const { result } = renderHook(() => useQueryExecution());

      let executionResult;
      await act(async () => {
        executionResult = await result.current.executeQuery({
          databaseConfig: mockDatabaseConfig,
          serverUrl: mockServerUrl,
          auth: mockAuth,
          onStaticResults,
          onQuerySave
        });
      });

      expect(executionResult.success).toBe(true);
      expect(executionResult.mode).toBe('static');
      expect(executionResult.envelope).toEqual(mockEnvelope);
      expect(typeof executionResult.executionTime).toBe('number');

      expect(result.current.rawResults).toBe('raw result');
      expect(result.current.results).toBe('formatted result');
      expect(result.current.isLoading).toBe(false);

      expect(onStaticResults).toHaveBeenCalledWith([{ data: 'row1' }]);
      expect(onQuerySave).toHaveBeenCalled();
    });

    it('should handle empty static response', async () => {
      const mockResponse = { mode: 'static', data: null };
      const mockEnvelope = {
        rawText: '',
        formattedText: null,
        rows: []
      };

      queryService.executeQuery.mockResolvedValue(mockResponse);
      responseService.toResultEnvelope.mockReturnValue(mockEnvelope);

      const { result } = renderHook(() => useQueryExecution());

      let executionResult;
      await act(async () => {
        executionResult = await result.current.executeQuery({
          databaseConfig: mockDatabaseConfig,
          serverUrl: mockServerUrl,
          auth: mockAuth
        });
      });

      expect(executionResult.success).toBe(true);
      expect(result.current.results).toBe('Query executed successfully (no results)');
    });
  });

  describe('streaming query execution', () => {
    it('should handle successful streaming response', async () => {
      const mockResponse = {
        mode: 'stream',
        streamIndex: 'test-stream-index'
      };

      queryService.executeQuery.mockResolvedValue(mockResponse);

      const onStreamInitialize = vi.fn();
      const onQuerySave = vi.fn();

      const { result } = renderHook(() => useQueryExecution());

      let executionResult;
      await act(async () => {
        executionResult = await result.current.executeQuery({
          databaseConfig: mockDatabaseConfig,
          serverUrl: mockServerUrl,
          auth: mockAuth,
          onStreamInitialize,
          onQuerySave
        });
      });

      expect(executionResult.success).toBe(true);
      expect(executionResult.mode).toBe('stream');
      expect(executionResult.streamIndex).toBe('test-stream-index');
      expect(typeof executionResult.executionTime).toBe('number');

      expect(result.current.isLoading).toBe(false);
      expect(onStreamInitialize).toHaveBeenCalledWith('test-stream-index');
      expect(onQuerySave).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle query service errors', async () => {
      const error = new Error('Network error');
      queryService.executeQuery.mockRejectedValue(error);

      const { result } = renderHook(() => useQueryExecution());

      let executionResult;
      await act(async () => {
        executionResult = await result.current.executeQuery({
          databaseConfig: mockDatabaseConfig,
          serverUrl: mockServerUrl,
          auth: mockAuth
        });
      });

      expect(executionResult.success).toBe(false);
      expect(executionResult.error).toBe('Error: Network error');
      expect(result.current.error).toBe('Error: Network error');
      expect(result.current.isLoading).toBe(false);
    });

    it('should handle result too large error', async () => {
      const error = new Error('Payload too large');
      error.code = 'RESULT_TOO_LARGE';
      queryService.executeQuery.mockRejectedValue(error);

      const { result } = renderHook(() => useQueryExecution());

      let executionResult;
      await act(async () => {
        executionResult = await result.current.executeQuery({
          databaseConfig: mockDatabaseConfig,
          serverUrl: mockServerUrl,
          auth: mockAuth
        });
      });

      expect(executionResult.error).toContain('Result payload exceeds safe concatenation threshold');
      expect(result.current.error).toContain('Result payload exceeds safe concatenation threshold');
    });

    it('should handle unknown errors gracefully', async () => {
      const error = new Error();
      queryService.executeQuery.mockRejectedValue(error);

      const { result } = renderHook(() => useQueryExecution());

      let executionResult;
      await act(async () => {
        executionResult = await result.current.executeQuery({
          databaseConfig: mockDatabaseConfig,
          serverUrl: mockServerUrl,
          auth: mockAuth
        });
      });

      expect(executionResult.error).toBe('Error: Unknown error occurred');
    });
  });

  describe('cancellation', () => {
    it('should support query cancellation', async () => {
      // Mock a delayed response
      queryService.executeQuery.mockImplementation(() => new Promise((resolve) => {
        setTimeout(() => resolve({ mode: 'static', data: 'delayed' }), 100);
      }));

      const { result } = renderHook(() => useQueryExecution());

      // Start execution
      const executionPromise = act(async () => {
        return result.current.executeQuery({
          databaseConfig: mockDatabaseConfig,
          serverUrl: mockServerUrl,
          auth: mockAuth
        });
      });

      // Cancel immediately
      act(() => {
        result.current.cancelExecution();
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('should handle abort errors as cancellation', async () => {
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      queryService.executeQuery.mockRejectedValue(abortError);

      const { result } = renderHook(() => useQueryExecution());

      let executionResult;
      await act(async () => {
        executionResult = await result.current.executeQuery({
          databaseConfig: mockDatabaseConfig,
          serverUrl: mockServerUrl,
          auth: mockAuth
        });
      });

      expect(executionResult.success).toBe(false);
      expect(executionResult.cancelled).toBe(true);
      expect(result.current.error).toBe(''); // No error set for cancellation
    });
  });

  describe('keyboard shortcuts', () => {
    it('should detect Ctrl+Enter key combination', () => {
      const { result } = renderHook(() => useQueryExecution());

      const mockEvent = {
        ctrlKey: true,
        key: 'Enter',
        preventDefault: vi.fn()
      };

      const shouldExecute = result.current.handleQueryKeyDown(mockEvent);

      expect(shouldExecute).toBe(true);
      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    it('should ignore other key combinations', () => {
      const { result } = renderHook(() => useQueryExecution());

      const mockEvent = {
        ctrlKey: false,
        key: 'Enter',
        preventDefault: vi.fn()
      };

      const shouldExecute = result.current.handleQueryKeyDown(mockEvent);

      expect(shouldExecute).toBe(false);
      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe('loading state management', () => {
    it('should manage loading state during execution', async () => {
      // Mock a delayed response
      let resolveQuery;
      queryService.executeQuery.mockImplementation(() => new Promise((resolve) => {
        resolveQuery = resolve;
      }));

      const { result } = renderHook(() => useQueryExecution());

      expect(result.current.isLoading).toBe(false);

      // Start execution
      const executionPromise = act(async () => {
        return result.current.executeQuery({
          databaseConfig: mockDatabaseConfig,
          serverUrl: mockServerUrl,
          auth: mockAuth
        });
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.canExecute).toBe(false);

      // Resolve the promise
      await act(async () => {
        resolveQuery({ mode: 'static', data: 'test' });
        await executionPromise;
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.canExecute).toBe(true);
    });
  });
});