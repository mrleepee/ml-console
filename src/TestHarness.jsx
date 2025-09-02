import { useState } from "react";
import { fetch } from "@tauri-apps/plugin-http";
import { digestAuthRequest } from "./digestAuth";
import "./TestHarness.css";

function TestHarness({ serverUrl, username = "admin", password = "admin" }) {
  const [testResults, setTestResults] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedEndpoint, setSelectedEndpoint] = useState("httpTest");

  const endpoints = {
    httpTest: {
      name: "HTTP Test (httpbin.org)",
      path: "",
      method: "GET",
      description: "Test basic HTTP functionality",
      fullUrl: "https://httpbin.org/get"
    },
    evaluator: {
      name: "Query Evaluator",
      path: "/qconsole/endpoints/evaler.xqy",
      method: "POST",
      description: "Execute XQuery/JavaScript queries",
      testData: {
        xquery: 'xquery version "1.0-ml";\n\n"hello world"',
        javascript: 'console.log("hello world");\n"hello world"'
      }
    },
    // Add more endpoints as we discover them
    // history: {
    //   name: "Query History",
    //   path: "/qconsole/endpoints/history.xqy",
    //   method: "GET",
    //   description: "Get query execution history"
    // },
    // sessions: {
    //   name: "Sessions",
    //   path: "/qconsole/endpoints/sessions.xqy", 
    //   method: "GET",
    //   description: "Get active sessions"
    // }
  };

  const generateSessionIds = () => {
    const timestamp = Date.now();
    return {
      qid: timestamp.toString(),
      dbid: "7682138842179613689",
      sid: timestamp.toString(),
      crid: Math.floor(Math.random() * 10000000000).toString(),
      cache: timestamp.toString()
    };
  };

  const testEndpoint = async (endpointKey) => {
    const endpoint = endpoints[endpointKey];
    if (!endpoint) return;

    setIsRunning(true);
    const testId = Date.now();
    
    try {
      const sessionIds = generateSessionIds();
      let url, body, headers;

      if (endpointKey === "httpTest") {
        // Test basic HTTP functionality
        url = endpoint.fullUrl;
        headers = {};

        const startTime = Date.now();
        const response = await fetch(url, {
          method: endpoint.method,
          headers,
        });
        const endTime = Date.now();

        const responseText = await response.text();
        
        setTestResults(prev => [...prev, {
          id: testId.toString(),
          endpoint: endpoint.name,
          type: "http-test",
          url,
          method: endpoint.method,
          requestBody: "",
          status: response.status,
          statusText: response.statusText,
          responseText,
          duration: endTime - startTime,
          timestamp: new Date().toISOString(),
          success: response.ok
        }]);
      } else if (endpointKey === "evaluator") {
        // Test both XQuery and JavaScript
        const tests = [
          { type: "xquery", query: endpoint.testData.xquery },
          { type: "javascript", query: endpoint.testData.javascript }
        ];

        for (const test of tests) {
          const queryParams = new URLSearchParams({
            ...sessionIds,
            querytype: test.type,
            action: "eval",
            optimize: "1",
            trace: "",
          });

          url = `${serverUrl}${endpoint.path}?${queryParams}`;
          body = `data=${encodeURIComponent(test.query)}`;
          headers = {
            "Content-Type": "application/x-www-form-urlencoded",
          };

          const startTime = Date.now();
          const response = await digestAuthRequest(url, {
            method: endpoint.method,
            headers,
            body,
            username: username,
            password: password,
          });
          const endTime = Date.now();

          const responseText = await response.text();
          
          setTestResults(prev => [...prev, {
            id: `${testId}-${test.type}`,
            endpoint: endpoint.name,
            type: test.type,
            url,
            method: endpoint.method,
            requestBody: body,
            status: response.status,
            statusText: response.statusText,
            responseText,
            duration: endTime - startTime,
            timestamp: new Date().toISOString(),
            success: response.ok
          }]);
        }
      } else {
        // Generic endpoint test
        url = `${serverUrl}${endpoint.path}`;
        headers = { 
          "Content-Type": "application/json",
        };

        const startTime = Date.now();
        const response = await digestAuthRequest(url, {
          method: endpoint.method,
          headers,
          username: username,
          password: password,
        });
        const endTime = Date.now();

        const responseText = await response.text();
        
        setTestResults(prev => [...prev, {
          id: testId.toString(),
          endpoint: endpoint.name,
          type: "generic",
          url,
          method: endpoint.method,
          requestBody: "",
          status: response.status,
          statusText: response.statusText,
          responseText,
          duration: endTime - startTime,
          timestamp: new Date().toISOString(),
          success: response.ok
        }]);
      }

    } catch (error) {
      setTestResults(prev => [...prev, {
        id: testId.toString(),
        endpoint: endpoint.name,
        type: "error",
        url: `${serverUrl}${endpoint.path}`,
        method: endpoint.method,
        requestBody: "",
        status: 0,
        statusText: "Network Error",
        responseText: error.message,
        duration: 0,
        timestamp: new Date().toISOString(),
        success: false,
        error: true
      }]);
    } finally {
      setIsRunning(false);
    }
  };

  const testAllEndpoints = async () => {
    setIsRunning(true);
    setTestResults([]);
    
    for (const endpointKey of Object.keys(endpoints)) {
      await testEndpoint(endpointKey);
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    setIsRunning(false);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="test-harness">
      <div className="test-header">
        <h2>Query Console Test Harness</h2>
        <div className="test-controls">
          <select 
            value={selectedEndpoint} 
            onChange={(e) => setSelectedEndpoint(e.target.value)}
            className="endpoint-selector"
          >
            {Object.entries(endpoints).map(([key, endpoint]) => (
              <option key={key} value={key}>
                {endpoint.name}
              </option>
            ))}
          </select>
          <button 
            onClick={() => testEndpoint(selectedEndpoint)}
            disabled={isRunning}
            className="test-single-btn"
          >
            Test Selected
          </button>
          <button 
            onClick={testAllEndpoints}
            disabled={isRunning}
            className="test-all-btn"
          >
            {isRunning ? "Testing..." : "Test All Endpoints"}
          </button>
          <button 
            onClick={clearResults}
            disabled={isRunning}
            className="clear-btn"
          >
            Clear Results
          </button>
        </div>
      </div>

      <div className="endpoint-info">
        <h3>{endpoints[selectedEndpoint]?.name}</h3>
        <p><strong>Path:</strong> {endpoints[selectedEndpoint]?.path}</p>
        <p><strong>Method:</strong> {endpoints[selectedEndpoint]?.method}</p>
        <p><strong>Description:</strong> {endpoints[selectedEndpoint]?.description}</p>
      </div>

      <div className="test-results">
        <h3>Test Results ({testResults.length})</h3>
        {testResults.length === 0 ? (
          <p className="no-results">No test results yet. Run a test to see results here.</p>
        ) : (
          <div className="results-list">
            {testResults.map((result) => (
              <div key={result.id} className={`result-item ${result.success ? 'success' : 'error'}`}>
                <div className="result-header">
                  <div className="result-meta">
                    <span className="endpoint-name">{result.endpoint}</span>
                    <span className="test-type">{result.type}</span>
                    <span className={`status ${result.success ? 'success' : 'error'}`}>
                      {result.status} {result.statusText}
                    </span>
                    <span className="duration">{result.duration}ms</span>
                  </div>
                  <div className="result-actions">
                    <button 
                      onClick={() => copyToClipboard(result.url)}
                      className="copy-btn"
                      title="Copy URL"
                    >
                      📋 URL
                    </button>
                    <button 
                      onClick={() => copyToClipboard(result.responseText)}
                      className="copy-btn"
                      title="Copy Response"
                    >
                      📋 Response
                    </button>
                  </div>
                </div>
                
                <div className="result-details">
                  <div className="detail-section">
                    <h4>Request</h4>
                    <div className="detail-content">
                      <p><strong>URL:</strong> <code>{result.url}</code></p>
                      <p><strong>Method:</strong> {result.method}</p>
                      {result.requestBody && (
                        <div>
                          <p><strong>Body:</strong></p>
                          <pre className="request-body">{result.requestBody}</pre>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="detail-section">
                    <h4>Response</h4>
                    <div className="detail-content">
                      <p><strong>Status:</strong> {result.status} {result.statusText}</p>
                      <p><strong>Duration:</strong> {result.duration}ms</p>
                      <p><strong>Timestamp:</strong> {new Date(result.timestamp).toLocaleString()}</p>
                      <div>
                        <p><strong>Response Body:</strong></p>
                        <pre className="response-body">{result.responseText}</pre>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default TestHarness;
