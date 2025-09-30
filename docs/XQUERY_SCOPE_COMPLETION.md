# XQuery Scope-Aware Auto-Completion

## Overview

ML Console's Monaco editor provides intelligent, scope-aware auto-completion for XQuery variables. The completion system uses ANTLR-based parsing to extract variables with full scope information, enabling accurate suggestions that respect XQuery's lexical scoping rules.

## Features

### 1. Scope-Based Filtering

Variables are only suggested when they are accessible at the cursor position:

```xquery
let $outer := 1
for $item in 1 to 3
  let $inner := $item * 2
  return $item   (: Suggests: $outer, $item, $inner :)

(: Outside the for loop :)
return $         (: Suggests: $outer only :)
```

**How it works:**
- Each variable tracks `scopeStart` and `scopeEnd` line numbers
- Completion provider filters variables where cursor is within `[scopeStart, scopeEnd]`
- Variables declared after the cursor are excluded

### 2. Variable Shadowing Detection

When variables with the same name exist in nested scopes, only the innermost (shadowing) variable is suggested:

```xquery
let $x := 1
return
  let $x := 2    (: Shadows outer $x :)
  return
    let $x := 3  (: Shadows middle $x :)
    return $x    (: Suggests only innermost $x with "shadows line 3" indicator :)
```

**Implementation:**
- Post-process analysis detects overlapping scopes with same variable name
- Completion provider keeps only the variable with largest `scopeStart` (most nested)
- Shadowing information displayed in completion detail text

### 3. Function Parameter Completion

Function parameters are extracted with type declarations and suggested within function scope:

```xquery
declare function local:process($value as xs:decimal, $flag as xs:boolean) {
  let $doubled := $value * 2
  return $       (: Suggests: $value, $flag, $doubled :)
};

return $         (: Parameters not suggested outside function :)
```

**Features:**
- Function parameters have `type: 'function-param'`
- Type declarations displayed in completion details
- Parameters shown with distinctive icon (Property kind vs Variable kind)
- Scope limited to function body

### 4. Variable Type Indicators

Completion suggestions distinguish between variable types:

| Type | Display | Icon | Example |
|------|---------|------|---------|
| let | `let variable • line N` | Variable | `let $x := 1` |
| for | `for variable • line N` | Variable | `for $item in (1 to 5)` |
| function-param | `parameter in local:func as type • line N` | Property | `function($x as xs:string)` |

### 5. Type Information Display

Function parameters show type declarations:

```xquery
declare function local:calc($price as xs:decimal) {
  $price       (: Detail: "parameter in local:calc as xs:decimal • line 1" :)
};
```

**Features:**
- Type declaration parsed from function signature
- Displayed in completion item detail
- Also shown in documentation popup

## Architecture

### Parser Stack

```
monacoXqueryCompletion.js
    ↓
VariableExtractor.js (ANTLR-based)
    ↓
XQueryParser.js + XQueryLexer.js (Generated)
    ↓
ScopeExtractionListener (Tree walker)
```

### Key Components

#### 1. VariableExtractor (`src/utils/xquery-parser/VariableExtractor.js`)

**Responsibilities:**
- Parse XQuery code using ANTLR
- Walk AST with `ScopeExtractionListener`
- Extract variables with scope ranges
- Detect shadowing relationships

**Output format:**
```javascript
{
  variables: [
    {
      type: 'let' | 'for' | 'function-param',
      name: '$varName',
      line: 5,
      column: 10,
      scopeStart: 5,
      scopeEnd: 20,
      shadows: 3,         // Line of outer declaration (or null)
      shadowedBy: [15],   // Lines of inner declarations
      function: 'local:func',  // For function-params only
      typeDecl: 'xs:decimal'   // For function-params only
    }
  ],
  functions: [...],
  errors: [...]
}
```

#### 2. Scope Extraction Listener

**Scope stack pattern:**
- `enterFunctionDecl` / `enterFlworExpr` → push scope
- `exitFunctionDecl` / `exitFlworExpr` → pop scope, set `scopeEnd`
- Variables added to current scope during tree walk

**Shadowing detection:**
- Post-process after tree walk completes
- Group variables by name, sort by `scopeStart`
- Check for overlapping scope ranges
- Mark `shadows` and `shadowedBy` relationships

#### 3. Monaco Completion Provider (`src/utils/monacoXqueryCompletion.js`)

**Three-step filtering:**

1. **Scope filtering** (`isVariableAccessible`):
   - Variable declared before cursor? (line/column check)
   - Cursor within variable's scope range?

2. **Shadowing filter** (`filterShadowedVariables`):
   - Group accessible variables by name
   - Keep only innermost variable per name

3. **Suggestion creation**:
   - Map to Monaco completion items
   - Set appropriate icon (`Variable` vs `Property`)
   - Generate detail text with type and shadowing info

### Performance

- **Parse time**: ~100ms for typical XQuery files
- **Bundle size**: 953KB (ANTLR parser)
- **Caching**: Results cached per document, invalidated on edit
- **Memory**: `WeakMap` prevents leaks when documents close

## Usage

### Triggering Completion

1. **Automatic**: Type `$` character
2. **Manual**: Press `Ctrl+Space` (or `Cmd+Space` on macOS)

### Reading Completion Details

Completion items show:
- **Label**: Variable name (e.g., `$myVar`)
- **Icon**: Variable (let/for) or Property (function parameter)
- **Detail**: `<type> <context> as <typeDecl> • line <N>`
- **Documentation**: Type declaration (for function parameters)

### Example Session

```xquery
declare function local:process($item as element(), $depth as xs:integer) {
  let $name := $item/@name/string()
  for $child in $item/*
    let $childDepth := $depth + 1
    return
      (: Type $ here :)
```

**Suggestions when cursor at line 6:**
- `$item` — parameter in local:process as element() • line 1
- `$depth` — parameter in local:process as xs:integer • line 1
- `$name` — let variable • line 2
- `$child` — for variable • line 3
- `$childDepth` — let variable • line 4

## Testing

See `tests/xquery-scope-completion.spec.ts` for comprehensive tests:

1. ✅ Suggests let variables in scope
2. ✅ Does not suggest variables out of scope
3. ✅ Suggests function parameters within function body
4. ✅ Handles variable shadowing correctly
5. ✅ Shows function parameter with type information
6. ✅ Distinguishes let, for, and function parameter variables
7. ✅ Cache invalidates on document edit

Run tests:
```bash
npm test -- tests/xquery-scope-completion.spec.ts
```

## Limitations

1. **ANTLR parser dependency**: 953KB bundle size
2. **Parse errors**: Incomplete XQuery may fail to extract variables
3. **No cross-module resolution**: Variables from imported modules not suggested
4. **No built-in functions**: Only user-defined variables suggested (XQuery built-ins via separate provider)

## Future Enhancements

1. **Function completion**: Suggest function names with signatures
2. **Namespace prefix completion**: Complete namespace-qualified names
3. **Import resolution**: Suggest variables from imported modules
4. **Hover tooltips**: Show full variable definition on hover
5. **Go to definition**: Jump to variable declaration
6. **Rename refactoring**: Rename variable across scope

## Related Files

- `src/utils/xquery-parser/VariableExtractor.js` - ANTLR-based extractor
- `src/utils/monacoXqueryCompletion.js` - Monaco provider
- `tests/scope-extraction/` - Extractor test framework
- `tests/xquery-scope-completion.spec.ts` - Integration tests
- `tests/scope-extraction/SCOPE-EXTRACTION.md` - Implementation details

## References

- [Monaco Editor API](https://microsoft.github.io/monaco-editor/api/)
- [ANTLR4 Documentation](https://github.com/antlr/antlr4/tree/master/doc)
- [XQuery 3.1 Specification](https://www.w3.org/TR/xquery-31/)
- [MarkLogic XQuery Guide](https://docs.marklogic.com/guide/xquery)