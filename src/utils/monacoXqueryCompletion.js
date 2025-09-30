import { VariableExtractor } from './xquery-parser/VariableExtractor';

// Cache extractor instance (lightweight, no heavy parser loading needed)
let extractorInstance = null;

function getExtractor() {
  if (!extractorInstance) {
    extractorInstance = new VariableExtractor();
  }
  return extractorInstance;
}

// Cache parse results per document (invalidate on edit)
const parseCache = new WeakMap();

/**
 * Register XQuery variable completion provider for Monaco
 * @param {monaco} monaco - Monaco editor instance
 * @param {string} languageId - Language ID (e.g., 'xquery-ml')
 */
export async function registerXQueryCompletionProvider(monaco, languageId) {
  monaco.languages.registerCompletionItemProvider(languageId, {
    triggerCharacters: ['$'],

    provideCompletionItems: async (model, position, context, token) => {
      try {
        // Get extractor instance (lightweight, no async loading needed)
        const extractor = getExtractor();

        // Get or parse document
        let parseResult = parseCache.get(model);
        if (!parseResult) {
          const code = model.getValue();
          parseResult = extractor.extract(code);
          parseCache.set(model, parseResult);
        }

        // Debug logging - moved outside cache guard to always show
        console.log('[XQuery Completion] Code being parsed:', model.getValue());
        console.log('[XQuery Completion] Parsed variables:', JSON.stringify(parseResult.variables, null, 2));
        console.log('[XQuery Completion] Parse errors:', JSON.stringify(parseResult.errors, null, 2));
        if (parseResult.errors.length > 0) {
          console.error('[XQuery Completion] First parse error:', JSON.stringify(parseResult.errors[0], null, 2));
        }

        // Filter variables accessible at cursor position (column-aware)
        const cursorLine = position.lineNumber;
        const cursorColumn = position.column;

        const suggestions = parseResult.variables
          .filter(v => {
            // Variable must be declared before cursor
            if (v.line < cursorLine) return true;
            if (v.line === cursorLine && v.column < cursorColumn) return true;
            return false;
          })
          .map(v => ({
            label: v.name,
            kind: monaco.languages.CompletionItemKind.Variable,
            insertText: v.name,
            detail: `let variable (line ${v.line})`,
            sortText: `0_${v.name}` // Sort variables before keywords
          }));

        // Debug logging
        console.log('[XQuery Completion] Cursor:', JSON.stringify({ line: cursorLine, column: cursorColumn }));
        console.log('[XQuery Completion] Filtered suggestions:', JSON.stringify(suggestions, null, 2));

        return {
          suggestions,
          dispose: () => {}
        };
      } catch (error) {
        console.error('[XQuery Completion] Fatal error:', error);
        return { suggestions: [], dispose: () => {} };
      }
    }
  });

  // Invalidate cache on document changes - attach to existing models
  const attachCacheInvalidation = (model) => {
    model.onDidChangeContent(() => {
      parseCache.delete(model);
    });
  };

  // Hook up existing models
  monaco.editor.getModels().forEach(attachCacheInvalidation);

  // Hook up future models
  monaco.editor.onDidCreateModel(attachCacheInvalidation);
}