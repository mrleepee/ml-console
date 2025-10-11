export class XQueryFoldingProvider {
  constructor() {
    this.displayName = 'XQuery Folding';
  }

  provideFoldingRanges(model, context, token) {
    const ranges = [];
    const text = model.getValue();
    const lines = text.split('\n');

    // Stack to track nested structures
    const stack = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      if (token.isCancellationRequested) {
        return ranges;
      }

      // XQuery comments: (: ... :)
      const commentStartMatch = line.match(/\(\:/);
      if (commentStartMatch && !this.isInString(line, commentStartMatch.index)) {
        const commentStart = { line: i + 1, type: 'comment', indent: line.search(/\S/) };

        // Look for comment end on same line
        const sameLineEndMatch = line.substring(commentStartMatch.index + 2).match(/\:\)/);
        if (!sameLineEndMatch) {
          stack.push(commentStart);
        }
        continue;
      }

      const commentEndMatch = line.match(/\:\)/);
      if (commentEndMatch && !this.isInString(line, commentEndMatch.index)) {
        const lastComment = this.findLastOfType(stack, 'comment');
        if (lastComment) {
          ranges.push({
            start: lastComment.line,
            end: i + 1,
            kind: 1 // FoldingRangeKind.Comment
          });
          this.removeFromStack(stack, lastComment);
        }
        continue;
      }

      // FLWOR expressions - detect start of major clauses
      if (this.isFLWORStart(trimmedLine)) {
        const currentIndent = line.search(/\S/);
        const lastFLWOR = this.findLastFLWOR(stack);

        // Push if: no existing FLWOR, or this is at a different indent level
        // Same indent means it's a continuation clause (let after for), so don't push
        if (!lastFLWOR || currentIndent > lastFLWOR.indent || currentIndent < lastFLWOR.indent) {
          const flworStart = {
            line: i + 1,
            type: 'flwor',
            indent: currentIndent,
            keyword: this.getFLWORKeyword(trimmedLine)
          };
          stack.push(flworStart);
        }
        // Don't continue - let braces on same line be processed
      }

      // FLWOR return clause ends the expression
      if (this.isReturnClause(trimmedLine)) {
        const currentIndent = line.search(/\S/);
        // Find the matching FLWOR start with same indentation
        const flworStart = this.findLastFLWOR(stack);
        if (flworStart && i + 1 > flworStart.line && currentIndent === flworStart.indent) {
          // Look ahead to find the end of the return expression
          const returnEnd = this.findReturnEnd(lines, i);
          if (returnEnd >= i) {
            ranges.push({
              start: flworStart.line,
              end: returnEnd + 1,
              kind: 0 // FoldingRangeKind.Region
            });
            this.removeFromStack(stack, flworStart);
          }
        }
        // Don't continue - let braces on same line be processed
      }

      // Curly braces { }
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (!this.isInString(line, j)) {
          if (char === '{') {
            stack.push({
              line: i + 1,
              type: 'brace',
              indent: line.search(/\S/)
            });
          } else if (char === '}') {
            const lastBrace = this.findLastOfType(stack, 'brace');
            if (lastBrace) {
              // Only create fold if braces span multiple lines
              if (i + 1 > lastBrace.line) {
                ranges.push({
                  start: lastBrace.line,
                  end: i + 1,
                  kind: 0 // FoldingRangeKind.Region
                });
              }
              // Always remove matched brace from stack
              this.removeFromStack(stack, lastBrace);
            }
          }
        }
      }

      // XML elements
      const xmlStartMatch = trimmedLine.match(/^<([a-zA-Z_][\w\-]*:?[a-zA-Z_][\w\-]*)[^>]*>$/);
      if (xmlStartMatch && !trimmedLine.includes('</')) {
        const tagName = xmlStartMatch[1];
        stack.push({
          line: i + 1,
          type: 'xml',
          tagName: tagName,
          indent: line.search(/\S/)
        });
        // XML tags are entire lines, so continue is appropriate
        continue;
      }

      const xmlEndMatch = trimmedLine.match(/^<\/([a-zA-Z_][\w\-]*:?[a-zA-Z_][\w\-]*)\s*>$/);
      if (xmlEndMatch) {
        const tagName = xmlEndMatch[1];
        const matchingStart = this.findLastXMLTag(stack, tagName);
        if (matchingStart && i > matchingStart.line - 1) {
          ranges.push({
            start: matchingStart.line,
            end: i + 1,
            kind: 0 // FoldingRangeKind.Region
          });
          this.removeFromStack(stack, matchingStart);
        }
        // XML tags are entire lines, so continue is appropriate
        continue;
      }

      // Function definitions - handled by brace folding
      // Function fold regions are created by the curly brace logic
      // which provides sufficient folding for function bodies
    }

    // Sort ranges by start line, then by end line (descending) for consistent ordering
    return ranges.sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start;
      return b.end - a.end; // Longer ranges first when starting at same line
    });
  }

  isInString(line, index) {
    const beforeIndex = line.substring(0, index);
    const doubleQuotes = (beforeIndex.match(/"/g) || []).length;
    const singleQuotes = (beforeIndex.match(/'/g) || []).length;
    return (doubleQuotes % 2 === 1) || (singleQuotes % 2 === 1);
  }

  isFLWORStart(line) {
    return /^(for|let)\s+/.test(line);
  }

  isReturnClause(line) {
    return /^return(\s+|$)/.test(line);
  }

  getFLWORKeyword(line) {
    const match = line.match(/^(for|let|where|order\s+by|group\s+by|return)/);
    return match ? match[1] : null;
  }

  findLastFLWOR(stack) {
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i].type === 'flwor') {
        return stack[i];
      }
    }
    return null;
  }

  findReturnEnd(lines, startLine) {
    let braceCount = 0;
    let parenCount = 0;
    const returnIndent = lines[startLine].search(/\S/);

    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      const currentIndent = line.search(/\S/);

      // Count braces and parentheses to determine expression boundaries
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (!this.isInString(line, j)) {
          if (char === '{') braceCount++;
          else if (char === '}') braceCount--;
          else if (char === '(') parenCount++;
          else if (char === ')') parenCount--;
        }
      }

      // End of return expression when we're back to balanced braces and find:
      // - a semicolon or closing brace at end of line
      // - OR a new major construct at same or lesser indentation (not nested inside return)
      if (braceCount === 0 && parenCount === 0) {
        if (trimmedLine.endsWith(';') || trimmedLine.endsWith('}')) {
          return i;
        }
        // Only treat for/let/declare/xquery as end markers if at same or lesser indentation
        if (i > startLine && currentIndent <= returnIndent &&
            /^(for|let|declare|xquery)\s+/.test(trimmedLine)) {
          return i - 1; // Previous line is the end
        }
      }
    }

    // If we reach EOF with balanced braces/parens, treat EOF as the end of the expression
    if (braceCount === 0 && parenCount === 0) {
      return lines.length - 1;
    }

    // Unbalanced delimiters at EOF - invalid fold
    return startLine;
  }

  findLastOfType(stack, type) {
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i].type === type) {
        return stack[i];
      }
    }
    return null;
  }

  findLastXMLTag(stack, tagName) {
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i].type === 'xml' && stack[i].tagName === tagName) {
        return stack[i];
      }
    }
    return null;
  }

  removeFromStack(stack, item) {
    const index = stack.indexOf(item);
    if (index > -1) {
      stack.splice(index, 1);
    }
  }

  getCommonIndent(lines) {
    let minIndent = Infinity;
    for (const line of lines) {
      if (line.trim().length === 0) continue; // Skip empty lines
      const indent = line.search(/\S/);
      if (indent !== -1 && indent < minIndent) {
        minIndent = indent;
      }
    }
    return minIndent === Infinity ? 0 : minIndent;
  }
}