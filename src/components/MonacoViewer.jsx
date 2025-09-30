import React, { useEffect, useRef, Suspense, useCallback } from "react";
// Lazy-load Monaco editor to keep initial bundle size small
const Editor = React.lazy(() => import("@monaco-editor/react"));

import { defineCustomMonacoThemes, getEnhancedTheme, loadAndDefineTheme, preloadPopularThemes } from "../utils/monacoThemes";
import { registerXQueryLanguage } from "../utils/monacoXquery";
import { isValidTheme } from "../utils/themeLoader";
import useEditorPreferences from "../hooks/useEditorPreferences";

export default function MonacoViewer({ value = "", language = "plaintext", theme = "vs" }) {
  const containerRef = useRef(null);
  const editorRef = useRef(null);

  // Get editor preferences for consistent styling
  const { getMonacoOptions, preferences } = useEditorPreferences();

  const formatContent = useCallback(async () => {
    if (
      editorRef.current &&
      value &&
      (language === "json" || language === "xml" || language === "html")
    ) {
      try {
        await new Promise((r) => setTimeout(r, 100));
        const action = editorRef.current.getAction("editor.action.formatDocument");
        if (action) await action.run();
      } catch (err) {
        console.debug("Auto-format failed:", err);
      }
    }
  }, [value, language]);

  const handleMount = async (editor, monaco) => {
    editorRef.current = editor;
    defineCustomMonacoThemes(monaco);
    registerXQueryLanguage(monaco);

    // Load custom theme if it's not a built-in theme
    if (isValidTheme(theme)) {
      try {
        await loadAndDefineTheme(monaco, theme);
        // Apply the theme after it's loaded
        const themeId = getEnhancedTheme(theme);
        editor.updateOptions({ theme: themeId });
      } catch (error) {
        console.warn(`Failed to load custom theme ${theme}:`, error);
      }
    }

    // Preload popular themes in the background for better UX
    preloadPopularThemes(monaco).catch(error =>
      console.debug('Failed to preload popular themes:', error)
    );

    // First layout after mount
    requestAnimationFrame(async () => {
      editor.layout();
      await formatContent();
    });
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

  useEffect(() => {
    formatContent();
  }, [formatContent]);

  // Handle theme changes dynamically
  useEffect(() => {
    if (editorRef.current && isValidTheme(theme)) {
      // Get monaco instance from the editor
      const monaco = window.monaco;

      if (monaco) {
        loadAndDefineTheme(monaco, theme).then(() => {
          // Apply the theme after it's loaded and defined
          const themeId = getEnhancedTheme(theme);
          editorRef.current.updateOptions({ theme: themeId });
        }).catch(error =>
          console.warn(`Failed to load theme ${theme} on change:`, error)
        );
      }
    }
  }, [theme]);

  // Update Monaco editor options when preferences change (CRITICAL FIX for font size)
  useEffect(() => {
    if (editorRef.current) {
      const newOptions = getMonacoOptions({
        readOnly: true,
        renderLineHighlight: "none", // Keep this specific to viewer
        minimap: { enabled: false }, // Always disabled for viewer
        dragAndDrop: false, // Disabled for read-only viewer
      });
      editorRef.current.updateOptions(newOptions);
    }
  }, [preferences, getMonacoOptions]);

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
          theme={isValidTheme(theme) ? getEnhancedTheme(theme) : 'vs-dark'}
          width="100%"
          height="100%"
          options={getMonacoOptions({
            readOnly: true,
            renderLineHighlight: "none", // Keep this specific to viewer
            minimap: { enabled: false }, // Always disabled for viewer
            dragAndDrop: false, // Disabled for read-only viewer
          })}
        />
      </Suspense>
    </div>
  );
}
