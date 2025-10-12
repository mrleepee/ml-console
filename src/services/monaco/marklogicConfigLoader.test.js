import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getMarkLogicXQueryLanguageConfig,
  __resetMarkLogicConfigCacheForTests,
  __setMarkLogicConfigOverrideForTests,
  emptyMarkLogicConfig
} from './marklogicConfigLoader';

// Mock yaml module to test error handling
vi.mock('yaml', async () => {
  const actual = await vi.importActual('yaml');
  return {
    ...actual,
    parse: vi.fn(actual.parse)
  };
});

describe('getMarkLogicXQueryLanguageConfig', () => {
  beforeEach(() => {
    __resetMarkLogicConfigCacheForTests();
  });

  it('parses YAML configuration into arrays', async () => {
    const config = await getMarkLogicXQueryLanguageConfig();
    expect(Array.isArray(config.keywords)).toBe(true);
    expect(Array.isArray(config.builtins)).toBe(true);
    expect(Array.isArray(config.completionItems)).toBe(true);
    expect(config.keywords).toContain('xdmp');
    expect(config.builtins).toContain('cts:search');
  });

  it('caches the parsed configuration', async () => {
    const first = await getMarkLogicXQueryLanguageConfig();
    const second = await getMarkLogicXQueryLanguageConfig();
    expect(second).toBe(first);
  });

  it('includes enhanced XQuery operators and keywords', async () => {
    const config = await getMarkLogicXQueryLanguageConfig();

    // Check for XQuery operators
    expect(config.keywords).toContain('eq');
    expect(config.keywords).toContain('ne');
    expect(config.keywords).toContain('lt');
    expect(config.keywords).toContain('le');
    expect(config.keywords).toContain('gt');
    expect(config.keywords).toContain('ge');

    // Check for MarkLogic-specific keywords
    expect(config.keywords).toContain('cts');
    expect(config.keywords).toContain('sem');
    expect(config.keywords).toContain('map');
    expect(config.keywords).toContain('json');
  });

  it('includes comprehensive MarkLogic functions', async () => {
    const config = await getMarkLogicXQueryLanguageConfig();

    // Check for core namespaces
    expect(config.builtins).toContain('xdmp');
    expect(config.builtins).toContain('cts');
    expect(config.builtins).toContain('fn');
    expect(config.builtins).toContain('xs');

    // Check for specific functions
    expect(config.builtins).toContain('xdmp:log');
    expect(config.builtins).toContain('xdmp:invoke');
    expect(config.builtins).toContain('fn:doc');
    expect(config.builtins).toContain('fn:collection');
  });

  it('provides test override functionality', async () => {
    const testConfig = {
      keywords: ['test-keyword'],
      builtins: ['test:function'],
      completionItems: [{ label: 'test', kind: 'function' }]
    };

    __setMarkLogicConfigOverrideForTests(testConfig);
    const config = await getMarkLogicXQueryLanguageConfig();

    expect(config).toBe(testConfig);
    expect(config.keywords).toEqual(['test-keyword']);
    expect(config.builtins).toEqual(['test:function']);
  });

  it('provides empty config fallback', () => {
    expect(emptyMarkLogicConfig).toEqual({
      keywords: [],
      builtins: [],
      completionItems: []
    });
    expect(Object.isFrozen(emptyMarkLogicConfig)).toBe(true);
  });

  it('maintains data structure integrity', async () => {
    const config = await getMarkLogicXQueryLanguageConfig();

    // Ensure no undefined or null values
    config.keywords.forEach(keyword => {
      expect(typeof keyword).toBe('string');
      expect(keyword.length).toBeGreaterThan(0);
    });

    config.builtins.forEach(builtin => {
      expect(typeof builtin).toBe('string');
      expect(builtin.length).toBeGreaterThan(0);
    });

    config.completionItems.forEach(item => {
      expect(item).toBeDefined();
      expect(typeof item.label).toBe('string');
    });
  });

  it('handles YAML parse errors gracefully', async () => {
    // Import the parse function mock
    const { parse } = await import('yaml');

    // Mock console.warn to capture error logging
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Make parse throw an error
    parse.mockImplementationOnce(() => {
      throw new Error('Invalid YAML syntax');
    });

    // Reset cache to force re-parsing
    __resetMarkLogicConfigCacheForTests();

    const config = await getMarkLogicXQueryLanguageConfig();

    // Should fall back to empty config
    expect(config).toBe(emptyMarkLogicConfig);
    expect(config.keywords).toEqual([]);
    expect(config.builtins).toEqual([]);
    expect(config.completionItems).toEqual([]);

    // Should log warning
    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to load MarkLogic XQuery config. Falling back to defaults.',
      expect.any(Error)
    );

    // Cleanup
    consoleSpy.mockRestore();
    parse.mockRestore();
  });

  it('sanitizes completion items properly', async () => {
    // Import the parse function mock
    const { parse } = await import('yaml');

    // Mock parse to return data with malformed completion items
    parse.mockImplementationOnce(() => ({
      keywords: ['test-keyword'],
      builtins: ['test:function'],
      completionItems: [
        { label: 'valid-item', kind: 'function' },
        null, // Should be filtered out
        undefined, // Should be filtered out
        { kind: 'function' }, // Missing label, should be filtered out
        { label: '', kind: 'function' }, // Empty label, should be filtered out
        { label: 123, kind: 'function' }, // Non-string label, should be filtered out
        { label: 'another-valid-item', insertText: 'test()', kind: 'snippet' }
      ]
    }));

    // Reset cache to force re-parsing
    __resetMarkLogicConfigCacheForTests();

    const config = await getMarkLogicXQueryLanguageConfig();

    expect(config.completionItems).toHaveLength(2);
    expect(config.completionItems[0]).toEqual({ label: 'valid-item', kind: 'function' });
    expect(config.completionItems[1]).toEqual({
      label: 'another-valid-item',
      insertText: 'test()',
      kind: 'snippet'
    });
    // Empty label should be filtered out (not present in results)

    // Cleanup
    parse.mockRestore();
  });

  it('handles malformed YAML data structures', async () => {
    // Import the parse function mock
    const { parse } = await import('yaml');

    // Mock parse to return malformed data structures
    parse.mockImplementationOnce(() => ({
      keywords: 'not-an-array', // Should become empty array
      builtins: null, // Should become empty array
      completionItems: 'not-an-array' // Should become empty array
    }));

    // Reset cache to force re-parsing
    __resetMarkLogicConfigCacheForTests();

    const config = await getMarkLogicXQueryLanguageConfig();

    expect(config.keywords).toEqual([]);
    expect(config.builtins).toEqual([]);
    expect(config.completionItems).toEqual([]);

    // Cleanup
    parse.mockRestore();
  });

  it('sanitizes keywords and builtins arrays', async () => {
    // Import the parse function mock
    const { parse } = await import('yaml');

    // Mock parse to return malformed arrays with mixed data types
    parse.mockImplementationOnce(() => ({
      keywords: [
        'valid-keyword',
        '', // Empty string, should be filtered out
        null, // Should be filtered out
        123, // Number, should be filtered out
        '  spaced-keyword  ', // Should be trimmed
        undefined // Should be filtered out
      ],
      builtins: [
        'valid:builtin',
        '', // Empty string, should be filtered out
        null, // Should be filtered out
        true, // Boolean, should be filtered out
        '  spaced:builtin  ' // Should be trimmed
      ],
      completionItems: []
    }));

    // Reset cache to force re-parsing
    __resetMarkLogicConfigCacheForTests();

    const config = await getMarkLogicXQueryLanguageConfig();

    expect(config.keywords).toEqual(['valid-keyword', 'spaced-keyword']);
    expect(config.builtins).toEqual(['valid:builtin', 'spaced:builtin']);
    expect(config.completionItems).toEqual([]);

    // Cleanup
    parse.mockRestore();
  });

  it('filters out completion items with empty or whitespace-only labels', async () => {
    const { parse } = await import('yaml');

    parse.mockImplementationOnce(() => ({
      keywords: [],
      builtins: [],
      completionItems: [
        { label: 'valid-item', kind: 'function' },
        { label: '', kind: 'function' }, // Empty string - should be filtered
        { label: '   ', kind: 'function' }, // Whitespace only - should be filtered
        { label: '\t\n', kind: 'function' }, // Tabs/newlines - should be filtered
        { label: 'another-valid', kind: 'snippet' }
      ]
    }));

    __resetMarkLogicConfigCacheForTests();

    const config = await getMarkLogicXQueryLanguageConfig();

    expect(config.completionItems).toHaveLength(2);
    expect(config.completionItems.map(item => item.label)).toEqual(['valid-item', 'another-valid']);

    parse.mockRestore();
  });

  it('trims whitespace from completion item string fields', async () => {
    const { parse } = await import('yaml');

    parse.mockImplementationOnce(() => ({
      keywords: [],
      builtins: [],
      completionItems: [
        {
          label: '  spaced-label  ',
          insertText: '  spaced-insert  ',
          detail: '  spaced-detail  ',
          documentation: '  spaced-docs  ',
          kind: 'function'
        },
        {
          label: 'clean-label',
          insertText: 'clean-insert',
          kind: 'snippet'
        }
      ]
    }));

    __resetMarkLogicConfigCacheForTests();

    const config = await getMarkLogicXQueryLanguageConfig();

    expect(config.completionItems).toHaveLength(2);

    // First item should have all string fields trimmed
    expect(config.completionItems[0]).toEqual({
      label: 'spaced-label',
      insertText: 'spaced-insert',
      detail: 'spaced-detail',
      documentation: 'spaced-docs',
      kind: 'function'
    });

    // Second item should remain unchanged
    expect(config.completionItems[1]).toEqual({
      label: 'clean-label',
      insertText: 'clean-insert',
      kind: 'snippet'
    });

    parse.mockRestore();
  });
});
