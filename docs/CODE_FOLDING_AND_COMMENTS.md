# Code Folding and Comment Toggling

This document describes the code folding and comment toggling features for XQuery in Monaco Editor.

## Overview

The Monaco XQuery language implementation now includes:
- **Code Folding**: Intelligent folding for XQuery constructs including FLWOR expressions, XML elements, comments, and curly brace blocks
- **Comment Toggling**: Line and block comment toggling with XQuery-style `(: ... :)` comment syntax
- **Keyboard Shortcuts**: Standard editor shortcuts for commenting operations

## Code Folding Features

### Supported Constructs

#### 1. XQuery Comments
```xquery
(: This is a foldable comment
   spanning multiple lines
   with proper XQuery syntax
:)
```

#### 2. FLWOR Expressions
```xquery
for $item in collection("data")
let $value := $item/value
where $value > 10
order by $value descending
return $item
```

#### 3. Curly Brace Blocks
```xquery
let $object := {
  "name": "example",
  "nested": {
    "key": "value"
  }
}
```

#### 4. XML Elements
```xquery
<root>
  <item id="1">
    <title>Foldable Content</title>
    <description>This entire block can be folded</description>
  </item>
</root>
```

#### 5. Function Definitions
```xquery
declare function local:process-item($item as element()) as element() {
  let $processed := transform($item)
  return $processed
};
```

### Folding Rules

1. **Comments**: Multi-line XQuery comments `(: ... :)` are foldable
2. **FLWOR**: Complete FLWOR expressions from `for`/`let` to `return` are foldable
3. **Braces**: Matching `{...}` blocks with content spanning multiple lines
4. **XML**: Opening and closing tag pairs with content
5. **Functions**: Function declarations from signature to closing brace

## Comment Toggling Features

### Comment Styles

#### Line Comments
- **Toggle**: `Ctrl+/` (Windows/Linux) or `Cmd+/` (macOS)
- **Format**: `(: line content :)`
- **Behavior**: Toggles comment status of current line or selected lines

#### Block Comments
- **Toggle**: `Ctrl+Shift+A` (Windows/Linux) or `Cmd+Shift+A` (macOS)
- **Format**: Single line: `(: content :)`, Multi-line:
  ```xquery
  (:
  content line 1
  content line 2
  :)
  ```

### Comment Operations

#### Line Comment Examples
```xquery
let $x := 1              →  (: let $x := 1 :)
(: let $x := 1 :)        →  let $x := 1
  let $y := 2            →    (: let $y := 2 :)
```

#### Block Comment Examples
```xquery
Selected text:           →  (: Selected text :)
Multi-line
selection                →  (:
                            Multi-line
                            selection
                            :)
```

## Implementation Details

### XQueryFoldingProvider

The folding provider uses a stack-based approach to track nested constructs:

1. **State Tracking**: Maintains a stack of open constructs (comments, braces, XML tags, FLWOR clauses)
2. **Context Awareness**: Recognizes XQuery-specific patterns and syntax
3. **Nesting Support**: Handles properly nested structures with correct scoping
4. **Performance**: Efficiently processes large files with minimal overhead

### XQueryCommentProvider

The comment provider offers context-sensitive commenting:

1. **Detection**: Identifies existing comment patterns accurately
2. **Preservation**: Maintains indentation and formatting when toggling
3. **Block Handling**: Manages multi-line comments with proper structure
4. **Integration**: Works with Monaco's command system and keyboard shortcuts

## Configuration

### Language Configuration

The XQuery language is configured with:

```javascript
monaco.languages.setLanguageConfiguration(XQUERY_LANGUAGE, {
  comments: {
    blockComment: ['(:', ':)']
  },
  folding: {
    markers: {
      start: /^\s*\(\:/,
      end: /^\s*\:\)/
    },
    offSide: false
  },
  indentationRules: {
    increaseIndentPattern: /^\s*(for|let|where|order\s+by|group\s+by|return|\{|<[^/>]*[^/]>)\s*$/,
    decreaseIndentPattern: /^\s*(\}|<\/[^>]+>|:\))\s*$/
  }
});
```

### Provider Registration

```javascript
// Register folding provider
const foldingProvider = new XQueryFoldingProvider();
monaco.languages.registerFoldingRangeProvider(XQUERY_LANGUAGE, foldingProvider);

// Register comment commands
monaco.editor.addCommand('xquery.comment.toggle', commentToggleHandler);
monaco.editor.addCommand('xquery.comment.block.toggle', blockCommentToggleHandler);
```

## Testing

### Unit Tests

Both providers have comprehensive test suites:

- **XQueryFoldingProvider**: Tests for all folding constructs, nesting, edge cases
- **XQueryCommentProvider**: Tests for comment detection, toggling, formatting

### Manual Testing

To test these features:

1. **Code Folding**:
   - Open an XQuery file with complex FLWOR expressions
   - Look for fold indicators in the gutter
   - Click to fold/unfold constructs
   - Verify nested folding works correctly

2. **Comment Toggling**:
   - Select XQuery code
   - Use `Ctrl+/` for line comments
   - Use `Ctrl+Shift+A` for block comments
   - Verify indentation is preserved

## Troubleshooting

### Common Issues

1. **Folding Not Working**:
   - Ensure XQuery language is properly registered
   - Check that content spans multiple lines
   - Verify syntax is valid XQuery

2. **Comment Shortcuts Not Working**:
   - Confirm editor has focus
   - Check that XQuery language is active
   - Verify keyboard shortcuts aren't conflicting

3. **Performance Issues**:
   - Large files may experience slower folding calculation
   - Consider disabling folding for very large documents
   - Report performance issues with specific file patterns

### Debug Information

Enable Monaco editor logging:
```javascript
monaco.editor.setModelLanguage(model, 'xquery-ml');
// Check console for language registration messages
```

## Future Enhancements

### Planned Features

1. **Smart Folding**: Context-aware folding based on XQuery semantics
2. **Custom Markers**: User-defined folding regions with comments
3. **Folding Persistence**: Remember folded state across sessions
4. **Advanced Comments**: Support for JSDoc-style documentation comments

### Configuration Options

Future versions may include:
- Configurable comment styles
- Custom folding rules
- Performance tuning options
- Integration with XQuery formatting tools

## API Reference

### XQueryFoldingProvider Methods

- `provideFoldingRanges(model, context, token)`: Returns array of folding ranges
- `isInString(line, index)`: Checks if position is inside a string literal
- `isFLWORStart(line)`: Identifies FLWOR expression starts
- `findReturnEnd(lines, startLine)`: Locates end of return expression

### XQueryCommentProvider Methods

- `provideCommentActions(model, range, token)`: Returns available comment actions
- `commentLine(line)`: Adds line comment to text
- `uncommentLine(line)`: Removes line comment from text
- `addBlockComment(text)`: Wraps text in block comment
- `removeBlockComment(text)`: Removes block comment markers