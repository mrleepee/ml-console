# Command Palette Formatting Tools

## Overview

This document specifies the requirements for implementing comprehensive formatting tools in ML Console's Monaco Editor command palette. The formatting tools will support XML, JSON, XQuery, JavaScript, and SPARQL with intelligent language detection and consistent user experience.

## Supported Languages and Formats

### 1. XML Formatting
- **Pretty printing**: Proper indentation and line breaks
- **Attribute alignment**: Configurable single-line vs multi-line attributes
- **Self-closing tag normalization**: Consistent `<tag/>` vs `<tag></tag>` handling
- **Namespace preservation**: Maintain namespace declarations and prefixes
- **CDATA handling**: Preserve CDATA sections without formatting internal content
- **Comment preservation**: Maintain XML comments with proper formatting

### 2. JSON Formatting
- **Standard JSON**: RFC 7159 compliant formatting
- **Indentation**: Configurable 2/4 space or tab indentation
- **Array formatting**: Single-line for simple arrays, multi-line for complex
- **Object key sorting**: Optional alphabetical key sorting
- **Trailing comma handling**: Remove illegal trailing commas
- **String escape normalization**: Consistent Unicode and special character escaping

### 3. XQuery Formatting
- **FLWOR expression alignment**: Proper clause alignment and indentation
- **Function formatting**: Parameter alignment and body indentation
- **XML embedding**: Format embedded XML within XQuery expressions
- **Namespace declaration alignment**: Organized namespace and import declarations
- **Comment formatting**: XQuery comment `(: :)` formatting preservation
- **Operator spacing**: Consistent spacing around XQuery operators

### 4. JavaScript Formatting
- **ES6+ syntax support**: Arrow functions, destructuring, template literals
- **Code style options**: Configurable bracket placement, semicolon usage
- **Object/Array formatting**: Consistent multi-line object and array formatting
- **Function formatting**: Parameter and body alignment
- **Import/Export statements**: Organized import grouping and formatting
- **JSDoc preservation**: Maintain JSDoc comments with proper formatting

### 5. SPARQL Formatting
- **Query clause alignment**: SELECT, WHERE, ORDER BY clause formatting
- **Triple pattern alignment**: Consistent subject-predicate-object formatting
- **PREFIX declaration organization**: Alphabetical prefix organization
- **Filter expression formatting**: Proper parentheses and operator spacing
- **Union/Optional formatting**: Proper nested query formatting
- **Comment preservation**: SPARQL `#` comment formatting

## Command Palette Integration

### Command Structure
```
Format Document                    Ctrl+Shift+I
Format Selection                   Ctrl+K Ctrl+F
Format XML                        Alt+Shift+X
Format JSON                       Alt+Shift+J
Format XQuery                     Alt+Shift+Q
Format JavaScript                 Alt+Shift+S
Format SPARQL                     Alt+Shift+P
```

### Command Categories
All formatting commands appear under "Format" category in command palette:
- `Format: Document` - Auto-detect language and format entire document
- `Format: Selection` - Format selected text only
- `Format: XML` - Force XML formatting regardless of language detection
- `Format: JSON` - Force JSON formatting regardless of language detection
- `Format: XQuery` - Force XQuery formatting regardless of language detection
- `Format: JavaScript` - Force JavaScript formatting regardless of language detection
- `Format: SPARQL` - Force SPARQL formatting regardless of language detection

## Technical Implementation

### Formatter Libraries
- **XML**: `prettier` with XML plugin or custom XML formatter
- **JSON**: `JSON.stringify()` with custom spacing logic
- **XQuery**: Custom XQuery formatter (no mature libraries available)
- **JavaScript**: `prettier` with JavaScript/TypeScript plugins
- **SPARQL**: Custom SPARQL formatter (limited library support)

### Language Detection
```javascript
function detectLanguage(content) {
  // XQuery detection patterns
  if (/\b(xquery|declare|import)\b/i.test(content)) return 'xquery';
  if (/\b(for|let|where|return)\s+[\$\w]/i.test(content)) return 'xquery';

  // SPARQL detection patterns
  if (/\b(SELECT|CONSTRUCT|ASK|DESCRIBE)\b/i.test(content)) return 'sparql';
  if (/\b(PREFIX|WHERE|FILTER)\b/i.test(content)) return 'sparql';

  // XML detection
  if (/^\s*<[?!]?[\w\-:]+/m.test(content)) return 'xml';

  // JSON detection
  try {
    JSON.parse(content);
    return 'json';
  } catch (e) {
    if (/^\s*[\{\[]/.test(content)) return 'json';
  }

  // JavaScript detection (fallback)
  if (/\b(function|const|let|var|=&gt;)\b/.test(content)) return 'javascript';

  return 'plaintext';
}
```

### Monaco Editor Actions Registration
```javascript
function registerFormattingCommands(editor, monaco) {
  // Universal format command with auto-detection
  editor.addAction({
    id: 'format-document',
    label: 'Format Document',
    keybindings: [
      monaco.KeyMod.Ctrl | monaco.KeyMod.Shift | monaco.KeyCode.KeyI
    ],
    contextMenuGroupId: 'modification',
    contextMenuOrder: 1,
    run: function(editor) {
      const model = editor.getModel();
      const content = model.getValue();
      const language = detectLanguage(content);
      const formatted = formatContent(content, language);

      if (formatted !== content) {
        editor.executeEdits('format-document', [{
          range: model.getFullModelRange(),
          text: formatted
        }]);
      }
    }
  });

  // Format selection
  editor.addAction({
    id: 'format-selection',
    label: 'Format Selection',
    keybindings: [
      monaco.KeyMod.Ctrl | monaco.KeyCode.KeyK,
      monaco.KeyMod.Ctrl | monaco.KeyCode.KeyF
    ],
    precondition: 'editorHasSelection',
    run: function(editor) {
      const selection = editor.getSelection();
      const model = editor.getModel();
      const selectedText = model.getValueInRange(selection);
      const language = detectLanguage(selectedText);
      const formatted = formatContent(selectedText, language);

      if (formatted !== selectedText) {
        editor.executeEdits('format-selection', [{
          range: selection,
          text: formatted
        }]);
      }
    }
  });

  // Language-specific formatters
  ['xml', 'json', 'xquery', 'javascript', 'sparql'].forEach(lang => {
    editor.addAction({
      id: `format-${lang}`,
      label: `Format ${lang.toUpperCase()}`,
      keybindings: getLanguageKeybinding(lang),
      run: function(editor) {
        const model = editor.getModel();
        const content = model.getValue();
        const formatted = formatContent(content, lang);

        if (formatted !== content) {
          editor.executeEdits(`format-${lang}`, [{
            range: model.getFullModelRange(),
            text: formatted
          }]);
        }
      }
    });
  });
}
```

## Configuration Options

### Formatting Settings
```javascript
const defaultFormattingConfig = {
  xml: {
    indentSize: 2,
    useSpaces: true,
    maxLineLength: 120,
    selfClosingTagStyle: 'consistent', // 'expand', 'collapse', 'consistent'
    attributeWrap: 'auto', // 'auto', 'force', 'never'
    preserveWhitespace: false
  },
  json: {
    indentSize: 2,
    useSpaces: true,
    sortKeys: false,
    trailingComma: false,
    maxLineLength: 80
  },
  xquery: {
    indentSize: 2,
    useSpaces: true,
    alignFLWORClauses: true,
    alignFunctionParams: true,
    maxLineLength: 100,
    preserveComments: true
  },
  javascript: {
    indentSize: 2,
    useSpaces: true,
    useSemicolons: true,
    trailingComma: 'es5',
    bracketSpacing: true,
    singleQuote: false
  },
  sparql: {
    indentSize: 2,
    useSpaces: true,
    alignClauses: true,
    sortPrefixes: true,
    maxLineLength: 120,
    uppercaseKeywords: true
  }
};
```

## Error Handling

### Graceful Degradation
- **Parse errors**: Show user-friendly error messages with line/column information
- **Partial formatting**: Attempt to format valid portions while preserving invalid sections
- **Fallback behavior**: If formatting fails, preserve original content and show warning
- **Undo support**: All formatting operations support Monaco's built-in undo/redo

### User Feedback
```javascript
function handleFormattingError(error, language, content) {
  // Show non-intrusive notification
  monaco.editor.setModelMarkers(model, 'formatter', [{
    startLineNumber: error.line || 1,
    startColumn: error.column || 1,
    endLineNumber: error.line || 1,
    endColumn: error.column || 1,
    message: `${language.toUpperCase()} formatting error: ${error.message}`,
    severity: monaco.MarkerSeverity.Warning
  }]);

  // Optional: Show status bar message
  showStatusMessage(`Failed to format ${language}: ${error.message}`, 5000);
}
```

## Integration Points

### QueryEditor.jsx Integration
```javascript
// In handleMount function
const handleMount = async (editor, monaco) => {
  // ... existing code ...

  // Register formatting commands
  registerFormattingCommands(editor, monaco);

  // ... rest of existing code ...
};
```

### Context Menu Integration
```javascript
// Add to context menu groups
editor.addAction({
  id: 'format-document',
  // ... other properties ...
  contextMenuGroupId: 'modification',
  contextMenuOrder: 1.1, // After cut/copy/paste
});
```

## User Experience

### Visual Indicators
- **Progress indication**: Show formatting progress for large documents
- **Change highlighting**: Briefly highlight formatted regions
- **Status feedback**: Show "Document formatted" message on success
- **Error markers**: Mark problematic sections with warnings

### Keyboard Shortcuts
- Standard VS Code formatting shortcuts for familiarity
- Language-specific shortcuts for quick access
- Chord combinations for advanced formatting options

### Accessibility
- All commands accessible via command palette
- Keyboard shortcuts follow accessibility guidelines
- Screen reader compatible status messages
- High contrast theme support for indicators

## Performance Considerations

### Optimization Strategies
- **Lazy loading**: Load formatters on-demand to reduce initial bundle size
- **Worker threads**: Use web workers for large document formatting
- **Incremental formatting**: Format only changed regions when possible
- **Caching**: Cache formatting results for unchanged content
- **Debouncing**: Debounce auto-formatting triggers

### Resource Management
```javascript
// Lazy formatter loading
async function getFormatter(language) {
  if (!formatters[language]) {
    formatters[language] = await import(`./formatters/${language}Formatter.js`);
  }
  return formatters[language];
}

// Memory cleanup
function cleanupFormatters() {
  // Clear cached formatters when not needed
  Object.keys(formatters).forEach(key => {
    if (!activeLanguages.includes(key)) {
      delete formatters[key];
    }
  });
}
```

## Future Enhancements

### Advanced Features
- **Format on save**: Automatic formatting when saving documents
- **Format on type**: Real-time formatting as user types
- **Custom format profiles**: User-defined formatting configurations
- **Team formatting configs**: Shared formatting rules via configuration files
- **Plugin system**: Extensible formatter plugin architecture

### ML Console Specific
- **MarkLogic integration**: Validate formatting against MarkLogic XQuery engine
- **Database-aware formatting**: Format queries based on target database schema
- **Result formatting**: Format query results in addition to query text
- **Collaborative formatting**: Consistent formatting across team members

## Testing Strategy

### Unit Tests
- Formatter correctness for each supported language
- Edge case handling (malformed syntax, empty content, very large documents)
- Configuration option validation
- Error handling and recovery

### Integration Tests
- Command palette command registration
- Keyboard shortcut functionality
- Context menu integration
- Undo/redo support

### Performance Tests
- Large document formatting (>1MB)
- Memory usage during formatting operations
- Formatter loading time benchmarks
- Concurrent formatting operations

## Implementation Priority

### Phase 1 (Essential)
1. JSON formatting (simplest, most reliable)
2. XML formatting (high user value)
3. JavaScript formatting (leverages existing libraries)

### Phase 2 (Advanced)
1. XQuery formatting (custom implementation required)
2. SPARQL formatting (custom implementation required)
3. Advanced configuration options

### Phase 3 (Polish)
1. Performance optimizations
2. Advanced user experience features
3. Integration with ML Console specific features

---

**Note**: This document serves as a comprehensive specification for implementing Monaco Editor command palette formatting tools. Implementation should begin with Phase 1 languages and progressively add advanced features based on user feedback and usage patterns.