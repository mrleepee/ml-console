import { useState, useCallback, useEffect } from 'react';

/**
 * Custom hook for managing application theme state
 *
 * Manages:
 * - Application theme (light/dark)
 * - Monaco editor theme synchronization
 * - DOM theme attribute updates
 * - Theme persistence (if localStorage is available)
 *
 * @param {Object} options Configuration options
 * @param {string} options.initialTheme Initial application theme
 * @param {string} options.initialMonacoTheme Initial Monaco editor theme
 * @param {boolean} options.persistTheme Whether to persist theme in localStorage
 * @returns {Object} Theme state and controls
 */
export default function useTheme({
  initialTheme = 'light',
  initialMonacoTheme = 'vs',
  persistTheme = true
} = {}) {

  // Load theme from localStorage if available and persistence is enabled
  const getStoredTheme = useCallback(() => {
    if (!persistTheme || typeof window === 'undefined' || !window.localStorage) {
      return initialTheme;
    }
    try {
      return window.localStorage.getItem('ml-console-theme') || initialTheme;
    } catch (error) {
      console.warn('Failed to load theme from localStorage:', error);
      return initialTheme;
    }
  }, [initialTheme, persistTheme]);

  const getStoredMonacoTheme = useCallback(() => {
    if (!persistTheme || typeof window === 'undefined' || !window.localStorage) {
      return initialMonacoTheme;
    }
    try {
      return window.localStorage.getItem('ml-console-monaco-theme') || initialMonacoTheme;
    } catch (error) {
      console.warn('Failed to load Monaco theme from localStorage:', error);
      return initialMonacoTheme;
    }
  }, [initialMonacoTheme, persistTheme]);

  // Theme state
  const [theme, setTheme] = useState(getStoredTheme);
  const [monacoTheme, setMonacoTheme] = useState(getStoredMonacoTheme);

  // Ensure themes are loaded from localStorage after mount
  useEffect(() => {
    const storedTheme = getStoredTheme();
    const storedMonacoTheme = getStoredMonacoTheme();

    // Use functional updates to avoid dependency issues
    setTheme(currentTheme => storedTheme !== currentTheme ? storedTheme : currentTheme);
    setMonacoTheme(currentMonacoTheme => storedMonacoTheme !== currentMonacoTheme ? storedMonacoTheme : currentMonacoTheme);
  }, [getStoredTheme, getStoredMonacoTheme]); // Run when localStorage functions change

  // Save theme to localStorage
  const saveTheme = useCallback((newTheme) => {
    if (!persistTheme || typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    try {
      window.localStorage.setItem('ml-console-theme', newTheme);
    } catch (error) {
      console.warn('Failed to save theme to localStorage:', error);
    }
  }, [persistTheme]);

  const saveMonacoTheme = useCallback((newMonacoTheme) => {
    if (!persistTheme || typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    try {
      window.localStorage.setItem('ml-console-monaco-theme', newMonacoTheme);
    } catch (error) {
      console.warn('Failed to save Monaco theme to localStorage:', error);
    }
  }, [persistTheme]);

  // Update application theme
  const updateTheme = useCallback((newTheme) => {
    setTheme(newTheme);
    saveTheme(newTheme);
  }, [saveTheme]);

  // Update Monaco theme
  const updateMonacoTheme = useCallback((newMonacoTheme) => {
    setMonacoTheme(newMonacoTheme);
    saveMonacoTheme(newMonacoTheme);
  }, [saveMonacoTheme]);

  // Toggle between light and dark themes
  const toggleTheme = useCallback(() => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    updateTheme(newTheme);
  }, [theme, updateTheme]);

  // Get theme toggle button properties
  const getToggleButtonProps = useCallback(() => {
    return {
      onClick: toggleTheme,
      title: `Switch to ${theme === 'light' ? 'dark' : 'light'} mode`,
      'aria-label': `Switch to ${theme === 'light' ? 'dark' : 'light'} mode`,
      children: theme === 'light' ? '🌙' : '☀️'
    };
  }, [theme, toggleTheme]);

  // Auto-sync Monaco theme with app theme (for basic themes)
  const syncMonacoTheme = useCallback(() => {
    // Only auto-sync if using basic themes
    if (monacoTheme === 'vs' && theme === 'dark') {
      setMonacoTheme('vs-dark');
      saveMonacoTheme('vs-dark');
    } else if (monacoTheme === 'vs-dark' && theme === 'light') {
      setMonacoTheme('vs');
      saveMonacoTheme('vs');
    }
  }, [theme, monacoTheme, saveMonacoTheme]);

  // Check if current theme is dark
  const isDark = theme === 'dark';

  // Check if current theme is light
  const isLight = theme === 'light';

  // Get theme-specific CSS classes
  const getThemeClasses = useCallback((baseClasses = '') => {
    return `${baseClasses} ${isDark ? 'dark' : 'light'}`.trim();
  }, [isDark]);

  // Update DOM data-theme attribute
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [theme]);

  // Note: Auto-sync removed to preserve user's Monaco theme preference
  // Users can manually sync themes if desired via syncMonacoTheme()

  // Available theme options
  const themeOptions = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' }
  ];

  // Available Monaco theme options
  const monacoThemeOptions = [
    { value: 'vs', label: 'Light (Visual Studio)' },
    { value: 'vs-dark', label: 'Dark (Visual Studio Dark)' },
    { value: 'hc-black', label: 'High Contrast Black' },
    { value: 'hc-light', label: 'High Contrast Light' }
  ];

  return {
    // Theme state
    theme,
    monacoTheme,
    isDark,
    isLight,

    // Theme actions
    setTheme: updateTheme,
    setMonacoTheme: updateMonacoTheme,
    toggleTheme,
    syncMonacoTheme,

    // Utility functions
    getThemeClasses,
    getToggleButtonProps,

    // Theme options
    themeOptions,
    monacoThemeOptions,

    // Configuration info
    persistTheme,
    hasLocalStorage: typeof window !== 'undefined' && !!window.localStorage,
  };
}