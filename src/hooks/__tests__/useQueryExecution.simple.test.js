import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import useQueryExecution from '../useQueryExecution';

// Mock the dependencies
vi.mock('../../services/queryService');
vi.mock('../../services/responseService', () => ({
  toResultEnvelope: vi.fn(),
}));

import queryService from '../../services/queryService';
import { toResultEnvelope } from '../../services/responseService';

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

    // Setup default successful mocks
    queryService.executeQuery = vi.fn().mockResolvedValue({
      mode: 'static',
      data: 'test-result'
    });

    toResultEnvelope.mockReturnValue({
      rawText: 'raw test result',
      formattedText: 'formatted test result',
      rows: [{ data: 'test-row' }]
    });
  });

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

  it('should update query content', () => {
    const { result } = renderHook(() => useQueryExecution());

    act(() => {
      result.current.setQuery('new query content');
    });

    expect(result.current.query).toBe('new query content');
  });

  it('should update query type', () => {
    const { result } = renderHook(() => useQueryExecution());

    act(() => {
      result.current.setQueryType('javascript');
    });

    expect(result.current.queryType).toBe('javascript');
  });

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

  it('should handle successful static query execution', async () => {
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
    expect(executionResult.mode).toBe('static');
    expect(result.current.rawResults).toBe('raw test result');
    expect(result.current.results).toBe('formatted test result');
    expect(result.current.isLoading).toBe(false);

    expect(queryService.executeQuery).toHaveBeenCalledWith({
      query: result.current.query,
      queryType: result.current.queryType,
      databaseConfig: mockDatabaseConfig,
      serverUrl: mockServerUrl,
      auth: mockAuth,
      preferStream: true,
      signal: expect.any(AbortSignal)
    });
  });

  it('should handle streaming query execution', async () => {
    queryService.executeQuery.mockResolvedValue({
      mode: 'stream',
      streamIndex: 'test-stream-123'
    });

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
    expect(executionResult.mode).toBe('stream');
    expect(executionResult.streamIndex).toBe('test-stream-123');
  });

  it('should handle query errors gracefully', async () => {
    queryService.executeQuery.mockRejectedValue(new Error('Network error'));

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

  it('should clear results and errors', () => {
    const { result } = renderHook(() => useQueryExecution());

    act(() => {
      result.current.clearResults();
    });

    expect(result.current.error).toBe('');
    expect(result.current.results).toBe('');
    expect(result.current.rawResults).toBe('');
  });
});