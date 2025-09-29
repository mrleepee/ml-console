export class XQueryCommentProvider {
  constructor() {
    this.displayName = 'XQuery Comment Toggle';
  }

  provideCommentActions(model, range, token) {
    const text = model.getValueInRange(range);
    const lines = text.split('\n');

    if (token.isCancellationRequested) {
      return [];
    }

    // Check if all lines are commented
    const allCommented = lines.every(line => this.isLineCommented(line));

    if (allCommented) {
      return this.createUncommentActions(model, range, lines);
    } else {
      return this.createCommentActions(model, range, lines);
    }
  }

  isLineCommented(line) {
    const trimmed = line.trim();
    return trimmed.startsWith('(:') && trimmed.endsWith(':)');
  }

  createCommentActions(model, range, lines) {
    const actions = [];

    // Single line comment action
    if (range.startLineNumber === range.endLineNumber) {
      actions.push({
        id: 'xquery.comment.line',
        label: 'Toggle Line Comment',
        run: () => {
          const line = model.getLineContent(range.startLineNumber);
          const trimmed = line.trim();

          if (this.isLineCommented(line)) {
            // Uncomment
            const uncommented = this.uncommentLine(line);
            this.replaceLineContent(model, range.startLineNumber, uncommented);
          } else {
            // Comment
            const commented = this.commentLine(line);
            this.replaceLineContent(model, range.startLineNumber, commented);
          }
        }
      });
    }

    // Block comment action
    actions.push({
      id: 'xquery.comment.block',
      label: 'Toggle Block Comment',
      run: () => {
        const selection = model.getValueInRange(range);

        if (this.isBlockCommented(selection)) {
          // Remove block comment
          const uncommented = this.removeBlockComment(selection);
          model.pushEditOperations([], [{
            range: range,
            text: uncommented
          }], () => null);
        } else {
          // Add block comment
          const commented = this.addBlockComment(selection);
          model.pushEditOperations([], [{
            range: range,
            text: commented
          }], () => null);
        }
      }
    });

    return actions;
  }

  createUncommentActions(model, range, lines) {
    return [{
      id: 'xquery.uncomment.lines',
      label: 'Uncomment Lines',
      run: () => {
        const edits = [];

        for (let i = range.startLineNumber; i <= range.endLineNumber; i++) {
          const line = model.getLineContent(i);
          const uncommented = this.uncommentLine(line);

          edits.push({
            range: {
              startLineNumber: i,
              startColumn: 1,
              endLineNumber: i,
              endColumn: model.getLineMaxColumn(i)
            },
            text: uncommented
          });
        }

        model.pushEditOperations([], edits, () => null);
      }
    }];
  }

  commentLine(line) {
    const trimmed = line.trim();
    if (trimmed === '') return line;

    const leadingWhitespace = line.match(/^\s*/)[0];
    return `${leadingWhitespace}(: ${trimmed} :)`;
  }

  uncommentLine(line) {
    const trimmed = line.trim();

    if (trimmed.startsWith('(:') && trimmed.endsWith(':)')) {
      // Remove comment markers and trim inner content
      let content = trimmed.slice(2, -2).trim();
      const leadingWhitespace = line.match(/^\s*/)[0];
      return `${leadingWhitespace}${content}`;
    }

    return line;
  }

  isBlockCommented(text) {
    const trimmed = text.trim();
    return trimmed.startsWith('(:') && trimmed.endsWith(':)');
  }

  addBlockComment(text) {
    // Don't double-comment
    if (this.isBlockCommented(text)) {
      return text;
    }

    // Handle multiline selections
    const lines = text.split('\n');
    if (lines.length > 1) {
      return `(:\n${text}\n:)`;
    } else {
      return `(: ${text.trim()} :)`;
    }
  }

  removeBlockComment(text) {
    const trimmed = text.trim();

    if (trimmed.startsWith('(:') && trimmed.endsWith(':)')) {
      let content = trimmed.slice(2, -2);

      // Handle multiline comments with proper indentation
      if (content.includes('\n')) {
        const lines = content.split('\n');
        // Remove empty first and last lines if they exist
        if (lines[0].trim() === '') lines.shift();
        if (lines[lines.length - 1].trim() === '') lines.pop();

        // Remove common leading whitespace
        const commonIndent = this.getCommonIndent(lines);
        return lines.map(line => line.substring(commonIndent)).join('\n');
      } else {
        return content.trim();
      }
    }

    return text;
  }

  getCommonIndent(lines) {
    const nonEmptyLines = lines.filter(line => line.trim() !== '');
    if (nonEmptyLines.length === 0) return 0;

    let minIndent = Infinity;
    for (const line of nonEmptyLines) {
      const indent = line.search(/\S/);
      if (indent !== -1) {
        minIndent = Math.min(minIndent, indent);
      }
    }

    return minIndent === Infinity ? 0 : minIndent;
  }

  replaceLineContent(model, lineNumber, newContent) {
    const range = {
      startLineNumber: lineNumber,
      startColumn: 1,
      endLineNumber: lineNumber,
      endColumn: model.getLineMaxColumn(lineNumber)
    };

    model.pushEditOperations([], [{
      range: range,
      text: newContent
    }], () => null);
  }
}

export const createXQueryCommentActions = (model, selection) => {
  const provider = new XQueryCommentProvider();
  const mockToken = { isCancellationRequested: false };

  // Ensure model returns proper value
  if (!model.getValueInRange) {
    return [];
  }

  return provider.provideCommentActions(model, selection, mockToken);
};