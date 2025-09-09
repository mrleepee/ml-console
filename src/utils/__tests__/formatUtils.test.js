import { describe, it, expect } from 'vitest';
import { formatXmlPretty, getRawContent } from '../formatUtils';

describe('formatXmlPretty', () => {
  it('formats XML with indentation', () => {
    const raw = '<root><child>value</child></root>';
    const formatted = formatXmlPretty(raw);
    expect(formatted).toBe('<root>\n  <child>\n    value\n  </child>\n</root>');
  });

  it('returns original text on failure', () => {
    const raw = '<unclosed>';
    expect(formatXmlPretty(raw)).toBe('<unclosed>');
  });
});

describe('getRawContent', () => {
  it('formats JSON content', () => {
    const record = { contentType: 'application/json', content: '{"a":1}' };
    expect(getRawContent(record)).toBe('{\n  "a": 1\n}');
  });

  it('formats XML content', () => {
    const record = { contentType: 'application/xml', content: '<r><a/></r>' };
    expect(getRawContent(record)).toBe('<r>\n  <a/>\n</r>');
  });

  it('returns content for unknown types', () => {
    const record = { contentType: 'text/plain', content: 'hello' };
    expect(getRawContent(record)).toBe('hello');
  });
});
