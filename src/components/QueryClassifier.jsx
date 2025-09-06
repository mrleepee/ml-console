import React, { useState } from 'react';

const QueryClassifier = ({ query, onClassify, isClassifying = false }) => {
  const [classification, setClassification] = useState(null);
  const [error, setError] = useState(null);

  const handleClassify = async () => {
    if (!query || query.trim().length === 0) return;
    
    setError(null);
    onClassify?.(true);
    
    try {
      // Dynamic import to avoid bundling when not used
      const { classifyQuery } = await import('../renderer/llm/classifier');
      const result = await classifyQuery(query);
      setClassification(result);
    } catch (err) {
      console.error('Classification failed:', err);
      setError(err.message || 'Classification failed');
    } finally {
      onClassify?.(false);
    }
  };

  if (!query || query.trim().length === 0) {
    return null;
  }

  return (
    <div className="query-classifier">
      <button 
        onClick={handleClassify}
        disabled={isClassifying}
        className="classify-btn"
        title="Classify query using AI"
      >
        {isClassifying ? '🤖 Classifying...' : '🤖 Classify'}
      </button>
      
      {classification && (
        <div className="classification-result">
          <span className="classified-type">
            AI: {classification.label.toUpperCase()}
          </span>
          <span className="confidence">
            ({Math.round(classification.score * 100)}%)
          </span>
        </div>
      )}
      
      {error && (
        <div className="classification-error">
          Error: {error}
        </div>
      )}
    </div>
  );
};

export default QueryClassifier;
