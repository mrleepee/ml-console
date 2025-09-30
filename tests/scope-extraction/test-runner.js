import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import antlr4 from 'antlr4';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import generated parser
const XQueryLexer = await import('./generated/XQueryLexer.js').then(m => m.default);
const XQueryParser = await import('./generated/XQueryParser.js').then(m => m.default);
const XQueryParserListener = await import('./generated/XQueryParserListener.js').then(m => m.default);

// Enhanced listener with scope tracking
class ScopeExtractionListener extends XQueryParserListener {
  constructor() {
    super();
    this.variables = [];
    this.functions = [];
    this.imports = [];

    // Scope stack for tracking ranges
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

  // ========== RETURN CLAUSE (FLWOR scope boundary) ==========

  exitReturnClause(ctx) {
    // Return clause defines end of FLWOR scope
    const scope = this.getCurrentScope();
    if (scope && scope.kind === 'flwor') {
      const endLine = ctx.stop ? ctx.stop.line : ctx.start.line;
      if (!scope.endLine) {
        scope.endLine = endLine;
      }
    }
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

  // ========== MODULE IMPORTS ==========

  enterModuleImport(ctx) {
    try {
      const nsUri = ctx.nsURI ? ctx.nsURI.getText().replace(/['"]/g, '') : 'unknown';
      const prefix = ctx.ncName ? (Array.isArray(ctx.ncName()) ? ctx.ncName()[0].getText() : ctx.ncName().getText()) : null;

      this.imports.push({
        namespace: nsUri,
        prefix: prefix,
        line: ctx.start.line,
        column: ctx.start.column
      });
    } catch (e) {
      // Silently skip problematic imports
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
          // Inner shadows outer if: inner.scopeStart >= outer.scopeStart && inner.scopeEnd <= outer.scopeEnd
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

// Parse a single XQuery file
function parseXQueryFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const fileName = path.basename(filePath);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Parsing: ${fileName}`);
  console.log(`${'='.repeat(60)}`);

  const startTime = performance.now();
  const startMemory = process.memoryUsage().heapUsed;

  try {
    // Create input stream
    const input = new antlr4.InputStream(content);

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
        this.errors.push({ line, column, message: msg });
      }
    }

    const errorListener = new ErrorListener();
    parser.removeErrorListeners();
    parser.addErrorListener(errorListener);

    // Parse
    const tree = parser.module();
    const parseTime = performance.now() - startTime;

    // Extract variables using enhanced listener
    const listener = new ScopeExtractionListener();
    antlr4.tree.ParseTreeWalker.DEFAULT.walk(listener, tree);

    // Detect shadowing after full tree walk
    listener.detectShadowing();

    const endMemory = process.memoryUsage().heapUsed;
    const memoryDelta = endMemory - startMemory;

    // Results
    const result = {
      file: fileName,
      success: errorListener.errors.length === 0,
      parseTime: parseTime.toFixed(2) + 'ms',
      memoryUsed: (memoryDelta / 1024 / 1024).toFixed(2) + 'MB',
      errors: errorListener.errors,
      variables: listener.variables,
      functions: listener.functions,
      imports: listener.imports,
      stats: {
        totalVariables: listener.variables.length,
        letBindings: listener.variables.filter(v => v.type === 'let').length,
        forBindings: listener.variables.filter(v => v.type === 'for').length,
        functionParams: listener.variables.filter(v => v.type === 'function-param').length,
        functions: listener.functions.length,
        imports: listener.imports.length,
        variablesWithScope: listener.variables.filter(v => v.scopeEnd !== null).length,
        functionsWithParams: listener.functions.filter(f => f.params.length > 0).length,
        shadowingVars: listener.variables.filter(v => v.shadows !== null).length,
        shadowedVars: listener.variables.filter(v => v.shadowedBy && v.shadowedBy.length > 0).length
      }
    };

    // Console output
    if (result.success) {
      console.log(`✅ Parse successful: ${result.parseTime}`);
    } else {
      console.log(`❌ Parse failed with ${result.errors.length} errors`);
      result.errors.forEach(err => {
        console.log(`   Line ${err.line}:${err.column} - ${err.message}`);
      });
    }

    console.log(`\nExtracted Data:`);
    console.log(`  Variables: ${result.stats.totalVariables}`);
    console.log(`    - let bindings: ${result.stats.letBindings}`);
    console.log(`    - for bindings: ${result.stats.forBindings}`);
    console.log(`    - function params: ${result.stats.functionParams}`);
    console.log(`  Functions: ${result.stats.functions} (${result.stats.functionsWithParams} with params)`);
    console.log(`  Imports: ${result.stats.imports}`);
    console.log(`  Variables with scope: ${result.stats.variablesWithScope}/${result.stats.totalVariables}`);

    if (listener.variables.length > 0) {
      console.log(`\nVariable Details:`);
      listener.variables.forEach(v => {
        const scopeInfo = v.scopeEnd ? `scope: ${v.scopeStart}-${v.scopeEnd}` : 'scope: pending';
        const typeInfo = v.typeDecl ? ` (${v.typeDecl})` : '';
        const shadowInfo = v.shadows ? ` [shadows line ${v.shadows}]` : '';
        const shadowedInfo = v.shadowedBy && v.shadowedBy.length > 0 ? ` [shadowed by line ${v.shadowedBy.join(', ')}]` : '';
        console.log(`  ${v.name} (${v.type}) at line ${v.line}, ${scopeInfo}${typeInfo}${shadowInfo}${shadowedInfo}`);
      });
    }

    if (listener.functions.length > 0) {
      console.log(`\nFunction Details:`);
      listener.functions.forEach(f => {
        const paramList = f.params.map(p => {
          return p.type ? `${p.name}: ${p.type}` : p.name;
        }).join(', ');
        console.log(`  ${f.name}(${paramList}) at line ${f.line}`);
      });
    }

    console.log(`\nPerformance:`);
    console.log(`  Parse time: ${result.parseTime}`);
    console.log(`  Memory used: ${result.memoryUsed}`);
    console.log(`  File size: ${(content.length / 1024).toFixed(2)}KB`);

    return result;

  } catch (error) {
    const parseTime = performance.now() - startTime;
    console.log(`❌ Exception: ${error.message}`);
    console.error(error.stack);

    return {
      file: fileName,
      success: false,
      parseTime: parseTime.toFixed(2) + 'ms',
      error: error.message,
      stack: error.stack
    };
  }
}

// Main test runner
function runTests() {
  console.log('XQuery Scope Extraction - Enhanced Test Runner');
  console.log('==============================================\n');

  const fixturesDir = path.join(__dirname, 'fixtures');
  const resultsDir = path.join(__dirname, 'results');
  const astDumpsDir = path.join(resultsDir, 'ast-dumps');

  // Get all .xq files
  const fixtures = fs.readdirSync(fixturesDir)
    .filter(f => f.endsWith('.xq'))
    .map(f => path.join(fixturesDir, f));

  console.log(`Found ${fixtures.length} test fixtures\n`);

  // Parse each file
  const results = [];
  for (const fixture of fixtures) {
    const result = parseXQueryFile(fixture);
    results.push(result);

    // Write detailed AST dump
    const dumpPath = path.join(astDumpsDir, path.basename(fixture, '.xq') + '.json');
    fs.writeFileSync(dumpPath, JSON.stringify(result, null, 2));
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('SUMMARY');
  console.log(`${'='.repeat(60)}`);

  const successful = results.filter(r => r.success).length;
  const failed = results.length - successful;

  console.log(`\nParse Results:`);
  console.log(`  ✅ Successful: ${successful}/${results.length}`);
  console.log(`  ❌ Failed: ${failed}/${results.length}`);

  const totalVars = results.reduce((sum, r) => sum + (r.stats?.totalVariables || 0), 0);
  const totalFuncs = results.reduce((sum, r) => sum + (r.stats?.functions || 0), 0);
  const totalImports = results.reduce((sum, r) => sum + (r.stats?.imports || 0), 0);
  const totalFuncParams = results.reduce((sum, r) => sum + (r.stats?.functionParams || 0), 0);
  const totalWithScope = results.reduce((sum, r) => sum + (r.stats?.variablesWithScope || 0), 0);
  const totalShadowing = results.reduce((sum, r) => sum + (r.stats?.shadowingVars || 0), 0);
  const totalShadowed = results.reduce((sum, r) => sum + (r.stats?.shadowedVars || 0), 0);

  console.log(`\nExtracted Data (all files):`);
  console.log(`  Variables: ${totalVars} (${totalWithScope} with scope ranges)`);
  console.log(`    - Function params: ${totalFuncParams}`);
  console.log(`    - Shadowing: ${totalShadowing} variables shadow outer declarations`);
  console.log(`    - Shadowed: ${totalShadowed} variables are shadowed by inner declarations`);
  console.log(`  Functions: ${totalFuncs}`);
  console.log(`  Imports: ${totalImports}`);

  const avgParseTime = results.reduce((sum, r) => sum + parseFloat(r.parseTime), 0) / results.length;
  console.log(`\nPerformance:`);
  console.log(`  Average parse time: ${avgParseTime.toFixed(2)}ms`);
  console.log(`  Max parse time: ${Math.max(...results.map(r => parseFloat(r.parseTime))).toFixed(2)}ms`);
  console.log(`  Min parse time: ${Math.min(...results.map(r => parseFloat(r.parseTime))).toFixed(2)}ms`);

  // Scope coverage analysis
  const scopeCoverage = (totalWithScope / totalVars * 100).toFixed(1);
  console.log(`\nScope Tracking:`);
  console.log(`  Coverage: ${scopeCoverage}% of variables have scope ranges`);

  if (scopeCoverage < 100) {
    console.log(`  ⚠️  ${totalVars - totalWithScope} variables missing scope ranges`);
  } else {
    console.log(`  ✅ Full scope coverage achieved`);
  }

  // Write performance summary
  const perfPath = path.join(resultsDir, 'performance.json');
  fs.writeFileSync(perfPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {
      totalFiles: results.length,
      successful,
      failed,
      totalVariables: totalVars,
      variablesWithScope: totalWithScope,
      scopeCoverage: scopeCoverage + '%',
      totalFunctionParams: totalFuncParams,
      totalFunctions: totalFuncs,
      totalImports: totalImports,
      avgParseTime: avgParseTime.toFixed(2) + 'ms',
      maxParseTime: Math.max(...results.map(r => parseFloat(r.parseTime))).toFixed(2) + 'ms',
      minParseTime: Math.min(...results.map(r => parseFloat(r.parseTime))).toFixed(2) + 'ms'
    },
    results
  }, null, 2));

  console.log(`\nResults written to: ${resultsDir}/`);
  console.log(`  - performance.json (summary)`);
  console.log(`  - ast-dumps/*.json (detailed AST per file)`);

  console.log(`\nScope extraction complete! 🚀`);
  process.exit(failed > 0 ? 1 : 0);
}

// Run
runTests();