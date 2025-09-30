import { useState, useEffect, useCallback } from 'react';

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
  renderWhitespace: 'selection'
};

const STORAGE_KEY = 'editorPreferences';

/**
 * Hook for managing Monaco editor preferences
 * Provides state management and localStorage persistence for editor settings
 */
export default function useEditorPreferences() {
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
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
      // Common options that should always be set
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

  return {
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
}