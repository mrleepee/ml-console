import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { escapeRegExp, parseResponse, parseMultipartToTableData, parseMultipartResponse } from '../responseUtils';

describe('escapeRegExp', () => {
  it('escapes special characters', () => {
    expect(escapeRegExp('a+b*c')).toBe('a\\+b\\*c');
  });
});

describe('parseResponse', () => {
  it('parses header and body', () => {
    const sample = 'Content-Type: text/plain\nX-Primitive: xs:string\n\nHello';
    const parsed = parseResponse(sample);
    expect(parsed[0]).toEqual({
      contentType: 'text/plain',
      primitive: 'xs:string',
      uri: '',
      path: '',
      content: 'Hello'
    });
  });
});

describe('parseMultipartToTableData', () => {
  it('parses multiple parts', () => {
    const boundary = 'abc123';
    const body = [
      `--${boundary}`,
      'Content-Type: text/plain',
      '',
      'First',
      `--${boundary}`,
      'Content-Type: text/plain',
      '',
      'Second',
      `--${boundary}--`,
      ''
    ].join('\r\n');
    const parts = parseMultipartToTableData(body);
    expect(parts.length).toBe(2);
    expect(parts[0].content).toBe('First');
    expect(parts[1].contentType).toBe('text/plain');
  });
});

describe('parseMultipartResponse', () => {
  it('joins content of parts', () => {
    const boundary = 'xyz';
    const body = [
      `--${boundary}`,
      'Content-Type: text/plain',
      '',
      'A',
      `--${boundary}`,
      'Content-Type: text/plain',
      '',
      'B',
      `--${boundary}--`
    ].join('\r\n');
    const combined = parseMultipartResponse(body);
    expect(combined).toBe('A\nB');
  });
});

// Streaming tests with large response
const largePath = path.resolve(__dirname, '../../../tests/example-larger-response.txt');
const largeText = fs.readFileSync(largePath, 'utf8');

describe('streaming large response', () => {
  it('parses all parts from the large file', () => {
    const records = parseMultipartToTableData(largeText);
    expect(records.length).toBe(5000);
  });

  it('extracts first record correctly', () => {
    const records = parseMultipartToTableData(largeText);
    expect(records[0].contentType).toBe('application/xml');
    expect(records[0].content).toContain('<ligand>');
  });

  it('combines content into a single string', () => {
    const combined = parseMultipartResponse(largeText);
    expect(combined).toContain('<ligand>');
  });
});
