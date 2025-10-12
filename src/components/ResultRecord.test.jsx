import { describe, test, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import ResultRecord from './results/ResultRecord';
import { formatRecordContent } from '../services/responseService';
import { calculateResultEditorHeight } from '../utils/editorSizing';

// Mock the services
vi.mock('../services/responseService', () => ({
  formatRecordContent: vi.fn((record) => record.content || '')
}));

vi.mock('../utils/editorSizing', () => ({
  calculateResultEditorHeight: vi.fn((content) => {
    const lines = content.split('\n').length;
    const height = Math.max(60, Math.min(600, lines * 19 + 20));
    return `${height}px`;
  })
}));

// Mock LoadingBoundary to render children immediately
vi.mock('./LoadingBoundary', () => ({
  default: ({ children }) => <div>{children}</div>,
  EditorFallback: () => <div data-testid="editor-fallback">Loading...</div>
}));

// Mock Monaco Editor
vi.mock('./MonacoEditor', () => ({
  default: vi.fn(({ content, height, language, theme }) => (
    <div data-testid="monaco-editor" data-height={height} data-language={language} data-theme={theme}>
      {content}
    </div>
  ))
}));

describe('ResultRecord Component', () => {
  let mockGetLanguage;

  beforeEach(() => {
    mockGetLanguage = vi.fn((contentType) => {
      if (!contentType) return 'plaintext';
      if (contentType.includes('xml')) return 'xml';
      if (contentType.includes('json')) return 'json';
      return 'plaintext';
    });
    vi.clearAllMocks();
  });

  test('renders record with basic information', () => {
    const record = {
      uri: '/test/record.xml',
      content: '<test>data</test>',
      contentType: 'application/xml',
      primitive: 'element()',
      path: '/test/record'
    };

    render(
      <ResultRecord
        record={record}
        index={0}
        globalIndex={0}
        pageStart={0}
        isActive={false}
        monacoTheme="vs"
        getMonacoLanguageFromContentType={mockGetLanguage}
      />
    );

    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('/test/record.xml')).toBeInTheDocument();
    expect(screen.getByText(/application\/xml/)).toBeInTheDocument();
    expect(screen.getByText(/element\(\)/)).toBeInTheDocument();
    // XPath appears in content, so multiple matches - use getAllByText
    const xpathMatches = screen.getAllByText(/\/test\/record/);
    expect(xpathMatches.length).toBeGreaterThan(0);
  });

  test('applies active styling when index matches activeRecordIndex', () => {
    const record = {
      uri: '/test/record.xml',
      content: '<test>data</test>',
      contentType: 'application/xml'
    };

    const { rerender } = render(
      <ResultRecord
        record={record}
        index={0}
        globalIndex={0}
        pageStart={0}
        isActive={false}
        monacoTheme="vs"
        getMonacoLanguageFromContentType={mockGetLanguage}
      />
    );

    let recordElement = screen.getByTestId('result-record-0');
    expect(recordElement.className).toContain('border-base-300');
    expect(recordElement.className).not.toContain('border-primary');

    // Re-render with active index
    rerender(
      <ResultRecord
        record={record}
        index={0}
        globalIndex={0}
        pageStart={0}
        isActive={true}
        monacoTheme="vs"
        getMonacoLanguageFromContentType={mockGetLanguage}
      />
    );

    recordElement = screen.getByTestId('result-record-0');
    expect(recordElement.className).toContain('border-primary');
    expect(recordElement.className).toContain('ring-2');
  });

  test('calculates dynamic height for small content', () => {
    const record = {
      uri: '/test/small.xml',
      content: '<root>\n  <child>value</child>\n</root>',
      contentType: 'application/xml'
    };

    render(
      <ResultRecord
        record={record}
        index={0}
        globalIndex={0}
        pageStart={0}
        isActive={false}
        monacoTheme="vs"
        getMonacoLanguageFromContentType={mockGetLanguage}
      />
    );

    expect(calculateResultEditorHeight).toHaveBeenCalled();
    const editor = screen.getByTestId('monaco-editor');
    expect(editor.dataset.height).toBe('77px'); // 3 lines * 19 + 20 = 77px
  });

  test('calculates dynamic height for very long content (clamped to max)', () => {
    const longContent = Array(100).fill('<line>data</line>').join('\n');
    const record = {
      uri: '/test/large.xml',
      content: longContent,
      contentType: 'application/xml'
    };

    render(
      <ResultRecord
        record={record}
        index={0}
        globalIndex={0}
        pageStart={0}
        isActive={false}
        monacoTheme="vs"
        getMonacoLanguageFromContentType={mockGetLanguage}
      />
    );

    const editor = screen.getByTestId('monaco-editor');
    expect(editor.dataset.height).toBe('600px'); // Clamped to MAX_RESULT_HEIGHT
  });

  test('passes correct language to Monaco based on content type', () => {
    const xmlRecord = {
      uri: '/test/data.xml',
      content: '<xml/>',
      contentType: 'application/xml'
    };

    const { rerender } = render(
      <ResultRecord
        record={xmlRecord}
        index={0}
        globalIndex={0}
        pageStart={0}
        isActive={false}
        monacoTheme="vs"
        getMonacoLanguageFromContentType={mockGetLanguage}
      />
    );

    expect(mockGetLanguage).toHaveBeenCalledWith('application/xml');
    let editor = screen.getByTestId('monaco-editor');
    expect(editor.dataset.language).toBe('xml');

    // Test JSON
    const jsonRecord = {
      uri: '/test/data.json',
      content: '{"key": "value"}',
      contentType: 'application/json'
    };

    rerender(
      <ResultRecord
        record={jsonRecord}
        index={0}
        globalIndex={0}
        pageStart={0}
        isActive={false}
        monacoTheme="vs"
        getMonacoLanguageFromContentType={mockGetLanguage}
      />
    );

    expect(mockGetLanguage).toHaveBeenCalledWith('application/json');
    editor = screen.getByTestId('monaco-editor');
    expect(editor.dataset.language).toBe('json');
  });

  test('memoization: does not re-render when unrelated props change', () => {
    const record = {
      uri: '/test/record.xml',
      content: '<test>data</test>',
      contentType: 'application/xml'
    };

    let renderCount = 0;
    const CountingMonacoEditor = vi.fn((props) => {
      renderCount++;
      return <MockMonacoEditor {...props} />;
    });

    const { rerender } = render(
      <ResultRecord
        record={record}
        index={0}
        globalIndex={0}
        pageStart={0}
        isActive={false}
        monacoTheme="vs"
        getMonacoLanguageFromContentType={mockGetLanguage}
      />
    );

    const initialRenderCount = renderCount;

    // Re-render with new function reference (should NOT re-render due to custom comparison)
    const newGetLanguage = vi.fn(mockGetLanguage);
    rerender(
      <ResultRecord
        record={record}
        index={0}
        globalIndex={0}
        pageStart={0}
        isActive={false}
        monacoTheme="vs"
        getMonacoLanguageFromContentType={newGetLanguage}
      />
    );

    expect(renderCount).toBe(initialRenderCount); // No re-render
  });

  test('memoization: DOES re-render when isActive changes', () => {
    const record = {
      uri: '/test/record.xml',
      content: '<test>data</test>',
      contentType: 'application/xml'
    };

    let renderCount = 0;
    const CountingMonacoEditor = vi.fn((props) => {
      renderCount++;
      return <MockMonacoEditor {...props} />;
    });

    const { rerender } = render(
      <ResultRecord
        record={record}
        index={0}
        globalIndex={0}
        pageStart={0}
        isActive={false}
        monacoTheme="vs"
        getMonacoLanguageFromContentType={mockGetLanguage}
      />
    );

    const initialRenderCount = renderCount;

    // Re-render with isActive change (should re-render)
    rerender(
      <ResultRecord
        record={record}
        index={0}
        globalIndex={0}
        pageStart={0}
        isActive={true}
        monacoTheme="vs"
        getMonacoLanguageFromContentType={mockGetLanguage}
      />
    );

    expect(renderCount).toBeGreaterThan(initialRenderCount); // Re-rendered
  });

  test('formats content only once using useMemo', () => {
    const record = {
      uri: '/test/record.xml',
      content: '<test>data</test>',
      contentType: 'application/xml'
    };

    formatRecordContent.mockClear();

    const { rerender } = render(
      <ResultRecord
        record={record}
        index={0}
        globalIndex={0}
        pageStart={0}
        isActive={false}
        monacoTheme="vs"
        getMonacoLanguageFromContentType={mockGetLanguage}
      />
    );

    expect(formatRecordContent).toHaveBeenCalledTimes(1);

    // Re-render with different isActive but same record
    rerender(
      <ResultRecord
        record={record}
        index={0}
        globalIndex={0}
        pageStart={0}
        isActive={true}
        monacoTheme="vs"
        getMonacoLanguageFromContentType={mockGetLanguage}
      />
    );

    // formatRecordContent should NOT be called again (memoized)
    expect(formatRecordContent).toHaveBeenCalledTimes(1);
  });

  test('handles missing optional fields gracefully', () => {
    const record = {
      content: 'plain text content'
      // Missing uri, contentType, primitive, path
    };

    render(
      <ResultRecord
        record={record}
        index={0}
        globalIndex={0}
        pageStart={0}
        isActive={false}
        monacoTheme="vs"
        getMonacoLanguageFromContentType={mockGetLanguage}
      />
    );

    expect(screen.getByText('No URI')).toBeInTheDocument();
    // "Not available" appears twice (Content Type and Datatype)
    const notAvailableMatches = screen.getAllByText(/Not available/);
    expect(notAvailableMatches.length).toBe(2);
    expect(screen.queryByText(/XPath:/)).not.toBeInTheDocument();
  });

  // REGRESSION TESTS FOR NAVIGATION HIGHLIGHTING BUG
  describe('Navigation Highlighting (isActive prop)', () => {
    test('CRITICAL: isActive change causes styling update (regression test)', () => {
      const record = {
        uri: '/test/record.xml',
        content: '<test>data</test>',
        contentType: 'application/xml'
      };

      const { rerender } = render(
        <ResultRecord
          record={record}
          index={0}
          globalIndex={0}
          pageStart={0}
          isActive={false}
          monacoTheme="vs"
          getMonacoLanguageFromContentType={mockGetLanguage}
          />
      );

      let element = screen.getByTestId('result-record-0');
      expect(element.className).toContain('border-base-300');
      expect(element.className).not.toContain('border-primary');

      // Change isActive to true - should trigger re-render and update styling
      rerender(
        <ResultRecord
          record={record}
          index={0}
          globalIndex={0}
          pageStart={0}
          isActive={true}
          monacoTheme="vs"
          getMonacoLanguageFromContentType={mockGetLanguage}
          />
      );

      element = screen.getByTestId('result-record-0');
      expect(element.className).toContain('border-primary');
      expect(element.className).toContain('ring-2');
      expect(element.className).not.toContain('border-base-300');
    });

    test('CRITICAL: multiple records maintain independent active states', () => {
      const records = [
        { uri: '/test/1.xml', content: '<test>1</test>', contentType: 'application/xml' },
        { uri: '/test/2.xml', content: '<test>2</test>', contentType: 'application/xml' },
        { uri: '/test/3.xml', content: '<test>3</test>', contentType: 'application/xml' }
      ];

      const { rerender } = render(
        <div>
          {records.map((record, index) => (
            <ResultRecord
              key={index}
              record={record}
              index={index}
              globalIndex={index}
              pageStart={0}
              isActive={index === 0}
              monacoTheme="vs"
              getMonacoLanguageFromContentType={mockGetLanguage}
                  />
          ))}
        </div>
      );

      // Initially record 0 is active
      expect(screen.getByTestId('result-record-0').className).toContain('border-primary');
      expect(screen.getByTestId('result-record-1').className).toContain('border-base-300');
      expect(screen.getByTestId('result-record-2').className).toContain('border-base-300');

      // Navigate to record 1
      rerender(
        <div>
          {records.map((record, index) => (
            <ResultRecord
              key={index}
              record={record}
              index={index}
              globalIndex={index}
              pageStart={0}
              isActive={index === 1}
              monacoTheme="vs"
              getMonacoLanguageFromContentType={mockGetLanguage}
                  />
          ))}
        </div>
      );

      // Record 0 should lose active styling, record 1 should gain it
      expect(screen.getByTestId('result-record-0').className).toContain('border-base-300');
      expect(screen.getByTestId('result-record-0').className).not.toContain('border-primary');
      expect(screen.getByTestId('result-record-1').className).toContain('border-primary');
      expect(screen.getByTestId('result-record-2').className).toContain('border-base-300');

      // Navigate to record 2
      rerender(
        <div>
          {records.map((record, index) => (
            <ResultRecord
              key={index}
              record={record}
              index={index}
              globalIndex={index}
              pageStart={0}
              isActive={index === 2}
              monacoTheme="vs"
              getMonacoLanguageFromContentType={mockGetLanguage}
                  />
          ))}
        </div>
      );

      // Record 1 should lose active styling, record 2 should gain it
      expect(screen.getByTestId('result-record-0').className).toContain('border-base-300');
      expect(screen.getByTestId('result-record-1').className).toContain('border-base-300');
      expect(screen.getByTestId('result-record-1').className).not.toContain('border-primary');
      expect(screen.getByTestId('result-record-2').className).toContain('border-primary');
    });

    test('CRITICAL: memo does NOT block re-renders when isActive changes', () => {
      const record = {
        uri: '/test/record.xml',
        content: '<test>data</test>',
        contentType: 'application/xml'
      };

      let renderCount = 0;
      const CountingMonacoEditor = vi.fn((props) => {
        renderCount++;
        return <MockMonacoEditor {...props} />;
      });

      const { rerender } = render(
        <ResultRecord
          record={record}
          index={0}
          globalIndex={0}
          pageStart={0}
          isActive={false}
          monacoTheme="vs"
          getMonacoLanguageFromContentType={mockGetLanguage}
          />
      );

      const initialRenderCount = renderCount;

      // Change isActive - should trigger re-render
      rerender(
        <ResultRecord
          record={record}
          index={0}
          globalIndex={0}
          pageStart={0}
          isActive={true}
          monacoTheme="vs"
          getMonacoLanguageFromContentType={mockGetLanguage}
          />
      );

      // This MUST re-render to update border styling
      expect(renderCount).toBeGreaterThan(initialRenderCount);
    });

    test('memo DOES block re-renders when only function props change', () => {
      const record = {
        uri: '/test/record.xml',
        content: '<test>data</test>',
        contentType: 'application/xml'
      };

      let renderCount = 0;
      const CountingMonacoEditor = vi.fn((props) => {
        renderCount++;
        return <MockMonacoEditor {...props} />;
      });

      const { rerender } = render(
        <ResultRecord
          record={record}
          index={0}
          globalIndex={0}
          pageStart={0}
          isActive={false}
          monacoTheme="vs"
          getMonacoLanguageFromContentType={mockGetLanguage}
          />
      );

      const initialRenderCount = renderCount;

      // Change only function reference (should NOT re-render)
      const newGetLanguage = vi.fn(mockGetLanguage);
      rerender(
        <ResultRecord
          record={record}
          index={0}
          globalIndex={0}
          pageStart={0}
          isActive={false}
          monacoTheme="vs"
          getMonacoLanguageFromContentType={newGetLanguage}
          />
      );

      // Should NOT re-render (performance optimization)
      expect(renderCount).toBe(initialRenderCount);
    });
  });
});
