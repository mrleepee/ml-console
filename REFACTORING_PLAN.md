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
**Stabilize in: `src/services/queryService.js` with IPC adapter**

**Boundary to introduce before extraction:**
- Create `src/ipc/queryClient.js` exporting a minimal interface (`sendQuery`, `cancelQuery`, `checkConnection`).
- `queryService` must depend only on this adapter (no direct `window.electron`).
- Adapter encapsulates channel names, payload normalization, and retry semantics.

**Functions to extract or relocate into the service after the boundary exists:**
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

### 1.2 Response Processing Service Hardening
**Enhance existing `src/services/responseService.js`**

**Maintenance & extension tasks:**
- Introduce an explicit interface for result shapes consumed by UI (table rows, raw text, metadata) and document it in the module.
- Tighten boundary handling by centralizing delimiter parsing and validating MIME headers before splitting payloads.
- Extend formatting utilities with streaming-safe guards (avoid large string concatenation) and expose consistent error objects.
- Add adapters that convert `queryService` payloads into the normalized structures expected by hooks/components.

**Benefits:**
- Hardened parsing logic with clearer contracts.
- Safer consumption from React state without duplicating formatting logic.
- Smooth hand-off to upcoming streaming hook.

**Tests to extend:**
```javascript
// src/services/responseService.test.js
- Contract tests covering the documented interface
- Boundary delimiter edge cases (quoted boundaries, whitespace)
- Regression tests for formatting guards on large payloads
- Validation for adapter outputs consumed by UI hooks
```

### 1.3 Streaming Results Hook
**Design `src/hooks/useStreamingResults.js` as the stateful orchestrator.**

**Responsibilities to implement inside the hook:**
- Coordinate chunk ingestion from `queryService` via cancellable subscriptions.
- Maintain reducers for `pages`, `activeRecord`, `pagination`, and `streamStatus` rather than ad-hoc `useState` calls.
- Provide imperative controls (`nextPage`, `prevPage`, `goToNextRecord`, `goToPrevRecord`, `jumpToPage`) that operate on reducer state.
- Surface lifecycle callbacks (`onStart`, `onChunk`, `onComplete`, `onError`) so components can respond without duplicating state.

**Benefits:**
- Centralizes pagination and streaming bookkeeping next to React state requirements.
- Unlocks deterministic unit tests covering reducer transitions and cancellation.
- Simplifies `App.jsx` by replacing multiple interdependent hooks with one focused manager.

**Tests to create:**
```javascript
// src/hooks/useStreamingResults.test.js
- Reducer transition table for pagination and record navigation
- Cancellation flow when a new query starts mid-stream
- Error propagation to consumers via `onError`
- Integration with `responseService` adapters for chunk parsing
```

## Phase 2: Extract React Hooks (Priority: Medium)

### 2.1 Custom Hooks
**Create hooks in: `src/hooks/`**

#### `useDatabaseConfig.js`
```javascript
// Responsibilities
- Load configs on mount using `queryClient.checkConnection` via shared `useAsyncEffect` helper.
- Maintain reducer with states: {status, configs, selectedId, lastError} to avoid stale closures.
- Expose imperative `selectDatabase(configId)` that persists choice and revalidates connection.
- Provide `refresh()` for manual reload (debounced, abortable via AbortController).
- Publish lifecycle callbacks: onConfigLoaded, onConnectionLost.
```

#### `useQueryHistory.js`
```javascript
// Responsibilities
- Own reducer for {entries, filter, status} with actions load/sync/add/remove.
- Coordinate with IPC adapter for persistence; guarantee cancellation when component unmounts.
- Provide selectors (`visibleEntries`, `recentEntry`) derived with `useMemo`.
- Emit onHistoryMutate events for analytics side-effects (optional injection).
```

#### `useQueryExecution.js`
```javascript
// Responsibilities
- Wrap `queryService.executeQuery` and enforce single-flight execution with queued cancellations.
- Track lifecycle via reducer {phase, requestId, error, metrics, rawStream}.
- Provide `execute(params, {onChunk})` that pipes streaming payloads to `useStreamingResults`.
- Expose `cancel()` that signals adapter and flips reducer to `cancelled` phase; ensure cleanup in `useEffect` return.
- Surface stable callbacks for telemetry (onRequestStart, onRequestFinish, onRequestError).
```

#### `useTheme.js`
```javascript
// Responsibilities
- Sync theme preference between localStorage, Electron native theme, and Monaco.
- Use layout effect to update DOM class list before paint to avoid flash.
- Manage reducer {uiTheme, monacoTheme, prefersDark} with derived memo selectors.
- Provide `applyMonacoTheme(editorInstance)` helper to coordinate lazy-loaded editor.
```

**Tests for hooks:**
```javascript
// src/hooks/__tests__/
- Reducer transition tables and lifecycle coverage
- Cancellation/cleanup behavior when components unmount
- Integration with IPC adapter mocks and response/query services
- Memoized selector correctness and dependency tracking
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

#### Vitest (unit) targets
- `src/services/queryService.test.js` — IPC adapter contract, validation matrix, cancellation paths.
- `src/services/responseService.test.js` — interface contract, delimiter edge cases, adapter outputs.
- `src/hooks/useStreamingResults.test.js` — reducer transitions, lifecycle callbacks, cancellation.
- `src/hooks/__tests__/useDatabaseConfig.test.js` — connection lifecycle, reducer guards.

#### React Testing Library integration targets
- `src/components/QueryConsole.test.jsx` — execute flow wiring with hooks/services.
- `src/components/ResultsViewer.test.jsx` — pagination controls and streaming updates.
- `src/components/QueryHistoryPanel.test.jsx` — persistence integration and filter behavior.

#### Playwright E2E scenarios (existing `tests/e2e/*.spec.ts`)
- Extend `tests/e2e/query-execution.spec.ts` for streaming cancel/retry workflow.
- Add coverage in `tests/e2e/history.spec.ts` for history sync.
- Create `tests/e2e/theme-toggle.spec.ts` to assert theme persistence across reloads.

#### Mock Strategy
```javascript
// Test utilities for consistent mocking
- mockElectronAPI() - Consistent Electron API mocking
- mockQueryResponses() - Various server response scenarios
- mockDatabaseConfigs() - Database configuration scenarios
- createStreamingHarness() - Deterministic chunk sequencing for hooks
```

**Coverage Goals (suite-specific):**
- Vitest: ≥95% statements in `src/services`, ≥90% in `src/hooks`.
- React Testing Library: Interaction suites achieving ≥85% branch coverage for components under test.
- Playwright: Smoke workflows executed on CI for every PR (pass rate tracked, no coverage metric).

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
1. **Stabilize Query Service + IPC adapter** (establish contract for downstream consumers)
2. **Harden Response Service** (align outputs to the new contract)
3. **Introduce Streaming Results Hook** (consume stabilized services)

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