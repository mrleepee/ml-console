import { describe, it, expect, beforeEach } from 'vitest';
import { getMarkLogicXQueryLanguageConfig, __resetMarkLogicConfigCacheForTests } from './marklogicConfigLoader';

describe('getMarkLogicXQueryLanguageConfig', () => {
  beforeEach(() => {
    __resetMarkLogicConfigCacheForTests();
  });

  it('parses YAML configuration into arrays', () => {
    const config = getMarkLogicXQueryLanguageConfig();
    expect(Array.isArray(config.keywords)).toBe(true);
    expect(Array.isArray(config.builtins)).toBe(true);
    expect(config.keywords).toContain('xdmp');
    expect(config.builtins).toContain('cts:search');
  });

  it('caches the parsed configuration', () => {
    const first = getMarkLogicXQueryLanguageConfig();
    const second = getMarkLogicXQueryLanguageConfig();
    expect(second).toBe(first);
  });
});
