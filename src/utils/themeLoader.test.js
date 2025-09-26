import {
  THEME_CATEGORIES,
  getAllAvailableThemes,
  getThemesByCategory,
  searchThemes,
  getThemeCategory,
  isValidTheme,
  getRecommendedThemes,
  getThemeDisplayName,
  getMonacoThemeId
} from './themeLoader.js';

describe('themeLoader', () => {
  describe('THEME_CATEGORIES', () => {
    test('exports correct category constants', () => {
      expect(THEME_CATEGORIES.LIGHT).toBe('light');
      expect(THEME_CATEGORIES.DARK).toBe('dark');
      expect(THEME_CATEGORIES.HIGH_CONTRAST).toBe('high-contrast');
    });
  });

  describe('getAllAvailableThemes', () => {
    test('returns array of theme objects', () => {
      const themes = getAllAvailableThemes();
      expect(Array.isArray(themes)).toBe(true);
      expect(themes.length).toBeGreaterThan(0);
    });

    test('each theme has required properties', () => {
      const themes = getAllAvailableThemes();
      themes.forEach(theme => {
        expect(theme).toHaveProperty('name');
        expect(theme).toHaveProperty('displayName');
        expect(theme).toHaveProperty('category');
        expect(theme).toHaveProperty('id');
        expect(typeof theme.name).toBe('string');
        expect(typeof theme.displayName).toBe('string');
        expect(typeof theme.category).toBe('string');
        expect(typeof theme.id).toBe('string');
      });
    });

    test('themes are sorted by category then name', () => {
      const themes = getAllAvailableThemes();
      for (let i = 1; i < themes.length; i++) {
        const prev = themes[i - 1];
        const curr = themes[i];

        if (prev.category !== curr.category) {
          const categoryOrder = ['light', 'dark', 'high-contrast'];
          const prevIndex = categoryOrder.indexOf(prev.category);
          const currIndex = categoryOrder.indexOf(curr.category);
          expect(prevIndex).toBeLessThan(currIndex);
        } else {
          expect(prev.displayName.localeCompare(curr.displayName)).toBeLessThanOrEqual(0);
        }
      }
    });

    test('includes expected popular themes', () => {
      const themes = getAllAvailableThemes();
      const themeNames = themes.map(t => t.name);

      expect(themeNames).toContain('GitHub Dark');
      expect(themeNames).toContain('GitHub Light');
      expect(themeNames).toContain('Night Owl');
      expect(themeNames).toContain('Dracula');
      expect(themeNames).toContain('Solarized-dark');
      expect(themeNames).toContain('Solarized-light');
    });
  });

  describe('getThemesByCategory', () => {
    test('returns object with category keys', () => {
      const categorized = getThemesByCategory();
      expect(categorized).toHaveProperty('light');
      expect(categorized).toHaveProperty('dark');
      expect(categorized).toHaveProperty('high-contrast');
    });

    test('each category contains array of themes', () => {
      const categorized = getThemesByCategory();
      Object.values(categorized).forEach(themes => {
        expect(Array.isArray(themes)).toBe(true);
      });
    });

    test('light category contains light themes', () => {
      const categorized = getThemesByCategory();
      categorized.light.forEach(theme => {
        expect(theme.category).toBe('light');
      });
    });

    test('dark category contains dark themes', () => {
      const categorized = getThemesByCategory();
      categorized.dark.forEach(theme => {
        expect(theme.category).toBe('dark');
      });
    });

    test('total themes match getAllAvailableThemes count', () => {
      const allThemes = getAllAvailableThemes();
      const categorized = getThemesByCategory();
      const totalCategorized = Object.values(categorized)
        .reduce((sum, themes) => sum + themes.length, 0);

      expect(totalCategorized).toBe(allThemes.length);
    });
  });

  describe('searchThemes', () => {
    test('returns all themes when no search term', () => {
      const allThemes = getAllAvailableThemes();
      const searchResults = searchThemes('');
      expect(searchResults).toEqual(allThemes);
    });

    test('returns all themes when search term is undefined', () => {
      const allThemes = getAllAvailableThemes();
      const searchResults = searchThemes();
      expect(searchResults).toEqual(allThemes);
    });

    test('filters themes by name case-insensitively', () => {
      const results = searchThemes('github');
      expect(results.length).toBeGreaterThan(0);
      results.forEach(theme => {
        expect(theme.displayName.toLowerCase()).toContain('github');
      });
    });

    test('filters themes by category', () => {
      const results = searchThemes('dark');
      expect(results.length).toBeGreaterThan(0);
      results.forEach(theme => {
        expect(
          theme.displayName.toLowerCase().includes('dark') ||
          theme.category.toLowerCase().includes('dark')
        ).toBe(true);
      });
    });

    test('returns empty array for non-matching search', () => {
      const results = searchThemes('xyz-nonexistent-theme-name');
      expect(results).toEqual([]);
    });
  });

  describe('getThemeCategory', () => {
    test('returns correct category for known themes', () => {
      expect(getThemeCategory('GitHub Dark')).toBe('dark');
      expect(getThemeCategory('GitHub Light')).toBe('light');
      expect(getThemeCategory('Night Owl')).toBe('dark');
      expect(getThemeCategory('Solarized-light')).toBe('light');
    });

    test('returns dark as default for unknown themes', () => {
      expect(getThemeCategory('Unknown Theme')).toBe('dark');
      expect(getThemeCategory('')).toBe('dark');
      expect(getThemeCategory(null)).toBe('dark');
    });
  });

  describe('isValidTheme', () => {
    test('returns true for valid theme names', () => {
      expect(isValidTheme('GitHub Dark')).toBe(true);
      expect(isValidTheme('Night Owl')).toBe(true);
      expect(isValidTheme('Dracula')).toBe(true);
    });

    test('returns false for invalid theme names', () => {
      expect(isValidTheme('Invalid Theme')).toBe(false);
      expect(isValidTheme('')).toBe(false);
      expect(isValidTheme(null)).toBe(false);
      expect(isValidTheme(undefined)).toBe(false);
    });

    test('returns false for built-in themes', () => {
      expect(isValidTheme('vs')).toBe(false);
      expect(isValidTheme('vs-dark')).toBe(false);
      // Note: hc-black and hc-light are actually included in the theme map as valid themes
      // This test should check themes that are not in THEME_CATEGORY_MAP
    });
  });

  describe('getRecommendedThemes', () => {
    test('returns object with light and dark recommendations', () => {
      const recommended = getRecommendedThemes();
      expect(recommended).toHaveProperty('light');
      expect(recommended).toHaveProperty('dark');
      expect(recommended).toHaveProperty('fallback');
      expect(typeof recommended.light).toBe('string');
      expect(typeof recommended.dark).toBe('string');
      expect(typeof recommended.fallback).toBe('string');
    });

    test('recommended themes are valid', () => {
      const recommended = getRecommendedThemes();
      expect(isValidTheme(recommended.light)).toBe(true);
      expect(isValidTheme(recommended.dark)).toBe(true);
      expect(isValidTheme(recommended.fallback)).toBe(true);
    });
  });

  describe('getThemeDisplayName', () => {
    test('returns theme name for valid inputs', () => {
      expect(getThemeDisplayName('GitHub Dark')).toBe('GitHub Dark');
      expect(getThemeDisplayName('Night Owl')).toBe('Night Owl');
      expect(getThemeDisplayName('Test Theme')).toBe('Test Theme');
    });

    test('handles empty or null theme names', () => {
      expect(getThemeDisplayName('')).toBe('Unknown Theme');
      expect(getThemeDisplayName(null)).toBe('Unknown Theme');
      expect(getThemeDisplayName(undefined)).toBe('Unknown Theme');
    });
  });

  describe('getMonacoThemeId', () => {
    test('converts theme names to monaco-compatible IDs', () => {
      expect(getMonacoThemeId('GitHub Dark')).toBe('github-dark');
      expect(getMonacoThemeId('Night Owl')).toBe('night-owl');
      expect(getMonacoThemeId('MagicWB (Amiga)')).toBe('magicwb-amiga');
      expect(getMonacoThemeId('Tomorrow-Night-Bright')).toBe('tomorrow-night-bright');
    });

    test('handles special characters', () => {
      expect(getMonacoThemeId('Theme (Special)')).toBe('theme-special');
      expect(getMonacoThemeId('Theme-With-Dashes')).toBe('theme-with-dashes');
      expect(getMonacoThemeId('Theme With Spaces')).toBe('theme-with-spaces');
    });

    test('handles empty input', () => {
      expect(getMonacoThemeId('')).toBe('');
    });
  });

  describe('integration tests', () => {
    test('all theme IDs are unique', () => {
      const themes = getAllAvailableThemes();
      const ids = themes.map(t => t.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    test('searchThemes maintains theme properties', () => {
      const results = searchThemes('github');
      results.forEach(theme => {
        expect(theme).toHaveProperty('name');
        expect(theme).toHaveProperty('displayName');
        expect(theme).toHaveProperty('category');
        expect(theme).toHaveProperty('id');
      });
    });

    test('categorization is consistent', () => {
      const allThemes = getAllAvailableThemes();
      allThemes.forEach(theme => {
        expect(getThemeCategory(theme.name)).toBe(theme.category);
      });
    });
  });
});