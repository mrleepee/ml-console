# Known Test Failures

This document tracks known test failures that are not blocking development. These are pre-existing issues that need to be addressed separately.

**Last Updated:** 2025-10-06

## Summary

- **Total Tests:** 458
- **Passing:** 423 (92.8%)
- **Failing:** 33 (7.2%)
- **Skipped:** 2
- **Test Files Failing:** 8 of 27

---

## Failing Test Files

### 1. src/utils/monacoXquery.test.js (7 failures)

**Category:** XQuery Language Features
**Impact:** Medium - Affects XQuery syntax highlighting and parsing

**Failures:**
- XML/HTML Embedding Support (Phase 2) > XML Tag Recognition > should tokenize basic XML tags
- XML/HTML Embedding Support (Phase 2) > XQuery Expressions in XML Attributes > should handle XQuery expressions within XML attribute values
- XML/HTML Embedding Support (Phase 2) > Mixed XQuery and XML Content > should handle element constructors with XQuery expressions
- XML/HTML Embedding Support (Phase 2) > Enhanced FLWOR Expression Tests (XQuery 3.0+) > should handle nested FLWOR expressions
- XML/HTML Embedding Support (Phase 2) > Enhanced FLWOR Expression Tests (XQuery 3.0+) > should integrate FLWOR with XML embedding
- XML/HTML Embedding Support (Phase 2) > Enhanced FLWOR Expression Tests (XQuery 3.0+) > should include safe FLWOR keywords in global list
- XML/HTML Embedding Support (Phase 2) > Enhanced FLWOR Expression Tests (XQuery 3.0+) > should support standalone count clauses

**Root Cause:** XML tokenization and XQuery 3.0+ FLWOR expression support incomplete

---

### 2. src/components/ThemeSelector.test.jsx (10 failures)

**Category:** Theme Selection UI
**Impact:** Low - Theme selection functionality may work in practice

**Failures:** Theme loading and selection tests

**Root Cause:** Theme selector component tests need updating

---

### 3. src/hooks/__tests__/useDatabaseConfig.test.js (5 failures)

**Category:** Database Configuration Hook
**Impact:** Medium - Database connection logic

**Failures:** Database configuration initialization and refresh logic

**Root Cause:** Test setup issues with mocked database API

---

### 4. src/hooks/__tests__/useQueryExecution.test.js (4 failures)

**Category:** Query Execution Logic
**Impact:** Medium - Core query execution functionality

**Failures:**
- useQueryExecution - Core Functionality > cancellation > should handle abort errors as cancellation
- useQueryExecution - Core Functionality > keyboard shortcuts > should detect Ctrl+Enter key combination
- useQueryExecution - Core Functionality > keyboard shortcuts > should ignore other key combinations
- useQueryExecution - Core Functionality > loading state management > should manage loading state during execution

**Error:** `Cannot read properties of null (reading 'executeQuery')`

**Root Cause:** Hook rendering context issues in tests

---

### 5. src/hooks/__tests__/useQueryHistory.test.js (3 failures)

**Category:** Query History Management
**Impact:** Low - History functionality

**Failures:** Query history save/delete operations

**Root Cause:** Mocked electron API issues

---

### 6. src/hooks/__tests__/useQueryHistory.simple.test.js (2 failures)

**Category:** Query History (Simplified)
**Impact:** Low

**Failures:** Connection check and database config refresh

**Root Cause:** Similar to useQueryHistory.test.js

---

### 7. src/hooks/__tests__/useDatabaseConfig.simple.test.js (1 failure)

**Category:** Database Configuration (Simplified)
**Impact:** Low

**Failures:** Database configuration error handling

**Root Cause:** Test expects error to be thrown but gets unhandled rejection

---

### 8. src/App.test.jsx (1 failure)

**Category:** Main Application Component
**Impact:** Low - App renders successfully in practice

**Failures:** One app component test

**Root Cause:** Test setup or rendering context issue

---

## Recent Fixes

### 2025-10-06: Monaco Editor Theme Errors
- **Issue:** `Cannot read properties of undefined (reading 'editor')`
- **Location:** src/utils/monacoThemes.js:42
- **Fix:** Added null check for monaco object before calling `monaco.editor.defineTheme()`
- **Result:** Reduced unhandled rejections from 6 to 2

---

## Testing Guidelines

When running tests:

```bash
# Run all tests
npm test

# Run specific test file
npm test -- --run src/components/QueryEditor.test.jsx

# Run tests with timeout
timeout 30 npm test -- --run
```

**Note:** Pre-existing test failures should not block new feature development. New features must have passing tests.

---

## Action Items

- [ ] Fix XQuery XML tokenization (7 failures)
- [ ] Fix ThemeSelector tests (10 failures)
- [ ] Fix useDatabaseConfig test mocking (6 failures total)
- [ ] Fix useQueryExecution hook rendering (4 failures)
- [ ] Fix useQueryHistory electron API mocks (5 failures total)
- [ ] Fix App.test.jsx rendering issue (1 failure)

**Priority:** Medium - These don't block feature work but should be addressed to improve test coverage reliability.
