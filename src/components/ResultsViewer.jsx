import React from 'react';
import { formatRecordContent } from '../services/responseService';

/**
 * ResultsViewer Component
 *
 * A focused component for displaying query results with multiple view modes.
 * Supports table view with structured records and pagination, plus raw/parsed text views.
 *
 * Features:
 * - Multiple view modes (table, parsed, raw)
 * - Pagination for large result sets
 * - Record navigation within pages
 * - Monaco editor integration for syntax highlighting
 * - Error display
 * - Loading states
 *
 * @param {Object} props Component props
 * @param {boolean} props.isLoading Whether query is currently executing
 * @param {string} props.error Error message to display
 * @param {string} props.viewMode Current view mode (table, parsed, raw)
 * @param {Function} props.onViewModeChange Callback when view mode changes
 * @param {Array} props.tableData Array of record objects for table view
 * @param {string} props.results Formatted results text
 * @param {string} props.streamIndex Stream index for large results
 * @param {number} props.activeRecordIndex Currently active record index
 * @param {number} props.pageStart Current page start index
 * @param {number} props.pageSize Number of records per page
 * @param {number} props.totalRecords Total number of records
 * @param {Function} props.onPrevPage Callback for previous page
 * @param {Function} props.onNextPage Callback for next page
 * @param {Function} props.onPrevRecord Callback for previous record
 * @param {Function} props.onNextRecord Callback for next record
 * @param {Object} props.recordRefs Ref object for record elements
 * @param {Object} props.resultsOutputRef Ref for results output container
 * @param {React.Component} props.MonacoEditor Monaco editor component
 * @param {React.Component} props.MemoMonacoEditor Memoized Monaco editor component
 * @param {Function} props.getMonacoLanguageFromContentType Function to get language from content type
 * @returns {JSX.Element} ResultsViewer component
 */
export default function ResultsViewer({
  isLoading = false,
  error = '',
  viewMode = 'table',
  onViewModeChange,
  tableData = [],
  results = '',
  streamIndex = null,
  activeRecordIndex = 0,
  pageStart = 0,
  pageSize = 50,
  totalRecords = 0,
  onPrevPage,
  onNextPage,
  onPrevRecord,
  onNextRecord,
  recordRefs,
  resultsOutputRef,
  MonacoEditor,
  MemoMonacoEditor,
  getMonacoLanguageFromContentType
}) {

  const hasRecords = tableData.length > 0;

  // Render record in table view
  const renderRecord = (record, index) => {
    const globalIndex = typeof record.index === 'number' ? record.index : (pageStart + index);
    const contentHash = record.content?.substring(0, 50)?.replace(/\W+/g, '') || 'empty';
    const stableId = `record-${globalIndex}-${record.uri || 'no-uri'}-${contentHash}`;
    const recordId = `record-${globalIndex}`;

    return (
      <div
        key={stableId}
        className={`card bg-base-100 shadow-sm border ${index === activeRecordIndex ? 'border-primary ring-2 ring-primary/20' : 'border-base-300'}`}
        ref={(el) => {
          if (el) recordRefs.current[recordId] = el;
          else delete recordRefs.current[recordId];
        }}
        id={recordId}
      >
        <div className="card-header bg-primary text-primary-content px-4 py-2">
          <div className="flex justify-between items-center">
            <span className="font-medium">#{globalIndex + 1}</span>
            <span className="text-sm opacity-90">{record.uri || 'No URI'}</span>
          </div>
        </div>
        <div className="card-body p-4">
          <div className="flex flex-wrap gap-4 text-sm text-base-content/70 mb-4">
            <span><strong>Content Type:</strong> {record.contentType || 'Not available'}</span>
            <span><strong>Datatype:</strong> {record.primitive || 'Not available'}</span>
            {record.path && <span><strong>XPath:</strong> {record.path}</span>}
          </div>
          <div className="border border-base-300 rounded-lg overflow-hidden">
            <MemoMonacoEditor
              content={formatRecordContent(record)}
              language={getMonacoLanguageFromContentType(record.contentType)}
              readOnly={true}
              height="300px"
              path={stableId}
            />
          </div>
        </div>
      </div>
    );
  };

  // Render table view
  const renderTableView = () => {
    if (!hasRecords) {
      return (
        <div className="flex items-center justify-center h-32 text-base-content/50">
          <div className="text-center">
            <svg className="mx-auto h-12 w-12 text-base-content/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="mt-2">No results to display</p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4 p-4">
        {tableData.map(renderRecord)}
      </div>
    );
  };

  // Render text view (parsed or raw)
  const renderTextView = () => {
    if (streamIndex) {
      return (
        <div className="flex items-center justify-center h-32 text-base-content/60">
          <div className="text-center">
            <p className="text-sm">Large result streamed to disk. Use Table view with pagination to browse records.</p>
          </div>
        </div>
      );
    }

    return (
      <MonacoEditor
        content={results}
        language="plaintext"
        readOnly={true}
        height="400px"
      />
    );
  };

  // Render loading state
  const renderLoadingState = () => (
    <div className="flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-4">
        <span className="loading loading-spinner loading-lg"></span>
        <span className="text-lg">Executing query...</span>
      </div>
    </div>
  );

  // Render error state
  const renderError = () => (
    <div className="alert alert-error m-4">
      <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>{error}</span>
    </div>
  );

  return (
    <div className="card bg-base-100 shadow-sm border border-base-300 flex-1 flex flex-col min-w-0 overflow-hidden">
      <div className="card-header bg-base-200 px-4 py-3 border-b border-base-300">
        <div className="flex items-center justify-between">
          <h2 className="card-title text-lg">Results</h2>
          <div className="card-actions flex items-center gap-2">
            {/* View Mode Selector */}
            <select
              value={viewMode}
              onChange={(e) => onViewModeChange(e.target.value)}
              className="select select-bordered select-sm w-32"
            >
              <option value="table">Table View</option>
              <option value="parsed">Parsed Text</option>
              <option value="raw">Raw Output</option>
            </select>

            {/* Pagination Controls */}
            {viewMode === 'table' && streamIndex && (
              <div className="flex items-center gap-2">
                <button
                  className="btn btn-sm"
                  onClick={onPrevPage}
                  disabled={pageStart === 0}
                  title="Previous 50"
                >
                  Previous 50
                </button>
                <button
                  className="btn btn-sm"
                  onClick={onNextPage}
                  disabled={pageStart + pageSize >= totalRecords}
                  title="Next 50"
                >
                  Next 50
                </button>
                <span className="text-sm text-base-content/70">
                  {Math.min(pageStart + 1, totalRecords)}–{Math.min(pageStart + pageSize, totalRecords)} of {totalRecords}
                </span>
              </div>
            )}

            {/* Record Navigation Controls */}
            {viewMode === "table" && hasRecords && (
              <div className="flex items-center gap-2">
                <div className="join">
                  <button
                    onClick={onPrevRecord}
                    disabled={activeRecordIndex <= 0}
                    className="btn btn-sm btn-outline join-item"
                    title="Previous record (Ctrl+↑)"
                  >
                    ↑
                  </button>
                  <button
                    onClick={onNextRecord}
                    disabled={activeRecordIndex >= tableData.length - 1}
                    className="btn btn-sm btn-outline join-item"
                    title="Next record (Ctrl+↓)"
                  >
                    ↓
                  </button>
                </div>
                <span className="text-sm text-base-content/70">
                  {activeRecordIndex + 1} of {tableData.length}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card-body p-0 flex-1 min-w-0 overflow-hidden">
        {error && renderError()}

        <div className="results-output flex-1 min-w-0 overflow-hidden" ref={resultsOutputRef}>
          <div className="h-full w-full overflow-y-auto">
            {isLoading ? renderLoadingState() : (
              <div className="overflow-x-auto">
                {viewMode === "table" ? renderTableView() : (
                  <div className="p-4">
                    {renderTextView()}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}