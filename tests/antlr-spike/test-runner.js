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

// Custom listener to extract variables
class VariableExtractorListener extends XQueryParserListener {
  constructor() {
    super();
    this.variables = [];
    this.functions = [];
    this.imports = [];
  }

  // Extract let binding variables
  enterLetBinding(ctx) {
    try {
      if (ctx.varName) {
        this.variables.push({
          type: 'let',
          name: '$' + ctx.varName().getText(),
          line: ctx.start.line,
          column: ctx.start.column
        });
      }
    } catch (e) {
      // Skip problematic bindings
    }
  }

  // Extract for binding variables
  enterForBinding(ctx) {
    try {
      if (ctx.name) {
        this.variables.push({
          type: 'for',
          name: '$' + ctx.name.getText(),
          line: ctx.start.line,
          column: ctx.start.column
        });
      }
    } catch (e) {
      // Skip problematic bindings
    }
  }

  // Extract function declarations
  enterFunctionDecl(ctx) {
    const funcName = ctx.eqName ? ctx.eqName().getText() : 'unknown';
    const params = [];

    if (ctx.paramList && ctx.paramList().param) {
      const paramList = Array.isArray(ctx.paramList().param()) ? ctx.paramList().param() : [ctx.paramList().param()];
      for (const param of paramList) {
        if (param.varName) {
          const paramName = '$' + param.varName().getText();
          params.push(paramName);
          this.variables.push({
            type: 'function-param',
            name: paramName,
            function: funcName,
            line: param.start.line,
            column: param.start.column
          });
        }
      }
    }

    this.functions.push({
      name: funcName,
      params: params,
      line: ctx.start.line,
      column: ctx.start.column
    });
  }

  // Extract module imports
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

    // Extract variables using listener
    const listener = new VariableExtractorListener();
    antlr4.tree.ParseTreeWalker.DEFAULT.walk(listener, tree);

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
        imports: listener.imports.length
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
    console.log(`  Functions: ${result.stats.functions}`);
    console.log(`  Imports: ${result.stats.imports}`);

    if (listener.variables.length > 0) {
      console.log(`\nVariable Details:`);
      listener.variables.forEach(v => {
        console.log(`  ${v.name} (${v.type}) at line ${v.line}`);
      });
    }

    if (listener.functions.length > 0) {
      console.log(`\nFunction Details:`);
      listener.functions.forEach(f => {
        console.log(`  ${f.name}(${f.params.join(', ')}) at line ${f.line}`);
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
  console.log('ANTLR XQuery Parser JavaScript Spike');
  console.log('=====================================\n');

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

  console.log(`\nExtracted Data (all files):`);
  console.log(`  Variables: ${totalVars}`);
  console.log(`  Functions: ${totalFuncs}`);
  console.log(`  Imports: ${totalImports}`);

  const avgParseTime = results.reduce((sum, r) => sum + parseFloat(r.parseTime), 0) / results.length;
  console.log(`\nPerformance:`);
  console.log(`  Average parse time: ${avgParseTime.toFixed(2)}ms`);
  console.log(`  Max parse time: ${Math.max(...results.map(r => parseFloat(r.parseTime))).toFixed(2)}ms`);
  console.log(`  Min parse time: ${Math.min(...results.map(r => parseFloat(r.parseTime))).toFixed(2)}ms`);

  // Write performance summary
  const perfPath = path.join(resultsDir, 'performance.json');
  fs.writeFileSync(perfPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {
      totalFiles: results.length,
      successful,
      failed,
      totalVariables: totalVars,
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

  // Bundle size analysis
  const parserSize = fs.statSync(path.join(__dirname, 'generated/XQueryParser.js')).size;
  const lexerSize = fs.statSync(path.join(__dirname, 'generated/XQueryLexer.js')).size;
  const listenerSize = fs.statSync(path.join(__dirname, 'generated/XQueryParserListener.js')).size;
  const totalSize = parserSize + lexerSize + listenerSize;

  console.log(`\nBundle Size Analysis:`);
  console.log(`  XQueryParser.js: ${(parserSize / 1024).toFixed(2)}KB`);
  console.log(`  XQueryLexer.js: ${(lexerSize / 1024).toFixed(2)}KB`);
  console.log(`  XQueryParserListener.js: ${(listenerSize / 1024).toFixed(2)}KB`);
  console.log(`  Total: ${(totalSize / 1024).toFixed(2)}KB`);

  const bundleSizePath = path.join(resultsDir, 'bundle-size.txt');
  fs.writeFileSync(bundleSizePath, `ANTLR XQuery Parser Bundle Size
Generated: ${new Date().toISOString()}

XQueryParser.js: ${(parserSize / 1024).toFixed(2)}KB
XQueryLexer.js: ${(lexerSize / 1024).toFixed(2)}KB
XQueryParserListener.js: ${(listenerSize / 1024).toFixed(2)}KB
Total: ${(totalSize / 1024).toFixed(2)}KB

Assessment: ${totalSize / 1024 < 1024 ? '✅ Under 1MB - acceptable for desktop app' : '⚠️  Over 1MB - may need optimization'}
`);

  console.log(`\nSpike complete! 🚀`);
  process.exit(failed > 0 ? 1 : 0);
}

// Run
runTests();