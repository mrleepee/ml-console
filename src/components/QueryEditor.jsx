import React, { useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";
import { defineCustomMonacoThemes, getEnhancedTheme } from "../utils/monacoThemes";

export default function QueryEditor({
  value = "",
  onChange,
  onKeyDown,            // expects a textarea-like event
  language = "plaintext",
  disabled = false,
  theme = "vs",
  placeholder = "",
}) {
  const containerRef = useRef(null);
  const editorRef = useRef(null);
  const monacoRef = useRef(null);

  // Bridge monaco change -> textarea-like onChange
  const handleChange = (val) => {
    if (onChange) onChange({ target: { value: val ?? "" } });
  };

  const handleMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Ensure our custom themes exist
    defineCustomMonacoThemes(monaco);

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

  return (
    <div
      ref={containerRef}
      className="h-full w-full min-w-0"
      style={{ position: "relative", overflow: "hidden" }}
    >
      <Editor
        value={value}
        language={language}
        onChange={handleChange}
        onMount={handleMount}
        theme={getEnhancedTheme(theme)}
        width="100%"
        height="100%"               // <-- critical: fill the container we control
        options={{
          readOnly: !!disabled,
          automaticLayout: false,   // we drive layout via ResizeObserver
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: "on",
          renderLineHighlight: "none",
          fontSize: 12,
          lineNumbers: "on",
          folding: true,
          foldingStrategy: "indentation",
          showFoldingControls: "mouseover",
          lineDecorationsWidth: 10,
          lineNumbersMinChars: 3,
          renderWhitespace: "selection",
          selectionHighlight: true,
          occurrencesHighlight: true,
          insertSpaces: true,
          tabSize: 2,
          detectIndentation: true,
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