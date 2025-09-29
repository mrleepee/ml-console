# Phase 2: Enhanced XQuery Syntax Implementation Plan

## Overview
Phase 2 builds on the secure foundation of Phase 1 to implement advanced XQuery syntax highlighting and Monaco Editor integration features.

## Timeline: 3 Weeks (Revised from 2 weeks based on codex complexity analysis)

## Critical Dependencies
- ✅ Phase 1 completion with 100% test coverage
- ✅ Security vulnerabilities resolved (query injection, TLS, credentials)
- ✅ Multi-instance Monaco architecture established

## Week 1: XML/HTML Embedding Foundation

### 1.1 XML Context-Aware Tokenizer
**Objective**: Implement Monaco Monarch state transitions for embedded XML within XQuery

**Technical Implementation**:
```javascript
// Monarch tokenizer states for XML embedding
tokenizer: {
  root: [
    // Existing XQuery rules...
    [/<(?!\/|\s)/, { token: 'delimiter.angle', next: '@xml_tag' }],
    [/<\//, { token: 'delimiter.angle', next: '@xml_end_tag' }],
  ],
  xml_tag: [
    [/[a-zA-Z][\w-]*/, 'tag'],
    [/\s*=\s*/, 'delimiter'],
    [/"([^"]*)"/, 'attribute.value'],
    [/'([^']*)'/, 'attribute.value'],
    [/\/?>/, { token: 'delimiter.angle', next: '@pop' }],
  ],
  xml_end_tag: [
    [/[a-zA-Z][\w-]*/, 'tag'],
    [/>/, { token: 'delimiter.angle', next: '@pop' }],
  ]
}
```

**Deliverables**:
- Enhanced Monarch grammar with XML state machine
- Support for XML attributes, namespaces, and self-closing tags
- CDATA section handling: `<![CDATA[...]]>`
- Mixed content parsing (XQuery expressions within XML)

**Test Coverage**:
- Unit tests for XML tokenization in various contexts
- Integration tests with existing XQuery syntax
- Edge cases: malformed XML, nested structures

### 1.2 Performance Optimization
**Objective**: Ensure XML embedding doesn't degrade tokenizer performance

**Requirements**:
- Profile with 5-10MB XQuery files containing embedded XML
- Cap regex backtracking (avoid nested `.*` patterns)
- Benchmark against Phase 1 performance baselines

## Week 2: Enhanced FLWOR & Theme System

### 2.1 Extended FLWOR Expression Support
**Current Gap**: Basic `for`, `let`, `where`, `order by`, `return` keywords only

**Enhanced Coverage**:
```xquery
(: Currently supported :)
for $x in collection()
let $y := $x/title
where $y contains text "search"
order by $y
return $x

(: Phase 2 additions :)
for $x at $pos in collection()
let $y := $x/title
where $y contains text "search"
group by $category := $x/category
count $total
window $w start at $s when true
order by $y ascending empty least
return element result { $x, $total }
```

**Implementation**:
- Add `at`, `group by`, `count`, `window` clause detection
- Sequence type annotations: `as element(node)?`, `as xs:string*`
- Variable binding operators: `let ... :=` variations
- Enhanced FLWOR expression nesting recognition

### 2.2 Automated Theme Integration System
**Critical Issue**: Manual testing across 54 Monaco themes won't scale

**Solution Architecture**:
```javascript
// Theme validation automation
export const validateThemeCompatibility = async (themeName) => {
  const theme = await loadThemeJSON(themeName);
  const tokenTests = generateTokenColorAssertions(theme);
  return runThemeValidation(tokenTests);
};

// Automated regression testing
export const runThemeRegressionSuite = async () => {
  const themes = await getAllMonacoThemes(); // 54 themes
  const results = await Promise.all(
    themes.map(theme => validateThemeCompatibility(theme.name))
  );
  return generateThemeCompatibilityReport(results);
};
```

**Deliverables**:
- Programmatic theme JSON loading system
- Automated color extraction and validation
- Playwright-based screenshot regression tests
- Theme compatibility matrix dashboard

### 2.3 Asset Management Fix
**Critical Issue**: Theme files in `config/` won't be accessible after Electron packaging

**Solution**:
- Move theme JSONs from `config/monaco-themes/` to `public/monaco-themes/`
- Update `themeLoader.js` to use proper public asset paths
- Ensure Vite copies theme assets to `dist/` during build

## Week 3: Code Folding & Performance Validation

### 3.1 Custom Folding Rules Implementation
**Current Limitation**: Monaco's default indentation-based folding misses XQuery constructs

**Enhanced Folding Strategy**:
```javascript
// Custom folding rules for XQuery constructs
foldingRules: {
  markers: {
    start: /^declare\s+function|^element\s*\{|^\s*\(:/,
    end: /^\}\s*;?$|^\s*:\)/
  }
}
```

**Folding Support**:
- Function declarations: `declare function ... { ... }`
- Element constructors: `element name { content }`
- XML blocks with proper tag matching
- XQuery comment blocks: `(: ... :)`
- FLWOR expression blocks
- Nested pragma and option declarations

### 3.2 Comment Toggling (Ctrl+/)
**Implementation**: Monaco language service integration
- Single line: `(: comment :)`
- Multi-line block comment support
- Preserve existing comment nesting behavior

### 3.3 Performance Validation & Benchmarking
**Requirements**:
- Large file performance: Test with 5-10MB XQuery documents
- Memory usage profiling: Maintain <50MB for complete function library
- Tokenization speed: Measure impact of XML embedding and FLWOR enhancements
- Theme switching performance: Validate 54-theme compatibility doesn't slow editor

**Automated Performance Gates**:
- Tokenization must complete within 2 seconds for 10MB files
- Memory usage must not exceed Phase 1 baselines by >20%
- Theme switching must complete within 500ms

## Implementation Strategy

### Development Workflow
1. **Feature Branch per Week**: `feature/xml-embedding`, `feature/flwor-themes`, `feature/folding-performance`
2. **Codex Review Checkpoints**: After each major component completion
3. **Continuous Integration**: Tests must pass before merge
4. **Performance Monitoring**: Automated benchmarking on every commit

### Risk Mitigation
- **Scope Flexibility**: XML embedding can be isolated if timeline pressure
- **Fallback Mechanisms**: Graceful degradation when themes lack token mappings
- **Parallel Development**: Theme automation runs independently of tokenizer work
- **Performance Circuit Breakers**: Mandatory optimization if benchmarks fail

### Quality Gates
1. **Zero Critical Codex Findings**: All reviews must pass before proceeding
2. **100% Test Coverage**: Maintain coverage on all new components
3. **Theme Compatibility**: All 54 Monaco themes must render XQuery correctly
4. **Performance Benchmarks**: Must meet or exceed Phase 1 performance

## Technical Architecture

### Enhanced Monarch Grammar Structure
```javascript
export const enhancedXQueryMonarch = {
  defaultToken: '',
  tokenizer: {
    root: [
      // Phase 1: Basic XQuery + MarkLogic
      // Phase 2: XML embedding, enhanced FLWOR
    ],
    // New states for Phase 2
    xml_context: [...],
    flwor_expression: [...],
    sequence_type: [...],
    xml_attribute: [...]
  },
  // Enhanced folding and comment rules
  foldingRules: {...},
  comments: { blockComment: ['(:', ':)'] }
};
```

### Theme Integration Architecture
```javascript
// Centralized theme management
export class XQueryThemeManager {
  async loadTheme(themeName) { /* Load from public/ */ }
  async validateTokens(theme) { /* Automated validation */ }
  async generateReport() { /* Compatibility matrix */ }
}
```

## Success Metrics

### Functional Requirements
- ✅ XML/HTML embedding with proper syntax highlighting
- ✅ Complete FLWOR expression support (group by, count, window, etc.)
- ✅ All 54 Monaco themes compatible with XQuery tokens
- ✅ Code folding for functions, XML blocks, comments
- ✅ Comment toggling with Ctrl+/

### Performance Requirements
- ✅ <2s tokenization for 10MB XQuery files
- ✅ <50MB memory usage for complete system
- ✅ <500ms theme switching time
- ✅ Zero performance regression vs Phase 1

### Quality Requirements
- ✅ 100% statement coverage on new components
- ✅ Zero critical security issues
- ✅ Zero critical codex findings
- ✅ Comprehensive automated test suite

## Phase 3 Preparation
Phase 2 completion enables:
- Language Server Protocol integration
- Server-side function completion (1000+ MarkLogic functions)
- Hover documentation and parameter hints
- Advanced refactoring capabilities

---

**Next Steps**: Begin Week 1 implementation with XML/HTML embedding tokenizer foundation.