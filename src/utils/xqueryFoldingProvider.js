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
        const flworStart = {
          line: i + 1,
          type: 'flwor',
          indent: line.search(/\S/),
          keyword: this.getFLWORKeyword(trimmedLine)
        };
        stack.push(flworStart);
        continue;
      }

      // FLWOR return clause ends the expression
      if (this.isReturnClause(trimmedLine)) {
        // Find the matching FLWOR start
        const flworStart = this.findLastFLWOR(stack);
        if (flworStart && i > flworStart.line) {
          // Look ahead to find the end of the return expression
          const returnEnd = this.findReturnEnd(lines, i);
          if (returnEnd > i) {
            ranges.push({
              start: flworStart.line,
              end: returnEnd + 1,
              kind: 0 // FoldingRangeKind.Region
            });
            this.removeFromStack(stack, flworStart);
          }
        }
        continue;
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
            if (lastBrace && i > lastBrace.line - 1) {
              ranges.push({
                start: lastBrace.line,
                end: i + 1,
                kind: 0 // FoldingRangeKind.Region
              });
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
        continue;
      }

      // Function definitions
      const functionMatch = trimmedLine.match(/^declare\s+function\s+[\w\-:]+\s*\(/);
      if (functionMatch) {
        stack.push({
          line: i + 1,
          type: 'function',
          indent: line.search(/\S/)
        });
        continue;
      }

      // End of function (usually marked by };)
      if (trimmedLine.match(/^\};?\s*$/) && this.findLastOfType(stack, 'function')) {
        const functionStart = this.findLastOfType(stack, 'function');
        if (functionStart && i > functionStart.line) {
          ranges.push({
            start: functionStart.line,
            end: i + 1,
            kind: 0 // FoldingRangeKind.Region
          });
          this.removeFromStack(stack, functionStart);
        }
        continue;
      }
    }

    return ranges;
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
    return /^return\s+/.test(line);
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

    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i].trim();

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

      // End of return expression when we're back to balanced braces and find a semicolon or new major construct
      if (braceCount === 0 && parenCount === 0) {
        if (line.endsWith(';') || line.endsWith('}') ||
            /^(for|let|declare|xquery)\s+/.test(line)) {
          return i;
        }
      }
    }

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
}