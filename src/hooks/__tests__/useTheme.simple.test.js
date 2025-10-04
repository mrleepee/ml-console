import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setMockElectronAPI, clearMockElectronAPI } from '../../test/helpers/mockElectronAPI';
import { renderHook, act } from '@testing-library/react';
import useTheme from '../useTheme';

describe('useTheme - Core Functionality', () => {
  // Capture originals for restoration
  let originalWindow;
  let originalDocument;
  let originalLocalStorage;

  // Mock localStorage
  const mockLocalStorage = {
    store: {},
    getItem: vi.fn((key) => mockLocalStorage.store[key] || null),
    setItem: vi.fn((key, value) => {
      mockLocalStorage.store[key] = value;
    }),
    removeItem: vi.fn((key) => {
      delete mockLocalStorage.store[key];
    }),
    clear: vi.fn(() => {
      mockLocalStorage.store = {};
    })
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.clear();

    // Capture originals
    originalWindow = global.window;
    originalDocument = global.document;
    originalLocalStorage = global.window?.localStorage;

    // Replace localStorage with mock object
    // This is safe because we restore in afterEach
    if (global.window) {
      Object.defineProperty(global.window, 'localStorage', {
        value: mockLocalStorage,
        writable: true,
        configurable: true
      });
    }

    // Mock document.documentElement.setAttribute
    if (global.document?.documentElement) {
      vi.spyOn(global.document.documentElement, 'setAttribute');
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();

    // Restore originals to prevent leakage
    if (originalWindow !== undefined) {
      global.window = originalWindow;
    }
    if (originalDocument !== undefined) {
      global.document = originalDocument;
    }
    if (originalLocalStorage !== undefined && global.window) {
      Object.defineProperty(global.window, 'localStorage', {
        value: originalLocalStorage,
        writable: true,
        configurable: true
      });
    }
  });

  describe('initialization', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useTheme());

      expect(result.current.theme).toBe('light');
      expect(result.current.monacoTheme).toBe('vs');
      expect(result.current.isDark).toBe(false);
      expect(result.current.isLight).toBe(true);
      expect(result.current.persistTheme).toBe(true);
      expect(result.current.hasLocalStorage).toBe(true);
    });

    it('should initialize with custom values', () => {
      const options = {
        initialTheme: 'dark',
        initialMonacoTheme: 'vs-dark',
        persistTheme: false
      };

      const { result } = renderHook(() => useTheme(options));

      expect(result.current.theme).toBe('dark');
      expect(result.current.monacoTheme).toBe('vs-dark');
      expect(result.current.isDark).toBe(true);
      expect(result.current.isLight).toBe(false);
      expect(result.current.persistTheme).toBe(false);
    });

    it('should load theme from localStorage if available', () => {
      mockLocalStorage.store['ml-console-theme'] = 'dark';
      mockLocalStorage.store['ml-console-monaco-theme'] = 'vs-dark';

      const { result } = renderHook(() => useTheme());

      expect(result.current.theme).toBe('dark');
      expect(result.current.monacoTheme).toBe('vs-dark');
    });

    it('should set DOM data-theme attribute on initialization', () => {
      renderHook(() => useTheme());

      expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'light');
    });

    it('should provide theme options', () => {
      const { result } = renderHook(() => useTheme());

      expect(result.current.themeOptions).toEqual([
        { value: 'light', label: 'Light' },
        { value: 'dark', label: 'Dark' }
      ]);

      expect(result.current.monacoThemeOptions).toHaveLength(4);
      expect(result.current.monacoThemeOptions[0]).toEqual({ value: 'vs', label: 'Light (Visual Studio)' });
    });
  });

  describe('theme management', () => {
    it('should update application theme', () => {
      const { result } = renderHook(() => useTheme());

      act(() => {
        result.current.setTheme('dark');
      });

      expect(result.current.theme).toBe('dark');
      expect(result.current.isDark).toBe(true);
      expect(result.current.isLight).toBe(false);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('ml-console-theme', 'dark');
      expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'dark');
    });

    it('should update Monaco theme', () => {
      const { result } = renderHook(() => useTheme());

      act(() => {
        result.current.setMonacoTheme('vs-dark');
      });

      expect(result.current.monacoTheme).toBe('vs-dark');
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('ml-console-monaco-theme', 'vs-dark');
    });

    it('should toggle theme between light and dark', () => {
      const { result } = renderHook(() => useTheme());

      // Initially light
      expect(result.current.theme).toBe('light');

      // Toggle to dark
      act(() => {
        result.current.toggleTheme();
      });

      expect(result.current.theme).toBe('dark');
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('ml-console-theme', 'dark');

      // Toggle back to light
      act(() => {
        result.current.toggleTheme();
      });

      expect(result.current.theme).toBe('light');
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('ml-console-theme', 'light');
    });

    it('should not persist theme when persistTheme is false', () => {
      const { result } = renderHook(() => useTheme({ persistTheme: false }));

      act(() => {
        result.current.setTheme('dark');
      });

      expect(result.current.theme).toBe('dark');
      expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
    });
  });

  describe('Monaco theme synchronization', () => {
    it('should NOT auto-sync Monaco theme on initialization (preserves user preference)', () => {
      const { result } = renderHook(() => useTheme({
        initialTheme: 'dark',
        initialMonacoTheme: 'vs'
      }));

      // Auto-sync was removed to preserve user's Monaco theme preference
      // User must manually call syncMonacoTheme() if they want synchronization
      expect(result.current.monacoTheme).toBe('vs');
      expect(mockLocalStorage.setItem).not.toHaveBeenCalledWith('ml-console-monaco-theme', 'vs-dark');
    });

    it('should manually sync Monaco theme', () => {
      const { result } = renderHook(() => useTheme({
        initialTheme: 'dark',
        initialMonacoTheme: 'vs'
      }));

      act(() => {
        result.current.syncMonacoTheme();
      });

      expect(result.current.monacoTheme).toBe('vs-dark');
    });
  });

  describe('utility functions', () => {
    it('should provide toggle button properties', () => {
      const { result } = renderHook(() => useTheme());

      const buttonProps = result.current.getToggleButtonProps();

      expect(buttonProps.title).toBe('Switch to dark mode');
      expect(buttonProps['aria-label']).toBe('Switch to dark mode');
      expect(buttonProps.children).toBe('🌙');
      expect(typeof buttonProps.onClick).toBe('function');

      // Test with dark theme
      act(() => {
        result.current.setTheme('dark');
      });

      const darkButtonProps = result.current.getToggleButtonProps();
      expect(darkButtonProps.title).toBe('Switch to light mode');
      expect(darkButtonProps.children).toBe('☀️');
    });

    it('should provide theme classes', () => {
      const { result } = renderHook(() => useTheme());

      expect(result.current.getThemeClasses()).toBe('light');
      expect(result.current.getThemeClasses('btn card')).toBe('btn card light');

      act(() => {
        result.current.setTheme('dark');
      });

      expect(result.current.getThemeClasses()).toBe('dark');
      expect(result.current.getThemeClasses('btn card')).toBe('btn card dark');
    });
  });

  describe('localStorage error handling', () => {
    it('should handle localStorage errors gracefully', () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('localStorage disabled');
      });

      const { result } = renderHook(() => useTheme());

      act(() => {
        result.current.setTheme('dark');
      });

      // Should still update state even if localStorage fails
      expect(result.current.theme).toBe('dark');
    });

    it('should handle missing localStorage gracefully', () => {
      // Temporarily remove localStorage property
      const tempStorage = global.window.localStorage;
      delete global.window.localStorage;

      const { result } = renderHook(() => useTheme());

      expect(result.current.hasLocalStorage).toBe(false);
      expect(result.current.theme).toBe('light'); // Should use default

      act(() => {
        result.current.setTheme('dark');
      });

      expect(result.current.theme).toBe('dark'); // Should still work

      // Restore
      global.window.localStorage = tempStorage;
    });

    it.skip('should handle missing window gracefully', () => {
      // NOTE: Cannot test - React Testing Library requires window to render
      // The hook has typeof window === 'undefined' guards in place (lines 26, 38)
      // This test documents the expected behavior but cannot execute in jsdom
    });
  });

  describe('DOM updates', () => {
    it('should update DOM data-theme attribute when theme changes', () => {
      const { result } = renderHook(() => useTheme());

      act(() => {
        result.current.setTheme('dark');
      });

      expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'dark');

      act(() => {
        result.current.setTheme('light');
      });

      expect(document.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'light');
    });

    it.skip('should handle missing document gracefully', () => {
      // NOTE: Cannot test - React Testing Library requires document to render
      // The hook has typeof document === 'undefined' guards in place (lines 95, 115)
      // This test documents the expected behavior but cannot execute in jsdom
    });
  });
});