import { describe, it, expect } from 'vitest';
import {
  calculateResultEditorHeight,
  countLines,
  MIN_RESULT_HEIGHT,
  MAX_RESULT_HEIGHT,
  DEFAULT_LINE_HEIGHT
} from './editorSizing.js';

describe('editorSizing utility', () => {
  describe('calculateResultEditorHeight', () => {
    it('returns minimum height for empty string', () => {
      expect(calculateResultEditorHeight('')).toBe(`${MIN_RESULT_HEIGHT}px`);
    });

    it('returns minimum height for whitespace-only content', () => {
      expect(calculateResultEditorHeight('   ')).toBe(`${MIN_RESULT_HEIGHT}px`);
      expect(calculateResultEditorHeight('\n\n\n')).toBe(`${MIN_RESULT_HEIGHT}px`);
      expect(calculateResultEditorHeight('\t\t')).toBe(`${MIN_RESULT_HEIGHT}px`);
    });

    it('calculates correct height for single line (clamped to minimum)', () => {
      const content = 'Single line of text';
      const calculatedHeight = (1 * DEFAULT_LINE_HEIGHT) + 20; // 39px
      const expected = `${Math.max(MIN_RESULT_HEIGHT, calculatedHeight)}px`; // Clamped to 60px
      expect(calculateResultEditorHeight(content)).toBe(expected);
    });

    it('calculates correct height for 3 lines (minimum)', () => {
      const content = 'Line 1\nLine 2\nLine 3';
      const calculatedHeight = (3 * DEFAULT_LINE_HEIGHT) + 20; // 77px
      const expected = `${Math.max(MIN_RESULT_HEIGHT, calculatedHeight)}px`;
      expect(calculateResultEditorHeight(content)).toBe(expected);
    });

    it('calculates correct height for 10 lines', () => {
      const content = Array(10).fill('Line').join('\n');
      const expected = `${(10 * DEFAULT_LINE_HEIGHT) + 20}px`; // 210px
      expect(calculateResultEditorHeight(content)).toBe(expected);
    });

    it('clamps to maximum height for very long content', () => {
      const content = Array(100).fill('Line').join('\n');
      expect(calculateResultEditorHeight(content)).toBe(`${MAX_RESULT_HEIGHT}px`);
    });

    it('normalizes CRLF line endings to LF', () => {
      const contentLF = 'Line 1\nLine 2\nLine 3';
      const contentCRLF = 'Line 1\r\nLine 2\r\nLine 3';
      expect(calculateResultEditorHeight(contentLF)).toBe(calculateResultEditorHeight(contentCRLF));
    });

    it('counts trailing newlines (Monaco renders them)', () => {
      const contentWithTrailing = 'Line 1\nLine 2\nLine 3\n\n\n';
      const contentWithout = 'Line 1\nLine 2\nLine 3';
      // Content with trailing newlines should have greater height
      const heightWithTrailing = calculateResultEditorHeight(contentWithTrailing);
      const heightWithout = calculateResultEditorHeight(contentWithout);
      expect(parseInt(heightWithTrailing)).toBeGreaterThan(parseInt(heightWithout));
    });

    it('uses custom line height when provided', () => {
      const content = 'Line 1\nLine 2';
      const customLineHeight = 25;
      const expected = `${(2 * customLineHeight) + 20}px`; // 70px
      expect(calculateResultEditorHeight(content, customLineHeight)).toBe(expected);
    });

    it('handles XML content correctly', () => {
      const xmlContent = `<ligand-uri ligand-record-id="bioactivity-ligand/gostar/pt/1989514/8344/104143">
  bioactivity-ligand/56927bed-9df8-3464-a564-d5a40818f9c0
</ligand-uri>`;
      const lines = xmlContent.trim().split('\n').length; // 3 lines
      const calculatedHeight = (lines * DEFAULT_LINE_HEIGHT) + 20; // 77px
      const expected = `${Math.max(MIN_RESULT_HEIGHT, calculatedHeight)}px`;
      expect(calculateResultEditorHeight(xmlContent)).toBe(expected);
    });

    it('handles JSON content correctly', () => {
      const jsonContent = JSON.stringify({ key: 'value', nested: { a: 1, b: 2 } }, null, 2);
      const lines = jsonContent.split('\n').length;
      const expected = `${(lines * DEFAULT_LINE_HEIGHT) + 20}px`;
      expect(calculateResultEditorHeight(jsonContent)).toBe(expected);
    });

    it('returns minimum height for null content', () => {
      expect(calculateResultEditorHeight(null)).toBe(`${MIN_RESULT_HEIGHT}px`);
      expect(calculateResultEditorHeight(undefined)).toBe(`${MIN_RESULT_HEIGHT}px`);
    });
  });

  describe('countLines', () => {
    it('returns 0 for empty string', () => {
      expect(countLines('')).toBe(0);
    });

    it('returns 0 for whitespace-only content', () => {
      expect(countLines('   ')).toBe(0);
      expect(countLines('\n\n')).toBe(0);
    });

    it('counts single line correctly', () => {
      expect(countLines('Single line')).toBe(1);
    });

    it('counts multiple lines correctly', () => {
      expect(countLines('Line 1\nLine 2\nLine 3')).toBe(3);
    });

    it('normalizes CRLF line endings', () => {
      const contentLF = 'Line 1\nLine 2\nLine 3';
      const contentCRLF = 'Line 1\r\nLine 2\r\nLine 3';
      expect(countLines(contentLF)).toBe(countLines(contentCRLF));
    });

    it('counts trailing newlines', () => {
      expect(countLines('Line 1\nLine 2\n\n\n')).toBe(5); // 2 content lines + 3 trailing blank lines
    });

    it('returns 0 for null/undefined', () => {
      expect(countLines(null)).toBe(0);
      expect(countLines(undefined)).toBe(0);
    });
  });

  describe('constants', () => {
    it('has sensible default values', () => {
      expect(MIN_RESULT_HEIGHT).toBe(60);
      expect(MAX_RESULT_HEIGHT).toBe(600);
      expect(DEFAULT_LINE_HEIGHT).toBe(19);
    });

    it('MIN_RESULT_HEIGHT is less than MAX_RESULT_HEIGHT', () => {
      expect(MIN_RESULT_HEIGHT).toBeLessThan(MAX_RESULT_HEIGHT);
    });
  });
});
