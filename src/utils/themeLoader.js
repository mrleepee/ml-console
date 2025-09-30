// Theme loading and management utilities for Monaco Editor
// Handles loading themes from JSON files and categorizing them

/**
 * Theme categories for organization
 */
export const THEME_CATEGORIES = {
  LIGHT: 'light',
  DARK: 'dark',
  HIGH_CONTRAST: 'high-contrast'
};

/**
 * Predefined theme categorization based on analysis of theme bases and colors
 */
const THEME_CATEGORY_MAP = {
  // Light themes
  'Amy': THEME_CATEGORIES.LIGHT,
  'Birds of Paradise': THEME_CATEGORIES.LIGHT,
  'Clouds': THEME_CATEGORIES.LIGHT,
  'Dawn': THEME_CATEGORIES.LIGHT,
  'Dreamweaver': THEME_CATEGORIES.LIGHT,
  'Eiffel': THEME_CATEGORIES.LIGHT,
  'GitHub Light': THEME_CATEGORIES.LIGHT,
  'iPlastic': THEME_CATEGORIES.LIGHT,
  'Kuroir Theme': THEME_CATEGORIES.LIGHT,
  'LAZY': THEME_CATEGORIES.LIGHT,
  'MagicWB (Amiga)': THEME_CATEGORIES.LIGHT,
  'Solarized-light': THEME_CATEGORIES.LIGHT,
  'SpaceCadet': THEME_CATEGORIES.LIGHT,
  'Textmate (Mac Classic)': THEME_CATEGORIES.LIGHT,
  'Tomorrow': THEME_CATEGORIES.LIGHT,

  // Dark themes
  'Active4D': THEME_CATEGORIES.DARK,
  'All Hallows Eve': THEME_CATEGORIES.DARK,
  'Blackboard': THEME_CATEGORIES.DARK,
  'Brilliance Black': THEME_CATEGORIES.DARK,
  'Brilliance Dull': THEME_CATEGORIES.DARK,
  'Chrome DevTools': THEME_CATEGORIES.DARK,
  'Clouds Midnight': THEME_CATEGORIES.DARK,
  'Cobalt': THEME_CATEGORIES.DARK,
  'Cobalt2': THEME_CATEGORIES.DARK,
  'Dominion Day': THEME_CATEGORIES.DARK,
  'Dracula': THEME_CATEGORIES.DARK,
  'Espresso Libre': THEME_CATEGORIES.DARK,
  'GitHub Dark': THEME_CATEGORIES.DARK,
  'idleFingers': THEME_CATEGORIES.DARK,
  'krTheme': THEME_CATEGORIES.DARK,
  'Material-Theme': THEME_CATEGORIES.DARK,
  'Merbivore': THEME_CATEGORIES.DARK,
  'Merbivore Soft': THEME_CATEGORIES.DARK,
  'monokai': THEME_CATEGORIES.DARK,
  'Monokai Bright': THEME_CATEGORIES.DARK,
  'Night Owl': THEME_CATEGORIES.DARK,
  'Nord': THEME_CATEGORIES.DARK,
  'Oceanic Next': THEME_CATEGORIES.DARK,
  'Pastels on Dark': THEME_CATEGORIES.DARK,
  'Slush and Poppies': THEME_CATEGORIES.DARK,
  'Solarized-dark': THEME_CATEGORIES.DARK,
  'Tomorrow-Night': THEME_CATEGORIES.DARK,
  'Tomorrow-Night-Blue': THEME_CATEGORIES.DARK,
  'Tomorrow-Night-Bright': THEME_CATEGORIES.DARK,
  'Tomorrow-Night-Eighties': THEME_CATEGORIES.DARK,
  'TwilightII File': THEME_CATEGORIES.DARK,
  'Upstream Sunburst': THEME_CATEGORIES.DARK,
  'Vibrant Ink': THEME_CATEGORIES.DARK,
  'Zenburnesque': THEME_CATEGORIES.DARK,
  'monoindustrial': THEME_CATEGORIES.DARK,

  // Note: Built-in Monaco themes (vs, vs-dark, hc-black) are handled separately in ThemeSelector
  // Note: hc-light removed - Monaco doesn't properly support it, causes loading errors
};

/**
 * Load a theme from JSON file path
 * @param {string} themeName - Name of the theme (without .json extension)
 * @returns {Promise<Object>} Theme configuration object
 */
export async function loadThemeFromFile(themeName) {
  try {
    const response = await fetch(`/config/monaco-themes/themes/${themeName}.json`);
    if (!response.ok) {
      throw new Error(`Failed to load theme ${themeName}: ${response.statusText}`);
    }
    const themeData = await response.json();
    return themeData;
  } catch (error) {
    console.error(`Error loading theme ${themeName}:`, error);
    throw error;
  }
}

/**
 * Get theme category for a given theme name
 * @param {string} themeName - Name of the theme
 * @returns {string} Theme category
 */
export function getThemeCategory(themeName) {
  return THEME_CATEGORY_MAP[themeName] || THEME_CATEGORIES.DARK;
}

/**
 * Get list of all available themes with their metadata
 * @returns {Array} Array of theme objects with name, category, and display name
 */
export function getAllAvailableThemes() {
  const themes = Object.keys(THEME_CATEGORY_MAP).map(themeName => ({
    name: themeName,
    displayName: themeName,
    category: THEME_CATEGORY_MAP[themeName],
    id: themeName.toLowerCase().replace(/\s+/g, '-').replace(/[()]/g, '')
  }));

  // Sort themes by category, then by name
  return themes.sort((a, b) => {
    if (a.category !== b.category) {
      const categoryOrder = [THEME_CATEGORIES.LIGHT, THEME_CATEGORIES.DARK, THEME_CATEGORIES.HIGH_CONTRAST];
      return categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category);
    }
    return a.displayName.localeCompare(b.displayName);
  });
}

/**
 * Get themes grouped by category
 * @returns {Object} Object with category keys and theme arrays as values
 */
export function getThemesByCategory() {
  const allThemes = getAllAvailableThemes();
  const grouped = {
    [THEME_CATEGORIES.LIGHT]: [],
    [THEME_CATEGORIES.DARK]: [],
    [THEME_CATEGORIES.HIGH_CONTRAST]: []
  };

  allThemes.forEach(theme => {
    grouped[theme.category].push(theme);
  });

  return grouped;
}

/**
 * Search themes by name
 * @param {string} searchTerm - Search term to filter themes
 * @returns {Array} Filtered array of theme objects
 */
export function searchThemes(searchTerm) {
  if (!searchTerm) return getAllAvailableThemes();

  const term = searchTerm.toLowerCase();
  return getAllAvailableThemes().filter(theme =>
    theme.displayName.toLowerCase().includes(term) ||
    theme.category.toLowerCase().includes(term)
  );
}

/**
 * Check if a theme name is valid and available
 * @param {string} themeName - Name of the theme to validate
 * @returns {boolean} True if theme is available
 */
export function isValidTheme(themeName) {
  return Object.keys(THEME_CATEGORY_MAP).includes(themeName);
}

/**
 * Get recommended themes based on system preferences
 * @returns {Object} Object with light and dark theme recommendations
 */
export function getRecommendedThemes() {
  return {
    light: 'GitHub Light',
    dark: 'GitHub Dark',
    fallback: 'Night Owl'
  };
}

/**
 * Get theme display name for UI
 * @param {string} themeName - Internal theme name
 * @returns {string} Display-friendly theme name
 */
export function getThemeDisplayName(themeName) {
  return themeName || 'Unknown Theme';
}

/**
 * Convert theme name to Monaco-compatible ID
 * @param {string} themeName - Theme name
 * @returns {string} Monaco-compatible theme ID
 */
export function getMonacoThemeId(themeName) {
  return themeName.toLowerCase().replace(/\s+/g, '-').replace(/[()]/g, '');
}