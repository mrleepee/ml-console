# XQuery Monaco Integration Implementation Plan

## Research Summary

I've analyzed two key repositories for existing XQuery Monaco integration approaches:

### 1. MarkLogic-Sublime (Archived Repository: paxtonhare/MarkLogic-Sublime)
- **TextMate Grammar**: Comprehensive XQuery-ML syntax highlighting with 1000+ lines of YAML-tmLanguage
- **Function Library**: JSON files with MarkLogic functions for versions 7, 8, and 9 (both XQuery and JavaScript)
- **Key Assets**:
  - `xquery_language/xquery-ml.YAML-tmLanguage` - Complete syntax definition
  - `marklogic_builtins/ml-xquery-functions-9.json` - Function definitions (1MB)
- **Architecture**: Sublime Text plugin with static syntax definitions

### 2. mlxprs (Active VSCode Extension: marklogic/mlxprs)
- **TextMate Grammar**: Production-ready XQuery-ML syntax highlighting (38KB tmLanguage file)
- **Language Server**: TypeScript-based completion provider with rich IntelliSense
- **Function Documentation**: 11MB JSON file with complete MarkLogic function signatures and docs
- **Key Assets**:
  - `syntaxes/xquery-ml.tmLanguage` - Production TextMate grammar
  - `server/etc/marklogic-hint-docs.json` - Complete function library (11MB)
  - `server/completionsXqy.ts` - IntelliSense implementation
- **Architecture**: Full Language Server Protocol implementation with debugging support

## Critical Issues Identified by Codex Review

### 1. **Architecture Decision Conflict**
- **Problem**: Monaco-native approach conflicts with advanced features (variable scope, refactoring)
- **Solution**: Scale back to Monaco's native capabilities for realistic delivery

### 2. **Bundle Size & Performance**
- **Problem**: Function library would bloat initial bundle and memory usage
- **Solution**: Server-side API with on-demand fetching, not bundled JSON

### 3. **Unrealistic Timeline**
- **Problem**: 1-week phases with complex scope
- **Solution**: Extend to 2-week phases with focused deliverables

### 4. **Function Library Strategy**
- **Problem**: No evidence 11MB → 500KB compression is achievable
- **Solution**: Use server-side API approach with caching

## Revised Implementation Plan: Monaco-Native Approach (Option A)

### Phase 1: Foundation (2 weeks)
**Branch**: `feature/xquery-monaco-phase1`

#### Objectives
Basic language registration and simple syntax highlighting only

#### Week 1: Language Setup
- Register XQuery language with Monaco (`src/utils/monacoXQuery.js`)
- Basic Monarch grammar (keywords, strings, comments only)
- File extension detection in QueryEditor (`.xq`, `.xql`, `.xqm`, `.xqy`, `.xquery`)
- Configure MIME type: `application/xquery`

#### Week 2: Core Syntax
- Variables (`$variable-name`) and operators (`:=`, `=`, `!=`, etc.)
- Basic function highlighting (`namespace:function-name()`)
- Bracket matching: `{}`, `[]`, `()`, `<>`
- Auto-closing pairs including XQuery comments `(: :)`
- Integration testing with existing QueryEditor

#### Deliverables
- `src/utils/monacoXQuery.js` - Basic XQuery language definition
- Updated `src/components/QueryEditor.jsx` - XQuery language detection
- Working syntax highlighting for core XQuery constructs
- Performance baseline measurements

### Phase 2: Enhanced Syntax (2 weeks)
**Branch**: `feature/xquery-monaco-phase2`

#### Objectives
Complete syntax highlighting and theme integration

#### Week 1: Advanced Grammar
- XML/HTML embedding within XQuery (first implementation)
- Namespace prefixes and QNames
- FLWOR expressions (`for`, `let`, `where`, `order by`, `return`)
- Type annotations and sequence types

#### Week 2: Theme Integration
- XQuery token mappings for all existing Monaco themes
- Code folding for functions and XML blocks
- Comment toggling support (`Ctrl+/` for `(: :)`)
- Comprehensive theme testing across all custom themes

#### Deliverables
- Production-quality syntax highlighting with XML support
- Theme compatibility verified for all existing themes
- Code folding and editor enhancements working
- Bundle size monitoring implemented

### Phase 3: Server-Side Function API (3 weeks)
**Branch**: `feature/xquery-monaco-phase3`

#### Objectives
On-demand function completions via API (no bundled JSON)

#### Week 1: Backend API Development
- Server endpoint for MarkLogic function metadata: `/api/xquery/functions/{namespace}`
- Extract function data from mlxprs sources
- Namespace-based function lookup (fn, xdmp, cts, math, map, json)
- Response caching strategy and performance optimization

#### Week 2: Completion Provider
- Monaco completion provider implementation: `monaco.languages.registerCompletionItemProvider`
- API integration with debouncing (prevent excessive requests)
- Context-aware function suggestions
- Parameter hints with type information

#### Week 3: Documentation & Performance
- Hover documentation: `monaco.languages.registerHoverProvider`
- Signature help during function calls
- Performance profiling and optimization
- Bundle size validation (ensure no function data in bundle)

#### Deliverables
- Server API for XQuery function metadata
- Working auto-completion with server-side data
- Hover documentation and signature help
- Performance metrics within targets

### Phase 4: Polish & Optimization (2 weeks)
**Branch**: `feature/xquery-monaco-phase4`

#### Objectives
Enhanced completions and performance optimization (Monaco-native only)

#### Week 1: Enhanced Completions
- Parameter hints and snippet completions
- Variable name suggestions (basic scope within current editor)
- Namespace prefix completions
- Common XQuery pattern snippets

#### Week 2: Performance & Testing
- Lazy loading optimizations for API calls
- Memory usage optimization
- Comprehensive testing suite
- Performance benchmarks and CI integration

#### Deliverables
- Polished XQuery experience within Monaco limitations
- Complete test coverage
- Performance benchmarks meeting success criteria
- Production-ready implementation

## Technical Architecture

### File Structure
```
src/
├── utils/
│   ├── monacoXQuery.js          # Main language definition
│   ├── xqueryCompletions.js     # Completion provider with API integration
│   └── xqueryTokens.js          # Token definitions
├── api/
│   └── xquery/
│       └── functions.js         # Server-side function metadata API
└── components/
    └── QueryEditor.jsx          # Updated for XQuery support
```

### Key Technical Decisions

1. **Monaco Native Implementation**
   - Use Monaco's built-in language features (no external language server)
   - Leverage Monaco Monarch for syntax highlighting
   - Server-side API for function metadata (not bundled)

2. **Function Library Strategy**
   - Server endpoint: `/api/xquery/functions/{namespace}`
   - Extract function data from mlxprs sources during build
   - On-demand API calls with caching
   - No function data in client bundle

3. **Integration Strategy**
   - Extend existing Monaco integration in ml-console
   - Preserve all existing functionality
   - Add XQuery as additional language option
   - Document QueryEditor lifecycle integration

### Performance Considerations

- **Server-Side API**: Functions fetched on demand, not bundled
- **Caching Strategy**: Namespace-based caching with TTL
- **Efficient Tokenization**: Optimized Monarch grammar for large files
- **Debouncing**: Prevent excessive API requests
- **Bundle Monitoring**: Automated size checks in CI

## Success Metrics

1. **Functionality**
   - Complete XQuery 1.0-ml syntax highlighting
   - Auto-completion for 1000+ MarkLogic functions
   - Hover documentation and signature help
   - Error detection and quick fixes

2. **Performance**
   - Syntax highlighting responsive for files up to 10MB
   - Completion suggestions appear within 100ms
   - Memory usage under 50MB for function library

3. **Developer Experience**
   - Seamless integration with existing ml-console workflow
   - Consistent behavior across all Monaco themes
   - Intuitive auto-completion and documentation

## Dependencies & Compatibility

- **Required**: Existing Monaco integration in ml-console
- **Compatible**: All current Monaco themes and configurations
- **No Breaking Changes**: Existing functionality preserved
- **Browser Support**: Same as current Monaco implementation

## Risks & Mitigation

1. **Large Function Library**
   - Risk: Performance impact from 1000+ functions
   - Mitigation: Namespace-based lazy loading, optimized JSON structure

2. **Theme Compatibility**
   - Risk: XQuery tokens not working with custom themes
   - Mitigation: Comprehensive theme testing, fallback token mappings

3. **Complex Syntax**
   - Risk: Monaco Monarch limitations with XQuery complexity
   - Mitigation: Iterative development, fallback to simpler highlighting

## Future Enhancements

1. **Language Server Integration** (Phase 5+)
   - Real-time error checking
   - Advanced refactoring
   - Cross-file analysis

2. **Debugging Support** (Phase 6+)
   - Integration with MarkLogic debugger
   - Breakpoint support
   - Variable inspection

3. **Code Generation** (Phase 7+)
   - Template generation
   - Boilerplate code creation
   - Snippet library expansion

This implementation plan provides a comprehensive roadmap for adding world-class XQuery support to Monaco while maintaining the performance and user experience standards of ml-console.