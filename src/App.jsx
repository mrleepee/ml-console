import React, { useState, useEffect, useRef } from "react";
import Editor from '@monaco-editor/react';
import parseHeaders from 'parse-headers';
import TestHarness from "./TestHarness";
import QueryEditor from "./components/QueryEditor";
import "./App.css";

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
  const [query, setQuery] = useState('xquery version "1.0-ml";\n\n(//*[not(*)])[1 to 3]');
  const [results, setResults] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [queryType, setQueryType] = useState("xquery");
  const [database, setDatabase] = useState("prime-content");
  const [databases, setDatabases] = useState([]);
  const [activeTab, setActiveTab] = useState("console");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin");
  const [connectionStatus, setConnectionStatus] = useState("disconnected");
  const [rawResults, setRawResults] = useState("");
  const [viewMode, setViewMode] = useState("table"); // "table", "parsed", "raw"
  const [tableData, setTableData] = useState([]);
  const [activeRecordIndex, setActiveRecordIndex] = useState(0);
  const hasRecords = tableData && tableData.length > 0;
  const activeRecord = hasRecords ? tableData[Math.min(Math.max(activeRecordIndex,0), tableData.length-1)] : null;
  const [queryHistory, setQueryHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(true);
  const [server, setServer] = useState("localhost");
  const recordRefs = useRef({});
  const resultsOutputRef = useRef(null);
  
  // Server configuration
  const serverUrl = `http://${server}:8000`;

  // Record navigation functions
  const scrollToRecord = (index) => {
    const recordId = `record-${index}`;
    const element = recordRefs.current[recordId];
    const container = resultsOutputRef.current;
    
    if (element && container) {
      // Calculate the position to scroll to within the container
      const containerRect = container.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      const currentScroll = container.scrollTop;
      const containerTop = containerRect.top;
      const elementTop = elementRect.top;
      
      // Calculate target scroll position - element position relative to container
      const targetScroll = currentScroll + (elementTop - containerTop) - 20; // 20px offset from top
      
      // Smooth scroll to the target position
      container.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: 'smooth'
      });
      
      setActiveRecordIndex(index);
    }
  };

  const goToPrevRecord = () => {
    const newIndex = Math.max(activeRecordIndex - 1, 0);
    scrollToRecord(newIndex);
  };

  const goToNextRecord = () => {
    const newIndex = Math.min(activeRecordIndex + 1, tableData.length - 1);
    scrollToRecord(newIndex);
  };

  // Simple HTTP request helper (works in both Electron and web)
  async function makeRequest(options) {
    try {
      // Check if we're in Electron environment
      if (window.electronAPI && window.electronAPI.httpRequest) {
        const response = await window.electronAPI.httpRequest(options);
        return response;
      } else {
        // Web environment - attempt real network request using fetch (no mock)
        const resp = await fetch(options.url, {
          method: options.method || 'GET',
          headers: options.headers || {},
          body: options.body,
        });
        const bodyText = await resp.text();
        const headers = {};
        resp.headers.forEach((value, key) => {
          headers[key.toLowerCase()] = value;
        });
        return {
          status: resp.status,
          headers,
          body: bodyText
        };
      }
    } catch (error) {
      console.error('HTTP request failed:', error);
      throw error;
    }
  }

  // Database helper functions
  async function saveQueryToHistory(content, queryType, databaseName, executionTimeMs = null, status = 'executed') {
    try {
      if (window.electronAPI && window.electronAPI.database) {
        const result = await window.electronAPI.database.saveQuery({
          content,
          queryType,
          databaseName,
          executionTimeMs,
          status
        });
        
        if (result.success) {
          if (result.updated) {
            console.log('Query already exists, updated timestamp:', result.id);
            console.log(result.message);
          } else {
            console.log('New query saved to history:', result.id);
            console.log(result.message);
          }
          // Refresh history after saving
          loadQueryHistory();
        } else {
          console.error('Failed to save query:', result.error);
        }
      }
    } catch (error) {
      console.error('Error saving query to history:', error);
    }
  }

  async function loadQueryHistory(limit = 15) {
    try {
      if (window.electronAPI && window.electronAPI.database) {
        setHistoryLoading(true);
        const result = await window.electronAPI.database.getRecentQueries(limit);
        
        if (result.success) {
          setQueryHistory(result.queries);
        } else {
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
  }

  async function loadQueryFromHistory(id) {
    try {
      if (window.electronAPI && window.electronAPI.database) {
        const result = await window.electronAPI.database.getQueryById(id);
        
        if (result.success && result.query) {
          setQuery(result.query.content);
          setQueryType(result.query.queryType);
          setDatabase(result.query.databaseName || database);
        } else {
          console.error('Failed to load query:', result.error);
        }
      }
    } catch (error) {
      console.error('Error loading query from history:', error);
    }
  }

  async function deleteQueryFromHistory(id, event) {
    event.stopPropagation(); // Prevent triggering the load query click
    
    try {
      if (window.electronAPI && window.electronAPI.database) {
        const result = await window.electronAPI.database.deleteQuery(id);
        
        if (result.success) {
          // Refresh history after deletion
          loadQueryHistory();
        } else {
          console.error('Failed to delete query:', result.error);
        }
      }
    } catch (error) {
      console.error('Error deleting query from history:', error);
    }
  }

  // Utility: escape regex metacharacters
  function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // New header parsing function using parse-headers library
  function parseResponse(responseText) {
    const txt = responseText.replace(/^\uFEFF/, '');
    const m = /\r?\n\r?\n/.exec(txt);
    if (!m) return [{ contentType: '', primitive: '', uri: '', path: '', content: txt }];

    const rawHeaders = txt.slice(0, m.index);
    const content = txt.slice(m.index + m[0].length);

    const h = parseHeaders(rawHeaders); // keys are lowercase
    return [{
      contentType: h['content-type'] || '',
      primitive: h['x-primitive'] || '',
      uri: h['x-uri'] || '',
      path: h['x-path'] || '',
      content
    }];
  }

  // Parse multipart/mixed response into structured data for table view
  function parseMultipartToTableData(responseText) {
    if (!responseText) return [];
    
    const results = [];
    
    // Find boundary: take the first line starting with -- and capture to EOL
    const boundaryMatch = responseText.match(/^--([^\r\n-]+)(?:--)?\s*$/m);
    if (!boundaryMatch) {
      // Fallback: use parseResponse for single-part responses
      return parseResponse(responseText);
    }

    const boundary = boundaryMatch[1];
    const escapedBoundary = escapeRegExp(boundary);
    
    // Split the response by boundary
    const parts = responseText.split(new RegExp(`--${escapedBoundary}(?:--)?\\s*`, 'g'));
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].trim();
      if (!part) continue; // Skip empty parts
      
      // Use the parseResponse function for each part
      const parsedRecords = parseResponse(part);
      results.push(...parsedRecords);
    }
    
    return results;
  }

  // Parse multipart/mixed response to extract just the content (legacy)
  function parseMultipartResponse(responseText) {
    const tableData = parseMultipartToTableData(responseText);
    return tableData.map(record => record.content).join('\n');
  }

  // Pretty-print helpers for displaying record content
  function formatJsonPretty(rawText) {
    try {
      const parsed = JSON.parse(rawText);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return rawText;
    }
  }

  function formatXmlPretty(rawText) {
    try {
      const tokens = rawText
        .replace(/>\s+</g, '><')
        .split(/(<[^>]+>)/g)
        .filter(Boolean);

      let indentLevel = 0;
      const indentUnit = '  ';
      const lines = [];

      for (const token of tokens) {
        const isTag = token.startsWith('<') && token.endsWith('>');
        if (isTag) {
          const t = token.trim();
          const isClosing = /^<\//.test(t);
          const isSelfClosing = /\/>$/.test(t) || /^<\?/.test(t) || /^<!/.test(t);

          if (isClosing) {
            indentLevel = Math.max(indentLevel - 1, 0);
          }

          lines.push(`${indentUnit.repeat(indentLevel)}${t}`);

          if (!isClosing && !isSelfClosing) {
            indentLevel += 1;
          }
        } else {
          const text = token.trim();
          if (text) {
            lines.push(`${indentUnit.repeat(indentLevel)}${text}`);
          }
        }
      }

      return lines.join('\n');
    } catch {
      return rawText;
    }
  }

  function getRawContent(record) {
    const content = record.content || '';
    const contentType = (record.contentType || '').toLowerCase();

    if (contentType.includes('json')) {
      try {
        return JSON.stringify(JSON.parse(content), null, 2);
      } catch {
        return content;
      }
    }

    if (contentType.includes('xml')) {
      return formatXmlPretty(content);
    }

    return content;
  }

  // Monaco editor component for record content
  function MonacoEditor({ content, language, readOnly = true, height = "200px", path }) {
    const [editorMounted, setEditorMounted] = useState(false);
    const editorRef = useRef(null);

    const formatContent = React.useCallback(async () => {
      if (editorRef.current && content && (language === 'json' || language === 'xml' || language === 'html')) {
        try {
          // Small delay to ensure editor is fully ready
          await new Promise(resolve => setTimeout(resolve, 100));
          const action = editorRef.current.getAction('editor.action.formatDocument');
          if (action) {
            await action.run();
          }
        } catch (error) {
          console.debug('Auto-format failed:', error);
        }
      }
    }, [content, language]);

    const handleEditorMount = React.useCallback((editor, monaco) => {
      editorRef.current = editor;
      setEditorMounted(true);
    }, []);

    // Format content when editor mounts and content changes
    useEffect(() => {
      if (editorMounted && content) {
        formatContent();
      }
    }, [editorMounted, content, formatContent]);

    return (
      <div style={{ 
        height: height, 
        width: "100%",
        border: "1px solid #ddd",
        borderRadius: "4px"
      }}>
        <Editor
          height={height}
          language={language}
          value={content}
          path={path}
          keepCurrentModel={true}
          onMount={handleEditorMount}
          options={{
            readOnly: readOnly,
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
            selectOnLineNumbers: false,
            automaticLayout: true,
            tabSize: 2,
            insertSpaces: true,
            detectIndentation: true,
            formatOnPaste: true,
            formatOnType: false
          }}
          theme="vs"
        />
      </div>
    );
  }

  const MemoMonacoEditor = React.memo(MonacoEditor, (prevProps, nextProps) => {
    return (
      prevProps.content === nextProps.content &&
      prevProps.language === nextProps.language &&
      prevProps.readOnly === nextProps.readOnly &&
      prevProps.height === nextProps.height &&
      prevProps.path === nextProps.path
    );
  });

  // Health check function for connection status
  async function checkConnection() {
    try {
      setConnectionStatus("connecting");
      
      const response = await makeRequest({
        url: `http://${server}:7997/LATEST/healthcheck`, // Using healthcheck endpoint 
        method: "GET",
        headers: {},
        timeout: 10000, // 10 second timeout
        username,
        password
      });

      if (response.status === 200 || response.status === 204) {
        setConnectionStatus("connected");
      } else {
        setConnectionStatus("error");
      }
    } catch (err) {
      setConnectionStatus("error");
    }
  }

  // Get available databases
  async function getDatabases() {
    try {
      console.log("=== GETTING DATABASES ===");
      
      // Query MarkLogic for databases using XQuery
      const databaseQuery = `
        xquery version "1.0-ml";
        for $db in xdmp:databases()
        return xdmp:database-name($db)
      `;
      
      const response = await makeRequest({
        url: `${serverUrl}/v1/eval`,
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `xquery=${encodeURIComponent(databaseQuery)}`,
        username,
        password,
      });

      if (response.status >= 200 && response.status < 300) {
        // Parse the multipart response to extract database names
        const cleanedResponse = parseMultipartResponse(response.body || "");
        
        // Split by lines and filter for valid database names (no XML/HTML content)
        const dbNames = cleanedResponse.split('\n')
          .map(name => name.trim())
          .filter(name => 
            name.length > 0 && 
            !name.startsWith('<') && 
            !name.includes('<?xml') &&
            !name.includes('html')
          );
        
        console.log("Found databases:", dbNames);
        
        if (dbNames.length > 0) {
          setDatabases(dbNames);
          
          // Set first database as default if current selection isn't valid
          if (!dbNames.includes(database)) {
            setDatabase(dbNames[0]);
          }
        } else {
          throw new Error("No valid database names found in response");
        }
      } else {
        throw new Error(`Failed to get databases: HTTP ${response.status}`);
      }
    } catch (err) {
      console.error("Get databases error:", err);
      setError(`Failed to get databases: ${err.message}`);
      setConnectionStatus("error");
      // Fallback to common database names
      setDatabases(["Documents", "Modules", "Security", "Schemas", "Triggers"]);
    }
  }

  // Get databases and check connection when server/credentials change
  useEffect(() => {
    if (username && password && server) {
      // checkConnection();
      getDatabases();
    }
  }, [username, password, server]);

  // Load query history on startup
  useEffect(() => {
    loadQueryHistory();
  }, []);

  // Background health check every 5 seconds
  useEffect(() => {
    if (username && password && server) {
      const intervalId = setInterval(() => {
        checkConnection();
      }, 30000); // 30 seconds

      return () => clearInterval(intervalId);
    }
  }, [username, password, server]);

  // Keyboard shortcuts for record navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (viewMode === "table" && hasRecords) {
        if (e.key === 'ArrowUp' && e.ctrlKey) {
          e.preventDefault();
          goToPrevRecord();
        } else if (e.key === 'ArrowDown' && e.ctrlKey) {
          e.preventDefault();
          goToNextRecord();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode, hasRecords, activeRecordIndex, tableData.length]);

  // Update displayed results when view mode changes
  useEffect(() => {
    if (rawResults) {
      if (viewMode === "raw") {
        setResults(rawResults);
      } else if (viewMode === "parsed") {
        const cleanedResults = parseMultipartResponse(rawResults);
        setResults(cleanedResults || "Query executed successfully (no results)");
      }
      // Table mode doesn't use setResults - it renders directly from tableData
    }
  }, [viewMode, rawResults]);

  async function executeQuery() {
    console.log("=== EXECUTEQUERY FUNCTION CALLED ===");
    
    if (!query.trim()) {
      setError("Please enter a query");
      return;
    }
  
    console.log("=== SETTING INITIAL STATE ===");
    setIsLoading(true);
    setError("");
    setResults("");
    const executionStartTime = Date.now();
  
    try {
      console.log("=== EXECUTING QUERY VIA REST API ===");
      
      // Use MarkLogic REST API v1/eval endpoint
      const url = `${serverUrl.replace(/\/+$/, "")}/v1/eval`;
      
      // Prepare request body based on query type
      let body;
      let contentType;
      
      if (queryType === "xquery") {
        body = `xquery=${encodeURIComponent(query)}&database=${encodeURIComponent(database)}`;
        contentType = "application/x-www-form-urlencoded";
      } else if (queryType === "javascript") {
        body = `javascript=${encodeURIComponent(query)}&database=${encodeURIComponent(database)}`;
        contentType = "application/x-www-form-urlencoded";
      } else if (queryType === "sparql") {
        // For SPARQL, we might need a different endpoint or parameter
        // For now, treating it as XQuery with special handling
        body = `xquery=${encodeURIComponent(query)}&database=${encodeURIComponent(database)}`;
        contentType = "application/x-www-form-urlencoded";
      }
  
      console.log("=== REQUEST DEBUG ===");
      console.log("URL:", url);
      console.log("Method: POST");
      console.log("Content-Type:", contentType);
      console.log("Body:", body);
      console.log("Database:", database);
      console.log("Username:", username);
  
      const response = await makeRequest({
        url,
        method: "POST",
        headers: {
          "Content-Type": contentType,
        },
        body,
        username,
        password,
      });

      console.log("=== RESPONSE RECEIVED ===");
      console.log("Status:", response.status);
      console.log("Headers:", response.headers);
      console.log("Body preview:", response.body?.substring?.(0, 500));
  
      if (response.status < 200 || response.status >= 300) {
        throw new Error(`HTTP ${response.status}: ${response.body || 'Unknown error'}`);
      }
  
      console.log("=== PROCESSING RESPONSE ===");
      
      // Store raw results
      const rawResponse = response.body || "";
      console.log("Setting rawResults...");
      setRawResults(rawResponse);
      
      // Parse into structured table data
      console.log("Parsing multipart data...");
      const parsedTableData = parseMultipartToTableData(rawResponse);
      console.log("Setting tableData with:", parsedTableData);
      setTableData(parsedTableData);
      
      // Parse multipart/mixed response to extract just the results
      console.log("Parsing multipart response...");
      const cleanedResults = parseMultipartResponse(rawResponse);
      console.log("=== CLEANED RESULTS ===");
      console.log("Raw response length:", rawResponse.length);
      console.log("Parsed table data:", parsedTableData);
      console.log("Cleaned results:", cleanedResults);
      console.log("=== END CLEANED RESULTS ===");
      
      // Set results based on view mode - start with parsed view
      const displayResults = cleanedResults || "Query executed successfully (no results)";
      console.log("Setting results with:", displayResults);
      setResults(displayResults);
      console.log("Setting connection status to connected...");
      setConnectionStatus("connected");
      
      // Save query to history
      const executionTime = Date.now() - executionStartTime;
      await saveQueryToHistory(query, queryType, database, executionTime, 'executed');
      
    } catch (err) {
      console.error("Query execution error:", err);
      console.error("Error details:", {
        message: err.message,
        stack: err.stack,
        name: err.name
      });
      setError(`Error: ${err.message || "Unknown error occurred"}`);
      setConnectionStatus("error");
    } finally {
      setIsLoading(false);
    }
  }
  
  // Smart text wrapping for brackets and quotes
  const handleQueryKeyDown = (e) => {
    // Handle Ctrl+Enter for execution
    if (e.ctrlKey && e.key === "Enter") {
      e.preventDefault();
      executeQuery();
      return;
    }

    const textarea = e.target;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    
    // Only wrap if there's selected text
    if (start === end || !selectedText) return;

    let wrapChars = null;

    // Define wrapping pairs
    switch (e.key) {
      case '(':
        wrapChars = ['(', ')'];
        break;
      case '[':
        wrapChars = ['[', ']'];
        break;
      case '{':
        wrapChars = ['{', '}'];
        break;
      case '"':
        wrapChars = ['"', '"'];
        break;
      case "'":
        wrapChars = ["'", "'"];
        break;
      case '`':
        wrapChars = ['`', '`'];
        break;
      default:
        return; // No wrapping for other keys
    }

    if (wrapChars) {
      e.preventDefault();
      
      const beforeSelection = textarea.value.substring(0, start);
      const afterSelection = textarea.value.substring(end);
      const wrappedText = wrapChars[0] + selectedText + wrapChars[1];
      
      const newValue = beforeSelection + wrappedText + afterSelection;
      setQuery(newValue);
      
      // Set selection to highlight the wrapped content
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(
          start + wrapChars[0].length, 
          end + wrapChars[0].length
        );
      }, 0);
    }
  };


  return (
    <div className="ml-console">
      <header className="header">
        <h1>ML Console</h1>
        <div className="server-config">
          <label htmlFor="server">Server:</label>
          <select
            id="server"
            value={server}
            onChange={(e) => setServer(e.target.value)}
          >
            <option value="localhost">localhost</option>
          </select>
          <label htmlFor="query-type">Query Type:</label>
          <select
            id="query-type"
            value={queryType}
            onChange={(e) => setQueryType(e.target.value)}
          >
            <option value="xquery">XQuery</option>
            <option value="javascript">JavaScript</option>
            <option value="sparql">SPARQL</option>
          </select>
          <label htmlFor="database">Database:</label>
          <select
            id="database"
            value={database}
            onChange={(e) => setDatabase(e.target.value)}
          >
            {databases.map((db, index) => (
              <option key={`db-${index}-${db}`} value={db}>{db}</option>
            ))}
          </select>
          <label htmlFor="username">Username:</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="admin"
          />
          <label htmlFor="password">Password:</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="admin"
          />
        </div>
        <div className="connection-indicator">
          <div className={`status-dot ${
            connectionStatus === "connected" ? "connected" :
            connectionStatus === "error" ? "error" :
            connectionStatus === "connecting" ? "connecting" : "ready"
          }`} title={
            connectionStatus === "connected" ? "Connected" :
            connectionStatus === "error" ? "Connection Error" :
            connectionStatus === "connecting" ? "Connecting..." : "Ready"
          }></div>
        </div>
      </header>

      <div className="tab-navigation">
        <button 
          className={`tab-button ${activeTab === 'console' ? 'active' : ''}`}
          onClick={() => setActiveTab('console')}
        >
          Query Console
        </button>
        <button 
          className={`tab-button ${activeTab === 'test' ? 'active' : ''}`}
          onClick={() => setActiveTab('test')}
        >
          Test Harness
        </button>
      </div>

      <main className="main-content">
        {activeTab === 'console' ? (
          <div className="console-layout">
            <div className="query-and-results">
              <div className="query-section">
                <div className="query-header">
                  <h2>Query</h2>
                  <div className="query-buttons">
                    <button
                      onClick={executeQuery}
                      disabled={isLoading}
                      className="execute-btn"
                    >
                      {isLoading ? "Executing..." : "Execute (Ctrl+Enter)"}
                    </button>
                  </div>
                </div>
                <QueryEditor
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleQueryKeyDown}
                  language={queryType}
                  placeholder={`Enter your ${queryType === 'xquery' ? 'XQuery' : queryType === 'sparql' ? 'SPARQL' : 'JavaScript'} query here...`}
                  disabled={isLoading}
                />
              </div>

              <div className="results-section">
                <div className="results-header">
                  <h2>Results</h2>
                  <div className="results-controls">
                    <select 
                      value={viewMode} 
                      onChange={(e) => setViewMode(e.target.value)}
                      className="view-mode-select"
                    >
                      <option value="table">Table View</option>
                      <option value="parsed">Parsed Text</option>
                      <option value="raw">Raw Output</option>
                    </select>
                    {viewMode === "table" && hasRecords && (
                      <div className="record-navigation">
                        <button 
                          onClick={goToPrevRecord} 
                          disabled={activeRecordIndex <= 0}
                          className="nav-btn"
                          title="Previous record"
                        >
                          ↑ Prev
                        </button>
                        <span className="record-counter">
                          {activeRecordIndex + 1} / {tableData.length}
                        </span>
                        <button 
                          onClick={goToNextRecord} 
                          disabled={activeRecordIndex >= tableData.length - 1}
                          className="nav-btn"
                          title="Next record"
                        >
                          ↓ Next
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {error && <div className="error-message">{error}</div>}
                <div className="results-output" ref={resultsOutputRef}>
                  {isLoading ? (
                    <div className="loading">Executing query...</div>
                  ) : viewMode === "table" ? (
                    <div className="table-view">
                      {tableData.length > 0 ? (
                        tableData.map((record, index) => {
                          // Create truly unique identifier using index + URI + content hash
                          const contentHash = record.content?.substring(0, 50)?.replace(/\W+/g, '') || 'empty';
                          const stableId = `record-${index}-${record.uri || 'no-uri'}-${contentHash}`;
                          const recordId = `record-${index}`;
                          
                          return (
                            <div 
                              key={stableId} 
                              className={`table-record ${index === activeRecordIndex ? 'active-record' : ''}`}
                              ref={(el) => {
                                if (el) {
                                  recordRefs.current[recordId] = el;
                                } else {
                                  delete recordRefs.current[recordId];
                                }
                              }}
                              id={recordId}
                            >
                              <div className="record-header">
                                <span className="record-number">#{index + 1}</span>
                                <span className="record-uri">{record.uri || 'No URI'}</span>
                              </div>
                              <div className="record-metadata">
                                <div><strong>Content Type:</strong> <span>{record.contentType || 'Not available'}</span></div>
                                <div><strong>Datatype:</strong> <span>{record.primitive || 'Not available'}</span></div>
                                {record.path && <div><strong>XPath:</strong> <span>{record.path}</span></div>}
                              </div>
                              <div className="record-content">
                                <MemoMonacoEditor 
                                  content={getRawContent(record)}
                                  language={getMonacoLanguageFromContentType(record.contentType)}
                                  readOnly={true}
                                  height="300px"
                                  path={stableId}
                                />
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="no-results">No results to display</div>
                      )}
                    </div>
                  ) : (
                    <MonacoEditor 
                      content={results}
                      language="plaintext"
                      readOnly={true}
                      height="400px"
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="query-history-panel">
              <div className="history-header">
                <h2>Query History</h2>
                <div className="history-controls">
                  <button 
                    onClick={() => setShowHistory(prev => !prev)}
                    className="refresh-btn"
                  >
                    {showHistory ? '« Collapse' : '» Expand'}
                  </button>
                  <button 
                    onClick={() => loadQueryHistory()}
                    className="refresh-btn"
                    disabled={historyLoading}
                  >
                    {historyLoading ? "Loading..." : "Refresh"}
                  </button>
                </div>
              </div>
              {showHistory && (
                <div className="history-list">
                  {historyLoading ? (
                    <div className="loading">Loading history...</div>
                  ) : queryHistory.length > 0 ? (
                    queryHistory.map((historyItem) => (
                      <div 
                        key={historyItem.id} 
                        className="history-item"
                        onClick={() => loadQueryFromHistory(historyItem.id)}
                      >
                        <div className="history-item-header">
                          <div className="history-item-info">
                            <span className="history-item-type">{historyItem.queryType.toUpperCase()}</span>
                            <span className="history-item-time">
                              {new Date(historyItem.createdAt).toLocaleTimeString()}
                            </span>
                          </div>
                          <button 
                            className="history-delete-btn"
                            onClick={(e) => deleteQueryFromHistory(historyItem.id, e)}
                            title="Delete query"
                          >
                            ×
                          </button>
                        </div>
                        <div className="history-item-preview">
                          {historyItem.preview}
                        </div>
                        <div className="history-item-meta">
                          <span className="history-item-database">{historyItem.databaseName}</span>
                          {historyItem.executionTimeMs && (
                            <span className="history-item-duration">{historyItem.executionTimeMs}ms</span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="no-history">No query history yet</div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <TestHarness serverUrl={serverUrl} username={username} password={password} />
        )}
      </main>
    </div>
  );
}

export default App;
