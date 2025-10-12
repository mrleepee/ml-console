import React, { lazy, useMemo } from 'react';
import LoadingBoundary, { EditorFallback } from '../LoadingBoundary';
import { formatRecordContent } from '../../services/responseService';
import { calculateResultEditorHeight } from '../../utils/editorSizing';

// Lazy-load Monaco editor to reduce initial bundle size
const MonacoEditor = lazy(() => import('../MonacoEditor'));

/**
 * ResultRecord component displays a single query result record
 * Memoized to prevent unnecessary re-renders in result lists
 *
 * @param {Object} record - The result record data
 * @param {number} index - Local index within the page
 * @param {number} globalIndex - Global index across all results
 * @param {number} pageStart - Starting index of current page
 * @param {boolean} isActive - Whether this record is currently active/highlighted
 * @param {string} monacoTheme - Monaco editor theme
 * @param {Function} getMonacoLanguageFromContentType - Function to determine Monaco language
 */
const ResultRecord = React.memo(function ResultRecord({
  record,
  index,
  globalIndex,
  pageStart,
  isActive,
  monacoTheme,
  getMonacoLanguageFromContentType
}) {
  // Format content once and memoize
  const formattedContent = useMemo(() => formatRecordContent(record), [record]);
  const recordHeight = useMemo(() => calculateResultEditorHeight(formattedContent), [formattedContent]);

  const contentHash = record.content?.substring(0, 50)?.replace(/\W+/g, '') || 'empty';
  const stableId = `record-${globalIndex}-${record.uri || 'no-uri'}-${contentHash}`;
  const recordId = `record-${globalIndex}`;

  return (
    <div
      key={stableId}
      data-testid={`result-record-${index}`}
      className={`card bg-base-100 shadow-sm border ${isActive ? 'border-primary ring-2 ring-primary/20' : 'border-base-300'}`}
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
          <LoadingBoundary fallback={<EditorFallback height={recordHeight} />}>
            <MonacoEditor
              content={formattedContent}
              language={getMonacoLanguageFromContentType(record.contentType)}
              readOnly={true}
              height={recordHeight}
              path={stableId}
              theme={monacoTheme}
            />
          </LoadingBoundary>
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison: re-render when isActive, record content, or theme changes
  // Ignore function prop changes (getMonacoLanguageFromContentType)
  // CRITICAL: Check isActive FIRST - if it changed, must re-render to update border styling
  if (prevProps.isActive !== nextProps.isActive) {
    return false; // Force re-render when active state changes
  }

  // Skip re-render only if all relevant props are unchanged
  return (
    prevProps.record === nextProps.record &&
    prevProps.index === nextProps.index &&
    prevProps.monacoTheme === nextProps.monacoTheme &&
    prevProps.globalIndex === nextProps.globalIndex
  );
});

export default ResultRecord;
