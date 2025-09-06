/**
 * Simple LLM Test Component
 * Tests the actual LLM integration without complex setup
 */

import React, { useState } from 'react';
import { summarizeQuery, testLLMIntegration } from '../renderer/llm/summarizer';

export default function LLMTest() {
  const [testQuery, setTestQuery] = useState('xquery version "1.0-ml"; (//*[not(*)])[1 to 3]');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleTest = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      console.log('Testing LLM with query:', testQuery);
      
      // Test the actual LLM summarization
      const summary = await summarizeQuery(testQuery);
      setResult(summary);
      
      console.log('LLM Test Result:', summary);
    } catch (err) {
      console.error('LLM Test Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleIntegrationTest = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      console.log('Running LLM integration test...');
      
      const success = await testLLMIntegration();
      setResult({
        summary: success ? 'LLM integration test PASSED' : 'LLM integration test FAILED',
        confidence: success ? 1.0 : 0.0,
        model: 'Integration Test'
      });
      
      console.log('Integration test result:', success);
    } catch (err) {
      console.error('Integration test error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleElectronTest = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      console.log('Testing Electron LLM endpoint...');
      
      const response = await window.electronAPI.llm.test(testQuery);
      setResult({
        summary: `Electron test: ${response.message}`,
        confidence: response.success ? 1.0 : 0.0,
        model: 'Electron IPC'
      });
      
      console.log('Electron test response:', response);
    } catch (err) {
      console.error('Electron test error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', margin: '10px', borderRadius: '5px' }}>
      <h3>🧪 LLM Test Component</h3>
      
      <div style={{ marginBottom: '15px' }}>
        <label htmlFor="test-query" style={{ display: 'block', marginBottom: '5px' }}>
          Test Query:
        </label>
        <textarea
          id="test-query"
          value={testQuery}
          onChange={(e) => setTestQuery(e.target.value)}
          style={{ width: '100%', height: '80px', padding: '8px' }}
          placeholder="Enter a query to test..."
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <button 
          onClick={handleTest}
          disabled={loading}
          style={{ 
            marginRight: '10px', 
            padding: '8px 16px',
            backgroundColor: loading ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Testing...' : 'Test LLM Summarization'}
        </button>

        <button 
          onClick={handleIntegrationTest}
          disabled={loading}
          style={{ 
            marginRight: '10px', 
            padding: '8px 16px',
            backgroundColor: loading ? '#ccc' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          Integration Test
        </button>

        <button 
          onClick={handleElectronTest}
          disabled={loading}
          style={{ 
            padding: '8px 16px',
            backgroundColor: loading ? '#ccc' : '#ffc107',
            color: 'black',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          Electron Test
        </button>
      </div>

      {error && (
        <div style={{ 
          padding: '10px', 
          backgroundColor: '#f8d7da', 
          color: '#721c24', 
          border: '1px solid #f5c6cb',
          borderRadius: '4px',
          marginBottom: '10px'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div style={{ 
          padding: '10px', 
          backgroundColor: '#d4edda', 
          color: '#155724', 
          border: '1px solid #c3e6cb',
          borderRadius: '4px'
        }}>
          <h4>Result:</h4>
          <p><strong>Summary:</strong> {result.summary}</p>
          <p><strong>Confidence:</strong> {result.confidence}</p>
          <p><strong>Model:</strong> {result.model}</p>
        </div>
      )}
    </div>
  );
}
