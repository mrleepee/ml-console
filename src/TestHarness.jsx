import { useState, useEffect } from "react";
import "./TestHarness.css";

function TestHarness({ serverUrl, username = "admin", password = "admin" }) {
  const [testResults, setTestResults] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedTest, setSelectedTest] = useState("all");
  const [testOutput, setTestOutput] = useState("");
  const [testSummary, setTestSummary] = useState(null);

  const availableTests = {
    all: {
      name: "All Tests",
      description: "Run all Playwright tests",
      command: "npm run e2e:electron"
    },
    electron: {
      name: "Electron Tests",
      description: "Test Electron app functionality and UI",
      command: "npx playwright test tests/electron.spec.ts"
    },
    navigation: {
      name: "Navigation Tests", 
      description: "Test navigation and record handling",
      command: "npx playwright test tests/navigation.spec.ts"
    }
  };

  const runTest = async (testKey) => {
    const test = availableTests[testKey];
    if (!test) return;

    setIsRunning(true);
    setTestOutput("");
    setTestResults([]);
    setTestSummary(null);
    
    const testId = Date.now();
    const startTime = Date.now();
    
    try {
      // Use Electron's child_process to run the test command
      const result = await window.electronAPI.runCommand({
        command: test.command,
        cwd: process.cwd()
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Parse the test output
      const output = result.stdout || result.stderr || "";
      setTestOutput(output);
      
      // Parse test results from Playwright output
      const parsedResults = parsePlaywrightOutput(output);
      setTestResults(parsedResults);
      
      // Calculate summary
      const summary = {
        total: parsedResults.length,
        passed: parsedResults.filter(r => r.success).length,
        failed: parsedResults.filter(r => !r.success).length,
        duration: duration
      };
      setTestSummary(summary);
      
      // Add overall test result
      setTestResults(prev => [...prev, {
        id: testId.toString(),
        testName: test.name,
        type: "summary",
        success: summary.failed === 0,
        duration: duration,
        timestamp: new Date().toISOString(),
        summary: summary
      }]);

    } catch (error) {
      const endTime = Date.now();
      setTestOutput(`Error running test: ${error.message}`);
      setTestResults([{
        id: testId.toString(),
        testName: test.name,
        type: "error",
        success: false,
        duration: endTime - startTime,
        timestamp: new Date().toISOString(),
        error: error.message
      }]);
      setTestSummary({
        total: 1,
        passed: 0,
        failed: 1,
        duration: endTime - startTime
      });
    } finally {
      setIsRunning(false);
    }
  };

  const runAllTests = async () => {
    await runTest("all");
  };

  const parsePlaywrightOutput = (output) => {
    const results = [];
    const lines = output.split('\n');
    
    let currentTest = null;
    let inTestResult = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Look for test start patterns
      if (line.includes('Running') && line.includes('test')) {
        const testName = line.match(/Running (\d+) test/)?.[1] || 'Unknown';
        currentTest = {
          id: Date.now() + i,
          testName: `Test ${testName}`,
          type: 'playwright',
          success: false,
          duration: 0,
          timestamp: new Date().toISOString(),
          output: []
        };
        inTestResult = true;
      }
      
      // Look for test result patterns
      if (line.includes('✓') || line.includes('PASS')) {
        if (currentTest) {
          currentTest.success = true;
          currentTest.output.push(line);
        }
      } else if (line.includes('✗') || line.includes('FAIL') || line.includes('Error')) {
        if (currentTest) {
          currentTest.success = false;
          currentTest.output.push(line);
        }
      }
      
      // Look for test completion
      if (line.includes('Test finished') || line.includes('passed') || line.includes('failed')) {
        if (currentTest && inTestResult) {
          // Extract duration if available
          const durationMatch = line.match(/(\d+)ms/);
          if (durationMatch) {
            currentTest.duration = parseInt(durationMatch[1]);
          }
          results.push(currentTest);
          currentTest = null;
          inTestResult = false;
        }
      }
      
      // Collect output for current test
      if (currentTest && inTestResult && line) {
        currentTest.output.push(line);
      }
    }
    
    // If we have a current test that wasn't closed, add it
    if (currentTest) {
      results.push(currentTest);
    }
    
    return results;
  };

  const clearResults = () => {
    setTestResults([]);
    setTestOutput("");
    setTestSummary(null);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="test-harness">
      <div className="test-header">
        <h2>Playwright Test Runner</h2>
        <div className="test-controls">
          <select 
            value={selectedTest} 
            onChange={(e) => setSelectedTest(e.target.value)}
            className="test-selector"
          >
            {Object.entries(availableTests).map(([key, test]) => (
              <option key={key} value={key}>
                {test.name}
              </option>
            ))}
          </select>
          <button 
            onClick={() => runTest(selectedTest)}
            disabled={isRunning}
            className="test-single-btn"
          >
            Run Selected Test
          </button>
          <button 
            onClick={runAllTests}
            disabled={isRunning}
            className="test-all-btn"
          >
            {isRunning ? "Running Tests..." : "Run All Tests"}
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

      <div className="test-info">
        <h3>{availableTests[selectedTest]?.name}</h3>
        <p><strong>Command:</strong> <code>{availableTests[selectedTest]?.command}</code></p>
        <p><strong>Description:</strong> {availableTests[selectedTest]?.description}</p>
      </div>

      {testSummary && (
        <div className="test-summary">
          <h3>Test Summary</h3>
          <div className="summary-stats">
            <div className="stat">
              <span className="stat-label">Total:</span>
              <span className="stat-value">{testSummary.total}</span>
            </div>
            <div className="stat success">
              <span className="stat-label">Passed:</span>
              <span className="stat-value">{testSummary.passed}</span>
            </div>
            <div className="stat error">
              <span className="stat-label">Failed:</span>
              <span className="stat-value">{testSummary.failed}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Duration:</span>
              <span className="stat-value">{testSummary.duration}ms</span>
            </div>
          </div>
        </div>
      )}

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
                    <span className="test-name">{result.testName}</span>
                    <span className="test-type">{result.type}</span>
                    <span className={`status ${result.success ? 'success' : 'error'}`}>
                      {result.success ? 'PASSED' : 'FAILED'}
                    </span>
                    <span className="duration">{result.duration}ms</span>
                  </div>
                  <div className="result-actions">
                    <button 
                      onClick={() => copyToClipboard(result.output?.join('\n') || '')}
                      className="copy-btn"
                      title="Copy Output"
                    >
                      📋 Output
                    </button>
                  </div>
                </div>
                
                <div className="result-details">
                  <div className="detail-section">
                    <h4>Test Details</h4>
                    <div className="detail-content">
                      <p><strong>Test Name:</strong> {result.testName}</p>
                      <p><strong>Type:</strong> {result.type}</p>
                      <p><strong>Duration:</strong> {result.duration}ms</p>
                      <p><strong>Timestamp:</strong> {new Date(result.timestamp).toLocaleString()}</p>
                      {result.error && (
                        <div>
                          <p><strong>Error:</strong></p>
                          <pre className="error-output">{result.error}</pre>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {result.output && result.output.length > 0 && (
                    <div className="detail-section">
                      <h4>Test Output</h4>
                      <div className="detail-content">
                        <pre className="test-output">{result.output.join('\n')}</pre>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {testOutput && (
        <div className="raw-output">
          <h3>Raw Test Output</h3>
          <div className="output-controls">
            <button 
              onClick={() => copyToClipboard(testOutput)}
              className="copy-btn"
            >
              📋 Copy All Output
            </button>
          </div>
          <pre className="raw-output-content">{testOutput}</pre>
        </div>
      )}
    </div>
  );
}

export default TestHarness;
