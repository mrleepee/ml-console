import { describe, it, expect } from 'vitest';
import { getLanguageFromContentType, getLanguageFromQueryType } from '../languageUtils';

describe('getLanguageFromContentType', () => {
  it('maps known types correctly', () => {
    expect(getLanguageFromContentType('application/json')).toBe('json');
    expect(getLanguageFromContentType('text/xml')).toBe('xml');
    expect(getLanguageFromContentType('text/html')).toBe('html');
    expect(getLanguageFromContentType('application/javascript')).toBe('javascript');
  });

  it('defaults to plaintext for unknown types', () => {
    expect(getLanguageFromContentType('application/octet-stream')).toBe('plaintext');
    expect(getLanguageFromContentType(undefined)).toBe('plaintext');
  });
});

describe('getLanguageFromQueryType', () => {
  it('maps query types to languages', () => {
    expect(getLanguageFromQueryType('javascript')).toBe('javascript');
    expect(getLanguageFromQueryType('xquery')).toBe('xml');
    expect(getLanguageFromQueryType('sparql')).toBe('sql');
  });

  it('returns plaintext for unknown query types', () => {
    expect(getLanguageFromQueryType('unknown')).toBe('plaintext');
  });
});
