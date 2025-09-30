import { VariableExtractor } from './xquery-parser/VariableExtractor';

// Cache extractor instance
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
 * Check if a function is accessible at the given cursor position.
 * Functions must be declared before the cursor (no forward references in XQuery).
 *
 * @param {Object} func - Function with line, column
 * @param {number} cursorLine - Current cursor line
 * @param {number} cursorColumn - Current cursor column
 * @returns {boolean} - True if function is accessible
 */
function isFunctionAccessible(func, cursorLine, cursorColumn) {
  // Function must be declared before cursor position
  if (func.line > cursorLine) return false;
  if (func.line === cursorLine && func.column >= cursorColumn) return false;

  return true;
}

/**
 * Filter functions to only include local: namespace functions.
 * This excludes built-in functions (fn:, xs:, etc.) and imported functions.
 *
 * @param {Array} functions - All extracted functions
 * @returns {Array} - Only local: prefixed functions
 */
function filterLocalFunctions(functions) {
  return functions.filter(f =>
    f.name.startsWith('local:')
  );
}

/**
 * Create completion item for a function.
 *
 * @param {Object} func - Function object with name, params, returnType, signature
 * @param {Object} monaco - Monaco editor instance
 * @returns {Object} - Monaco completion item
 */
function createFunctionCompletionItem(func, monaco) {
  // For 0-arity functions, just insert function()
  // For functions with params, insert function() and position cursor inside
  let insertText;
  let command = null;

  if (func.params.length === 0) {
    // No parameters - insert function() with cursor after
    insertText = `${func.name}()$0`;
  } else {
    // Has parameters - insert function() with cursor inside, then trigger completion
    insertText = `${func.name}($0)`;

    // Auto-trigger completion after insertion to suggest variables/functions
    command = {
      id: 'editor.action.triggerSuggest',
      title: 'Trigger Suggest'
    };
  }

  // Build detail text with parameter info
  const details = [];
  if (func.params.length > 0) {
    const paramDetails = func.params
      .map(p => p.type ? `${p.name} as ${p.type}` : p.name)
      .join(', ');
    details.push(`(${paramDetails})`);
  }
  if (func.returnType) {
    details.push(`returns ${func.returnType}`);
  }
  details.push(`• line ${func.line}`);

  return {
    label: func.name,
    kind: monaco.languages.CompletionItemKind.Function,
    insertText: insertText,
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    detail: details.join(' '),
    documentation: {
      value: `\`\`\`xquery\n${func.signature}\n\`\`\``
    },
    command: command,
    sortText: `1_${func.name}` // Sort after variables (0_) but before keywords
  };
}

/**
 * Register XQuery function completion provider for Monaco
 * @param {monaco} monaco - Monaco editor instance
 * @param {string} languageId - Language ID (e.g., 'xquery-ml')
 */
export async function registerXQueryFunctionCompletionProvider(monaco, languageId) {
  monaco.languages.registerCompletionItemProvider(languageId, {
    // Trigger on typing function name prefix (local:)
    triggerCharacters: [':'],

    provideCompletionItems: async (model, position, context, token) => {
      try {
        // Get extractor instance
        const extractor = getExtractor();

        // Get or parse document
        let parseResult = parseCache.get(model);
        if (!parseResult) {
          const code = model.getValue();
          parseResult = extractor.extract(code);
          parseCache.set(model, parseResult);
        }

        // Debug logging
        console.log('[XQuery Function Completion] Functions found:', parseResult.functions.length);
        if (parseResult.errors.length > 0) {
          console.warn('[XQuery Function Completion] Parse errors:', parseResult.errors.length);
        }

        const cursorLine = position.lineNumber;
        const cursorColumn = position.column;

        // Step 1: Filter to local: functions only
        const localFunctions = filterLocalFunctions(parseResult.functions);

        console.log('[XQuery Function Completion] Local functions:', localFunctions.length);

        // Step 2: Filter by accessibility (declared before cursor)
        const accessibleFuncs = localFunctions.filter(f =>
          isFunctionAccessible(f, cursorLine, cursorColumn)
        );

        console.log('[XQuery Function Completion] Accessible functions:', accessibleFuncs.length);

        // Step 3: Check if we're completing after "local:"
        const lineText = model.getLineContent(position.lineNumber);
        const textBeforeCursor = lineText.substring(0, position.column - 1);

        // Only suggest if typing after "local:"
        if (!textBeforeCursor.endsWith('local:')) {
          return { suggestions: [], incomplete: false };
        }

        // Step 4: Create completion suggestions
        const suggestions = accessibleFuncs.map(f =>
          createFunctionCompletionItem(f, monaco)
        );

        // Log completion results for debugging
        if (suggestions.length === 0) {
          console.log('[XQuery Function Completion] No functions to suggest at this position');
        } else {
          console.log('[XQuery Function Completion] Suggesting:', suggestions.map(s => s.label).join(', '));
        }

        return {
          suggestions,
          incomplete: false
        };
      } catch (error) {
        console.error('[XQuery Function Completion] Fatal error:', error);
        return { suggestions: [], incomplete: false };
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