/**
 * Simple regex-based variable extractor for let bindings.
 * Extracts variable name, line, and column for cursor-based filtering.
 *
 * This implementation uses regex instead of ANTLR parsing to avoid
 * runtime compatibility issues while still providing basic variable completion.
 */
export class VariableExtractor {
  constructor() {
    // No dependencies needed for regex-based extraction
  }

  /**
   * Extract let variables from XQuery code using regex.
   * @param {string} code - XQuery source code
   * @returns {{ variables: Array<{name: string, line: number, column: number}>, errors: Array }}
   */
  extract(code) {
    try {
      const variables = [];
      const errors = [];

      // Regex to match: let $varname := expression
      // Captures the variable name after $
      const letPattern = /let\s+\$([a-zA-Z_][\w-]*)\s*:=/g;

      let match;
      while ((match = letPattern.exec(code)) !== null) {
        const varName = '$' + match[1];
        const matchIndex = match.index;

        // Calculate line and column from match index
        const beforeMatch = code.substring(0, matchIndex);
        const lines = beforeMatch.split('\n');
        const line = lines.length;
        const column = lines[lines.length - 1].length + 1;

        variables.push({
          name: varName,
          line: line,
          column: column
        });
      }

      return {
        variables,
        errors
      };
    } catch (error) {
      return {
        variables: [],
        errors: [{ msg: error.message }]
      };
    }
  }
}