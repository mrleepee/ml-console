import { useState } from "react";
import "./TestHarness.css";

function TestHarness({ serverUrl, username = "admin", password = "admin" }) {
  const [testResults, setTestResults] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedEndpoint, setSelectedEndpoint] = useState("restEval");

  const endpoints = {
    restEval: {
      name: "REST API Eval",
      path: "/v1/eval",
      method: "POST",
      description: "Test MarkLogic REST API query evaluation (primary endpoint used by console)",
      testData: {
        xquery: 'xquery version "1.0-ml";\n\n"REST API test"'
      }
    },
    digestAuth: {
      name: "Digest Authentication",
      path: "/qconsole/endpoints/evaler.xqy",
      method: "POST",
      description: "Test digest authentication with Query Console evaler endpoint",
      testData: {
        xquery: 'xquery version "1.0-ml";\n\n"digest auth test"'
      }
    },
    databases: {
      name: "Database List",
      path: "/qconsole/endpoints/databases.xqy",
      method: "GET", 
      description: "Test database enumeration endpoint"
    },
    healthCheck: {
      name: "Server Health",
      path: "/",
      method: "GET",
      description: "Basic server connectivity test"
    }
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

      if (endpointKey === "restEval") {
        // Test REST API eval endpoint (primary console endpoint)
        url = `${serverUrl}${endpoint.path}`;
        body = `xquery=${encodeURIComponent(endpoint.testData.xquery)}`;
        headers = {
          "Content-Type": "application/x-www-form-urlencoded",
        };
      } else if (endpointKey === "digestAuth") {
        // Test Query Console digest authentication
        const queryParams = new URLSearchParams({
          ...sessionIds,
          querytype: "xquery",
          action: "eval",
          optimize: "1",
          trace: "",
        });

        url = `${serverUrl}${endpoint.path}?${queryParams}`;
        body = `data=${encodeURIComponent(endpoint.testData.xquery)}`;
        headers = {
          "Content-Type": "application/x-www-form-urlencoded",
        };
      } else {
        // Simple GET endpoint test
        url = `${serverUrl}${endpoint.path}`;
        body = "";
        headers = { 
          "Content-Type": "application/json",
        };
      }

      const startTime = Date.now();
      const response = await window.electronAPI.httpRequest({
        url: url,
        method: endpoint.method,
        headers: headers,
        body: body,
        username: username,
        password: password,
      });
      const endTime = Date.now();

      const responseText = response.body;
      
      setTestResults(prev => [...prev, {
        id: testId.toString(),
        endpoint: endpoint.name,
        type: endpointKey,
        url,
        method: endpoint.method,
        requestBody: body,
        status: response.status,
        statusText: response.statusText,
        responseText,
        duration: endTime - startTime,
        timestamp: new Date().toISOString(),
        success: response.status >= 200 && response.status < 300
      }]);

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
