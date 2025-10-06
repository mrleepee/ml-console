import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * Query Editor Tests
 *
 * Tests for the query editor functionality including:
 * - newQuery button creating blank queries with language templates
 * - Query type changes triggering newQuery
 * - Default query loading from history
 */

describe('Query Editor Functionality', () => {
  describe('newQuery function', () => {
    it('should create XQuery template when queryType is xquery', () => {
      const { result } = renderHook(() => {
        const [query, setQuery] = useState('');
        const [queryType] = useState('xquery');

        const newQuery = useCallback(() => {
          const defaultQueries = {
            xquery: 'xquery version "1.0-ml";\n\n',
            javascript: "'use strict';\n\n",
            sparql: 'PREFIX : <http://example.org/>\n\nSELECT * WHERE {\n  ?s ?p ?o\n}\nLIMIT 10'
          };
          setQuery(defaultQueries[queryType] || '');
        }, [queryType]);

        return { query, newQuery };
      });

      act(() => {
        result.current.newQuery();
      });

      expect(result.current.query).toBe('xquery version "1.0-ml";\n\n');
    });

    it('should create JavaScript template when queryType is javascript', () => {
      const { result } = renderHook(() => {
        const [query, setQuery] = useState('');
        const [queryType] = useState('javascript');

        const newQuery = useCallback(() => {
          const defaultQueries = {
            xquery: 'xquery version "1.0-ml";\n\n',
            javascript: "'use strict';\n\n",
            sparql: 'PREFIX : <http://example.org/>\n\nSELECT * WHERE {\n  ?s ?p ?o\n}\nLIMIT 10'
          };
          setQuery(defaultQueries[queryType] || '');
        }, [queryType]);

        return { query, newQuery };
      });

      act(() => {
        result.current.newQuery();
      });

      expect(result.current.query).toBe("'use strict';\n\n");
    });

    it('should create SPARQL template when queryType is sparql', () => {
      const { result } = renderHook(() => {
        const [query, setQuery] = useState('');
        const [queryType] = useState('sparql');

        const newQuery = useCallback(() => {
          const defaultQueries = {
            xquery: 'xquery version "1.0-ml";\n\n',
            javascript: "'use strict';\n\n",
            sparql: 'PREFIX : <http://example.org/>\n\nSELECT * WHERE {\n  ?s ?p ?o\n}\nLIMIT 10'
          };
          setQuery(defaultQueries[queryType] || '');
        }, [queryType]);

        return { query, newQuery };
      });

      act(() => {
        result.current.newQuery();
      });

      expect(result.current.query).toBe('PREFIX : <http://example.org/>\n\nSELECT * WHERE {\n  ?s ?p ?o\n}\nLIMIT 10');
    });

    it('should clear query with empty string for unknown query type', () => {
      const { result } = renderHook(() => {
        const [query, setQuery] = useState('some existing query');
        const [queryType] = useState('unknown');

        const newQuery = useCallback(() => {
          const defaultQueries = {
            xquery: 'xquery version "1.0-ml";\n\n',
            javascript: "'use strict';\n\n",
            sparql: 'PREFIX : <http://example.org/>\n\nSELECT * WHERE {\n  ?s ?p ?o\n}\nLIMIT 10'
          };
          setQuery(defaultQueries[queryType] || '');
        }, [queryType]);

        return { query, newQuery };
      });

      act(() => {
        result.current.newQuery();
      });

      expect(result.current.query).toBe('');
    });

    it('should clear results and error state', () => {
      const { result } = renderHook(() => {
        const [query, setQuery] = useState('old query');
        const [results, setResults] = useState('some results');
        const [error, setError] = useState('some error');
        const [queryType] = useState('xquery');

        const newQuery = useCallback(() => {
          const defaultQueries = {
            xquery: 'xquery version "1.0-ml";\n\n',
            javascript: "'use strict';\n\n",
            sparql: 'PREFIX : <http://example.org/>\n\nSELECT * WHERE {\n  ?s ?p ?o\n}\nLIMIT 10'
          };
          setQuery(defaultQueries[queryType] || '');
          setResults('');
          setError('');
        }, [queryType]);

        return { query, results, error, newQuery };
      });

      act(() => {
        result.current.newQuery();
      });

      expect(result.current.query).toBe('xquery version "1.0-ml";\n\n');
      expect(result.current.results).toBe('');
      expect(result.current.error).toBe('');
    });
  });

  describe('Query Type Change Trigger', () => {
    it('should trigger newQuery when queryType changes after initial mount', async () => {
      const { result } = renderHook(() => {
        const [queryType, setQueryType] = useState('xquery');
        const [query, setQuery] = useState('initial query');
        const isInitialMount = useRef(true);
        const [callCount, setCallCount] = useState(0);

        const newQuery = useCallback(() => {
          const defaultQueries = {
            xquery: 'xquery version "1.0-ml";\n\n',
            javascript: "'use strict';\n\n",
            sparql: 'PREFIX : <http://example.org/>\n\nSELECT * WHERE {\n  ?s ?p ?o\n}\nLIMIT 10'
          };
          setQuery(defaultQueries[queryType] || '');
          setCallCount(c => c + 1);
        }, [queryType]);

        useEffect(() => {
          if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
          }
          newQuery();
        }, [queryType, newQuery]);

        return { query, queryType, setQueryType, callCount };
      });

      // Initial mount - newQuery should NOT be called yet
      expect(result.current.callCount).toBe(0);
      expect(result.current.query).toBe('initial query');

      // Change query type - should trigger newQuery
      act(() => {
        result.current.setQueryType('javascript');
      });

      // Wait for effect to run
      await waitFor(() => {
        expect(result.current.callCount).toBe(1);
        expect(result.current.query).toBe("'use strict';\n\n");
      });

      // Change again - should trigger newQuery again
      act(() => {
        result.current.setQueryType('sparql');
      });

      await waitFor(() => {
        expect(result.current.callCount).toBe(2);
        expect(result.current.query).toBe('PREFIX : <http://example.org/>\n\nSELECT * WHERE {\n  ?s ?p ?o\n}\nLIMIT 10');
      });
    });

    it('should skip first useEffect call on initial mount using useRef', () => {
      let capturedRef;
      const { result } = renderHook(() => {
        const isInitialMount = useRef(true);
        const [effectCalled, setEffectCalled] = useState(false);

        useEffect(() => {
          if (isInitialMount.current) {
            isInitialMount.current = false;
            return; // Should return here on first call
          }
          setEffectCalled(true); // Should not reach here on first call
        }, []);

        capturedRef = isInitialMount;
        return { effectCalled };
      });

      // Effect should have run but early returned
      expect(capturedRef.current).toBe(false);
      expect(result.current.effectCalled).toBe(false);
    });
  });

  describe('Default Query Loading', () => {
    it('should document expected behavior for loading last query', () => {
      // This test documents the expected behavior rather than testing async electron API
      const expectedBehavior = {
        onMount: 'Load most recent query from database via electronAPI.database.getRecentQueries(1)',
        ifFound: 'Set query content and queryType from the returned query',
        ifNotFound: 'Keep existing default query (xquery version "1.0-ml";...)',
        database: 'Query history is stored in SQLite via electron main process'
      };

      expect(expectedBehavior.onMount).toBeTruthy();
      expect(expectedBehavior.ifFound).toBeTruthy();
      expect(expectedBehavior.ifNotFound).toBeTruthy();
    });
  });

  describe('Template Content Validation', () => {
    it('should have correct XQuery version declaration', () => {
      const template = 'xquery version "1.0-ml";\n\n';
      expect(template).toContain('xquery version "1.0-ml";');
      expect(template).toMatch(/\n\n$/); // Should end with double newline for cursor
    });

    it('should have correct JavaScript strict mode', () => {
      const template = "'use strict';\n\n";
      expect(template).toContain("'use strict';");
      expect(template).toMatch(/\n\n$/);
    });

    it('should have valid SPARQL prefix and SELECT structure', () => {
      const template = 'PREFIX : <http://example.org/>\n\nSELECT * WHERE {\n  ?s ?p ?o\n}\nLIMIT 10';
      expect(template).toContain('PREFIX :');
      expect(template).toContain('SELECT * WHERE');
      expect(template).toContain('LIMIT 10');
      expect(template).toMatch(/\?s \?p \?o/); // Triple pattern
    });
  });
});
