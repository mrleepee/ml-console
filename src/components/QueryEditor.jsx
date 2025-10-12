import React, { useEffect, useRef, useMemo } from "react";
import Editor, { loader } from "@monaco-editor/react";
import { defineCustomMonacoThemes, getEnhancedTheme, loadAndDefineTheme } from "../services/monaco/monacoThemes";
import { isValidTheme } from "../utils/themeLoader";
import { monacoOptimizationManager, useMonacoOptimizations } from "../services/monaco/monacoOptimizations";
import useEditorPreferences from "../hooks/useEditorPreferences";

export default function QueryEditor({
  value = "",
  onChange,
  onKeyDown,            // expects a textarea-like event
  language = "plaintext",
  disabled = false,
  theme = "vs",
  placeholder = "",
  showControls = false, // new prop to show/hide editor controls
}) {
  const containerRef = useRef(null);
  const editorRef = useRef(null);
  const monacoRef = useRef(null);

  // Get editor preferences (includes user-configurable font size, etc.)
  const { getMonacoOptions, preferences } = useEditorPreferences();

  // Compute Monaco theme ID once to use consistently everywhere
  const themeId = useMemo(() => getEnhancedTheme(theme), [theme]);

  // Performance-optimized editor options based on content size
  const optimizedOptions = useMonacoOptimizations(value, {
    language,
    automaticLayout: true,
    wordWrap: "on",
    lineNumbers: "on",
    minimap: { enabled: false }, // Disabled - will be a future editor control feature
    folding: true,
    scrollBeyondLastLine: false,
    renderLineHighlight: "line",
    fontFamily: '"Fira Code", "Cascadia Code", "JetBrains Mono", monospace',
    fontSize: 14,
    tabSize: 2,
    insertSpaces: true,
    detectIndentation: false,
    accessibilitySupport: "auto",
    suggestOnTriggerCharacters: true,
    acceptSuggestionOnEnter: "on",
    wordBasedSuggestions: false  // Disable word-based suggestions for cleaner XQuery variable completion
  });

  // Initialize Monaco themes and language with optimizations
  useEffect(() => {
    loader.init().then(async monaco => {
      monacoRef.current = monaco;

      // Define themes
      defineCustomMonacoThemes(monaco);

      // Register XQuery language with optimization caching
      await monacoOptimizationManager.registerXQueryLanguageOptimized(monaco);

      // Enable performance monitoring in development
      if (process.env.NODE_ENV === 'development' && editorRef.current) {
        await monacoOptimizationManager.enablePerformanceMonitoring(monaco, editorRef.current);
      }
    });
  }, []);

  // Optimized change handler with debouncing for large files
  const optimizedHandleChange = useMemo(() => {
    const baseHandler = (val) => {
      if (onChange) onChange({ target: { value: val ?? "" } });
    };

    return monacoOptimizationManager.createOptimizedChangeHandler(
      baseHandler,
      value ? value.length : 0
    );
  }, [onChange, value?.length]);

  const handleMount = async (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Ensure our custom themes exist
    defineCustomMonacoThemes(monaco);

    // Register XQuery language with optimization caching
    await monacoOptimizationManager.registerXQueryLanguageOptimized(monaco);

    // Apply optimized theme switching for both built-in and custom themes
    try {
      // Only load JSON for custom themes; built-ins are already defined
      if (isValidTheme(theme)) {
        await loadAndDefineTheme(monaco, theme);
      }
      // Always apply the theme ID so both built-in and custom survive wrapper resets
      await monacoOptimizationManager.switchThemeOptimized(monaco, themeId, editor);
    } catch (error) {
      console.warn(`Failed to apply theme ${theme}:`, error);
    }

    // Apply runtime optimizations based on content size
    monacoOptimizationManager.applyRuntimeOptimizations(editor, value);

    // Enable performance monitoring in development
    if (process.env.NODE_ENV === 'development') {
      await monacoOptimizationManager.enablePerformanceMonitoring(monaco, editor);
    }

    // Forward keydown to consumer in a textarea-like shape
    editor.onKeyDown((e) => {
      if (!onKeyDown) return;

      const model = editor.getModel();
      if (!model) return;

      const sel = editor.getSelection();
      const start = model.getOffsetAt(sel.getStartPosition());
      const end = model.getOffsetAt(sel.getEndPosition());

      const syntheticEvent = {
        key: e.browserEvent.key,
        ctrlKey: e.browserEvent.ctrlKey || e.browserEvent.metaKey, // support Cmd on macOS
        preventDefault: () => e.preventDefault(),
        target: {
          value: model.getValue(),
          selectionStart: start,
          selectionEnd: end,
          focus: () => editor.focus(),
          setSelectionRange: (s, en) => {
            const sPos = model.getPositionAt(s);
            const ePos = model.getPositionAt(en);
            editor.setSelection({
              selectionStartLineNumber: sPos.lineNumber,
              selectionStartColumn: sPos.column,
              positionLineNumber: ePos.lineNumber,
              positionColumn: ePos.column,
            });
          },
        },
      };

      onKeyDown(syntheticEvent);
    });

    // Optional placeholder (shows as a decoration when empty)
    if (placeholder && !value) {
      try {
        const domNode = editor.getDomNode();
        if (domNode) {
          domNode.setAttribute("data-placeholder", placeholder);
        }
      } catch {
        /* noop */
      }
    }

    // First layout pass
    requestAnimationFrame(() => editor.layout());
  };

  // Keep Monaco sized to container via ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (editorRef.current) editorRef.current.layout();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Also relayout on window resizes (e.g., sidebar toggle emits resize)
  useEffect(() => {
    const fn = () => editorRef.current && editorRef.current.layout();
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  // Handle theme changes dynamically with optimization
  useEffect(() => {
    if (editorRef.current && monacoRef.current) {
      const applyTheme = async () => {
        try {
          // Only load JSON for custom themes
          if (isValidTheme(theme)) {
            await loadAndDefineTheme(monacoRef.current, theme);
          }
          // Always apply the theme ID for both built-in and custom
          await monacoOptimizationManager.switchThemeOptimized(
            monacoRef.current,
            themeId,
            editorRef.current
          );
        } catch (error) {
          console.warn(`Failed to apply theme ${theme} on change:`, error);
        }
      };
      applyTheme();
    }
  }, [theme, themeId]);

  // Update Monaco editor options when preferences change (CRITICAL FIX for font size)
  useEffect(() => {
    if (editorRef.current) {
      const newOptions = getMonacoOptions({
        readOnly: !!disabled,
        renderLineHighlight: "line",
      });
      editorRef.current.updateOptions(newOptions);
    }
  }, [preferences, disabled, getMonacoOptions]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full min-w-0"
      style={{ position: "relative", overflow: "hidden" }}
    >
      <Editor
        value={value}
        language={language}
        onChange={optimizedHandleChange}
        onMount={handleMount}
        theme={themeId}  // Use computed theme ID consistently
        width="100%"
        height="100%"               // <-- critical: fill the container we control
        options={{
          ...optimizedOptions,
          ...getMonacoOptions({
            readOnly: !!disabled,
            renderLineHighlight: "line",
          }),
          automaticLayout: false,   // we drive layout via ResizeObserver
          foldingStrategy: "indentation",
          showFoldingControls: "mouseover",
          lineDecorationsWidth: 10,
          lineNumbersMinChars: 3,
          renderWhitespace: "selection",
          formatOnPaste: true,
          formatOnType: false,
          contextmenu: true,
          dragAndDrop: true,
        }}
      />
      {/* optional placeholder styling */}
      <style>{`
        .monaco-editor[data-placeholder]:empty::before,
        .monaco-editor[data-placeholder] .inputarea:empty::before {
          content: attr(data-placeholder);
          position: absolute;
          left: 12px;
          top: 10px;
          opacity: 0.5;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
