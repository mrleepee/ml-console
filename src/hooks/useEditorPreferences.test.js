import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, test, expect, beforeEach, vi } from 'vitest';
import useEditorPreferences, { EditorPreferencesProvider } from './useEditorPreferences';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};

global.localStorage = localStorageMock;

// Wrapper component for tests
const wrapper = ({ children }) => {
  return React.createElement(EditorPreferencesProvider, null, children);
};

describe('useEditorPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  test('initializes with default preferences', () => {
    const { result } = renderHook(() => useEditorPreferences(), { wrapper });

    expect(result.current.preferences).toEqual({
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
    });
    expect(result.current.isLoading).toBe(false);
  });

  test('loads preferences from localStorage', () => {
    const storedPreferences = {
      fontSize: 16,
      lineNumbers: 'off',
      wordWrap: 'off',
      minimap: true,
      tabSize: 4
    };
    localStorageMock.getItem.mockReturnValue(JSON.stringify(storedPreferences));

    const { result } = renderHook(() => useEditorPreferences(), { wrapper });

    expect(result.current.preferences).toMatchObject(storedPreferences);
    expect(localStorageMock.getItem).toHaveBeenCalledWith('editorPreferences');
  });

  test('handles corrupted localStorage data gracefully', () => {
    localStorageMock.getItem.mockReturnValue('invalid json');
    console.warn = vi.fn(); // Mock console.warn

    const { result } = renderHook(() => useEditorPreferences(), { wrapper });

    expect(result.current.preferences.fontSize).toBe(12); // Should use defaults
    expect(console.warn).toHaveBeenCalledWith('Failed to load editor preferences:', expect.any(Error));
  });

  test('saves preferences to localStorage when updated', () => {
    const { result } = renderHook(() => useEditorPreferences(), { wrapper });

    act(() => {
      result.current.updatePreference('fontSize', 16);
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'editorPreferences',
      expect.stringContaining('"fontSize":16')
    );
  });

  test('updatePreference updates single preference', () => {
    const { result } = renderHook(() => useEditorPreferences(), { wrapper });

    act(() => {
      result.current.updatePreference('fontSize', 16);
    });

    expect(result.current.preferences.fontSize).toBe(16);
    expect(result.current.preferences.lineNumbers).toBe('on'); // Other preferences unchanged
  });

  test('updatePreferences updates multiple preferences', () => {
    const { result } = renderHook(() => useEditorPreferences(), { wrapper });

    act(() => {
      result.current.updatePreferences({
        fontSize: 18,
        lineNumbers: 'off',
        wordWrap: 'off'
      });
    });

    expect(result.current.preferences.fontSize).toBe(18);
    expect(result.current.preferences.lineNumbers).toBe('off');
    expect(result.current.preferences.wordWrap).toBe('off');
    expect(result.current.preferences.minimap).toBe(false); // Other preferences unchanged
  });

  test('resetPreferences restores defaults', () => {
    const { result } = renderHook(() => useEditorPreferences(), { wrapper });

    // First change some preferences
    act(() => {
      result.current.updatePreferences({
        fontSize: 20,
        lineNumbers: 'off',
        minimap: true
      });
    });

    // Then reset
    act(() => {
      result.current.resetPreferences();
    });

    expect(result.current.preferences).toEqual({
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
    });
  });

  test('getMonacoOptions returns correct Monaco editor options', () => {
    const { result } = renderHook(() => useEditorPreferences(), { wrapper });

    const options = result.current.getMonacoOptions();

    expect(options).toMatchObject({
      fontSize: 12,
      lineNumbers: 'on',
      wordWrap: 'on',
      minimap: { enabled: false },
      tabSize: 2,
      insertSpaces: true,
      detectIndentation: true,
      renderIndentGuides: true,
      matchBrackets: 'always',
      quickSuggestions: true,
      formatOnPaste: true,
      renderWhitespace: 'selection',
      automaticLayout: false,
      scrollBeyondLastLine: false,
      folding: true,
      contextmenu: true,
      dragAndDrop: true
    });
  });

  test('getMonacoOptions applies overrides', () => {
    const { result } = renderHook(() => useEditorPreferences(), { wrapper });

    const options = result.current.getMonacoOptions({
      readOnly: true,
      fontSize: 14,
      customOption: 'test'
    });

    expect(options.readOnly).toBe(true);
    expect(options.fontSize).toBe(14); // Override should win
    expect(options.customOption).toBe('test');
    expect(options.lineNumbers).toBe('on'); // Non-overridden preferences preserved
  });

  test('font size helpers work correctly', () => {
    const { result } = renderHook(() => useEditorPreferences(), { wrapper });

    // Test increase
    act(() => {
      result.current.increaseFontSize();
    });
    expect(result.current.preferences.fontSize).toBe(14);

    // Test decrease
    act(() => {
      result.current.decreaseFontSize();
    });
    expect(result.current.preferences.fontSize).toBe(12);

    // Test bounds - decrease at minimum
    expect(result.current.preferences.fontSize).toBe(12);
    act(() => {
      result.current.decreaseFontSize();
    });
    expect(result.current.preferences.fontSize).toBe(10); // Should go to 10

    act(() => {
      result.current.decreaseFontSize();
    });
    expect(result.current.preferences.fontSize).toBe(10); // Should stay at 10 (minimum)
  });

  test('toggle helpers work correctly', () => {
    const { result } = renderHook(() => useEditorPreferences(), { wrapper });

    // Test line numbers toggle
    expect(result.current.preferences.lineNumbers).toBe('on');
    act(() => {
      result.current.toggleLineNumbers();
    });
    expect(result.current.preferences.lineNumbers).toBe('off');
    act(() => {
      result.current.toggleLineNumbers();
    });
    expect(result.current.preferences.lineNumbers).toBe('on');

    // Test word wrap toggle
    expect(result.current.preferences.wordWrap).toBe('on');
    act(() => {
      result.current.toggleWordWrap();
    });
    expect(result.current.preferences.wordWrap).toBe('off');

    // Test minimap toggle
    expect(result.current.preferences.minimap).toBe(false);
    act(() => {
      result.current.toggleMinimap();
    });
    expect(result.current.preferences.minimap).toBe(true);
  });

  test('provides correct option arrays for UI components', () => {
    const { result } = renderHook(() => useEditorPreferences(), { wrapper });

    expect(result.current.fontSizes).toEqual([10, 12, 14, 16, 18, 20, 24]);
    expect(result.current.lineNumberOptions).toEqual([
      { value: 'on', label: 'On' },
      { value: 'off', label: 'Off' },
      { value: 'relative', label: 'Relative' }
    ]);
    expect(result.current.wordWrapOptions).toEqual([
      { value: 'on', label: 'On' },
      { value: 'off', label: 'Off' },
      { value: 'bounded', label: 'Bounded' }
    ]);
    expect(result.current.tabSizeOptions).toEqual([2, 4, 8]);
    expect(result.current.whitespaceOptions).toEqual([
      { value: 'none', label: 'None' },
      { value: 'selection', label: 'Selection' },
      { value: 'all', label: 'All' }
    ]);
  });

  test('handles localStorage save errors gracefully', () => {
    localStorageMock.setItem.mockImplementation(() => {
      throw new Error('Storage full');
    });
    console.warn = vi.fn();

    const { result } = renderHook(() => useEditorPreferences(), { wrapper });

    act(() => {
      result.current.updatePreference('fontSize', 16);
    });

    expect(console.warn).toHaveBeenCalledWith('Failed to save editor preferences:', expect.any(Error));
  });
});