import { useState, useCallback, useEffect } from 'react';

/**
 * Custom hook for managing query history state
 *
 * Manages:
 * - Loading and refreshing query history
 * - Saving queries to history
 * - Loading queries from history
 * - Deleting queries from history
 * - History panel visibility
 *
 * @param {Object} options Configuration options
 * @param {boolean} options.initialShowHistory Initial visibility of history panel
 * @param {number} options.defaultLimit Default number of queries to load
 * @returns {Object} Query history state and controls
 */
export default function useQueryHistory({
  initialShowHistory = true,
  defaultLimit = 15
} = {}) {

  // History state
  const [queryHistory, setQueryHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(initialShowHistory);

  // Check if electron API is available
  const hasElectronAPI = useCallback(() => {
    return window.electronAPI && window.electronAPI.database;
  }, []);

  // Load query history from database
  const loadQueryHistory = useCallback(async (limit = defaultLimit) => {
    if (!hasElectronAPI()) {
      console.warn('Query history not available: Electron API not found');
      return { success: false, error: 'Electron API not available' };
    }

    try {
      setHistoryLoading(true);
      const result = await window.electronAPI.database.getRecentQueries(limit);

      if (result.success) {
        setQueryHistory(result.queries);
        return { success: true, queries: result.queries };
      } else {
        console.error('Failed to load query history:', result.error);
        setQueryHistory([]);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error loading query history:', error);
      setQueryHistory([]);
      return { success: false, error: error.message };
    } finally {
      setHistoryLoading(false);
    }
  }, [hasElectronAPI, defaultLimit]);

  // Save query to history
  const saveQueryToHistory = useCallback(async (content, queryType, databaseConfig, executionTimeMs = null, status = 'executed') => {
    if (!hasElectronAPI()) {
      console.warn('Query save not available: Electron API not found');
      return { success: false, error: 'Electron API not available' };
    }

    try {
      const result = await window.electronAPI.database.saveQuery({
        content,
        queryType,
        databaseId: databaseConfig?.id,
        databaseName: databaseConfig?.name,
        modulesDatabase: databaseConfig?.modulesDatabase,
        modulesDatabaseId: databaseConfig?.modulesDatabaseId,
        executionTimeMs,
        status
      });

      if (result.success) {
        // Refresh history to include the new query
        await loadQueryHistory();
        return { success: true, queryId: result.queryId };
      } else {
        console.error('Failed to save query:', result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error saving query to history:', error);
      return { success: false, error: error.message };
    }
  }, [hasElectronAPI, loadQueryHistory]);

  // Load specific query from history by ID
  const loadQueryFromHistory = useCallback(async (id) => {
    if (!hasElectronAPI()) {
      console.warn('Query load not available: Electron API not found');
      return { success: false, error: 'Electron API not available' };
    }

    try {
      const result = await window.electronAPI.database.getQueryById(id);

      if (result.success && result.query) {
        // Reconstruct database config from stored data
        const restoredConfig = result.query.databaseId ? {
          id: result.query.databaseId,
          name: result.query.databaseName,
          modulesDatabase: result.query.modulesDatabase || 'file-system',
          modulesDatabaseId: result.query.modulesDatabaseId || '0'
        } : null;

        return {
          success: true,
          query: {
            content: result.query.content,
            queryType: result.query.queryType,
            databaseConfig: restoredConfig
          }
        };
      } else {
        console.error('Failed to load query:', result.error);
        return { success: false, error: result.error || 'Query not found' };
      }
    } catch (error) {
      console.error('Error loading query from history:', error);
      return { success: false, error: error.message };
    }
  }, [hasElectronAPI]);

  // Delete query from history
  const deleteQueryFromHistory = useCallback(async (id) => {
    if (!hasElectronAPI()) {
      console.warn('Query delete not available: Electron API not found');
      return { success: false, error: 'Electron API not available' };
    }

    try {
      const result = await window.electronAPI.database.deleteQuery(id);

      if (result.success) {
        // Refresh history to remove the deleted query
        await loadQueryHistory();
        return { success: true };
      } else {
        console.error('Failed to delete query:', result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Error deleting query from history:', error);
      return { success: false, error: error.message };
    }
  }, [hasElectronAPI, loadQueryHistory]);

  // Clear all history
  const clearQueryHistory = useCallback(async () => {
    if (!hasElectronAPI()) {
      console.warn('History clear not available: Electron API not found');
      return { success: false, error: 'Electron API not available' };
    }

    try {
      // Note: This would need to be implemented in the Electron API
      // For now, we'll just clear the local state
      setQueryHistory([]);
      return { success: true };
    } catch (error) {
      console.error('Error clearing query history:', error);
      return { success: false, error: error.message };
    }
  }, [hasElectronAPI]);

  // Toggle history panel visibility
  const toggleHistory = useCallback(() => {
    setShowHistory(prev => !prev);
  }, []);

  // Refresh history (alias for loadQueryHistory with default limit)
  const refreshHistory = useCallback(async () => {
    return await loadQueryHistory();
  }, [loadQueryHistory]);

  // Auto-load history on initialization
  useEffect(() => {
    loadQueryHistory();
  }, [loadQueryHistory]);

  return {
    // History state
    queryHistory,
    historyLoading,
    showHistory,

    // Actions
    loadQueryHistory,
    saveQueryToHistory,
    loadQueryFromHistory,
    deleteQueryFromHistory,
    clearQueryHistory,
    refreshHistory,
    setShowHistory,
    toggleHistory,

    // Computed values
    hasQueries: queryHistory.length > 0,
    hasElectronAPI: hasElectronAPI(),
    canSave: hasElectronAPI(),
  };
}