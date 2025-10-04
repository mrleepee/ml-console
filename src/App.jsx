import React, { useState, useEffect, useRef, useCallback } from "react";
import Editor from '@monaco-editor/react';
import {
  parseMultipartResponse,
  formatRecordContent,
  toResultEnvelope,
} from "./services/responseService";
import QueryEditor from "./components/QueryEditor";
import QueryEditorControls from "./components/QueryEditorControls";
import useEditorPreferences, { EditorPreferencesProvider } from "./hooks/useEditorPreferences";
import { getServers, getDatabases, parseDatabaseConfigs } from "./utils/databaseApi";
import { defineCustomMonacoThemes, getEnhancedTheme } from "./utils/monacoThemes";
import { XQUERY_LANGUAGE } from "./utils/monacoXqueryConstants";
import { monacoOptimizationManager } from "./utils/monacoOptimizations";
import "./App.css";
import useStreamingResults from "./hooks/useStreamingResults";
import queryService from "./services/queryService";
import { request as ipcRequest, checkConnection as adapterCheck } from "./ipc/queryClient";
import useTheme from "./hooks/useTheme";
import useDatabaseConfig from "./hooks/useDatabaseConfig";
import ThemeSelector from "./components/ThemeSelector";

function App() {
  console.log("🚀 App component loaded - React code is running!");
  
  // Content-Type to Monaco language mapping
  function getMonacoLanguageFromContentType(contentType) {
    if (!contentType) return 'plaintext';
    const type = contentType.toLowerCase();
    if (type.includes('json')) return 'json';
    if (type.includes('xml')) return 'xml';
    if (type.includes('html')) return 'html';
    if (type.includes('javascript') || type.includes('js')) return 'javascript';
    return 'plaintext';
  }

  // Query type to Monaco language mapping
  function getMonacoLanguageFromQueryType(queryType) {
    switch (queryType) {
      case 'javascript': return 'javascript';
      case 'xquery': return XQUERY_LANGUAGE;
      case 'sparql': return 'sql'; // SPARQL is similar to SQL
      default: return 'plaintext';
    }
  }

  const [query, setQuery] = useState('xquery version "1.0-ml";\n\n(//*[not(*)])[1 to 3]');
  const [results, setResults] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [queryType, setQueryType] = useState("xquery");
  const [activeTab, setActiveTab] = useState("console");
  const [rawResults, setRawResults] = useState("");
  const [viewMode, setViewMode] = useState("table"); // "table", "parsed", "raw"
  const pageSize = 50;
  const {
    state: streamState,
    reset: resetStreaming,
    initializeStream,
    loadStaticRecords,
    nextPage: nextStreamPage,
    prevPage: prevStreamPage,
    goToNextRecord: advanceStreamRecord,
    goToPrevRecord: rewindStreamRecord,
    setActiveRecordIndex: setStreamActiveRecordIndex,
  } = useStreamingResults({ pageSize });
  const { records: tableData, pagination, totalRecords, activeRecordIndex, mode: streamMode, index: streamIndex } = streamState;
  const pageStart = pagination.start;
  const hasRecords = tableData && tableData.length > 0;
  const activeRecord = hasRecords ? tableData[Math.min(Math.max(activeRecordIndex,0), tableData.length-1)] : null;
  const [queryHistory, setQueryHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(true);

  // Use the existing theme hook with persistence
  const {
    theme,
    monacoTheme,
    setMonacoTheme,
    toggleTheme
  } = useTheme({
    initialTheme: 'light',
    initialMonacoTheme: 'vs',
    persistTheme: true
  });

  // Editor preferences hook for Monaco editor customization
  const {
    preferences: editorPreferences,
    updatePreference,
    updatePreferences,
    increaseFontSize,
    decreaseFontSize,
    toggleLineNumbers,
    toggleWordWrap,
    toggleMinimap
  } = useEditorPreferences();

  // Use the enhanced database config hook with persistence
  const {
    server,
    username,
    password,
    serverUrl,
    connectionStatus,
    selectedDatabaseConfig,
    databaseConfigs,
    currentDatabaseConfigRef,
    setServer,
    setUsername,
    setPassword,
    selectDatabase,
    selectDatabaseConfig,
    updateConnection,
    refresh,
    checkConnectionHealth,
    isConnected,
    hasConfigs,
    hasValidSelection
  } = useDatabaseConfig({
    initialServer: 'localhost',
    initialUsername: 'admin',
    initialPassword: 'admin',
    persistConfig: true
  });

  const recordRefs = useRef({});
  const resultsOutputRef = useRef(null);

  // Record navigation functions
  const scrollToRecord = (index) => {
    const recordId = `record-${index}`;
    const element = recordRefs.current[recordId];
    const container = resultsOutputRef.current;
    if (element && container) {
      const containerRect = container.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      const currentScroll = container.scrollTop;
      const containerTop = containerRect.top;
      const elementTop = elementRect.top;
      const targetScroll = currentScroll + (elementTop - containerTop) - 20;
      container.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' });
      setStreamActiveRecordIndex(index);
    }
  };

  const goToPrevRecord = () => {
    if (!hasRecords) return;
    const target = Math.max(rewindStreamRecord(), 0);
    scrollToRecord(target);
  };
  const goToNextRecord = () => {
    if (!hasRecords) return;
    const target = Math.min(advanceStreamRecord(), tableData.length - 1);
    scrollToRecord(target);
  };

  const nextPage = async () => {
    await nextStreamPage();
  };

  const prevPage = async () => {
    await prevStreamPage();
  };


  // Database helper functions
  async function saveQueryToHistory(content, queryType, databaseConfig, executionTimeMs = null, status = 'executed') {
    try {
      if (window.electronAPI && window.electronAPI.database) {
        const result = await window.electronAPI.database.saveQuery({
          content,
          queryType,
          databaseName: databaseConfig.name,
          databaseId: databaseConfig.id,
          modulesDatabase: databaseConfig.modulesDatabase,
          modulesDatabaseId: databaseConfig.modulesDatabaseId,
          executionTimeMs,
          status
        });
        if (result.success) {
          loadQueryHistory();
        } else {
          console.error('Failed to save query:', result.error);
        }
      }
    } catch (error) {
      console.error('Error saving query to history:', error);
    }
  }

  const loadQueryHistory = useCallback(async (limit = 15) => {
    try {
      if (window.electronAPI && window.electronAPI.database) {
        setHistoryLoading(true);
        const result = await window.electronAPI.database.getRecentQueries(limit);
        if (result.success) setQueryHistory(result.queries);
        else {
          console.error('Failed to load query history:', result.error);
          setQueryHistory([]);
        }
      }
    } catch (error) {
      console.error('Error loading query history:', error);
      setQueryHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  async function loadQueryFromHistory(id) {
    try {
      if (window.electronAPI && window.electronAPI.database) {
        const result = await window.electronAPI.database.getQueryById(id);
        if (result.success && result.query) {
          setQuery(result.query.content);
          setQueryType(result.query.queryType);
          if (result.query.databaseId && result.query.databaseName) {
            const restoredConfig = {
              id: result.query.databaseId,
              name: result.query.databaseName,
              modulesDatabase: result.query.modulesDatabase || 'file-system',
              modulesDatabaseId: result.query.modulesDatabaseId || '0'
            };
            const existingConfig = databaseConfigs.find(c => c.id === restoredConfig.id);
            if (existingConfig) selectDatabaseConfig(existingConfig);
            else selectDatabaseConfig(restoredConfig);
          }
        } else {
          console.error('Failed to load query:', result.error);
        }
      }
    } catch (error) {
      console.error('Error loading query from history:', error);
    }
  }

  async function deleteQueryFromHistory(id, event) {
    event.stopPropagation();
    try {
      if (window.electronAPI && window.electronAPI.database) {
        const result = await window.electronAPI.database.deleteQuery(id);
        if (result.success) loadQueryHistory();
        else console.error('Failed to delete query:', result.error);
      }
    } catch (error) {
      console.error('Error deleting query from history:', error);
    }
  }

  // Monaco editor for record content (read-only viewer)
  function MonacoEditor({ content, language, readOnly = true, height = "200px", path, theme = "vs" }) {
    const [editorMounted, setEditorMounted] = useState(false);
    const editorRef = useRef(null);

    const formatContent = React.useCallback(async () => {
      if (editorRef.current && content && (language === 'json' || language === 'xml' || language === 'html')) {
        try {
          await new Promise(resolve => setTimeout(resolve, 100));
          const action = editorRef.current.getAction('editor.action.formatDocument');
          if (action) await action.run();
        } catch (error) {
          console.debug('Auto-format failed:', error);
        }
      }
    }, [content, language]);

    const handleEditorMount = React.useCallback(async (editor, monaco) => {
      editorRef.current = editor;
      setEditorMounted(true);
      defineCustomMonacoThemes(monaco);
      await monacoOptimizationManager.registerXQueryLanguageOptimized(monaco);
    }, []);

    useEffect(() => { if (editorMounted && content) formatContent(); }, [editorMounted, content, formatContent]);

    return (
      <div style={{ height, width: "100%", border: "1px solid #ddd", borderRadius: "4px" }}>
        <Editor
          height={height}
          language={language}
          value={content}
          path={path}
          keepCurrentModel={true}
          onMount={handleEditorMount}
          options={{
            readOnly,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            fontSize: 12,
            fontFamily: "Monaco, Menlo, 'Ubuntu Mono', monospace",
            lineNumbers: 'on',
            folding: true,
            foldingStrategy: 'indentation',
            showFoldingControls: 'mouseover',
            lineDecorationsWidth: 10,
            lineNumbersMinChars: 3,
            renderLineHighlight: 'none',
            selectOnLineNumbers: true,
            selectionHighlight: true,
            occurrencesHighlight: true,
            renderWhitespace: 'selection',
            showUnused: true,
            multiCursorModifier: 'alt',
            multiCursorMergeOverlapping: true,
            automaticLayout: true,
            tabSize: 2,
            insertSpaces: true,
            detectIndentation: true,
            formatOnPaste: true,
            formatOnType: false,
            dragAndDrop: true,
            mouseWheelZoom: false,
            contextmenu: true,
            hideCursorInOverviewRuler: false,
            overviewRulerBorder: false,
            find: { autoFindInSelection: 'never', seedSearchStringFromSelection: 'never' }
          }}
          theme={getEnhancedTheme(theme)}
        />
      </div>
    );
  }

  const MemoMonacoEditor = React.memo(MonacoEditor, (prev, next) =>
    prev.content === next.content &&
    prev.language === next.language &&
    prev.readOnly === next.readOnly &&
    prev.height === next.height &&
    prev.path === next.path &&
    prev.theme === next.theme
  );


  useEffect(() => { loadQueryHistory(); }, []);

  // Force Monaco to relayout when the sidebar opens/closes
  useEffect(() => {
    // Give the DOM a beat to settle then notify all listeners
    const id = setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
    return () => clearTimeout(id);
  }, [showHistory]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (viewMode === "table" && hasRecords) {
        if (e.key === 'ArrowUp' && e.ctrlKey) { e.preventDefault(); goToPrevRecord(); }
        else if (e.key === 'ArrowDown' && e.ctrlKey) { e.preventDefault(); goToNextRecord(); }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, hasRecords, activeRecordIndex, tableData.length]);

  // View mode change
  useEffect(() => {
    if (!rawResults || streamMode === 'stream') return;
    if (viewMode === "raw") setResults(rawResults);
    else if (viewMode === "parsed") {
      try {
        const cleanedResults = parseMultipartResponse(rawResults);
        setResults(cleanedResults || "Query executed successfully (no results)");
      } catch (err) {
        console.error('Failed to parse multipart response:', err);
        setError(`Error: ${err.message || 'Unable to parse response'}`);
      }
    }
  }, [viewMode, rawResults, streamMode]);

  async function executeQuery(databaseConfigOverride = null) {
    if (!query.trim()) { setError("Please enter a query"); return; }

    // Use the provided override, current ref value, or fall back to current state
    const dbConfig = databaseConfigOverride || currentDatabaseConfigRef.current || selectedDatabaseConfig;

    if (!dbConfig.id || databaseConfigs.length === 0) {
      setError("Please select a database. Check your server connection and credentials.");
      return;
    }
    setIsLoading(true); setError(""); setResults("");
    setRawResults(""); resetStreaming();
    const executionStartTime = Date.now();
    try {
      const response = await queryService.executeQuery({
        query,
        queryType,
        databaseConfig: dbConfig,
        serverUrl,
        auth: { username, password },
        preferStream: true,
      });

      if (response.mode === 'stream') {
        await initializeStream(response.streamIndex);
        setViewMode('table');
      } else {
        const envelope = toResultEnvelope(response);
        loadStaticRecords(envelope.rows);
        setRawResults(envelope.rawText);
        setResults(envelope.formattedText || 'Query executed successfully (no results)');
      }
      await saveQueryToHistory(query, queryType, dbConfig, Date.now() - executionStartTime, 'executed');
    } catch (err) {
      console.error("Query execution error:", err);
      if (err?.code === 'RESULT_TOO_LARGE') {
        setError('Error: Result payload exceeds safe concatenation threshold. Try streaming mode or refine the query.');
      } else {
        setError(`Error: ${err.message || "Unknown error occurred"}`);
      }
    } finally {
      setIsLoading(false);
    }
  }

  // Smart text wrapping for brackets and quotes
  const handleQueryKeyDown = (e) => {
    if (e.ctrlKey && e.key === "Enter") { e.preventDefault(); executeQuery(); return; }
    const textarea = e.target;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
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
      setQuery(newValue);
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + wrapChars[0].length, end + wrapChars[0].length);
      }, 0);
    }
  };

  // ---------- UI: renderer ----------
  const renderMainContent = () => {
    if (activeTab === 'console') {
      return (
        <div className="flex flex-1 h-full gap-4 min-h-0 overflow-hidden">
            {/* LEFT COLUMN: Query + Results stacked; min-w-0 avoids horizontal overflow */}
            <div className="flex-1 flex flex-col gap-4 min-w-0 min-h-0 overflow-hidden">
            {/* Query (bounded height) */}
            <div className="card bg-base-100 shadow-sm border border-base-300">
              <div className="card-header bg-base-200 px-4 py-3 border-b border-base-300">
                <div className="flex items-center justify-between">
                  <h2 className="card-title text-lg">Query</h2>
                  <div className="card-actions flex items-center gap-3">
                    {/* Editor Controls */}
                    <QueryEditorControls
                      preferences={editorPreferences}
                      onUpdatePreference={updatePreference}
                      increaseFontSize={increaseFontSize}
                      decreaseFontSize={decreaseFontSize}
                      toggleLineNumbers={toggleLineNumbers}
                      toggleWordWrap={toggleWordWrap}
                      toggleMinimap={toggleMinimap}
                    />

                    {/* Layout Presets */}
                    <div className="join">
                      <button
                        onClick={() => updatePreferences({ editorHeightPercent: 30, resultsHeightPercent: 70 })}
                        className={`btn btn-sm join-item ${editorPreferences.editorHeightPercent === 30 ? 'btn-active' : 'btn-outline'}`}
                        title="Minimize editor (30%)"
                      >
                        Min
                      </button>
                      <button
                        onClick={() => updatePreferences({ editorHeightPercent: 50, resultsHeightPercent: 50 })}
                        className={`btn btn-sm join-item ${editorPreferences.editorHeightPercent === 50 ? 'btn-active' : 'btn-outline'}`}
                        title="Balanced layout (50/50)"
                      >
                        Mid
                      </button>
                      <button
                        onClick={() => updatePreferences({ editorHeightPercent: 70, resultsHeightPercent: 30 })}
                        className={`btn btn-sm join-item ${editorPreferences.editorHeightPercent === 70 ? 'btn-active' : 'btn-outline'}`}
                        title="Maximize editor (70%)"
                      >
                        Max
                      </button>
                    </div>

                    {/* Execute Button */}
                    <button
                      onClick={() => executeQuery()}
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
                style={{
                  height: `${editorPreferences.editorHeightPercent}vh`,
                  minHeight: '260px'
                }}
              >
                <div className="h-full w-full min-w-0">
                  {/* key forces clean re-measure when sidebar toggles */}
                  <QueryEditor
                    key={showHistory ? 'withHistory' : 'withoutHistory'}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleQueryKeyDown}
                    language={getMonacoLanguageFromQueryType(queryType)}
                    placeholder={`Enter your ${queryType === 'xquery' ? 'XQuery' : queryType === 'sparql' ? 'SPARQL' : 'JavaScript'} query here...`}
                    disabled={isLoading}
                    theme={monacoTheme}
                  />
                </div>
              </div>
            </div>

            {/* Results (fills the remaining vertical space) */}
            <div className="card bg-base-100 shadow-sm border border-base-300 flex-1 flex flex-col min-w-0 overflow-hidden">
              <div className="card-header bg-base-200 px-4 py-3 border-b border-base-300">
                <div className="flex items-center justify-between">
                  <h2 className="card-title text-lg">Results</h2>
                  <div className="card-actions flex items-center gap-2">
                    <select 
                      value={viewMode} 
                      onChange={(e) => setViewMode(e.target.value)}
                      className="select select-bordered select-sm w-32"
                    >
                      <option value="table">Table View</option>
                      <option value="parsed">Parsed Text</option>
                      <option value="raw">Raw Output</option>
                    </select>
                    {viewMode === 'table' && streamIndex && (
                      <div className="flex items-center gap-2">
                        <button 
                          className="btn btn-sm"
                          onClick={prevPage}
                          disabled={pageStart === 0}
                          title="Previous 50"
                        >
                          Previous 50
                        </button>
                        <button 
                          className="btn btn-sm"
                          onClick={nextPage}
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
                    {viewMode === "table" && hasRecords && (
                      <div className="flex items-center gap-2">
                        <div className="join">
                          <button 
                            onClick={goToPrevRecord} 
                            disabled={activeRecordIndex <= 0}
                            className="btn btn-sm btn-outline join-item"
                            title="Previous record (Ctrl+↑)"
                          >
                            ↑
                          </button>
                          <button 
                            onClick={goToNextRecord} 
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
                {error && (
                  <div className="alert alert-error m-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{error}</span>
                  </div>
                )}
                <div className="results-output flex-1 min-w-0 overflow-hidden" ref={resultsOutputRef}>
                  <div className="h-full w-full overflow-y-auto">
                    {isLoading ? (
                      <div className="flex items-center justify-center h-full">
                        <div className="flex flex-col items-center gap-4">
                          <span className="loading loading-spinner loading-lg"></span>
                          <span className="text-lg">Executing query...</span>
                        </div>
                      </div>
                    ) : viewMode === "table" ? (
                      <div className="overflow-x-auto">
                        {tableData.length > 0 ? (
                          <div className="space-y-4 p-4">
                            {tableData.map((record, index) => {
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
                                        theme={monacoTheme}
                                      />
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-32 text-base-content/50">
                            <div className="text-center">
                              <svg className="mx-auto h-12 w-12 text-base-content/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <p className="mt-2">No results to display</p>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-4">
                        {streamIndex ? (
                          <div className="flex items-center justify-center h-32 text-base-content/60">
                            <div className="text-center">
                              <p className="text-sm">Large result streamed to disk. Use Table view with pagination to browse records.</p>
                            </div>
                          </div>
                        ) : (
                          <MonacoEditor
                            content={results}
                            language="plaintext"
                            readOnly={true}
                            height="400px"
                            theme={monacoTheme}
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: History */}
          {showHistory && (
            <div className="card bg-base-100 shadow-sm border border-base-300 w-80 flex flex-col h-full overflow-hidden">
              <div className="card-header bg-base-200 px-4 py-3 border-b border-base-300">
                <div className="flex items-center justify-between">
                  <h2 className="card-title text-lg">Query History</h2>
                  <div className="card-actions flex gap-1">
                    <button 
                      onClick={() => setShowHistory(false)}
                      className="btn btn-ghost btn-sm btn-square"
                      title="Collapse history panel"
                    >
                      ←
                    </button>
                    <button 
                      onClick={() => loadQueryHistory()}
                      className="btn btn-ghost btn-sm btn-square"
                      disabled={historyLoading}
                      title="Refresh history"
                    >
                      {historyLoading ? <span className="loading loading-spinner loading-xs"></span> : "↻"}
                    </button>
                  </div>
                </div>
              </div>
              <div className="card-body p-0 flex-1 overflow-y-auto min-h-0">
                {historyLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="flex flex-col items-center gap-2">
                      <span className="loading loading-spinner loading-md"></span>
                      <span className="text-sm">Loading history...</span>
                    </div>
                  </div>
                ) : queryHistory.length > 0 ? (
                  <div className="space-y-2 p-2">
                    {queryHistory.map((historyItem) => (
                      <div 
                        key={historyItem.id} 
                        className="card bg-base-100 border border-base-300 hover:border-primary/50 cursor-pointer transition-colors"
                        onClick={() => loadQueryFromHistory(historyItem.id)}
                      >
                        <div className="card-body p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="badge badge-primary badge-sm">{historyItem.queryType.toUpperCase()}</span>
                              <span className="text-xs text-base-content/60">
                                {new Date(historyItem.createdAt).toLocaleTimeString()}
                              </span>
                            </div>
                            <button 
                              className="btn btn-ghost btn-xs btn-square"
                              onClick={(e) => deleteQueryFromHistory(historyItem.id, e)}
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
                              {historyItem.modulesDatabase && historyItem.modulesDatabase !== historyItem.databaseName && 
                                ` (${historyItem.modulesDatabase})`
                              }
                            </span>
                            {historyItem.executionTimeMs && (
                              <span className="badge badge-outline badge-xs">{historyItem.executionTimeMs}ms</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-32 text-base-content/50">
                    <div className="text-center">
                      <svg className="mx-auto h-8 w-8 text-base-content/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="mt-2 text-sm">No query history yet</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {!showHistory && (
            <button 
              onClick={() => setShowHistory(true)}
              className="btn btn-ghost btn-sm btn-square"
              title="Expand history panel"
            >
              →
            </button>
          )}
        </div>
      );
    }

    if (activeTab === 'settings') {
      return (
        <div className="flex-1 overflow-auto">
          <div className="max-w-2xl mx-auto p-6">
            <div className="card bg-base-100 shadow-sm border border-base-300">
              <div className="card-header bg-base-200 px-6 py-4 border-b border-base-300">
                <h2 className="card-title text-xl">Settings</h2>
              </div>
              <div className="card-body p-6 space-y-6">
                <div className="form-control">
                  <label className="label" htmlFor="settings-server">
                    <span className="label-text font-medium">Server</span>
                  </label>
                  <select
                    id="settings-server"
                    className="select select-bordered"
                    value={server}
                    onChange={(e) => setServer(e.target.value)}
                  >
                    <option value="localhost">localhost</option>
                  </select>
                </div>

                <div className="form-control">
                  <label className="label" htmlFor="settings-username">
                    <span className="label-text font-medium">Username</span>
                  </label>
                  <input
                    id="settings-username"
                    type="text"
                    className="input input-bordered"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="admin"
                  />
                </div>

                <div className="form-control">
                  <label className="label" htmlFor="settings-password">
                    <span className="label-text font-medium">Password</span>
                  </label>
                  <input
                    id="settings-password"
                    type="password"
                    className="input input-bordered"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="admin"
                  />
                </div>

                {/* Enhanced Theme Selector */}
                <ThemeSelector
                  variant="full"
                  theme={theme}
                  onThemeChange={toggleTheme}
                  monacoTheme={monacoTheme}
                  onMonacoThemeChange={setMonacoTheme}
                />

                {/* Layout Settings */}
                <div className="divider"></div>
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Layout</h3>

                  <div className="form-control">
                    <label className="label" htmlFor="settings-editor-height">
                      <span className="label-text font-medium">Editor Height</span>
                      <span className="label-text-alt">{editorPreferences.editorHeightPercent}%</span>
                    </label>
                    <input
                      id="settings-editor-height"
                      type="range"
                      min="20"
                      max="70"
                      value={editorPreferences.editorHeightPercent}
                      onChange={(e) => {
                        const newHeight = parseInt(e.target.value);
                        updatePreferences({
                          editorHeightPercent: newHeight,
                          resultsHeightPercent: 100 - newHeight
                        });
                      }}
                      className="range range-primary mt-2"
                      step="5"
                      aria-label={`Editor height: ${editorPreferences.editorHeightPercent}%`}
                    />
                    <div className="w-full flex justify-between text-xs mt-2">
                      <span>20%</span>
                      <span>45%</span>
                      <span>70%</span>
                    </div>
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text font-medium">Results Height</span>
                      <span className="label-text-alt">{editorPreferences.resultsHeightPercent}% (auto)</span>
                    </label>
                    <div className="text-sm text-base-content/60">
                      Automatically calculated as 100% - Editor Height
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };
  // ---------- end renderer ----------

  return (
    <div className="h-screen bg-base-100 text-base-content flex flex-col overflow-hidden" data-theme={theme}>
      <header className="navbar bg-base-200 border-b border-base-300">
        <div className="navbar-start">
          <h1 className="text-xl font-bold">ML Console</h1>
        </div>
        <div className="navbar-center">
          <div className="flex items-center gap-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text text-sm font-medium mr-4">Query Type</span>
              </label>
              <select
                className="select select-bordered select-sm w-32"
                value={queryType}
                onChange={(e) => setQueryType(e.target.value)}
              >
                <option value="xquery">XQuery</option>
                <option value="javascript">JavaScript</option>
                <option value="sparql">SPARQL</option>
              </select>
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text text-sm font-medium mr-4">Database</span>
              </label>
              <select
                className="select select-bordered select-sm w-64"
                value={selectedDatabaseConfig.id}
                onChange={(e) => selectDatabase(e.target.value)}
                disabled={databaseConfigs.length === 0}
              >
                {databaseConfigs.length === 0 ? (
                  <option value="">No databases available - check connection</option>
                ) : (
                  databaseConfigs.map((config, index) => (
                    <option key={`db-${index}-${config.id}`} value={config.id}>
                      {config.name} ({config.modulesDatabase})
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>
        </div>
        <div className="navbar-end">
          <div className="flex items-center gap-3">
            <div className="tooltip" data-tip={
              connectionStatus === "connected" ? "Connected" :
              connectionStatus === "error" ? "Connection Error" :
              connectionStatus === "connecting" ? "Connecting..." : "Ready"
            }>
              <div className={`w-3 h-3 rounded-full ${
                connectionStatus === "connected" ? "bg-success" :
                connectionStatus === "error" ? "bg-error" :
                connectionStatus === "connecting" ? "bg-warning animate-pulse" :
                "bg-base-300"
              }`}></div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-xs text-base-content/60">
                Editor: {monacoTheme}
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={toggleTheme}
                title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              >
                {theme === 'light' ? '🌙' : '☀️'}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="tabs tabs-boxed bg-base-200 mx-4 mt-4">
        <button 
          className={`tab ${activeTab === 'console' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('console')}
        >
          Query Console
        </button>
        <button 
          className={`tab ${activeTab === 'settings' ? 'tab-active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          Settings
        </button>
      </div>

      <main className="flex-1 p-4 flex flex-col min-h-0 overflow-hidden">
        {renderMainContent()}
      </main>
    </div>
  );
}

export default App;
