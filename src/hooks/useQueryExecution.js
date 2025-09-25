import { useState, useCallback, useRef } from 'react';
import queryService from '../services/queryService';
import { toResultEnvelope } from '../services/responseService';

/**
 * Custom hook for managing query execution state
 *
 * Manages:
 * - Query content and type
 * - Execution state (loading, errors)
 * - Result processing and formatting
 * - Cancellation support
 *
 * @param {Object} options Configuration options
 * @param {string} options.initialQuery Initial query content
 * @param {string} options.initialQueryType Initial query type
 * @returns {Object} Query execution state and controls
 */
export default function useQueryExecution({
  initialQuery = 'xquery version "1.0-ml";\n\n(//*[not(*)])[1 to 3]',
  initialQueryType = 'xquery'
} = {}) {

  // Query content state
  const [query, setQuery] = useState(initialQuery);
  const [queryType, setQueryType] = useState(initialQueryType);

  // Execution state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState('');
  const [rawResults, setRawResults] = useState('');

  // Execution tracking
  const abortControllerRef = useRef(null);
  const executionStartTimeRef = useRef(null);

  // Clear results and errors
  const clearResults = useCallback(() => {
    setError('');
    setResults('');
    setRawResults('');
  }, []);

  // Cancel current execution
  const cancelExecution = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  }, []);

  // Execute query with full error handling and cancellation support
  const executeQuery = useCallback(async ({
    databaseConfig,
    serverUrl,
    auth,
    onStreamInitialize,
    onStaticResults,
    onQuerySave,
    preferStream = true
  }) => {
    // Validation
    if (!query.trim()) {
      setError('Please enter a query');
      return { success: false, error: 'Please enter a query' };
    }

    if (!databaseConfig?.id) {
      const errorMsg = 'Please select a database. Check your server connection and credentials.';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }

    // Setup execution
    setIsLoading(true);
    clearResults();
    executionStartTimeRef.current = Date.now();

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    try {
      const response = await queryService.executeQuery({
        query,
        queryType,
        databaseConfig,
        serverUrl,
        auth,
        preferStream,
        signal: abortControllerRef.current.signal
      });

      // Check if cancelled
      if (abortControllerRef.current?.signal.aborted) {
        return { success: false, cancelled: true };
      }

      const executionTime = Date.now() - executionStartTimeRef.current;

      if (response.mode === 'stream') {
        // Handle streaming response
        if (onStreamInitialize) {
          await onStreamInitialize(response.streamIndex);
        }

        // Save query to history
        if (onQuerySave) {
          await onQuerySave(query, queryType, databaseConfig, executionTime, 'executed');
        }

        return {
          success: true,
          mode: 'stream',
          streamIndex: response.streamIndex,
          executionTime
        };

      } else {
        // Handle static response
        const envelope = toResultEnvelope(response);
        setRawResults(envelope.rawText);
        setResults(envelope.formattedText || 'Query executed successfully (no results)');

        if (onStaticResults) {
          onStaticResults(envelope.rows);
        }

        // Save query to history
        if (onQuerySave) {
          await onQuerySave(query, queryType, databaseConfig, executionTime, 'executed');
        }

        return {
          success: true,
          mode: 'static',
          envelope,
          executionTime
        };
      }

    } catch (err) {
      // Handle cancellation
      if (err.name === 'AbortError' || abortControllerRef.current?.signal.aborted) {
        console.log('Query execution was cancelled');
        return { success: false, cancelled: true };
      }

      console.error('Query execution error:', err);

      // Handle specific error types
      let errorMessage;
      if (err?.code === 'RESULT_TOO_LARGE') {
        errorMessage = 'Error: Result payload exceeds safe concatenation threshold. Try streaming mode or refine the query.';
      } else {
        errorMessage = `Error: ${err.message || 'Unknown error occurred'}`;
      }

      setError(errorMessage);
      return { success: false, error: errorMessage };

    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [query, queryType, clearResults]);

  // Keyboard shortcut handler for Ctrl+Enter
  const handleQueryKeyDown = useCallback((e) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      // Caller should handle execution with required parameters
      return true;
    }
    return false;
  }, []);

  // Update query content
  const updateQuery = useCallback((newQuery) => {
    setQuery(newQuery);
    // Clear errors when query changes
    if (error) setError('');
  }, [error]);

  // Update query type
  const updateQueryType = useCallback((newQueryType) => {
    setQueryType(newQueryType);
  }, []);

  return {
    // Query state
    query,
    queryType,

    // Execution state
    isLoading,
    error,
    results,
    rawResults,

    // Execution info
    executionStartTime: executionStartTimeRef.current,

    // Actions
    setQuery: updateQuery,
    setQueryType: updateQueryType,
    executeQuery,
    cancelExecution,
    clearResults,
    handleQueryKeyDown,

    // Computed values
    canExecute: !isLoading && query.trim().length > 0,
    hasResults: results.length > 0 || rawResults.length > 0,
    hasError: error.length > 0,
  };
}