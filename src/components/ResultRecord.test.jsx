import { describe, test, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
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

// Mock Monaco Editor
const MockMonacoEditor = vi.fn(({ content, height, language, theme }) => (
  <div data-testid="monaco-editor" data-height={height} data-language={language} data-theme={theme}>
    {content}
  </div>
));

// Create ResultRecord component inline for testing (extracted from App.jsx)
const ResultRecord = React.memo(function ResultRecord({
  record,
  index,
  globalIndex,
  pageStart,
  isActive,
  recordRefs,
  monacoTheme,
  getMonacoLanguageFromContentType,
  MemoMonacoEditor
}) {
  const formattedContent = React.useMemo(() => formatRecordContent(record), [record]);
  const recordHeight = React.useMemo(() => calculateResultEditorHeight(formattedContent), [formattedContent]);

  const contentHash = record.content?.substring(0, 50)?.replace(/\W+/g, '') || 'empty';
  const stableId = `record-${globalIndex}-${record.uri || 'no-uri'}-${contentHash}`;
  const recordId = `record-${globalIndex}`;

  return (
    <div
      data-testid={`result-record-${index}`}
      className={`card bg-base-100 shadow-sm border ${isActive ? 'border-primary ring-2 ring-primary/20' : 'border-base-300'}`}
      ref={(el) => {
        if (el) recordRefs.current[recordId] = el;
        else delete recordRefs.current[recordId];
      }}
      id={recordId}
    >
      <div className="card-header bg-primary text-primary-content px-4 py-2">
        <div className="flex justify-between items-center">
          <span className="font-medium">#{globalIndex + 1}</span>
          <span className="text-sm opacity-90">{record.uri || 'No URI'}</span>
        </div>
      </div>
      <div className="card-body p-4">
        <div className="flex flex-wrap gap-4 text-sm text-base-content/70 mb-4">
          <span><strong>Content Type:</strong> {record.contentType || 'Not available'}</span>
          <span><strong>Datatype:</strong> {record.primitive || 'Not available'}</span>
          {record.path && <span><strong>XPath:</strong> {record.path}</span>}
        </div>
        <div className="border border-base-300 rounded-lg overflow-hidden">
          <MemoMonacoEditor
            content={formattedContent}
            language={getMonacoLanguageFromContentType(record.contentType)}
            readOnly={true}
            height={recordHeight}
            path={stableId}
            theme={monacoTheme}
          />
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.record === nextProps.record &&
    prevProps.index === nextProps.index &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.monacoTheme === nextProps.monacoTheme &&
    prevProps.globalIndex === nextProps.globalIndex
  );
});

describe('ResultRecord Component', () => {
  let mockRecordRefs;
  let mockGetLanguage;

  beforeEach(() => {
    mockRecordRefs = { current: {} };
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
        recordRefs={mockRecordRefs}
        monacoTheme="vs"
        getMonacoLanguageFromContentType={mockGetLanguage}
        MemoMonacoEditor={MockMonacoEditor}
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
        recordRefs={mockRecordRefs}
        monacoTheme="vs"
        getMonacoLanguageFromContentType={mockGetLanguage}
        MemoMonacoEditor={MockMonacoEditor}
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
        recordRefs={mockRecordRefs}
        monacoTheme="vs"
        getMonacoLanguageFromContentType={mockGetLanguage}
        MemoMonacoEditor={MockMonacoEditor}
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
        recordRefs={mockRecordRefs}
        monacoTheme="vs"
        getMonacoLanguageFromContentType={mockGetLanguage}
        MemoMonacoEditor={MockMonacoEditor}
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
        recordRefs={mockRecordRefs}
        monacoTheme="vs"
        getMonacoLanguageFromContentType={mockGetLanguage}
        MemoMonacoEditor={MockMonacoEditor}
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
        recordRefs={mockRecordRefs}
        monacoTheme="vs"
        getMonacoLanguageFromContentType={mockGetLanguage}
        MemoMonacoEditor={MockMonacoEditor}
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
        recordRefs={mockRecordRefs}
        monacoTheme="vs"
        getMonacoLanguageFromContentType={mockGetLanguage}
        MemoMonacoEditor={MockMonacoEditor}
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
        recordRefs={mockRecordRefs}
        monacoTheme="vs"
        getMonacoLanguageFromContentType={mockGetLanguage}
        MemoMonacoEditor={CountingMonacoEditor}
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
        recordRefs={mockRecordRefs}
        monacoTheme="vs"
        getMonacoLanguageFromContentType={newGetLanguage}
        MemoMonacoEditor={CountingMonacoEditor}
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
        recordRefs={mockRecordRefs}
        monacoTheme="vs"
        getMonacoLanguageFromContentType={mockGetLanguage}
        MemoMonacoEditor={CountingMonacoEditor}
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
        recordRefs={mockRecordRefs}
        monacoTheme="vs"
        getMonacoLanguageFromContentType={mockGetLanguage}
        MemoMonacoEditor={CountingMonacoEditor}
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
        recordRefs={mockRecordRefs}
        monacoTheme="vs"
        getMonacoLanguageFromContentType={mockGetLanguage}
        MemoMonacoEditor={MockMonacoEditor}
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
        recordRefs={mockRecordRefs}
        monacoTheme="vs"
        getMonacoLanguageFromContentType={mockGetLanguage}
        MemoMonacoEditor={MockMonacoEditor}
      />
    );

    // formatRecordContent should NOT be called again (memoized)
    expect(formatRecordContent).toHaveBeenCalledTimes(1);
  });

  test('stores ref in recordRefs.current with correct ID', () => {
    const record = {
      uri: '/test/record.xml',
      content: '<test>data</test>',
      contentType: 'application/xml'
    };

    render(
      <ResultRecord
        record={record}
        index={0}
        globalIndex={5}
        pageStart={0}
        isActive={false}
        recordRefs={mockRecordRefs}
        monacoTheme="vs"
        getMonacoLanguageFromContentType={mockGetLanguage}
        MemoMonacoEditor={MockMonacoEditor}
      />
    );

    expect(mockRecordRefs.current['record-5']).toBeDefined();
    expect(mockRecordRefs.current['record-5'].id).toBe('record-5');
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
        recordRefs={mockRecordRefs}
        monacoTheme="vs"
        getMonacoLanguageFromContentType={mockGetLanguage}
        MemoMonacoEditor={MockMonacoEditor}
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
          recordRefs={mockRecordRefs}
          monacoTheme="vs"
          getMonacoLanguageFromContentType={mockGetLanguage}
          MemoMonacoEditor={MockMonacoEditor}
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
          recordRefs={mockRecordRefs}
          monacoTheme="vs"
          getMonacoLanguageFromContentType={mockGetLanguage}
          MemoMonacoEditor={MockMonacoEditor}
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
              recordRefs={mockRecordRefs}
              monacoTheme="vs"
              getMonacoLanguageFromContentType={mockGetLanguage}
              MemoMonacoEditor={MockMonacoEditor}
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
              recordRefs={mockRecordRefs}
              monacoTheme="vs"
              getMonacoLanguageFromContentType={mockGetLanguage}
              MemoMonacoEditor={MockMonacoEditor}
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
              recordRefs={mockRecordRefs}
              monacoTheme="vs"
              getMonacoLanguageFromContentType={mockGetLanguage}
              MemoMonacoEditor={MockMonacoEditor}
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
          recordRefs={mockRecordRefs}
          monacoTheme="vs"
          getMonacoLanguageFromContentType={mockGetLanguage}
          MemoMonacoEditor={CountingMonacoEditor}
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
          recordRefs={mockRecordRefs}
          monacoTheme="vs"
          getMonacoLanguageFromContentType={mockGetLanguage}
          MemoMonacoEditor={CountingMonacoEditor}
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
          recordRefs={mockRecordRefs}
          monacoTheme="vs"
          getMonacoLanguageFromContentType={mockGetLanguage}
          MemoMonacoEditor={CountingMonacoEditor}
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
          recordRefs={mockRecordRefs}
          monacoTheme="vs"
          getMonacoLanguageFromContentType={newGetLanguage}
          MemoMonacoEditor={CountingMonacoEditor}
        />
      );

      // Should NOT re-render (performance optimization)
      expect(renderCount).toBe(initialRenderCount);
    });
  });
});
