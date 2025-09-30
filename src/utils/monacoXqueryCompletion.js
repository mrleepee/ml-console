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
 * Check if a variable is accessible at the given cursor position.
 * Uses scope ranges (scopeStart/scopeEnd) for accurate filtering.
 *
 * @param {Object} variable - Variable with scopeStart, scopeEnd, line, column
 * @param {number} cursorLine - Current cursor line
 * @param {number} cursorColumn - Current cursor column
 * @returns {boolean} - True if variable is accessible
 */
function isVariableAccessible(variable, cursorLine, cursorColumn) {
  // Variable must be declared before cursor position
  if (variable.line > cursorLine) return false;
  if (variable.line === cursorLine && variable.column >= cursorColumn) return false;

  // If scope information available, check if cursor is within scope
  if (variable.scopeStart != null && variable.scopeEnd != null) {
    // Cursor must be within [scopeStart, scopeEnd]
    if (cursorLine < variable.scopeStart || cursorLine > variable.scopeEnd) {
      return false;
    }
  }

  return true;
}

/**
 * Filter out shadowed variables at the cursor position.
 * If multiple variables with same name are accessible, only show the innermost (shadowing) one.
 *
 * @param {Array} variables - All accessible variables
 * @returns {Array} - Variables with shadowed ones removed
 */
function filterShadowedVariables(variables) {
  const byName = new Map();

  for (const v of variables) {
    const existing = byName.get(v.name);

    if (!existing) {
      byName.set(v.name, v);
    } else {
      // Keep the variable with the innermost (latest) scope
      // Variables with larger scopeStart are more deeply nested
      if (v.scopeStart > existing.scopeStart) {
        byName.set(v.name, v);
      }
    }
  }

  return Array.from(byName.values());
}

/**
 * Create completion item detail text with type information and scope context.
 *
 * @param {Object} variable - Variable object
 * @returns {string} - Detail string for completion item
 */
function createCompletionDetail(variable) {
  const parts = [];

  // Variable type
  if (variable.type === 'function-param') {
    parts.push('parameter');
    if (variable.function) {
      parts.push(`in ${variable.function}`);
    }
  } else if (variable.type === 'let') {
    parts.push('let variable');
  } else if (variable.type === 'for') {
    parts.push('for variable');
  }

  // Type declaration (for function params)
  if (variable.typeDecl) {
    parts.push(`as ${variable.typeDecl}`);
  }

  // Shadowing info
  if (variable.shadows != null) {
    parts.push(`(shadows line ${variable.shadows})`);
  }

  // Line number
  if (parts.length > 0) {
    parts.push(`• line ${variable.line}`);
  }

  return parts.join(' ');
}

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
        console.log('[XQuery Completion] Variables found:', parseResult.variables.length);
        console.log('[XQuery Completion] Functions found:', parseResult.functions.length);
        if (parseResult.errors.length > 0) {
          console.warn('[XQuery Completion] Parse errors:', parseResult.errors.length);
        }

        const cursorLine = position.lineNumber;
        const cursorColumn = position.column;

        // Step 1: Filter variables by scope and position
        const accessibleVars = parseResult.variables.filter(v =>
          isVariableAccessible(v, cursorLine, cursorColumn)
        );

        console.log('[XQuery Completion] Accessible variables:', accessibleVars.length);

        // Step 2: Remove shadowed variables (keep innermost only)
        const visibleVars = filterShadowedVariables(accessibleVars);

        console.log('[XQuery Completion] Visible variables (after shadowing filter):', visibleVars.length);

        // Step 3: Create completion suggestions
        const suggestions = visibleVars.map(v => {
          const completionKind = v.type === 'function-param'
            ? monaco.languages.CompletionItemKind.Property
            : monaco.languages.CompletionItemKind.Variable;

          return {
            label: v.name,
            kind: completionKind,
            insertText: v.name,
            detail: createCompletionDetail(v),
            documentation: v.typeDecl ? `Type: ${v.typeDecl}` : undefined,
            sortText: `0_${v.name}` // Sort variables before keywords
          };
        });

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