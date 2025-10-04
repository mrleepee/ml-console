import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const DEFAULT_PREFERENCES = {
  fontSize: 12,
  lineNumbers: 'on',
  wordWrap: 'on',
  minimap: false,
  tabSize: 2,
  indentationGuides: true,
  bracketMatching: true,
  autoCompletion: true,
  formatOnPaste: true,
  renderWhitespace: 'selection',
  editorHeightPercent: 40, // Editor height as percentage (20-80)
  resultsHeightPercent: 60 // Results height as percentage (auto-calculated)
};

const STORAGE_KEY = 'editorPreferences';

const EditorPreferencesContext = createContext(null);

/**
 * Provider component that manages editor preferences state
 * Provides shared state across all components that need editor preferences
 */
export function EditorPreferencesProvider({ children }) {
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);

        // Validate and clamp editorHeightPercent to ensure consistency
        if (typeof parsed.editorHeightPercent === 'number') {
          parsed.editorHeightPercent = Math.max(20, Math.min(80, parsed.editorHeightPercent));
          parsed.resultsHeightPercent = 100 - parsed.editorHeightPercent;
        }

        // Merge with defaults to handle missing properties in stored preferences
        setPreferences(prev => ({ ...prev, ...parsed }));
      }
    } catch (error) {
      console.warn('Failed to load editor preferences:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save preferences to localStorage whenever they change
  useEffect(() => {
    if (!isLoading) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
      } catch (error) {
        console.warn('Failed to save editor preferences:', error);
      }
    }
  }, [preferences, isLoading]);

  // Update a specific preference
  const updatePreference = useCallback((key, value) => {
    setPreferences(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);

  // Update multiple preferences at once
  const updatePreferences = useCallback((updates) => {
    setPreferences(prev => ({
      ...prev,
      ...updates
    }));
  }, []);

  // Reset to defaults
  const resetPreferences = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES);
  }, []);

  // Get Monaco editor options from preferences
  const getMonacoOptions = useCallback((overrides = {}) => {
    return {
      fontSize: preferences.fontSize,
      lineNumbers: preferences.lineNumbers,
      wordWrap: preferences.wordWrap,
      minimap: { enabled: preferences.minimap },
      tabSize: preferences.tabSize,
      insertSpaces: true,
      detectIndentation: true,
      renderIndentGuides: preferences.indentationGuides,
      matchBrackets: preferences.bracketMatching ? 'always' : 'never',
      quickSuggestions: preferences.autoCompletion,
      formatOnPaste: preferences.formatOnPaste,
      renderWhitespace: preferences.renderWhitespace,
      automaticLayout: false,
      scrollBeyondLastLine: false,
      folding: true,
      foldingStrategy: 'indentation',
      showFoldingControls: 'mouseover',
      lineDecorationsWidth: 10,
      lineNumbersMinChars: 3,
      selectionHighlight: true,
      occurrencesHighlight: true,
      formatOnType: false,
      contextmenu: true,
      dragAndDrop: true,
      // Apply any overrides
      ...overrides
    };
  }, [preferences]);

  // Font size helpers with 2px increments for better UX
  const increaseFontSize = useCallback(() => {
    const maxSize = 32; // Maximum font size
    if (preferences.fontSize < maxSize) {
      updatePreference('fontSize', preferences.fontSize + 2);
    }
  }, [preferences.fontSize, updatePreference]);

  const decreaseFontSize = useCallback(() => {
    const minSize = 10; // Minimum font size
    if (preferences.fontSize > minSize) {
      updatePreference('fontSize', preferences.fontSize - 2);
    }
  }, [preferences.fontSize, updatePreference]);

  // Toggle helpers for common boolean preferences
  const toggleLineNumbers = useCallback(() => {
    updatePreference('lineNumbers', preferences.lineNumbers === 'on' ? 'off' : 'on');
  }, [preferences.lineNumbers, updatePreference]);

  const toggleWordWrap = useCallback(() => {
    updatePreference('wordWrap', preferences.wordWrap === 'on' ? 'off' : 'on');
  }, [preferences.wordWrap, updatePreference]);

  const toggleMinimap = useCallback(() => {
    updatePreference('minimap', !preferences.minimap);
  }, [preferences.minimap, updatePreference]);

  // Layout helper to update editor height and auto-calculate results height
  const setEditorHeight = useCallback((heightPercent) => {
    const clampedHeight = Math.max(20, Math.min(80, heightPercent));
    updatePreferences({
      editorHeightPercent: clampedHeight,
      resultsHeightPercent: 100 - clampedHeight
    });
  }, [updatePreferences]);

  const value = {
    preferences,
    isLoading,
    updatePreference,
    updatePreferences,
    resetPreferences,
    getMonacoOptions,
    // Convenience methods
    increaseFontSize,
    decreaseFontSize,
    toggleLineNumbers,
    toggleWordWrap,
    toggleMinimap,
    setEditorHeight,
    // Available options for UI components
    fontSizes: [10, 12, 14, 16, 18, 20, 24],
    lineNumberOptions: [
      { value: 'on', label: 'On' },
      { value: 'off', label: 'Off' },
      { value: 'relative', label: 'Relative' }
    ],
    wordWrapOptions: [
      { value: 'on', label: 'On' },
      { value: 'off', label: 'Off' },
      { value: 'bounded', label: 'Bounded' }
    ],
    tabSizeOptions: [2, 4, 8],
    whitespaceOptions: [
      { value: 'none', label: 'None' },
      { value: 'selection', label: 'Selection' },
      { value: 'all', label: 'All' }
    ]
  };

  return (
    <EditorPreferencesContext.Provider value={value}>
      {children}
    </EditorPreferencesContext.Provider>
  );
}

/**
 * Hook to consume editor preferences from context
 * Must be used within EditorPreferencesProvider
 */
export function useEditorPreferences() {
  const context = useContext(EditorPreferencesContext);
  if (!context) {
    throw new Error('useEditorPreferences must be used within EditorPreferencesProvider');
  }
  return context;
}