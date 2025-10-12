import React, { useEffect, useRef, useState, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { defineCustomMonacoThemes, getEnhancedTheme } from '../services/monaco/monacoThemes';
import { monacoOptimizationManager } from '../services/monaco/monacoOptimizations';

/**
 * Memoized Monaco Editor component
 *
 * This component is extracted from App.jsx to prevent recreation on every render.
 * It handles editor mounting, theme setup, and XQuery language registration.
 *
 * @param {Object} props
 * @param {string} props.content - The content to display in the editor
 * @param {string} props.language - The language mode for syntax highlighting
 * @param {boolean} props.readOnly - Whether the editor is read-only
 * @param {string} props.height - CSS height value for the editor
 * @param {string} props.path - File path identifier for editor model management
 * @param {string} props.theme - Monaco theme name
 */
function MonacoEditor({ content, language, readOnly, height, path, theme }) {
  const editorRef = useRef(null);
  const [editorMounted, setEditorMounted] = useState(false);

  const formatContent = useCallback(() => {
    if (!editorRef.current || !content) return;

    try {
      const action = editorRef.current.getAction('editor.action.formatDocument');
      if (action) {
        action.run();
      }
    } catch (error) {
      console.debug('Auto-format failed:', error);
    }
  }, [content]);

  const handleEditorMount = useCallback(async (editor, monaco) => {
    editorRef.current = editor;
    setEditorMounted(true);
    defineCustomMonacoThemes(monaco);
    await monacoOptimizationManager.registerXQueryLanguageOptimized(monaco);
  }, []);

  useEffect(() => {
    if (editorMounted && content) {
      formatContent();
    }
  }, [editorMounted, content, formatContent]);

  return (
    <div style={{ height, width: "100%", border: "1px solid #ddd", borderRadius: "4px" }}>
      <Editor
        height={height}
        language={language}
        value={content}
        path={path}
        keepCurrentModel={true}
        onMount={handleEditorMount}
        options={{
          readOnly,
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
          selectOnLineNumbers: true,
          selectionHighlight: true,
          occurrencesHighlight: true,
          renderWhitespace: 'selection',
          showUnused: true,
          multiCursorModifier: 'alt',
          multiCursorMergeOverlapping: true,
          automaticLayout: true,
          tabSize: 2,
          insertSpaces: true,
          detectIndentation: true,
          formatOnPaste: true,
          formatOnType: false,
          dragAndDrop: true,
          mouseWheelZoom: false,
          contextmenu: true,
          hideCursorInOverviewRuler: false,
          overviewRulerBorder: false,
          find: { autoFindInSelection: 'never', seedSearchStringFromSelection: 'never' }
        }}
        theme={getEnhancedTheme(theme)}
      />
    </div>
  );
}

// Memoize with custom comparison to prevent unnecessary re-renders
export default React.memo(MonacoEditor, (prev, next) =>
  prev.content === next.content &&
  prev.language === next.language &&
  prev.readOnly === next.readOnly &&
  prev.height === next.height &&
  prev.path === next.path &&
  prev.theme === next.theme
);
