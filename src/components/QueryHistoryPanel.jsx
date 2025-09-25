import React from 'react';

/**
 * QueryHistoryPanel Component
 *
 * A focused component for displaying and managing query history.
 * Provides a collapsible side panel with query history items, search, and actions.
 *
 * Features:
 * - Collapsible side panel with toggle button
 * - Query history list with item details
 * - Load query from history functionality
 * - Delete individual queries
 * - Refresh history
 * - Loading states
 * - Empty state when no history
 * - Query type badges and execution times
 *
 * @param {Object} props Component props
 * @param {boolean} props.showHistory Whether history panel is visible
 * @param {Function} props.onToggleHistory Callback to toggle history visibility
 * @param {Array} props.queryHistory Array of query history items
 * @param {boolean} props.historyLoading Whether history is loading
 * @param {Function} props.onLoadQuery Callback when loading query from history
 * @param {Function} props.onDeleteQuery Callback when deleting query
 * @param {Function} props.onRefreshHistory Callback when refreshing history
 * @returns {JSX.Element} QueryHistoryPanel component
 */
export default function QueryHistoryPanel({
  showHistory = true,
  onToggleHistory,
  queryHistory = [],
  historyLoading = false,
  onLoadQuery,
  onDeleteQuery,
  onRefreshHistory
}) {

  // Handle query item click
  const handleQueryClick = (historyItem) => {
    if (onLoadQuery) {
      onLoadQuery(historyItem.id);
    }
  };

  // Handle delete click with event propagation stop
  const handleDeleteClick = (historyItem, event) => {
    event.stopPropagation();
    if (onDeleteQuery) {
      onDeleteQuery(historyItem.id, event);
    }
  };

  // Format creation date
  const formatTime = (dateString) => {
    try {
      return new Date(dateString).toLocaleTimeString();
    } catch (error) {
      return 'Unknown time';
    }
  };

  // Render loading state
  const renderLoadingState = () => (
    <div className="flex items-center justify-center h-32">
      <div className="flex flex-col items-center gap-2">
        <span className="loading loading-spinner loading-md"></span>
        <span className="text-sm">Loading history...</span>
      </div>
    </div>
  );

  // Render empty state
  const renderEmptyState = () => (
    <div className="flex items-center justify-center h-32 text-base-content/50">
      <div className="text-center">
        <svg className="mx-auto h-8 w-8 text-base-content/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="mt-2 text-sm">No query history yet</p>
      </div>
    </div>
  );

  // Render history item
  const renderHistoryItem = (historyItem) => (
    <div
      key={historyItem.id}
      className="card bg-base-100 border border-base-300 hover:border-primary/50 cursor-pointer transition-colors"
      onClick={() => handleQueryClick(historyItem)}
    >
      <div className="card-body p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="badge badge-primary badge-sm">
              {historyItem.queryType.toUpperCase()}
            </span>
            <span className="text-xs text-base-content/60">
              {formatTime(historyItem.createdAt)}
            </span>
          </div>
          <button
            className="btn btn-ghost btn-xs btn-square"
            onClick={(e) => handleDeleteClick(historyItem, e)}
            title="Delete query"
          >
            ×
          </button>
        </div>
        <div className="text-sm text-base-content/80 font-mono mb-2">
          {historyItem.preview}
        </div>
        <div className="flex items-center justify-between text-xs text-base-content/60">
          <span>
            {historyItem.databaseName}
            {historyItem.modulesDatabase &&
             historyItem.modulesDatabase !== historyItem.databaseName &&
             ` (${historyItem.modulesDatabase})`
            }
          </span>
          {historyItem.executionTimeMs && (
            <span className="badge badge-outline badge-xs">
              {historyItem.executionTimeMs}ms
            </span>
          )}
        </div>
      </div>
    </div>
  );

  // If history is hidden, show expand button
  if (!showHistory) {
    return (
      <button
        onClick={onToggleHistory}
        className="btn btn-ghost btn-sm btn-square"
        title="Expand history panel"
      >
        →
      </button>
    );
  }

  // Render history panel
  return (
    <div className="card bg-base-100 shadow-sm border border-base-300 w-80 flex flex-col h-full overflow-hidden">
      <div className="card-header bg-base-200 px-4 py-3 border-b border-base-300">
        <div className="flex items-center justify-between">
          <h2 className="card-title text-lg">Query History</h2>
          <div className="card-actions flex gap-1">
            <button
              onClick={onToggleHistory}
              className="btn btn-ghost btn-sm btn-square"
              title="Collapse history panel"
            >
              ←
            </button>
            <button
              onClick={onRefreshHistory}
              className="btn btn-ghost btn-sm btn-square"
              disabled={historyLoading}
              title="Refresh history"
            >
              {historyLoading ? (
                <span className="loading loading-spinner loading-xs"></span>
              ) : (
                "↻"
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="card-body p-0 flex-1 overflow-y-auto min-h-0">
        {historyLoading ? renderLoadingState() : (
          queryHistory.length > 0 ? (
            <div className="space-y-2 p-2">
              {queryHistory.map(renderHistoryItem)}
            </div>
          ) : renderEmptyState()
        )}
      </div>
    </div>
  );
}