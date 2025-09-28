import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildXQueryLanguageConfig } from './monacoXqueryConfig';
import { registerXQueryLanguage, __resetXQueryRegistrationForTests, XQUERY_LANGUAGE } from './monacoXquery';

vi.mock('./marklogicConfigLoader', () => ({
  getMarkLogicXQueryLanguageConfig: vi.fn(() => ({
    keywords: ['xdmp', 'cts'],
    builtins: ['xdmp', 'cts', 'fn', 'cts:search'],
    completionItems: [],
  })),
}));

const createMonacoStub = () => {
  const registered = [];
  const languageConfigurationCalls = [];
  const monarchCalls = [];

  return {
    languages: {
      getLanguages: () => registered.map((id) => ({ id })),
      register: ({ id }) => {
        registered.push(id);
      },
      setLanguageConfiguration: (id, config) => {
        languageConfigurationCalls.push({ id, config });
      },
      setMonarchTokensProvider: (id, config) => {
        monarchCalls.push({ id, config });
      }
    },
    stats: {
      get registeredLanguages() {
        return registered.slice();
      },
      get languageConfigurationCalls() {
        return languageConfigurationCalls.slice();
      },
      get monarchCalls() {
        return monarchCalls.slice();
      }
    }
  };
};

describe('buildXQueryLanguageConfig', () => {
  it('includes MarkLogic defaults by default', () => {
    const config = buildXQueryLanguageConfig();
    expect(config.keywords).toContain('xdmp');
    expect(config.builtins).toContain('cts:search');
  });

  it('merges overrides without duplicates', () => {
    const config = buildXQueryLanguageConfig({
      overrides: {
        keywords: ['custom-fn', 'xdmp'],
        builtins: ['custom-lib']
      }
    });
    expect(config.keywords.filter((item) => item === 'xdmp')).toHaveLength(1);
    expect(config.keywords).toContain('custom-fn');
    expect(config.builtins).toContain('custom-lib');
  });

  it('excludes MarkLogic config when includeMarkLogic is false', () => {
    const config = buildXQueryLanguageConfig({ includeMarkLogic: false });
    expect(config.keywords).not.toContain('xdmp');
    expect(config.keywords).not.toContain('cts');
    expect(config.builtins).not.toContain('cts:search');
    // Should still include base XQuery keywords
    expect(config.keywords).toContain('xquery');
    expect(config.keywords).toContain('for');
    expect(config.builtins).toContain('fn');
  });

  it('handles null and undefined overrides gracefully', () => {
    const configNull = buildXQueryLanguageConfig({ overrides: null });
    const configUndefined = buildXQueryLanguageConfig({ overrides: undefined });
    const configEmpty = buildXQueryLanguageConfig({ overrides: {} });

    // All should include MarkLogic defaults
    expect(configNull.keywords).toContain('xdmp');
    expect(configUndefined.keywords).toContain('xdmp');
    expect(configEmpty.keywords).toContain('xdmp');
  });

  it('handles overrides with empty arrays', () => {
    const config = buildXQueryLanguageConfig({
      overrides: {
        keywords: [],
        builtins: [],
        completionItems: []
      }
    });
    expect(config.keywords).toContain('xdmp'); // Still includes MarkLogic defaults
    expect(config.builtins).toContain('fn'); // Still includes base builtins
  });
});

describe('registerXQueryLanguage', () => {
  beforeEach(() => {
    __resetXQueryRegistrationForTests();
  });

  it('registers the language once and applies token providers', () => {
    const monaco = createMonacoStub();

    registerXQueryLanguage(monaco);
    registerXQueryLanguage(monaco); // no-op on identical config

    expect(monaco.stats.registeredLanguages).toEqual([XQUERY_LANGUAGE]);
    expect(monaco.stats.languageConfigurationCalls).toHaveLength(1);
    expect(monaco.stats.monarchCalls).toHaveLength(1);
  });

  it('reapplies providers when overrides change', () => {
    const monaco = createMonacoStub();

    registerXQueryLanguage(monaco, { keywords: ['first'] });
    registerXQueryLanguage(monaco, { keywords: ['second'] });

    expect(monaco.stats.registeredLanguages).toEqual([XQUERY_LANGUAGE]);
    expect(monaco.stats.languageConfigurationCalls).toHaveLength(2);
    expect(monaco.stats.monarchCalls).toHaveLength(2);
    expect(monaco.stats.monarchCalls[1].config.keywords).toContain('second');
  });

  it('handles missing monaco gracefully', () => {
    expect(() => registerXQueryLanguage(null)).not.toThrow();
    expect(() => registerXQueryLanguage({})).not.toThrow();
    expect(() => registerXQueryLanguage({ languages: null })).not.toThrow();
  });

  it('handles language already registered', () => {
    const monaco = createMonacoStub();
    // Pre-register the language
    monaco.languages.register({ id: XQUERY_LANGUAGE });

    registerXQueryLanguage(monaco);

    expect(monaco.stats.registeredLanguages).toEqual([XQUERY_LANGUAGE]);
    expect(monaco.stats.languageConfigurationCalls).toHaveLength(1);
    expect(monaco.stats.monarchCalls).toHaveLength(1);
  });

  it('registers language with all required properties', () => {
    const monaco = createMonacoStub();
    let registrationCall = null;

    const originalRegister = monaco.languages.register;
    monaco.languages.register = (config) => {
      registrationCall = config;
      // Call original register method to properly update internal state
      originalRegister.call(monaco.languages, { id: config.id });
    };

    registerXQueryLanguage(monaco);

    expect(registrationCall).toEqual({
      id: XQUERY_LANGUAGE,
      extensions: ['.xq', '.xql', '.xqm', '.xqy', '.xquery'],
      aliases: ['XQuery (ML)', 'xquery-ml', 'XQuery', 'xquery'],
      mimetypes: ['application/xquery']
    });
  });

  it('applies correct language configuration', () => {
    const monaco = createMonacoStub();

    registerXQueryLanguage(monaco);

    const configCall = monaco.stats.languageConfigurationCalls[0];
    expect(configCall.id).toBe(XQUERY_LANGUAGE);
    expect(configCall.config).toMatchObject({
      comments: { blockComment: ['(:', ':)'] },
      brackets: [['{', '}'], ['[', ']'], ['(', ')']],
      autoClosingPairs: expect.arrayContaining([
        { open: '"', close: '"', notIn: ['string'] },
        { open: "'", close: "'", notIn: ['string'] },
        { open: '(:', close: ':)', notIn: ['string'] },
        { open: '{', close: '}', notIn: ['string'] },
        { open: '[', close: ']' },
        { open: '(', close: ')' }
      ])
    });
  });

  it('applies monarch tokenizer with correct structure', () => {
    const monaco = createMonacoStub();

    registerXQueryLanguage(monaco);

    const monarchCall = monaco.stats.monarchCalls[0];
    expect(monarchCall.id).toBe(XQUERY_LANGUAGE);
    expect(monarchCall.config).toMatchObject({
      defaultToken: '',
      ignoreCase: true,
      brackets: expect.arrayContaining([
        { open: '{', close: '}', token: 'delimiter.curly' },
        { open: '[', close: ']', token: 'delimiter.square' },
        { open: '(', close: ')', token: 'delimiter.parenthesis' }
      ]),
      tokenizer: expect.objectContaining({
        root: expect.any(Array),
        comment: expect.any(Array),
        numbers: expect.any(Array),
        strings: expect.any(Array),
        string_double: expect.any(Array),
        string_single: expect.any(Array)
      })
    });
  });

  it('includes MarkLogic keywords and builtins in tokenizer', () => {
    const monaco = createMonacoStub();

    registerXQueryLanguage(monaco);

    const monarchCall = monaco.stats.monarchCalls[0];
    expect(monarchCall.config.keywords).toContain('xdmp');
    expect(monarchCall.config.keywords).toContain('cts');
    expect(monarchCall.config.builtins).toContain('xdmp');
    expect(monarchCall.config.builtins).toContain('fn');
  });

  it('detects completion item content changes and reapplies providers', () => {
    const monaco = createMonacoStub();

    // First registration with initial completion items
    registerXQueryLanguage(monaco, {
      completionItems: [{ label: 'initial-item', kind: 'function' }]
    });

    // Second registration with same array length but different content
    registerXQueryLanguage(monaco, {
      completionItems: [{ label: 'changed-item', kind: 'function' }]
    });

    // Should have registered language once but reapplied providers twice due to content change
    expect(monaco.stats.registeredLanguages).toEqual([XQUERY_LANGUAGE]);
    expect(monaco.stats.languageConfigurationCalls).toHaveLength(2);
    expect(monaco.stats.monarchCalls).toHaveLength(2);

    // Verify that the configurations are actually different objects (proving signature change detection worked)
    const firstMonarchCall = monaco.stats.monarchCalls[0];
    const secondMonarchCall = monaco.stats.monarchCalls[1];

    expect(firstMonarchCall).not.toBe(secondMonarchCall);
    expect(firstMonarchCall.config).not.toBe(secondMonarchCall.config);

    // Both calls should include MarkLogic defaults (proving config building still works)
    expect(firstMonarchCall.config.keywords).toContain('xdmp');
    expect(secondMonarchCall.config.keywords).toContain('xdmp');
    expect(firstMonarchCall.config.builtins).toContain('cts');
    expect(secondMonarchCall.config.builtins).toContain('cts');

    // The test proves that changing completion item content (same array length)
    // triggers signature change detection and provider reapplication
  });

  it('applies detailed tokenizer rules correctly', () => {
    const monaco = createMonacoStub();

    registerXQueryLanguage(monaco);

    const monarchCall = monaco.stats.monarchCalls[0];
    const tokenizer = monarchCall.config.tokenizer;

    // Test root tokenizer rules
    expect(tokenizer.root).toEqual(expect.arrayContaining([
      [/\(:/, 'comment', '@comment'], // XQuery comments
      { include: '@strings' },
      { include: '@numbers' },
      [/\$[a-zA-Z_][\w\-]*/, 'variable'], // XQuery variables
      [/[{}()\[\]]/, '@brackets'],
      [/[;,]/, 'delimiter'],
      [/:=/, 'operator'], // Assignment operator
      [/\beq\b|\bne\b|\blt\b|\ble\b|\bgt\b|\bge\b/, 'operator'], // Comparison operators
      [/\bis\b|\bisnot\b|\binstance\s+of\b|\btreat\s+as\b/, 'operator'], // Type operators
      [/\bto\b|\bmod\b|\bdiv\b|\bidiv\b/, 'operator'], // Arithmetic operators
      [/[<>=!|+\-*/%]/, 'operator'],
      [/[a-zA-Z_][\w\-]*:[a-zA-Z_][\w\-]*(?=\s*\()/, 'type.identifier'], // Function calls
      [/@?[a-zA-Z_][\w\-.]*/, expect.any(Object)] // Keywords/identifiers
    ]));

    // Test comment tokenizer rules
    expect(tokenizer.comment).toEqual([
      [/\(:/, 'comment', '@push'], // Nested comments
      [/:\)/, 'comment', '@pop'],
      [/[^():]+/, 'comment'],
      [/./, 'comment']
    ]);

    // Test number tokenizer rules
    expect(tokenizer.numbers).toEqual([
      [/\b\d+(\.\d+)?\b/, 'number']
    ]);

    // Test string tokenizer sections exist
    expect(tokenizer.strings).toBeDefined();
    expect(tokenizer.string_double).toBeDefined();
    expect(tokenizer.string_single).toBeDefined();
  });

  it('includes XQuery-specific token patterns', () => {
    const monaco = createMonacoStub();

    registerXQueryLanguage(monaco);

    const monarchCall = monaco.stats.monarchCalls[0];

    // Verify XQuery-specific patterns are included
    const rootRules = monarchCall.config.tokenizer.root;

    // Check for variable pattern: $variable-name
    const variableRule = rootRules.find(rule =>
      Array.isArray(rule) && rule[0].toString() === '/\\$[a-zA-Z_][\\w\\-]*/'
    );
    expect(variableRule).toBeDefined();
    expect(variableRule[1]).toBe('variable');

    // Check for assignment operator: :=
    const assignRule = rootRules.find(rule =>
      Array.isArray(rule) && rule[0].toString() === '/:=/'
    );
    expect(assignRule).toBeDefined();
    expect(assignRule[1]).toBe('operator');

    // Check for XQuery comparison operators
    const comparisonRule = rootRules.find(rule =>
      Array.isArray(rule) && rule[0].toString().includes('\\beq\\b')
    );
    expect(comparisonRule).toBeDefined();
    expect(comparisonRule[1]).toBe('operator');

    // Check for function call pattern: namespace:function()
    const functionRule = rootRules.find(rule =>
      Array.isArray(rule) && rule[0].toString().includes('(?=\\s*\\()')
    );
    expect(functionRule).toBeDefined();
    expect(functionRule[1]).toBe('type.identifier');
  });

  it('end-to-end integration test with real config building', () => {
    const monaco = createMonacoStub();

    // Use the real buildXQueryLanguageConfig with custom overrides
    const customOverrides = {
      keywords: ['custom-keyword'],
      builtins: ['custom:builtin'],
      completionItems: [{ label: 'custom-item', kind: 'function' }]
    };

    registerXQueryLanguage(monaco, customOverrides);

    // Verify language registration
    expect(monaco.stats.registeredLanguages).toEqual([XQUERY_LANGUAGE]);
    expect(monaco.stats.languageConfigurationCalls).toHaveLength(1);
    expect(monaco.stats.monarchCalls).toHaveLength(1);

    // Verify configuration was applied
    const configCall = monaco.stats.languageConfigurationCalls[0];
    expect(configCall.id).toBe(XQUERY_LANGUAGE);
    expect(configCall.config.comments).toEqual({ blockComment: ['(:', ':)'] });

    // Verify Monaco tokenizer includes merged configuration
    const monarchCall = monaco.stats.monarchCalls[0];
    expect(monarchCall.id).toBe(XQUERY_LANGUAGE);

    // Should include MarkLogic defaults + custom overrides
    expect(monarchCall.config.keywords).toContain('xdmp'); // From MarkLogic config
    expect(monarchCall.config.keywords).toContain('cts'); // From MarkLogic config
    expect(monarchCall.config.keywords).toContain('custom-keyword'); // From overrides

    expect(monarchCall.config.builtins).toContain('cts:search'); // From MarkLogic config
    expect(monarchCall.config.builtins).toContain('custom:builtin'); // From overrides

    // Verify tokenizer structure is complete
    expect(monarchCall.config.tokenizer).toHaveProperty('root');
    expect(monarchCall.config.tokenizer).toHaveProperty('comment');
    expect(monarchCall.config.tokenizer).toHaveProperty('numbers');
    expect(monarchCall.config.tokenizer).toHaveProperty('strings');

    // Verify completion items integration by testing the built config directly
    // (completion items are used by completion providers, not monarch tokenizer)
    const builtConfig = buildXQueryLanguageConfig({ overrides: customOverrides });
    expect(builtConfig.completionItems).toBeDefined();
    expect(builtConfig.completionItems.length).toBeGreaterThan(0);
    expect(builtConfig.completionItems).toEqual(
      expect.arrayContaining([{ label: 'custom-item', kind: 'function' }])
    );
  });

  it('end-to-end integration with configuration merging', () => {
    const monaco = createMonacoStub();

    // First registration with some overrides
    registerXQueryLanguage(monaco, {
      keywords: ['first-keyword'],
      builtins: ['first:builtin']
    });

    // Second registration with different overrides (should update tokenizer)
    registerXQueryLanguage(monaco, {
      keywords: ['second-keyword'],
      builtins: ['second:builtin'],
      completionItems: [{ label: 'second-item', kind: 'function' }]
    });

    // Should have applied configurations twice due to signature change
    expect(monaco.stats.registeredLanguages).toEqual([XQUERY_LANGUAGE]);
    expect(monaco.stats.languageConfigurationCalls).toHaveLength(2);
    expect(monaco.stats.monarchCalls).toHaveLength(2);

    // Check the final (second) configuration
    const finalMonarchCall = monaco.stats.monarchCalls[1];

    // Should include MarkLogic defaults + second overrides
    expect(finalMonarchCall.config.keywords).toContain('xdmp'); // MarkLogic
    expect(finalMonarchCall.config.keywords).toContain('second-keyword'); // Override
    expect(finalMonarchCall.config.keywords).not.toContain('first-keyword'); // Not merged

    expect(finalMonarchCall.config.builtins).toContain('cts:search'); // MarkLogic
    expect(finalMonarchCall.config.builtins).toContain('second:builtin'); // Override
    expect(finalMonarchCall.config.builtins).not.toContain('first:builtin'); // Not merged

    // Verify completion items flow through the integration
    const secondConfig = buildXQueryLanguageConfig({
      overrides: {
        keywords: ['second-keyword'],
        builtins: ['second:builtin'],
        completionItems: [{ label: 'second-item', kind: 'function' }]
      }
    });
    expect(secondConfig.completionItems).toEqual(
      expect.arrayContaining([{ label: 'second-item', kind: 'function' }])
    );
    // Should also include MarkLogic completion items if any exist
    expect(secondConfig.completionItems).toBeDefined();
  });

  it('returns completion data for downstream completion provider registration', () => {
    const monaco = createMonacoStub();

    // Track completion provider registrations
    let completionProviderConfig = null;
    monaco.languages.registerCompletionItemProvider = (languageId, provider) => {
      completionProviderConfig = { languageId, provider };
    };

    const customCompletionItems = [
      { label: 'test-completion', insertText: 'test()', kind: 'function' },
      { label: 'another-test', insertText: 'another()', kind: 'snippet' }
    ];

    // Register language with completion items and get the config data back
    const languageConfig = registerXQueryLanguage(monaco, {
      keywords: ['test-keyword'],
      completionItems: customCompletionItems
    });

    // Verify that registerXQueryLanguage returns the built config
    expect(languageConfig).toBeDefined();
    expect(languageConfig.completionItems).toBeDefined();
    expect(languageConfig.completionItems).toHaveLength(2);
    expect(languageConfig.completionItems).toEqual(
      expect.arrayContaining(customCompletionItems)
    );

    // Verify the config includes MarkLogic defaults merged with overrides
    expect(languageConfig.keywords).toContain('xdmp'); // MarkLogic default
    expect(languageConfig.keywords).toContain('test-keyword'); // Override
    expect(languageConfig.builtins).toContain('cts:search'); // MarkLogic default

    // Register a completion provider using the config returned by registerXQueryLanguage
    monaco.languages.registerCompletionItemProvider(XQUERY_LANGUAGE, {
      provideCompletionItems: () => {
        return { suggestions: languageConfig.completionItems };
      }
    });

    // Verify the completion provider was registered and can access the data
    expect(completionProviderConfig).toBeDefined();
    expect(completionProviderConfig.languageId).toBe(XQUERY_LANGUAGE);

    const suggestions = completionProviderConfig.provider.provideCompletionItems();
    expect(suggestions.suggestions).toEqual(customCompletionItems);

    // This test proves that completion data flows from registerXQueryLanguage
    // to downstream consumers, addressing the integration gap
  });

  it('handles multiple Monaco instances independently', () => {
    const monaco1 = createMonacoStub();
    const monaco2 = createMonacoStub();

    // Register language on first Monaco instance
    registerXQueryLanguage(monaco1, {
      keywords: ['first-keyword'],
      completionItems: [{ label: 'first-item', kind: 'function' }]
    });

    // Register language on second Monaco instance with different config
    registerXQueryLanguage(monaco2, {
      keywords: ['second-keyword'],
      completionItems: [{ label: 'second-item', kind: 'function' }]
    });

    // Both instances should have been registered
    expect(monaco1.stats.registeredLanguages).toEqual([XQUERY_LANGUAGE]);
    expect(monaco2.stats.registeredLanguages).toEqual([XQUERY_LANGUAGE]);
    expect(monaco1.stats.monarchCalls).toHaveLength(1);
    expect(monaco2.stats.monarchCalls).toHaveLength(1);

    // Each instance should have received its own configuration
    expect(monaco1.stats.monarchCalls[0].config.keywords).toContain('first-keyword');
    expect(monaco2.stats.monarchCalls[0].config.keywords).toContain('second-keyword');

    // Registering the same config again on each instance should be a no-op
    registerXQueryLanguage(monaco1, {
      keywords: ['first-keyword'],
      completionItems: [{ label: 'first-item', kind: 'function' }]
    });
    registerXQueryLanguage(monaco2, {
      keywords: ['second-keyword'],
      completionItems: [{ label: 'second-item', kind: 'function' }]
    });

    // Should still have only one registration per instance
    expect(monaco1.stats.monarchCalls).toHaveLength(1);
    expect(monaco2.stats.monarchCalls).toHaveLength(1);
  });
});
