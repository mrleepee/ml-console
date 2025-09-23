import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildXQueryLanguageConfig } from './monacoXqueryConfig';
import { registerXQueryLanguage, __resetXQueryRegistrationForTests, XQUERY_LANGUAGE } from './monacoXquery';

vi.mock('./marklogicConfigLoader', () => ({
  getMarkLogicXQueryLanguageConfig: vi.fn(() => ({
    keywords: ['xdmp', 'cts'],
    builtins: ['cts:search'],
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
});
