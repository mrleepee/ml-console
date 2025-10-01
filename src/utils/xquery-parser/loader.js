/**
 * Async loader for XQuery parser modules (ANTLR).
 * Lazy loads the parser only when needed to reduce initial bundle size.
 *
 * Bundle impact: ~1.2 MB (65% of main bundle) moved to separate chunk
 */

let parserPromise = null;

/**
 * Dynamically load XQuery parser modules.
 * Loads once and caches the result for subsequent calls.
 *
 * @returns {Promise<{XQueryLexer, XQueryParser, XQueryParserListener, VariableExtractor, antlr4}>}
 */
export async function loadXQueryParser() {
  if (!parserPromise) {
    parserPromise = Promise.all([
      import('./XQueryLexer.js'),
      import('./XQueryParser.js'),
      import('./XQueryParserListener.js'),
      import('./VariableExtractor.js'),
      import('antlr4')
    ]).then(([lexer, parser, listener, extractor, antlr]) => ({
      XQueryLexer: lexer.default,
      XQueryParser: parser.default,
      XQueryParserListener: listener.default,
      VariableExtractor: extractor.VariableExtractor,
      antlr4: antlr.default
    }));
  }
  return parserPromise;
}

/**
 * Reset loader state (for testing).
 */
export function resetParserLoader() {
  parserPromise = null;
}
