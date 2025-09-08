import React, { useEffect, useRef, Suspense } from "react";
// Lazy-load Monaco editor to keep initial bundle size small
const Editor = React.lazy(() => import("@monaco-editor/react"));

import { defineCustomMonacoThemes, getEnhancedTheme } from "../utils/monacoThemes";

export default function MonacoViewer({ value = "", language = "plaintext", theme = "vs" }) {
  const containerRef = useRef(null);
  const editorRef = useRef(null);

  const handleMount = (editor, monaco) => {
    editorRef.current = editor;
    defineCustomMonacoThemes(monaco);
    // First layout after mount
    requestAnimationFrame(() => editor.layout());
  };

  // Keep editor sized to container via ResizeObserver when available
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (editorRef.current) editorRef.current.layout();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Also relayout on window resize
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
      <Suspense fallback={<pre className="p-2 overflow-auto">{value}</pre>}>
        <Editor
          value={value}
          language={language}
          onMount={handleMount}
          theme={getEnhancedTheme(theme)}
          width="100%"
          height="100%"
          options={{
            readOnly: true,
            automaticLayout: false,
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
      </Suspense>
    </div>
  );
}
