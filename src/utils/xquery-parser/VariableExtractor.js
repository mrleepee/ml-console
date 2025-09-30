import antlr4 from 'antlr4';
import { default as XQueryLexer } from './XQueryLexer.js';
import { default as XQueryParser } from './XQueryParser.js';
import { default as XQueryParserListener } from './XQueryParserListener.js';

/**
 * ANTLR-based scope-aware variable extractor for XQuery.
 * Extracts variables with full scope information, shadowing detection,
 * and function parameter support.
 */
class ScopeExtractionListener extends XQueryParserListener {
  constructor() {
    super();
    this.variables = [];
    this.functions = [];
    this.scopeStack = [];
    this.currentFunction = null;
  }

  // ========== SCOPE MANAGEMENT ==========

  pushScope(kind, ctx) {
    const scope = {
      kind,              // 'function' | 'flwor'
      startLine: ctx.start.line,
      endLine: null,     // Will be set in exit method
      variables: []
    };
    this.scopeStack.push(scope);
    return scope;
  }

  popScope() {
    return this.scopeStack.pop();
  }

  getCurrentScope() {
    return this.scopeStack[this.scopeStack.length - 1] || null;
  }

  // ========== FUNCTION DECLARATIONS ==========

  enterFunctionDecl(ctx) {
    const funcName = ctx.name ? ctx.name.getText() : 'unknown';

    const func = {
      name: funcName,
      params: [],
      line: ctx.start.line,
      column: ctx.start.column
    };

    this.functions.push(func);
    this.currentFunction = func;

    // Push function scope
    this.pushScope('function', ctx);
  }

  exitFunctionDecl(ctx) {
    // Set scope end line for all variables in this function
    const scope = this.getCurrentScope();
    if (scope && scope.kind === 'function') {
      const endLine = ctx.stop ? ctx.stop.line : ctx.start.line;
      scope.endLine = endLine;

      // Assign scopeEnd to all variables in this scope
      scope.variables.forEach(v => {
        v.scopeEnd = endLine;
      });
    }

    this.popScope();
    this.currentFunction = null;
  }

  // ========== FUNCTION PARAMETERS ==========

  enterFunctionParam(ctx) {
    try {
      if (ctx.name) {
        const paramName = '$' + ctx.name.getText();
        const typeDecl = ctx.type ? ctx.type.getText() : null;

        const param = {
          name: paramName,
          type: typeDecl,
          line: ctx.start.line,
          column: ctx.start.column
        };

        // Add to current function's params
        if (this.currentFunction) {
          this.currentFunction.params.push(param);
        }

        // Add to variables list with function-param type
        const variable = {
          type: 'function-param',
          name: paramName,
          line: ctx.start.line,
          column: ctx.start.column,
          scopeStart: ctx.start.line,
          scopeEnd: null,  // Will be set in exitFunctionDecl
          function: this.currentFunction ? this.currentFunction.name : null,
          typeDecl: typeDecl
        };

        this.variables.push(variable);

        // Add to current scope
        const scope = this.getCurrentScope();
        if (scope) {
          scope.variables.push(variable);
        }
      }
    } catch (e) {
      // Skip problematic params
    }
  }

  // ========== FLWOR EXPRESSIONS ==========

  enterFlworExpr(ctx) {
    this.pushScope('flwor', ctx);
  }

  exitFlworExpr(ctx) {
    const scope = this.getCurrentScope();
    if (scope && scope.kind === 'flwor') {
      // Scope ends at the end of FLWOR expression
      const endLine = ctx.stop ? ctx.stop.line : ctx.start.line;
      scope.endLine = endLine;

      // Assign scopeEnd to all variables in this scope
      scope.variables.forEach(v => {
        if (!v.scopeEnd) {
          v.scopeEnd = endLine;
        }
      });
    }

    this.popScope();
  }

  // ========== LET BINDINGS ==========

  enterLetBinding(ctx) {
    try {
      if (ctx.varName) {
        const variable = {
          type: 'let',
          name: '$' + ctx.varName().getText(),
          line: ctx.start.line,
          column: ctx.start.column,
          scopeStart: ctx.start.line,
          scopeEnd: null  // Will be set in exitFlworExpr
        };

        this.variables.push(variable);

        // Add to current scope
        const scope = this.getCurrentScope();
        if (scope) {
          scope.variables.push(variable);
        }
      }
    } catch (e) {
      // Skip problematic bindings
    }
  }

  // ========== FOR BINDINGS ==========

  enterForBinding(ctx) {
    try {
      if (ctx.name) {
        const variable = {
          type: 'for',
          name: '$' + ctx.name.getText(),
          line: ctx.start.line,
          column: ctx.start.column,
          scopeStart: ctx.start.line,
          scopeEnd: null  // Will be set in exitFlworExpr
        };

        this.variables.push(variable);

        // Add to current scope
        const scope = this.getCurrentScope();
        if (scope) {
          scope.variables.push(variable);
        }
      }
    } catch (e) {
      // Skip problematic bindings
    }
  }

  // ========== SHADOWING DETECTION (POST-PROCESS) ==========

  detectShadowing() {
    // Group variables by name
    const varsByName = new Map();

    for (const v of this.variables) {
      if (!varsByName.has(v.name)) {
        varsByName.set(v.name, []);
      }
      varsByName.get(v.name).push(v);
    }

    // For each name with multiple declarations, detect shadowing
    for (const [name, vars] of varsByName.entries()) {
      if (vars.length < 2) continue;

      // Sort by scopeStart (outermost first)
      vars.sort((a, b) => a.scopeStart - b.scopeStart);

      // Initialize shadowing fields
      vars.forEach(v => {
        v.shadows = null;
        v.shadowedBy = [];
      });

      // Check each pair for overlapping scopes
      for (let i = 0; i < vars.length; i++) {
        const outer = vars[i];

        for (let j = i + 1; j < vars.length; j++) {
          const inner = vars[j];

          // Check if inner scope is within outer scope
          if (inner.scopeStart >= outer.scopeStart &&
              inner.scopeEnd <= outer.scopeEnd) {

            // Inner variable shadows outer
            inner.shadows = outer.line;
            outer.shadowedBy.push(inner.line);
          }
        }
      }
    }
  }
}

/**
 * ANTLR-based variable extractor with scope and shadowing support.
 */
export class VariableExtractor {
  constructor() {
    // ANTLR parser loaded lazily
  }

  /**
   * Extract variables from XQuery code with full scope information.
   * @param {string} code - XQuery source code
   * @returns {{ variables: Array, functions: Array, errors: Array }}
   */
  extract(code) {
    try {
      // Create input stream
      const input = new antlr4.InputStream(code);

      // Create lexer
      const lexer = new XQueryLexer(input);
      const tokens = new antlr4.CommonTokenStream(lexer);

      // Create parser
      const parser = new XQueryParser(tokens);

      // Custom error listener
      class ErrorListener extends antlr4.error.ErrorListener {
        constructor() {
          super();
          this.errors = [];
        }
        syntaxError(recognizer, offendingSymbol, line, column, msg, e) {
          this.errors.push({ line, column, msg });
        }
      }

      const errorListener = new ErrorListener();
      parser.removeErrorListeners();
      parser.addErrorListener(errorListener);

      // Parse
      const tree = parser.module();

      // Extract variables using enhanced listener
      const listener = new ScopeExtractionListener();
      antlr4.tree.ParseTreeWalker.DEFAULT.walk(listener, tree);

      // Detect shadowing after full tree walk
      listener.detectShadowing();

      return {
        variables: listener.variables,
        functions: listener.functions,
        errors: errorListener.errors
      };
    } catch (error) {
      console.error('[VariableExtractor] Parse error:', error);
      return {
        variables: [],
        functions: [],
        errors: [{ msg: error.message }]
      };
    }
  }
}