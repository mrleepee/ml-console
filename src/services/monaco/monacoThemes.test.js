import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getEnhancedTheme,
  defineCustomMonacoThemes,
  loadAndDefineTheme,
  preloadPopularThemes,
  clearThemeCache
} from './monacoThemes.js';
import * as themeLoader from '../../utils/themeLoader.js';

// Mock the themeLoader module
vi.mock('../../utils/themeLoader.js', () => ({
  isValidTheme: vi.fn(),
  getMonacoThemeId: vi.fn(),
  getRecommendedThemes: vi.fn(() => ({
    light: 'GitHub Light',
    dark: 'GitHub Dark',
    fallback: 'Night Owl'
  })),
  loadThemeFromFile: vi.fn()
}));

// Mock fetch for theme loading
global.fetch = vi.fn();

describe('monacoThemes', () => {
  let mockMonaco;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Clear theme cache to prevent cross-test contamination
    clearThemeCache();

    // Create mock Monaco instance
    mockMonaco = {
      editor: {
        defineTheme: vi.fn()
      }
    };

    // Setup default mock implementations
    themeLoader.isValidTheme.mockReturnValue(false);
    themeLoader.getMonacoThemeId.mockImplementation(name =>
      name.toLowerCase().replace(/\s+/g, '-')
    );

    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        base: 'vs-dark',
        inherit: true,
        rules: [],
        colors: {}
      })
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getEnhancedTheme', () => {
    test('returns enhanced built-in theme names', () => {
      expect(getEnhancedTheme('vs')).toBe('vs-enhanced');
      expect(getEnhancedTheme('vs-dark')).toBe('vs-dark-enhanced');
      expect(getEnhancedTheme('hc-black')).toBe('hc-black-enhanced');
      expect(getEnhancedTheme('hc-light')).toBe('hc-light-enhanced');
    });

    test('handles whitespace in theme names', () => {
      expect(getEnhancedTheme('  vs  ')).toBe('vs-enhanced');
      expect(getEnhancedTheme('\tvs-dark\n')).toBe('vs-dark-enhanced');
    });

    test('returns monaco theme ID for valid custom themes', async () => {
      const { isValidTheme, getMonacoThemeId } = themeLoader;
      isValidTheme.mockReturnValue(true);
      getMonacoThemeId.mockReturnValue('github-dark');

      expect(getEnhancedTheme('GitHub Dark')).toBe('github-dark');
      expect(isValidTheme).toHaveBeenCalledWith('GitHub Dark');
      expect(getMonacoThemeId).toHaveBeenCalledWith('GitHub Dark');
    });

    test('returns recommended dark theme for unknown themes', async () => {
      const { getMonacoThemeId } = themeLoader;
      getMonacoThemeId.mockReturnValue('github-dark');

      const result = getEnhancedTheme('unknown-theme');
      expect(result).toBe('github-dark');
      expect(getMonacoThemeId).toHaveBeenCalledWith('GitHub Dark');
    });

    test('handles null and undefined inputs', () => {
      expect(getEnhancedTheme(null)).toBe('github-dark');
      expect(getEnhancedTheme(undefined)).toBe('github-dark');
    });
  });

  describe('defineCustomMonacoThemes', () => {
    test('defines all enhanced built-in themes', () => {
      defineCustomMonacoThemes(mockMonaco);

      expect(mockMonaco.editor.defineTheme).toHaveBeenCalledTimes(4);
      expect(mockMonaco.editor.defineTheme).toHaveBeenCalledWith('vs-enhanced', expect.any(Object));
      expect(mockMonaco.editor.defineTheme).toHaveBeenCalledWith('vs-dark-enhanced', expect.any(Object));
      expect(mockMonaco.editor.defineTheme).toHaveBeenCalledWith('hc-black-enhanced', expect.any(Object));
      expect(mockMonaco.editor.defineTheme).toHaveBeenCalledWith('hc-light-enhanced', expect.any(Object));
    });

    test('defines themes with proper selection highlighting', () => {
      defineCustomMonacoThemes(mockMonaco);

      const calls = mockMonaco.editor.defineTheme.mock.calls;
      calls.forEach(([name, themeData]) => {
        expect(themeData).toHaveProperty('colors');
        expect(themeData.colors).toHaveProperty('editor.selectionBackground');
        expect(themeData.colors).toHaveProperty('editor.selectionForeground');
        expect(themeData.colors).toHaveProperty('editor.selectionHighlightBackground');
      });
    });

    test('light theme has appropriate selection colors', () => {
      defineCustomMonacoThemes(mockMonaco);

      const vsEnhancedCall = mockMonaco.editor.defineTheme.mock.calls
        .find(([name]) => name === 'vs-enhanced');
      const themeData = vsEnhancedCall[1];

      expect(themeData.base).toBe('vs');
      expect(themeData.inherit).toBe(true);
      expect(themeData.colors['editor.selectionBackground']).toBe('#ADD8E6CC');
      expect(themeData.colors['editor.selectionForeground']).toBe('#000000');
    });

    test('dark theme has appropriate selection colors', () => {
      defineCustomMonacoThemes(mockMonaco);

      const vsDarkEnhancedCall = mockMonaco.editor.defineTheme.mock.calls
        .find(([name]) => name === 'vs-dark-enhanced');
      const themeData = vsDarkEnhancedCall[1];

      expect(themeData.base).toBe('vs-dark');
      expect(themeData.inherit).toBe(true);
      expect(themeData.colors['editor.selectionBackground']).toBe('#264F78CC');
      expect(themeData.colors['editor.selectionForeground']).toBe('#FFFFFF');
    });
  });

  describe('loadAndDefineTheme', () => {
    test('returns false for invalid theme names', async () => {
      const { isValidTheme } = themeLoader;
      isValidTheme.mockReturnValue(false);

      const result = await loadAndDefineTheme(mockMonaco, 'invalid-theme');
      expect(result).toBe(false);
      expect(mockMonaco.editor.defineTheme).not.toHaveBeenCalled();
    });

    test('loads and defines valid custom theme', async () => {
      const { isValidTheme, getMonacoThemeId, loadThemeFromFile } = themeLoader;
      isValidTheme.mockReturnValue(true);
      getMonacoThemeId.mockReturnValue('github-dark');
      loadThemeFromFile.mockResolvedValue({
        base: 'vs-dark',
        inherit: true,
        rules: [],
        colors: { 'editor.background': '#24292e' }
      });

      const result = await loadAndDefineTheme(mockMonaco, 'GitHub Dark');

      expect(result).toBe(true);
      expect(loadThemeFromFile).toHaveBeenCalledWith('GitHub Dark');
      expect(mockMonaco.editor.defineTheme).toHaveBeenCalledWith('github-dark', expect.objectContaining({
        base: 'vs-dark',
        inherit: true,
        colors: expect.objectContaining({
          'editor.background': '#24292e',
          'editor.selectionBackground': '#264F78CC'
        })
      }));
    });

    test('enhances theme with selection colors when missing', async () => {
      const { isValidTheme, getMonacoThemeId, loadThemeFromFile } = themeLoader;
      isValidTheme.mockReturnValue(true);
      getMonacoThemeId.mockReturnValue('test-theme');
      loadThemeFromFile.mockResolvedValue({
        base: 'vs',
        inherit: true,
        rules: [],
        colors: {}
      });

      await loadAndDefineTheme(mockMonaco, 'Test Theme');

      const defineCall = mockMonaco.editor.defineTheme.mock.calls[0];
      const enhancedTheme = defineCall[1];

      expect(enhancedTheme.colors).toHaveProperty('editor.selectionBackground');
      expect(enhancedTheme.colors).toHaveProperty('editor.selectionForeground');
      expect(enhancedTheme.colors).toHaveProperty('editor.findMatchBackground');
    });

    test('preserves existing selection colors', async () => {
      const { isValidTheme, getMonacoThemeId, loadThemeFromFile } = themeLoader;
      isValidTheme.mockReturnValue(true);
      getMonacoThemeId.mockReturnValue('test-theme');
      loadThemeFromFile.mockResolvedValue({
        base: 'vs-dark',
        inherit: true,
        rules: [],
        colors: {
          'editor.selectionBackground': '#custom-color'
        }
      });

      await loadAndDefineTheme(mockMonaco, 'Test Theme');

      const defineCall = mockMonaco.editor.defineTheme.mock.calls[0];
      const enhancedTheme = defineCall[1];

      expect(enhancedTheme.colors['editor.selectionBackground']).toBe('#custom-color');
    });

    test('handles theme loading errors gracefully', async () => {
      const { isValidTheme, loadThemeFromFile } = themeLoader;
      isValidTheme.mockReturnValue(true);
      loadThemeFromFile.mockRejectedValue(new Error('Network error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await loadAndDefineTheme(mockMonaco, 'GitHub Dark');

      expect(result).toBe(false);
      expect(mockMonaco.editor.defineTheme).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Failed to load theme GitHub Dark:', expect.any(Error));

      consoleSpy.mockRestore();
    });

    test('caches successfully loaded themes', async () => {
      const { isValidTheme, getMonacoThemeId, loadThemeFromFile } = themeLoader;
      isValidTheme.mockReturnValue(true);
      getMonacoThemeId.mockReturnValue('github-dark');
      loadThemeFromFile.mockResolvedValue({
        base: 'vs-dark',
        inherit: true,
        rules: [],
        colors: {}
      });

      // Load theme twice
      const result1 = await loadAndDefineTheme(mockMonaco, 'GitHub Dark');
      const result2 = await loadAndDefineTheme(mockMonaco, 'GitHub Dark');

      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(loadThemeFromFile).toHaveBeenCalledTimes(1); // Should be cached on second call
      expect(mockMonaco.editor.defineTheme).toHaveBeenCalledTimes(1);
    });
  });

  describe('preloadPopularThemes', () => {
    test('attempts to load popular themes', async () => {
      const { isValidTheme, loadThemeFromFile } = themeLoader;
      isValidTheme.mockReturnValue(true);
      loadThemeFromFile.mockResolvedValue({
        base: 'vs-dark',
        inherit: true,
        rules: [],
        colors: {}
      });

      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

      await preloadPopularThemes(mockMonaco);

      expect(loadThemeFromFile).toHaveBeenCalledWith('GitHub Dark');
      expect(loadThemeFromFile).toHaveBeenCalledWith('GitHub Light');
      expect(loadThemeFromFile).toHaveBeenCalledWith('Night Owl');
      expect(loadThemeFromFile).toHaveBeenCalledWith('Dracula');
      expect(consoleSpy).toHaveBeenCalledWith('Popular themes preloading completed');

      consoleSpy.mockRestore();
    });

    test('handles individual theme loading failures gracefully', async () => {
      const { isValidTheme, loadThemeFromFile } = themeLoader;
      isValidTheme.mockReturnValue(true);
      // preloadPopularThemes loads 7 themes: GitHub Dark, GitHub Light, Night Owl, Dracula, Monokai Bright, Solarized-dark, Solarized-light
      loadThemeFromFile
        .mockResolvedValueOnce({ base: 'vs-dark', inherit: true, rules: [], colors: {} })  // GitHub Dark
        .mockRejectedValueOnce(new Error('Theme not found'))  // GitHub Light (fails)
        .mockResolvedValueOnce({ base: 'vs-dark', inherit: true, rules: [], colors: {} })  // Night Owl
        .mockResolvedValueOnce({ base: 'vs-dark', inherit: true, rules: [], colors: {} })  // Dracula
        .mockResolvedValueOnce({ base: 'vs-dark', inherit: true, rules: [], colors: {} })  // Monokai Bright
        .mockResolvedValueOnce({ base: 'vs-dark', inherit: true, rules: [], colors: {} })  // Solarized-dark
        .mockResolvedValueOnce({ base: 'vs', inherit: true, rules: [], colors: {} });      // Solarized-light

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

      await preloadPopularThemes(mockMonaco);

      expect(errorSpy).toHaveBeenCalledWith('Failed to load theme GitHub Light:', expect.any(Error));
      expect(debugSpy).toHaveBeenCalledWith('Popular themes preloading completed');

      errorSpy.mockRestore();
      debugSpy.mockRestore();
    });
  });

  describe('enhanceThemeSelection helper', () => {
    test('adds selection colors based on theme base', async () => {
      const { isValidTheme, getMonacoThemeId, loadThemeFromFile } = themeLoader;
      isValidTheme.mockReturnValue(true);
      getMonacoThemeId.mockReturnValueOnce('test-theme-dark');
      getMonacoThemeId.mockReturnValueOnce('test-theme-light');

      // Test dark theme enhancement
      loadThemeFromFile.mockResolvedValueOnce({
        base: 'vs-dark',
        inherit: true,
        rules: [],
        colors: {}
      });

      await loadAndDefineTheme(mockMonaco, 'Test Theme');

      const enhancedTheme = mockMonaco.editor.defineTheme.mock.calls[0][1];
      expect(enhancedTheme.colors['editor.selectionBackground']).toBe('#264F78CC');
      expect(enhancedTheme.colors['editor.selectionForeground']).toBe('#FFFFFF');

      // Test light theme enhancement
      loadThemeFromFile.mockResolvedValueOnce({
        base: 'vs',
        inherit: true,
        rules: [],
        colors: {}
      });

      await loadAndDefineTheme(mockMonaco, 'Test Theme Light');

      const lightEnhancedTheme = mockMonaco.editor.defineTheme.mock.calls[1][1];
      expect(lightEnhancedTheme.colors['editor.selectionBackground']).toBe('#ADD8E6CC');
      expect(lightEnhancedTheme.colors['editor.selectionForeground']).toBe('#000000');
    });

    test('handles high contrast themes', async () => {
      const { isValidTheme, getMonacoThemeId, loadThemeFromFile } = themeLoader;
      isValidTheme.mockReturnValue(true);
      getMonacoThemeId.mockReturnValue('test-hc-theme');
      loadThemeFromFile.mockResolvedValue({
        base: 'hc-black',
        inherit: true,
        rules: [],
        colors: {}
      });

      await loadAndDefineTheme(mockMonaco, 'Test HC Theme');

      const enhancedTheme = mockMonaco.editor.defineTheme.mock.calls[0][1];
      expect(enhancedTheme.colors['editor.selectionBackground']).toBe('#0000FFAA');
      expect(enhancedTheme.colors['editor.selectionHighlightBorder']).toBe('#FFFFFF');
    });
  });
});