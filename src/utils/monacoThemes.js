// Monaco Editor theme definitions and utilities
// Centralized theme management to avoid duplication

import { loadThemeFromFile, isValidTheme, getMonacoThemeId, getRecommendedThemes } from './themeLoader.js';

// Cache for loaded themes to avoid repeated loading
const themeCache = new Map();

// Helper function to get enhanced theme name
export const getEnhancedTheme = (themeName) => {
  // Normalize theme name by trimming whitespace
  const normalizedTheme = (themeName || '').trim();

  // Check if it's a custom theme
  if (isValidTheme(normalizedTheme)) {
    return getMonacoThemeId(normalizedTheme);
  }

  // Handle built-in themes
  switch (normalizedTheme) {
    case 'vs':
      return 'vs-enhanced';
    case 'vs-dark':
      return 'vs-dark-enhanced';
    case 'hc-black':
      return 'hc-black-enhanced';
    case 'hc-light':
      return 'hc-light-enhanced';
    default:
      console.warn(`getEnhancedTheme: Unknown theme '${normalizedTheme}', defaulting to recommended dark theme`);
      const recommended = getRecommendedThemes();
      return getMonacoThemeId(recommended.dark);
  }
};

// Define custom Monaco themes with proper selection highlighting
export const defineCustomMonacoThemes = (monaco) => {
  // Enhanced light theme with visible selection
  monaco.editor.defineTheme('vs-enhanced', {
    base: 'vs',
    inherit: true,
    rules: [],
    colors: {
      'editor.selectionBackground': '#ADD8E6CC',  // Light blue with transparency
      'editor.selectionForeground': '#000000',
      'editor.selectionHighlightBackground': '#B4D8FACC',  // Slightly different blue for occurrence highlights
      'editor.inactiveSelectionBackground': '#E0E0E0AA',  // Gray for inactive selections
      'editor.selectionHighlightBorder': '#0078D4',  // Blue border for selection highlights
      'editor.findMatchBackground': '#FFFF00AA',  // Yellow for find matches
      'editor.findMatchHighlightBackground': '#FFFF0066',  // Lighter yellow for other matches
    }
  });

  // Enhanced dark theme with visible selection
  monaco.editor.defineTheme('vs-dark-enhanced', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.selectionBackground': '#264F78CC',  // Dark blue with transparency
      'editor.selectionForeground': '#FFFFFF',
      'editor.selectionHighlightBackground': '#3A5998AA',  // Lighter blue for occurrence highlights
      'editor.inactiveSelectionBackground': '#3C3C3CAA',  // Dark gray for inactive selections
      'editor.selectionHighlightBorder': '#4A90E2',  // Blue border for selection highlights
      'editor.findMatchBackground': '#515C6ACC',  // Dark blue for find matches
      'editor.findMatchHighlightBackground': '#515C6A88',  // Lighter for other matches
    }
  });

  // Enhanced high contrast black theme with visible selection
  monaco.editor.defineTheme('hc-black-enhanced', {
    base: 'hc-black',
    inherit: true,
    rules: [],
    colors: {
      'editor.selectionBackground': '#0000FFAA',  // Bright blue with transparency
      'editor.selectionForeground': '#FFFFFF',
      'editor.selectionHighlightBackground': '#0080FFAA',  // Lighter blue for occurrence highlights
      'editor.inactiveSelectionBackground': '#808080AA',  // Gray for inactive selections
      'editor.selectionHighlightBorder': '#FFFFFF',  // White border for maximum contrast
      'editor.findMatchBackground': '#FFFF00CC',  // Bright yellow for find matches
      'editor.findMatchHighlightBackground': '#FFFF0088',  // Lighter yellow for other matches
    }
  });

  // Enhanced high contrast light theme with visible selection
  monaco.editor.defineTheme('hc-light-enhanced', {
    base: 'hc-light',
    inherit: true,
    rules: [],
    colors: {
      'editor.selectionBackground': '#0000FFAA',  // Bright blue with transparency
      'editor.selectionForeground': '#000000',
      'editor.selectionHighlightBackground': '#0080FFAA',  // Lighter blue for occurrence highlights
      'editor.inactiveSelectionBackground': '#C0C0C0AA',  // Light gray for inactive selections
      'editor.selectionHighlightBorder': '#000000',  // Black border for maximum contrast
      'editor.findMatchBackground': '#FFFF00CC',  // Bright yellow for find matches
      'editor.findMatchHighlightBackground': '#FFFF0088',  // Lighter yellow for other matches
    }
  });
};

/**
 * Load and define a custom theme from JSON file
 * @param {Object} monaco - Monaco editor instance
 * @param {string} themeName - Name of the theme to load
 * @returns {Promise<boolean>} Success status
 */
export const loadAndDefineTheme = async (monaco, themeName) => {
  if (!isValidTheme(themeName)) {
    console.warn(`loadAndDefineTheme: Invalid theme name '${themeName}'`);
    return false;
  }

  const themeId = getMonacoThemeId(themeName);

  // Check if theme is already loaded
  if (themeCache.has(themeId)) {
    return true;
  }

  try {
    const themeData = await loadThemeFromFile(themeName);

    // Enhance theme with improved selection colors based on base theme
    const enhancedTheme = enhanceThemeSelection(themeData, themeName);

    monaco.editor.defineTheme(themeId, enhancedTheme);
    themeCache.set(themeId, true);

    console.debug(`Successfully loaded theme: ${themeName} (${themeId})`);
    return true;
  } catch (error) {
    console.error(`Failed to load theme ${themeName}:`, error);
    return false;
  }
};

/**
 * Enhance theme with better selection highlighting
 * @param {Object} themeData - Original theme data
 * @param {string} themeName - Theme name for categorization
 * @returns {Object} Enhanced theme data
 */
function enhanceThemeSelection(themeData, themeName) {
  const enhanced = { ...themeData };

  // Ensure colors object exists
  if (!enhanced.colors) {
    enhanced.colors = {};
  }

  // Get base theme type for selection colors
  const isDark = themeData.base === 'vs-dark' || themeData.base === 'hc-black';
  const isHighContrast = themeData.base === 'hc-black' || themeData.base === 'hc-light';

  // Add enhanced selection colors if not present
  if (!enhanced.colors['editor.selectionBackground']) {
    if (isHighContrast) {
      enhanced.colors['editor.selectionBackground'] = isDark ? '#0000FFAA' : '#0000FFAA';
      enhanced.colors['editor.selectionForeground'] = isDark ? '#FFFFFF' : '#000000';
      enhanced.colors['editor.selectionHighlightBackground'] = '#0080FFAA';
      enhanced.colors['editor.selectionHighlightBorder'] = isDark ? '#FFFFFF' : '#000000';
    } else if (isDark) {
      enhanced.colors['editor.selectionBackground'] = '#264F78CC';
      enhanced.colors['editor.selectionForeground'] = '#FFFFFF';
      enhanced.colors['editor.selectionHighlightBackground'] = '#3A5998AA';
      enhanced.colors['editor.selectionHighlightBorder'] = '#4A90E2';
    } else {
      enhanced.colors['editor.selectionBackground'] = '#ADD8E6CC';
      enhanced.colors['editor.selectionForeground'] = '#000000';
      enhanced.colors['editor.selectionHighlightBackground'] = '#B4D8FACC';
      enhanced.colors['editor.selectionHighlightBorder'] = '#0078D4';
    }

    // Add find match colors
    enhanced.colors['editor.findMatchBackground'] = isDark ? '#515C6ACC' : '#FFFF00AA';
    enhanced.colors['editor.findMatchHighlightBackground'] = isDark ? '#515C6A88' : '#FFFF0066';
  }

  return enhanced;
}

/**
 * Preload popular themes for better performance
 * @param {Object} monaco - Monaco editor instance
 * @returns {Promise<void>}
 */
export const preloadPopularThemes = async (monaco) => {
  const popularThemes = [
    'GitHub Dark',
    'GitHub Light',
    'Night Owl',
    'Dracula',
    'Monokai Bright',
    'Solarized-dark',
    'Solarized-light'
  ];

  const loadPromises = popularThemes.map(themeName =>
    loadAndDefineTheme(monaco, themeName).catch(error =>
      console.warn(`Failed to preload theme ${themeName}:`, error)
    )
  );

  await Promise.allSettled(loadPromises);
  console.debug('Popular themes preloading completed');
};
