# ML Console App.jsx Refactoring Plan

## Current State Analysis

**App.jsx Complexity:**
- **1160 lines** with **80+ functions/methods** and **48 React hooks**
- Multiple responsibilities: UI rendering, data fetching, response parsing, query execution, history management, theme handling, pagination, streaming, etc.
- Heavy state management with 20+ useState declarations
- Complex business logic mixed with presentation logic

**Existing Architecture:**
- ✅ Some utilities already extracted to `/src/utils/` (databaseApi.js, monacoThemes.js, etc.)
- ✅ Some components extracted (QueryEditor.jsx, MonacoViewer.jsx)
- ✅ **Good test coverage for utils** (3 test files with comprehensive tests)
- ❌ **No tests for core App.jsx business logic**
- ❌ **No tests for extracted components**

## Refactoring Justification

**Yes, refactoring is definitely warranted** for these reasons:

1. **Maintainability**: 1160-line components are hard to debug and modify
2. **Testability**: Critical business logic is untestable when embedded in React components
3. **Reusability**: Query execution, parsing, and streaming logic could be reused
4. **Single Responsibility**: App.jsx violates SRP by handling too many concerns
5. **Team Development**: Large files create merge conflicts and cognitive overhead

## Phase 1: Extract Core Business Logic (Priority: High)

### 1.1 Query Execution Service
**Extract to: `src/services/queryService.js`**

**Functions to extract:**
- `executeQuery()` - Main query execution logic
- Database configuration validation
- Query type processing (xquery, javascript, sparql)
- Request body formatting
- Error handling and validation

**Benefits:**
- Fully unit testable query execution
- Reusable across different UI components
- Centralized query logic

**Tests to create:**
```javascript
// src/services/queryService.test.js
- Query validation edge cases
- Different query types (xquery, javascript, sparql)
- Database configuration handling
- Error scenarios (network failures, invalid queries)
- Mocking Electron API calls
```

### 1.2 Response Processing Service
**Extract to: `src/services/responseService.js`**

**Functions to extract:**
- `parseMultipartToTableData()` - Parse server responses into table data
- `parseMultipartResponse()` - Parse responses for display
- `parseResponse()` - Individual response parsing
- `formatXmlPretty()` - XML formatting utility
- `formatJsonPretty()` - JSON formatting utility
- `escapeRegExp()` - Utility function

**Benefits:**
- Isolated, testable parsing logic
- Better error handling for malformed responses
- Reusable formatting utilities

**Tests to create:**
```javascript
// src/services/responseService.test.js
- Multipart response parsing with various boundaries
- Single response parsing
- Malformed response handling
- XML/JSON formatting edge cases
- Header parsing validation
```

### 1.3 Streaming Data Service
**Extract to: `src/services/streamingService.js`**

**Functions to extract:**
- `loadPage()` and `loadPageWithIndex()` - Page loading logic
- `nextPage()`, `prevPage()` - Pagination controls
- Stream index management
- Page size calculations
- Record navigation (`goToNextRecord`, `goToPrevRecord`)

**Benefits:**
- Testable pagination logic
- Consistent streaming behavior
- Simplified component state management

**Tests to create:**
```javascript
// src/services/streamingService.test.js
- Page loading with different stream indices
- Pagination boundary conditions
- Record navigation logic
- Error handling for failed stream reads
```

## Phase 2: Extract React Hooks (Priority: Medium)

### 2.1 Custom Hooks
**Create hooks in: `src/hooks/`**

#### `useDatabaseConfig.js`
```javascript
// Manages database selection and configuration
export function useDatabaseConfig() {
  // State: selectedDatabaseConfig, databaseConfigs, connectionStatus
  // Functions: getDatabaseConfigs, checkConnection
  // Returns: { config, configs, status, selectDatabase, refresh }
}
```

#### `useQueryHistory.js`
```javascript
// Manages query history operations
export function useQueryHistory() {
  // State: queryHistory, historyLoading
  // Functions: loadQueryHistory, saveQuery, deleteQuery, loadFromHistory
  // Returns: { history, loading, save, delete, load, refresh }
}
```

#### `useQueryExecution.js`
```javascript
// Manages query execution state and lifecycle
export function useQueryExecution(queryService) {
  // State: isLoading, error, results, rawResults
  // Functions: execute, cancel, reset
  // Returns: { loading, error, results, execute, cancel, reset }
}
```

#### `useTheme.js`
```javascript
// Manages theme and Monaco editor settings
export function useTheme() {
  // State: theme, monacoTheme
  // Functions: setTheme, toggleTheme, setMonacoTheme
  // Returns: { theme, monacoTheme, setTheme, toggleTheme }
}
```

**Tests for hooks:**
```javascript
// src/hooks/__tests__/
- Hook state management
- Effect dependencies
- Error handling
- Integration with services
```

## Phase 3: Component Decomposition (Priority: Medium)

### 3.1 Feature Components
**Extract to: `src/components/`**

#### `QueryConsole.jsx` (~200-250 lines)
```javascript
// Main query interface
- Query editor integration
- Execute button and controls
- Query type selector
- Database selector integration
```

#### `ResultsViewer.jsx` (~150-200 lines)
```javascript
// Results display and pagination
- Table/Raw/Parsed view switching
- Pagination controls
- Record navigation
- Monaco editor for results
```

#### `DatabaseSelector.jsx` (~100-150 lines)
```javascript
// Database dropdown and connection status
- Database dropdown
- Connection status indicator
- Server configuration
- Credentials management
```

#### `QueryHistoryPanel.jsx` (~100-150 lines)
```javascript
// History sidebar
- History list rendering
- Load/Delete actions
- Search/Filter functionality
```

#### `ThemeSelector.jsx` (~50-75 lines)
```javascript
// Theme switching UI
- Theme dropdown
- Monaco theme integration
```

**Component Tests:**
```javascript
// src/components/__tests__/
- Component rendering
- User interactions
- Props validation
- Integration with hooks/services
```

## Phase 4: Enhanced Testing (Priority: High)

### 4.1 Comprehensive Test Suite

#### Unit Tests
- **Services**: All business logic functions
- **Hooks**: State management and side effects
- **Utilities**: Helper functions and formatters

#### Integration Tests
- **Component interactions**: How components work together
- **Service integration**: How services interact with each other
- **Hook-Service integration**: How hooks consume services

#### E2E Tests
- **Core workflows**: Query execution, result viewing, history management
- **Error scenarios**: Network failures, invalid inputs
- **Cross-browser compatibility**: Electron-specific features

#### Mock Strategy
```javascript
// Test utilities for consistent mocking
- mockElectronAPI() - Consistent Electron API mocking
- mockQueryResponses() - Various server response scenarios
- mockDatabaseConfigs() - Database configuration scenarios
```

**Coverage Goals:**
- **Services**: 95%+ (critical business logic)
- **Hooks**: 90%+ (state management)
- **Components**: 80%+ (user interactions)
- **Overall**: 85%+

## Phase 5: Performance Optimizations (Priority: Low)

### 5.1 React Optimizations

#### Memoization Strategy
```javascript
// Prevent unnecessary re-renders
- React.memo() for ResultsViewer, QueryHistory
- useMemo() for expensive calculations (parsing, formatting)
- useCallback() for event handlers passed to children
```

#### Code Splitting
```javascript
// Lazy load non-critical features
- Monaco editor themes
- Large result formatters
- History management UI
```

#### Virtual Scrolling
```javascript
// For large result sets
- Implement virtual scrolling in table view
- Lazy load query history items
```

## Implementation Strategy

### Phase 1 Implementation Order
1. **Start with Response Service** (least dependencies, high test value)
2. **Extract Query Service** (core functionality)
3. **Create Streaming Service** (depends on response parsing)

### Phase 2 Implementation Order
1. **Create base hooks** (useDatabaseConfig, useTheme)
2. **Extract complex hooks** (useQueryExecution, useQueryHistory)
3. **Integrate hooks into App.jsx**

### Phase 3 Implementation Order
1. **Extract simple components** (ThemeSelector, DatabaseSelector)
2. **Extract complex components** (QueryConsole, ResultsViewer)
3. **Create container components** if needed

## Expected Outcomes

**Post-Refactoring Structure:**
```
src/
├── components/          # UI Components (~200-300 lines each)
│   ├── QueryConsole.jsx
│   ├── ResultsViewer.jsx
│   ├── DatabaseSelector.jsx
│   ├── QueryHistoryPanel.jsx
│   └── ThemeSelector.jsx
├── hooks/              # Custom React hooks
│   ├── useDatabaseConfig.js
│   ├── useQueryHistory.js
│   ├── useQueryExecution.js
│   └── useTheme.js
├── services/           # Business logic services
│   ├── queryService.js
│   ├── responseService.js
│   └── streamingService.js
├── utils/              # Pure utilities (existing)
└── App.jsx            # ~200-300 lines (orchestration only)
```

**File Size Targets:**
- **App.jsx**: 200-300 lines (down from 1160)
- **Services**: 150-250 lines each
- **Components**: 100-300 lines each
- **Hooks**: 50-150 lines each

**Benefits:**
1. **Maintainability**: Each file has single responsibility
2. **Testability**: Business logic is fully unit-testable
3. **Developer Experience**: Easier debugging and feature development
4. **Code Quality**: Better separation of concerns
5. **Future Growth**: Scalable architecture for new features
6. **Performance**: Better React optimization opportunities

## Effort Estimation

- **Phase 1** (Extract Services): ~2-3 days (high impact)
- **Phase 2** (Extract Hooks): ~2-3 days (medium impact)
- **Phase 3** (Component Decomposition): ~2-3 days (medium impact)
- **Phase 4** (Enhanced Testing): ~2-3 days (high value)
- **Phase 5** (Performance): ~1 day (polish)

**Total Effort**: ~9-13 days for complete refactoring

## Risk Mitigation

1. **Incremental Approach**: Refactor one service/component at a time
2. **Test Coverage**: Maintain/improve test coverage throughout
3. **Feature Parity**: Ensure no functionality is lost during refactoring
4. **Code Reviews**: Thorough review of each phase
5. **Rollback Plan**: Keep original code in feature branches until refactoring is complete

## Success Metrics

- [ ] App.jsx reduced to <400 lines
- [ ] All business logic covered by unit tests (>90%)
- [ ] No functionality regressions
- [ ] Improved development velocity for new features
- [ ] Reduced bug reports related to state management
- [ ] Improved code review speed and quality