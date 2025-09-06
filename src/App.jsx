import React, { useState, useEffect, useRef, useCallback } from "react";
import Editor from '@monaco-editor/react';
import parseHeaders from 'parse-headers';
import TestHarness from "./TestHarness";
import QueryEditor from "./components/QueryEditor";
import { getServers, getDatabases, parseDatabaseConfigs } from "./utils/databaseApi";
import "./App.css";

function App() {
  // console.log("🚀 App component loaded - React code is running!");
  
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
  const [selectedDatabaseConfig, setSelectedDatabaseConfig] = useState({
    name: "",
    id: "",
    modulesDatabase: "",
    modulesDatabaseId: ""
  });
  const [databaseConfigs, setDatabaseConfigs] = useState([]);
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
  const [theme, setTheme] = useState("light");
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
  const makeRequest = useCallback(async (options) => {
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
  }, []);

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

  const loadQueryHistory = useCallback(async (limit = 15) => {
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
  }, []);

  async function loadQueryFromHistory(id) {
    try {
      if (window.electronAPI && window.electronAPI.database) {
        const result = await window.electronAPI.database.getQueryById(id);
        
        if (result.success && result.query) {
          setQuery(result.query.content);
          setQueryType(result.query.queryType);
          
          // Restore database configuration if available
          if (result.query.databaseId && result.query.databaseName) {
            const restoredConfig = {
              id: result.query.databaseId,
              name: result.query.databaseName,
              modulesDatabase: result.query.modulesDatabase || 'file-system',
              modulesDatabaseId: result.query.modulesDatabaseId || '0'
            };
            
            // Check if this config exists in current configs, if not add it
            const existingConfig = databaseConfigs.find(config => config.id === restoredConfig.id);
            if (existingConfig) {
              setSelectedDatabaseConfig(existingConfig);
            } else {
              // Add the restored config to available configs and select it
              setDatabaseConfigs(prev => [...prev, restoredConfig]);
              setSelectedDatabaseConfig(restoredConfig);
            }
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
  const parseMultipartResponse = useCallback((responseText) => {
    const tableData = parseMultipartToTableData(responseText);
    return tableData.map(record => record.content).join('\n');
  }, []);

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
  const checkConnection = useCallback(async () => {
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
  }, [server, username, password, makeRequest]);

  // Get database-modules configurations from MarkLogic servers using REST Management API
  async function getDatabaseConfigs() {
    try {      
      // Get servers and databases data using REST Management API
      const [serversData, databasesData] = await Promise.all([
        getServers(server, username, password, makeRequest),
        getDatabases(server, username, password, makeRequest)
      ]);
      
      console.log("Servers data:", serversData);
      console.log("Databases data:", databasesData);
      
      // Parse the combined data to create database-modules configurations
      const configs = parseDatabaseConfigs(serversData, databasesData);
      
      console.log("Found database configurations:", JSON.stringify(configs, null, 2));
      setDatabaseConfigs(configs);
      
      // Set first config as default if current selection isn't valid
      const currentIsValid = configs.some(config => 
        config.name === selectedDatabaseConfig.name && 
        config.id === selectedDatabaseConfig.id
      );
      
      if (!currentIsValid && configs.length > 0) {
        setSelectedDatabaseConfig(configs[0]);
      }
      
    } catch (err) {
      console.error("Get database configs error:", err);
      setError(`Failed to get database configurations: ${err.message}. Please check your server connection and credentials.`);
      setConnectionStatus("error");
      
      // Clear configurations on error - user must fix connection to proceed
      setDatabaseConfigs([]);
      setSelectedDatabaseConfig({
        name: "",
        id: "",
        modulesDatabase: "",
        modulesDatabaseId: ""
      });
    }
  }, [serverUrl, username, password, makeRequest, parseMultipartResponse]);

  // Get database configs and check connection when server/credentials change
  useEffect(() => {
    if (username && password && server) {
      // checkConnection();
      getDatabaseConfigs();
    }
  }, [username, password, server]); // Remove getDatabases from dependencies to break the loop

  // Load query history on startup
  useEffect(() => {
    loadQueryHistory();
  }, []); // Empty dependency array - only run once on mount

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

// disabled for now - 7997 healthcheck endpoint isn't always available
/*
  useEffect(() => {
    if (username && password && server) {
      const intervalId = setInterval(() => {
        checkConnection();
      }, 30000); // 30 seconds

      return () => clearInterval(intervalId);
    }
  }, [username, password, server]);
*/

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

    if (!selectedDatabaseConfig.id || databaseConfigs.length === 0) {
      setError("Please select a database. Check your server connection and credentials.");
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
        // Use xdmp:eval-in with database ID and modules database ID
        const wrappedQuery = selectedDatabaseConfig.modulesDatabaseId !== '0' 
          ? `xdmp:eval-in("${query.replace(/"/g, '""')}", ${selectedDatabaseConfig.id}, (), ${selectedDatabaseConfig.modulesDatabaseId})`
          : `xdmp:eval-in("${query.replace(/"/g, '""')}", ${selectedDatabaseConfig.id})`;
        body = `xquery=${encodeURIComponent(wrappedQuery)}`;
        contentType = "application/x-www-form-urlencoded";
      } else if (queryType === "javascript") {
        // For JavaScript, use database ID directly with modules database ID
        const modulesPart = selectedDatabaseConfig.modulesDatabaseId !== '0' 
          ? `&modules=${encodeURIComponent(selectedDatabaseConfig.modulesDatabaseId)}`
          : '';
        body = `javascript=${encodeURIComponent(query)}&database=${encodeURIComponent(selectedDatabaseConfig.id)}${modulesPart}`;
        contentType = "application/x-www-form-urlencoded";
      } else if (queryType === "sparql") {
        // For SPARQL, use xdmp:eval-in with database ID and modules database ID
        const wrappedQuery = selectedDatabaseConfig.modulesDatabaseId !== '0' 
          ? `xdmp:eval-in("${query.replace(/"/g, '""')}", ${selectedDatabaseConfig.id}, (), ${selectedDatabaseConfig.modulesDatabaseId})`
          : `xdmp:eval-in("${query.replace(/"/g, '""')}", ${selectedDatabaseConfig.id})`;
        body = `xquery=${encodeURIComponent(wrappedQuery)}`;
        contentType = "application/x-www-form-urlencoded";
      }
  
      console.log("=== REQUEST DEBUG ===");
      console.log("URL:", url);
      console.log("Method: POST");
      console.log("Content-Type:", contentType);
      console.log("Body:", body);
      console.log("Selected Database Config:", selectedDatabaseConfig);
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
      await saveQueryToHistory(query, queryType, selectedDatabaseConfig, executionTime, 'executed');
      
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
          <label htmlFor="database-config">Database:</label>
          <select
            id="database-config"
            value={selectedDatabaseConfig.id}
            onChange={(e) => {
              const config = databaseConfigs.find(c => c.id === e.target.value);
              if (config) {
                setSelectedDatabaseConfig(config);
              }
            }}
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
        <div className="header-controls">
          <button 
            className="theme-toggle"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
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
        <button 
          className={`tab-button ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          Settings
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
                        <div className="nav-arrows">
                          <button 
                            onClick={goToPrevRecord} 
                            disabled={activeRecordIndex <= 0}
                            className="nav-arrow"
                            title="Previous record (Ctrl+↑)"
                          >
                            ↑
                          </button>
                          <button 
                            onClick={goToNextRecord} 
                            disabled={activeRecordIndex >= tableData.length - 1}
                            className="nav-arrow"
                            title="Next record (Ctrl+↓)"
                          >
                            ↓
                          </button>
                        </div>
                        <span className="record-counter">
                          {activeRecordIndex + 1} of {tableData.length}
                        </span>
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
                              <div className="record-header" style={{ 
                                height: '85%', 
                                backgroundColor: '#1e3a8a',
                                color: 'white',
                                padding: '8px 12px',
                                borderRadius: '4px 4px 0 0',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                fontSize: '14px',
                                fontWeight: '500'
                              }}>
                                <span className="record-number">#{index + 1}</span>
                                <span className="record-uri">{record.uri || 'No URI'}</span>
                              </div>
                              <div className="record-metadata">
                                <span><strong>Content Type:</strong> {record.contentType || 'Not available'}</span>
                                <span style={{ margin: '0 10px' }}><strong>Datatype:</strong> {record.primitive || 'Not available'}</span>
                                {record.path && <span style={{ margin: '0 10px' }}><strong>XPath:</strong> {record.path}</span>}
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
                          <span className="history-item-database">
                            {historyItem.databaseName}
                            {historyItem.modulesDatabase && historyItem.modulesDatabase !== historyItem.databaseName && 
                              ` (${historyItem.modulesDatabase})`
                            }
                          </span>
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
        ) : activeTab === 'test' ? (
          <TestHarness serverUrl={serverUrl} username={username} password={password} />
        ) : activeTab === 'settings' ? (
          <div className="settings-layout">
            <h2>Settings</h2>
            <div className="settings-section">
              <div className="settings-group">
                <label htmlFor="settings-server">Server:</label>
                <select
                  id="settings-server"
                  value={server}
                  onChange={(e) => setServer(e.target.value)}
                >
                  <option value="localhost">localhost</option>
                </select>
              </div>

              <div className="settings-group">
                <label htmlFor="settings-username">Username:</label>
                <input
                  id="settings-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                />
              </div>

              <div className="settings-group">
                <label htmlFor="settings-password">Password:</label>
                <input
                  id="settings-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="admin"
                />
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

export default App;
