import { describe, expect, it } from 'vitest';
import {
  escapeRegExp,
  parseResponse,
  parseMultipartToTableData,
  parseMultipartResponse,
  formatXmlPretty,
  formatJsonPretty,
  formatRecordContent,
} from './responseService';

describe('responseService utilities', () => {
  it('escapes regular expression metacharacters', () => {
    expect(escapeRegExp('a+b*c?')).toBe('a\\+b\\*c\\?');
    expect(escapeRegExp('[test]')).toBe('\\[test\\]');
  });

  it('parses single responses with headers correctly', () => {
    const payload = [
      'Content-Type: application/json',
      'X-Primitive: element()',
      'X-Uri: /example.json',
      '',
      '{"foo": "bar"}',
    ].join('\r\n');

    const [record] = parseResponse(payload);
    expect(record).toEqual({
      contentType: 'application/json',
      primitive: 'element()',
      uri: '/example.json',
      path: '',
      content: '{"foo": "bar"}',
    });
  });

  it('parses responses without headers as plain content', () => {
    const [record] = parseResponse('plain text body');
    expect(record).toEqual({
      contentType: '',
      primitive: '',
      uri: '',
      path: '',
      content: 'plain text body',
    });
  });

  it('parses multipart responses into individual records', () => {
    const multipart = [
      '--boundary',
      'Content-Type: application/json',
      'X-Primitive: node()',
      '',
      '{"one": 1}',
      '--boundary',
      'Content-Type: text/plain',
      '',
      'second value',
      '--boundary--',
      '',
    ].join('\r\n');

    const records = parseMultipartToTableData(multipart);
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({ contentType: 'application/json', content: '{"one": 1}' });
    expect(records[1]).toMatchObject({ contentType: 'text/plain', content: 'second value' });
  });

  it('falls back to single response parsing when no boundary exists', () => {
    const records = parseMultipartToTableData('only one part');
    expect(records).toHaveLength(1);
    expect(records[0].content).toBe('only one part');
  });

  it('formats multipart responses as joined string content', () => {
    const multipart = [
      '--boundary',
      'Content-Type: text/plain',
      '',
      'first',
      '--boundary',
      'Content-Type: text/plain',
      '',
      'second',
      '--boundary--',
      '',
    ].join('\r\n');

    expect(parseMultipartResponse(multipart)).toBe('first\nsecond');
  });

  it('pretty prints xml content defensively', () => {
    const formatted = formatXmlPretty('<root><child>value</child></root>');
    expect(formatted).toBe(['<root>', '  <child>', '    value', '  </child>', '</root>'].join('\n'));
  });

  it('pretty prints json content when valid', () => {
    const formatted = formatJsonPretty('{"foo":1}');
    expect(formatted).toBe('{' + '\n  "foo": 1\n}');
  });

  it('formats record content based on content type', () => {
    const jsonRecord = { content: '{"foo":1}', contentType: 'application/json' };
    const xmlRecord = { content: '<root><item>2</item></root>', contentType: 'application/xml' };
    const textRecord = { content: 'plain', contentType: 'text/plain' };

    expect(formatRecordContent(jsonRecord)).toBe('{' + '\n  "foo": 1\n}');
    expect(formatRecordContent(xmlRecord)).toBe(['<root>', '  <item>', '    2', '  </item>', '</root>'].join('\n'));
    expect(formatRecordContent(textRecord)).toBe('plain');
  });
});
