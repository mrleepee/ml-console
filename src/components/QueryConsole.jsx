import React from 'react';
import QueryEditor from './QueryEditor';

/**
 * QueryConsole Component
 *
 * A focused component for query input and execution controls.
 * Encapsulates the query editor, execution button, and smart text wrapping functionality.
 *
 * Features:
 * - Query editing with Monaco editor
 * - Execute button with loading state
 * - Smart text wrapping for brackets and quotes
 * - Keyboard shortcuts (Ctrl+Enter)
 * - Query type and theme support
 *
 * @param {Object} props Component props
 * @param {string} props.query Current query content
 * @param {Function} props.onQueryChange Callback when query content changes
 * @param {Function} props.onExecute Callback when query should be executed
 * @param {boolean} props.isLoading Whether query is currently executing
 * @param {string} props.queryType Type of query (xquery, sparql, javascript)
 * @param {string} props.theme Monaco editor theme
 * @param {boolean} props.showHistory Whether history panel is visible (affects editor key)
 * @returns {JSX.Element} QueryConsole component
 */
export default function QueryConsole({
  query,
  onQueryChange,
  onExecute,
  isLoading = false,
  queryType = 'xquery',
  theme = 'vs',
  showHistory = true
}) {

  // Smart text wrapping for brackets and quotes
  const handleQueryKeyDown = (e) => {
    // Handle Ctrl+Enter for execution
    if (e.ctrlKey && e.key === "Enter") {
      e.preventDefault();
      onExecute();
      return;
    }

    // Handle smart wrapping
    const textarea = e.target;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);

    // Only wrap if there's selected text
    if (start === end || !selectedText) return;

    let wrapChars = null;
    switch (e.key) {
      case '(': wrapChars = ['(', ')']; break;
      case '[': wrapChars = ['[', ']']; break;
      case '{': wrapChars = ['{', '}']; break;
      case '"': wrapChars = ['"', '"']; break;
      case "'": wrapChars = ["'", "'"]; break;
      case '`': wrapChars = ['`', '`']; break;
      default: return;
    }

    if (wrapChars) {
      e.preventDefault();
      const before = textarea.value.substring(0, start);
      const after = textarea.value.substring(end);
      const wrapped = wrapChars[0] + selectedText + wrapChars[1];
      const newValue = before + wrapped + after;
      onQueryChange({ target: { value: newValue } });

      // Restore selection
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + wrapChars[0].length, end + wrapChars[0].length);
      }, 0);
    }
  };

  // Get language for Monaco editor based on query type
  const getMonacoLanguageFromQueryType = (queryType) => {
    switch (queryType) {
      case 'xquery': return 'xquery';
      case 'sparql': return 'sparql';
      case 'javascript': return 'javascript';
      default: return 'xquery';
    }
  };

  // Get placeholder text based on query type
  const getPlaceholderText = (queryType) => {
    switch (queryType) {
      case 'xquery': return 'Enter your XQuery query here...';
      case 'sparql': return 'Enter your SPARQL query here...';
      case 'javascript': return 'Enter your JavaScript query here...';
      default: return 'Enter your query here...';
    }
  };

  return (
    <div className="card bg-base-100 shadow-sm border border-base-300">
      <div className="card-header bg-base-200 px-4 py-3 border-b border-base-300">
        <div className="flex items-center justify-between">
          <h2 className="card-title text-lg">Query</h2>
          <div className="card-actions">
            <button
              onClick={onExecute}
              disabled={isLoading}
              className="btn btn-primary btn-sm"
            >
              {isLoading ? (
                <>
                  <span className="loading loading-spinner loading-xs"></span>
                  Executing...
                </>
              ) : (
                "Execute (Ctrl+Enter)"
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Fixed/controlled height + overflow hidden so Monaco can't grow infinitely */}
      <div
        className="card-body p-0 overflow-hidden"
        style={{ height: '40vh', minHeight: '260px' }}
      >
        <div className="h-full w-full min-w-0">
          {/* key forces clean re-measure when sidebar toggles */}
          <QueryEditor
            key={showHistory ? 'withHistory' : 'withoutHistory'}
            value={query}
            onChange={onQueryChange}
            onKeyDown={handleQueryKeyDown}
            language={getMonacoLanguageFromQueryType(queryType)}
            placeholder={getPlaceholderText(queryType)}
            disabled={isLoading}
            theme={theme}
          />
        </div>
      </div>
    </div>
  );
}