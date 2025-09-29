# Automated Theme Testing System

This document describes the automated theme testing system for Monaco XQuery syntax highlighting across all 54 Monaco themes.

## Overview

The theme testing system validates that:
- All Monaco themes load without errors
- XQuery syntax highlighting works consistently across themes
- FLWOR expressions are properly tokenized and highlighted
- Token structure remains consistent when themes change

## Components

### 1. ThemeTestFramework (`src/utils/themeTestFramework.js`)

Core testing framework that:
- Creates headless Monaco editors for testing
- Applies themes programmatically
- Captures token snapshots with type and position data
- Validates consistency across theme changes
- Generates detailed reports

### 2. Unit Tests (`src/utils/themeTestFramework.test.js`)

Comprehensive test suite covering:
- Framework initialization
- Token capture functionality
- Theme loading and error handling
- Consistency validation logic

### 3. E2E Tests (`tests/theme-testing.spec.js`)

Playwright-based tests that:
- Load the actual application in a browser
- Test theme switching in the UI
- Verify syntax highlighting preservation
- Generate end-to-end theme reports

### 4. CLI Runner (`scripts/test-themes.js`)

Automated script for CI/CD integration:
- Runs headless theme tests using Puppeteer
- Compares results with previous snapshots
- Detects theme regressions
- Generates detailed reports with diffs

## Usage

### Running Tests Locally

```bash
# Unit tests for the framework
npm run test src/utils/themeTestFramework.test.js

# End-to-end theme testing
npm run test:themes:e2e

# Automated CLI testing (requires app running on localhost:3025)
npm run test:themes
```

### CI/CD Integration

Add to your CI pipeline:

```yaml
- name: Start application
  run: npm run dev &

- name: Wait for application
  run: wait-on http://localhost:3025

- name: Run theme tests
  run: npm run test:themes
```

## Test Coverage

The system tests the following XQuery features across all themes:

### Core XQuery Syntax
- Keywords: `xquery`, `version`, `declare`, `namespace`
- Functions: `fn:*`, `xdmp:*`, `cts:*`
- Variables: `$variable-name`
- Operators: `:=`, `=`, `!=`, `lt`, `gt`, etc.

### FLWOR Expressions
- Basic: `for`, `let`, `where`, `order by`, `return`
- Advanced: `group by`, `count`
- XQuery 3.0+: `window`, `tumbling`, `sliding`
- Context-sensitive keywords in proper positions

### XML/HTML Embedding
- Element tags: `<element>`
- Attributes: `name="value"`
- Embedded XQuery: `<div>{$expression}</div>`
- Processing instructions: `<?xml-stylesheet?>`
- CDATA sections: `<![CDATA[...]]>`
- Comments: `<!-- XML comment -->`

### Error Handling
- Theme loading failures
- Tokenizer errors
- Inconsistent highlighting across themes

## Snapshot System

### Snapshot Structure

Each theme snapshot contains:
```json
{
  "theme": "theme-name",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "totalLines": 45,
  "tokenizedLines": 42,
  "tokens": [
    {
      "line": 1,
      "tokens": [
        {
          "text": "xquery",
          "type": "keyword",
          "start": 0,
          "end": 6
        }
      ]
    }
  ]
}
```

### Snapshot Comparison

The system detects:
- New themes added
- Themes that started failing
- Token structure changes
- Theme count changes

## Reports

### Test Report Structure

```json
{
  "timestamp": "2024-01-01T00:00:00.000Z",
  "summary": {
    "totalThemes": 54,
    "successful": 53,
    "failed": 1
  },
  "consistency": {
    "consistent": true,
    "message": "All themes show consistent token structure"
  },
  "comparison": {
    "isMatch": false,
    "differences": [
      {
        "type": "theme_regression",
        "theme": "problematic-theme",
        "error": "Theme not found"
      }
    ]
  }
}
```

### Report Types

- **theme_count_change**: Number of available themes changed
- **new_theme**: New theme detected
- **theme_regression**: Previously working theme now fails
- **theme_fixed**: Previously failing theme now works
- **token_structure_change**: Token count or structure changed

## Maintenance

### Adding New Test Cases

To test additional XQuery features:

1. Update the `XQUERY_TEST_FIXTURE` in `themeTestFramework.js`
2. Add corresponding test cases to verify the new syntax
3. Run tests to generate new baseline snapshots

### Theme Updates

When Monaco or theme assets are updated:

1. Run `npm run test:themes` to generate new snapshots
2. Review the differences report
3. Validate that changes are intentional
4. Commit updated snapshots if changes are valid

### Performance Tuning

The system can be optimized by:
- Reducing fixture complexity for faster testing
- Implementing parallel theme testing
- Caching Monaco editor instances
- Optimizing token capture algorithms

## Integration with CI

### Required Environment

- Node.js with Monaco Editor support
- Headless browser (Chromium/Playwright)
- Application server running on localhost:3025

### Exit Codes

- `0`: All tests passed
- `1`: Test failures or theme regressions detected

### Artifacts

The system generates:
- `coverage/theme-tests/theme-snapshots.json`: Current snapshots
- `coverage/theme-tests/theme-test-report.json`: Detailed report
- Console output with summary and differences