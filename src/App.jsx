import { useState } from "react";
import { fetch } from "@tauri-apps/plugin-http";
import TestHarness from "./TestHarness";
import { digestAuthRequest } from "./digestAuth";
import "./App.css";

function App() {
  const [query, setQuery] = useState('xquery version "1.0-ml";\n\n"hello world"');
  const [results, setResults] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [serverUrl, setServerUrl] = useState("http://localhost:8000");
  const [error, setError] = useState("");
  const [queryType, setQueryType] = useState("xquery");
  const [databaseId, setDatabaseId] = useState("7682138842179613689");
  const [activeTab, setActiveTab] = useState("console");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin");

  async function executeQuery() {
    if (!query.trim()) {
      setError("Please enter a query");
      return;
    }

    setIsLoading(true);
    setError("");
    setResults("");

    try {
      // Generate unique IDs for the query console session
      const qid = Date.now().toString();
      const dbid = databaseId;
      const sid = Date.now().toString();
      const crid = Math.floor(Math.random() * 10000000000).toString();
      const cache = Date.now().toString();

      // Build the query parameters
      const queryParams = new URLSearchParams({
        qid: qid,
        dbid: dbid,
        sid: sid,
        crid: crid,
        querytype: queryType,
        action: "eval",
        optimize: "1",
        trace: "",
        cache: cache
      });

      // Make the request to the MarkLogic Query Console evaluator
      const url = `${serverUrl}/qconsole/endpoints/evaler.xqy?${queryParams}`;
      const body = `data=${encodeURIComponent(query)}`;
      
      console.log("Request URL:", url);
      console.log("Request body:", body);
      console.log("Query params:", queryParams.toString());
      
      // Use digest authentication
      const response = await digestAuthRequest(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body,
        username: username,
        password: password,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.text();
      console.log("Response status:", response.status);
      console.log("Response headers:", response.headers);
      console.log("Response text:", result);
      setResults(result);
    } catch (err) {
      console.error("Query execution error:", err);
      setError(`Error: ${err.message || 'Unknown error occurred'}`);
    } finally {
      setIsLoading(false);
    }
  }

  const handleKeyDown = (e) => {
    if (e.ctrlKey && e.key === "Enter") {
      e.preventDefault();
      executeQuery();
    }
  };

  async function testConnection() {
    setIsLoading(true);
    setError("");
    setResults("");

    try {
      console.log("Testing connection to:", serverUrl);
      console.log("Fetch function available:", typeof fetch);
      
      // First test with a known good endpoint
      const testResponse = await fetch("https://httpbin.org/get", {
        method: "GET",
      });
      
      console.log("Test response (httpbin):", testResponse.status);
      
      // Then test the actual server with digest auth
      const response = await digestAuthRequest(serverUrl, {
        method: "GET",
        username: username,
        password: password,
      });
      
      console.log("Connection test response:", response.status);
      setResults(`Connection test successful! 
Test endpoint: ${testResponse.status}
Your server: ${response.status}`);
    } catch (err) {
      console.error("Connection test error:", err);
      console.error("Error stack:", err.stack);
      setError(`Connection failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="ml-console">
      <header className="header">
        <h1>ML Console</h1>
        <div className="server-config">
          <label htmlFor="server-url">Server URL:</label>
          <input
            id="server-url"
            type="text"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            placeholder="http://localhost:8000"
          />
          <label htmlFor="query-type">Query Type:</label>
          <select
            id="query-type"
            value={queryType}
            onChange={(e) => setQueryType(e.target.value)}
          >
            <option value="xquery">XQuery</option>
            <option value="javascript">JavaScript</option>
          </select>
          <label htmlFor="database-id">Database ID:</label>
          <input
            id="database-id"
            type="text"
            value={databaseId}
            onChange={(e) => setDatabaseId(e.target.value)}
            placeholder="7682138842179613689"
          />
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
          <>
            <div className="query-section">
              <div className="query-header">
                <h2>Query</h2>
                <div className="query-buttons">
                  <button
                    onClick={testConnection}
                    disabled={isLoading}
                    className="test-btn"
                  >
                    Test Connection
                  </button>
                  <button
                    onClick={executeQuery}
                    disabled={isLoading}
                    className="execute-btn"
                  >
                    {isLoading ? "Executing..." : "Execute (Ctrl+Enter)"}
                  </button>
                </div>
              </div>
              <textarea
                className="query-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Enter your ${queryType === 'xquery' ? 'XQuery' : 'JavaScript'} query here...`}
                disabled={isLoading}
              />
            </div>

            <div className="results-section">
              <h2>Results</h2>
              {error && <div className="error-message">{error}</div>}
              <div className="results-output">
                {isLoading ? (
                  <div className="loading">Executing query...</div>
                ) : (
                  <pre>{results}</pre>
                )}
              </div>
            </div>
          </>
        ) : (
          <TestHarness serverUrl={serverUrl} username={username} password={password} />
        )}
      </main>
    </div>
  );
}

export default App;
