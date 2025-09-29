import { describe, it, expect, beforeEach, vi } from 'vitest';
import { XQueryCommentProvider, createXQueryCommentActions } from './xqueryCommentProvider';

describe('XQueryCommentProvider', () => {
  let provider;
  let mockModel;

  beforeEach(() => {
    provider = new XQueryCommentProvider();
    mockModel = {
      getValueInRange: vi.fn(),
      getLineContent: vi.fn(),
      getLineMaxColumn: vi.fn(),
      pushEditOperations: vi.fn()
    };
  });

  describe('Line Comment Detection', () => {
    it('should detect commented lines correctly', () => {
      expect(provider.isLineCommented('(: This is a comment :)')).toBe(true);
      expect(provider.isLineCommented('  (: Indented comment :)  ')).toBe(true);
      expect(provider.isLineCommented('let $x := 1')).toBe(false);
      expect(provider.isLineCommented('(: Incomplete comment')).toBe(false);
      expect(provider.isLineCommented('incomplete comment :)')).toBe(false);
    });
  });

  describe('Line Comment Toggle', () => {
    it('should comment uncommented lines', () => {
      const line = 'let $x := 1';
      const commented = provider.commentLine(line);
      expect(commented).toBe('(: let $x := 1 :)');
    });

    it('should preserve indentation when commenting', () => {
      const line = '  let $x := 1';
      const commented = provider.commentLine(line);
      expect(commented).toBe('  (: let $x := 1 :)');
    });

    it('should handle empty lines', () => {
      const line = '';
      const commented = provider.commentLine(line);
      expect(commented).toBe('');
    });

    it('should uncomment commented lines', () => {
      const line = '(: let $x := 1 :)';
      const uncommented = provider.uncommentLine(line);
      expect(uncommented).toBe('let $x := 1');
    });

    it('should preserve indentation when uncommenting', () => {
      const line = '  (: let $x := 1 :)';
      const uncommented = provider.uncommentLine(line);
      expect(uncommented).toBe('  let $x := 1');
    });

    it('should handle already uncommented lines', () => {
      const line = 'let $x := 1';
      const uncommented = provider.uncommentLine(line);
      expect(uncommented).toBe('let $x := 1');
    });
  });

  describe('Block Comment Detection', () => {
    it('should detect block commented text', () => {
      expect(provider.isBlockCommented('(: This is a block comment :)')).toBe(true);
      expect(provider.isBlockCommented('(:\nMultiline\ncomment\n:)')).toBe(true);
      expect(provider.isBlockCommented('regular text')).toBe(false);
      expect(provider.isBlockCommented('(: incomplete')).toBe(false);
    });
  });

  describe('Block Comment Toggle', () => {
    it('should add block comments to single line', () => {
      const text = 'let $x := 1';
      const commented = provider.addBlockComment(text);
      expect(commented).toBe('(: let $x := 1 :)');
    });

    it('should add block comments to multiple lines', () => {
      const text = 'let $x := 1\nlet $y := 2';
      const commented = provider.addBlockComment(text);
      expect(commented).toBe('(:\nlet $x := 1\nlet $y := 2\n:)');
    });

    it('should not double-comment already commented text', () => {
      const text = '(: already commented :)';
      const commented = provider.addBlockComment(text);
      expect(commented).toBe('(: already commented :)');
    });

    it('should remove block comments from single line', () => {
      const text = '(: let $x := 1 :)';
      const uncommented = provider.removeBlockComment(text);
      expect(uncommented).toBe('let $x := 1');
    });

    it('should remove block comments from multiple lines', () => {
      const text = '(:\nlet $x := 1\nlet $y := 2\n:)';
      const uncommented = provider.removeBlockComment(text);
      expect(uncommented).toBe('let $x := 1\nlet $y := 2');
    });

    it('should handle multiline comments with indentation', () => {
      const text = '(:\n  let $x := 1\n  let $y := 2\n:)';
      const uncommented = provider.removeBlockComment(text);
      expect(uncommented).toBe('let $x := 1\nlet $y := 2');
    });

    it('should not modify non-commented text', () => {
      const text = 'let $x := 1\nlet $y := 2';
      const uncommented = provider.removeBlockComment(text);
      expect(uncommented).toBe('let $x := 1\nlet $y := 2');
    });
  });

  describe('Common Indentation Detection', () => {
    it('should find common indentation', () => {
      const lines = ['  line1', '  line2', '    line3'];
      expect(provider.getCommonIndent(lines)).toBe(2);
    });

    it('should handle lines with no indentation', () => {
      const lines = ['line1', 'line2'];
      expect(provider.getCommonIndent(lines)).toBe(0);
    });

    it('should handle empty lines', () => {
      const lines = ['  line1', '', '  line2'];
      expect(provider.getCommonIndent(lines)).toBe(2);
    });

    it('should handle all empty lines', () => {
      const lines = ['', '   ', ''];
      expect(provider.getCommonIndent(lines)).toBe(0);
    });
  });

  describe('Model Integration', () => {
    beforeEach(() => {
      mockModel.getLineMaxColumn.mockReturnValue(20);
      mockModel.pushEditOperations.mockImplementation((_, edits, callback) => {
        return callback ? callback() : null;
      });
    });

    it('should replace line content correctly', () => {
      provider.replaceLineContent(mockModel, 5, 'new content');

      expect(mockModel.pushEditOperations).toHaveBeenCalledWith(
        [],
        [{
          range: {
            startLineNumber: 5,
            startColumn: 1,
            endLineNumber: 5,
            endColumn: 20
          },
          text: 'new content'
        }],
        expect.any(Function)
      );
    });
  });

  describe('Comment Actions Provider', () => {
    const mockRange = {
      startLineNumber: 1,
      endLineNumber: 1,
      startColumn: 1,
      endColumn: 10
    };

    beforeEach(() => {
      mockModel.getValueInRange.mockReturnValue('let $x := 1');
      mockModel.getLineContent.mockReturnValue('let $x := 1');
      mockModel.getLineMaxColumn.mockReturnValue(12);
      mockModel.pushEditOperations.mockImplementation((_, edits, callback) => callback && callback());
    });

    it('should provide comment actions for uncommented text', () => {
      const mockToken = { isCancellationRequested: false };
      const actions = provider.provideCommentActions(mockModel, mockRange, mockToken);

      expect(actions).toHaveLength(2);
      expect(actions[0].id).toBe('xquery.comment.line');
      expect(actions[0].label).toBe('Toggle Line Comment');
      expect(actions[1].id).toBe('xquery.comment.block');
      expect(actions[1].label).toBe('Toggle Block Comment');
    });

    it('should provide uncomment actions for commented text', () => {
      mockModel.getValueInRange.mockReturnValue('(: let $x := 1 :)');
      mockModel.getLineContent.mockReturnValue('(: let $x := 1 :)');

      const mockToken = { isCancellationRequested: false };
      const actions = provider.provideCommentActions(mockModel, mockRange, mockToken);

      expect(actions).toHaveLength(1);
      expect(actions[0].id).toBe('xquery.uncomment.lines');
      expect(actions[0].label).toBe('Uncomment Lines');
    });

    it('should handle cancellation token', () => {
      const mockToken = { isCancellationRequested: true };
      const actions = provider.provideCommentActions(mockModel, mockRange, mockToken);

      expect(actions).toEqual([]);
    });

    it('should execute line comment action', () => {
      const mockToken = { isCancellationRequested: false };
      const actions = provider.provideCommentActions(mockModel, mockRange, mockToken);

      // Execute the line comment action
      actions[0].run();

      expect(mockModel.pushEditOperations).toHaveBeenCalledWith(
        [],
        [{
          range: {
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: 1,
            endColumn: 12
          },
          text: '(: let $x := 1 :)'
        }],
        expect.any(Function)
      );
    });

    it('should execute block comment action', () => {
      const mockToken = { isCancellationRequested: false };
      const actions = provider.provideCommentActions(mockModel, mockRange, mockToken);

      // Execute the block comment action
      actions[1].run();

      expect(mockModel.pushEditOperations).toHaveBeenCalledWith(
        [],
        [{
          range: mockRange,
          text: '(: let $x := 1 :)'
        }],
        expect.any(Function)
      );
    });
  });

  describe('createXQueryCommentActions helper', () => {
    it('should create comment actions using the helper function', () => {
      mockModel.getValueInRange.mockReturnValue('let $x := 1');
      const selection = { startLineNumber: 1, endLineNumber: 1 };
      const actions = createXQueryCommentActions(mockModel, selection);

      expect(actions).toBeInstanceOf(Array);
    });

    it('should handle models without getValueInRange', () => {
      const badModel = {};
      const selection = { startLineNumber: 1, endLineNumber: 1 };
      const actions = createXQueryCommentActions(badModel, selection);

      expect(actions).toEqual([]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle malformed comment markers', () => {
      expect(provider.isLineCommented('(:')).toBe(false);
      expect(provider.isLineCommented(':)')).toBe(false);
      expect(provider.isLineCommented('(::')).toBe(false);
    });

    it('should handle nested comment markers in content', () => {
      const line = '(: This has (: nested :) markers :)';
      expect(provider.isLineCommented(line)).toBe(true);
      const uncommented = provider.uncommentLine(line);
      expect(uncommented).toBe('This has (: nested :) markers');
    });

    it('should handle special XQuery operators in comments', () => {
      const line = '(: $x := fn:count($items) :)';
      expect(provider.isLineCommented(line)).toBe(true);
      const uncommented = provider.uncommentLine(line);
      expect(uncommented).toBe('$x := fn:count($items)');
    });
  });
});