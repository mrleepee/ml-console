# ML Console App.jsx Refactoring Plan

## Implementation Status Review

### ✅ COMPLETED WORK

#### Phase 1: Core Business Logic - **PARTIALLY COMPLETE**

**✅ 1.1 Query Execution Service - IMPLEMENTED**
- **File**: `src/services/queryService.js` ✅
- **Tests**: `src/services/queryService.test.js` ✅
- **Features**: Query validation, type processing, request building
- **Quality**: Well-structured with proper error handling

**✅ 1.2 Response Processing Service - IMPLEMENTED**
- **File**: `src/services/responseService.js` ✅
- **Tests**: `src/services/responseService.test.js` ✅
- **Features**: Multipart parsing, header extraction, result normalization
- **Quality**: Comprehensive with TypeScript-style JSDoc, error classes

**✅ 1.3 Streaming Results Hook - IMPLEMENTED**
- **File**: `src/hooks/useStreamingResults.js` ✅
- **Tests**: `src/hooks/__tests__/useStreamingResults.test.js` ✅
- **Features**: Reducer-based state, pagination, record navigation
- **Quality**: Clean reducer pattern with lifecycle management

**✅ IPC Adapter - IMPLEMENTED**
- **File**: `src/ipc/queryClient.js` ✅
- **Features**: Electron/browser abstraction, request normalization
- **Quality**: Good fallback strategy for non-Electron environments

### ❌ CRITICAL GAPS & ISSUES

#### App.jsx Integration - **NOT DONE**
- **Current State**: App.jsx still **1015 lines** (down from 1160, but target was 200-300)
- **Issue**: Services and hooks exist but **ARE NOT BEING USED** in App.jsx
- **Impact**: No actual refactoring benefit - all the old code is still there

#### Missing Components - **NOT STARTED**
- ❌ `QueryConsole.jsx`
- ❌ `ResultsViewer.jsx`
- ❌ `DatabaseSelector.jsx`
- ❌ `QueryHistoryPanel.jsx`
- ❌ `ThemeSelector.jsx`

#### Missing Hooks - **NOT STARTED**
- ❌ `useDatabaseConfig.js`
- ❌ `useQueryHistory.js`
- ❌ `useQueryExecution.js`
- ❌ `useTheme.js`

#### Integration Issues - **CRITICAL**
- App.jsx still contains **40 React hooks** (vs. plan target of <10)
- All the old parsing/execution logic is still embedded in App.jsx
- No evidence that the new services are being imported/used

### 📊 CURRENT VS. TARGET STATE

| Metric | Current | Target | Status |
|--------|---------|---------|---------|
| App.jsx lines | 1015 | 200-300 | ❌ |
| Services | 3/3 | 3/3 | ✅ |
| Hooks | 1/5 | 5/5 | ❌ |
| Components | 3/8 | 8/8 | ❌ |
| App.jsx hooks | 40 | <10 | ❌ |
| Test coverage | Good for services | 85%+ overall | ⚠️ |

### 🚨 CRITICAL ISSUES

#### 1. **False Success** - Services Exist But Aren't Used
- Created beautiful, well-tested services but **App.jsx ignores them completely**
- This is like building a new engine but leaving the old one in the car
- **Zero practical benefit** from the refactoring work done so far

#### 2. **Plan Execution Failure**
- Plan clearly stated "Extract core logic FROM App.jsx"
- Instead, logic was **duplicated** in services while **keeping original**
- This creates maintenance burden of having two implementations

#### 3. **Missing Integration Strategy**
- No clear migration path from old App.jsx code to new services
- Services and App.jsx have different interfaces/patterns
- Risk of introducing bugs during integration

## Original Analysis (Pre-Implementation)

**App.jsx Complexity (Historical):**
- **1160 lines** with **80+ functions/methods** and **48 React hooks**
- Multiple responsibilities: UI rendering, data fetching, response parsing, query execution, history management, theme handling, pagination, streaming, etc.
- Heavy state management with 20+ useState declarations
- Complex business logic mixed with presentation logic

**Existing Architecture (Historical):**
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

## 🎯 REQUIRED NEXT STEPS (Priority Order)

### Phase 1A: **Emergency Integration** (1-2 days) - **CRITICAL**
**Goal**: Make existing services actually useful by integrating them into App.jsx

1. **Replace App.jsx query execution** with `queryService.executeQuery()`
   - Import and use existing queryService
   - Remove duplicated query execution logic from App.jsx
   - Maintain exact same functionality/interface

2. **Replace App.jsx response parsing** with `responseService` functions
   - Import parseMultipartToTableData, parseMultipartResponse
   - Remove parsing functions from App.jsx
   - Ensure same parsing behavior

3. **Replace App.jsx streaming logic** with `useStreamingResults` hook
   - Integrate existing useStreamingResults hook
   - Remove manual pagination state management
   - Migrate to reducer pattern

4. **Remove duplicated logic** from App.jsx after integration
   - Delete old functions after successful replacement
   - Verify no dead code remains

5. **Verify no functionality regressions**
   - Test all query types (xquery, javascript, sparql)
   - Test streaming and non-streaming responses
   - Test pagination and record navigation

**Success Criteria**:
- App.jsx reduced to <800 lines
- Services are actively used (not just created)
- Zero functionality changes for end users
- All existing tests still pass

### Phase 1B: **Hook Extraction** (2-3 days)
**Goal**: Replace remaining useState/useEffect with custom hooks

1. Create and integrate `useDatabaseConfig`
   - Extract database selection/configuration logic
   - Manage connection status and validation
   - Replace 5-8 useState calls in App.jsx

2. Create and integrate `useQueryExecution`
   - Wrap queryService with React state management
   - Handle loading states, errors, cancellation
   - Replace query execution state logic

3. Create and integrate `useQueryHistory`
   - Extract history management from App.jsx
   - Handle persistence via Electron API
   - Replace history-related useState calls

4. Create and integrate `useTheme`
   - Extract theme/Monaco theme management
   - Handle localStorage persistence
   - Replace theme-related useState calls

**Success Criteria**:
- App.jsx reduced to <500 lines
- Custom hooks replace 15-20 useState calls
- Hook logic is unit testable
- App.jsx focuses on orchestration, not state details

### Phase 1C: **Component Decomposition** (3-4 days)
**Goal**: Break App.jsx into focused, manageable components

1. Extract `QueryConsole` component (~200-250 lines)
   - Query editor, execute button, type selector
   - Database selector integration
   - Uses useQueryExecution hook

2. Extract `ResultsViewer` component (~150-200 lines)
   - Table/Raw/Parsed view switching
   - Pagination controls, record navigation
   - Uses useStreamingResults hook

3. Extract `DatabaseSelector` component (~100-150 lines)
   - Database dropdown, connection status
   - Server configuration, credentials
   - Uses useDatabaseConfig hook

4. Extract `QueryHistoryPanel` component (~100-150 lines)
   - History list rendering
   - Load/Delete actions, search/filter
   - Uses useQueryHistory hook

5. Extract `ThemeSelector` component (~50-75 lines)
   - Theme dropdown, Monaco integration
   - Uses useTheme hook

**Success Criteria**:
- App.jsx reduced to 200-300 lines (orchestration only)
- 5 focused components with single responsibilities
- Each component is independently testable
- Clean prop interfaces between components

## ORIGINAL PHASES (For Reference)

### Phase 1: Extract Core Business Logic (Priority: High) - ✅ COMPLETE

**✅ 1.1 Query Execution Service** - IMPLEMENTED
- ✅ `src/services/queryService.js` with comprehensive validation
- ✅ `src/services/queryService.test.js` with full test coverage
- ✅ IPC adapter integration via `src/ipc/queryClient.js`

**✅ 1.2 Response Processing Service** - IMPLEMENTED
- ✅ `src/services/responseService.js` with improved boundary parsing
- ✅ `src/services/responseService.test.js` with edge case coverage
- ✅ TypeScript-style JSDoc documentation and error classes

**✅ 1.3 Streaming Results Hook** - IMPLEMENTED
- ✅ `src/hooks/useStreamingResults.js` with reducer pattern
- ✅ `src/hooks/__tests__/useStreamingResults.test.js` with lifecycle tests
- ✅ Cancellation support and lifecycle callbacks

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

## Updated Effort Estimation

### Immediate Priority (Based on Current State)
- **Phase 1A** (Emergency Integration): ~1-2 days (**CRITICAL - must do first**)
- **Phase 1B** (Hook Extraction): ~2-3 days (high impact)
- **Phase 1C** (Component Decomposition): ~3-4 days (medium impact)
- **Phase 4** (Enhanced Testing): ~2-3 days (high value)
- **Phase 5** (Performance): ~1 day (polish)

**Total Remaining Effort**: ~9-13 days to complete refactoring

### Original Estimation (Pre-Implementation)
- **Phase 1** (Extract Services): ✅ COMPLETE (~3 days completed)
- **Phase 2** (Extract Hooks): ~2-3 days (medium impact)
- **Phase 3** (Component Decomposition): ~2-3 days (medium impact)
- **Phase 4** (Enhanced Testing): ~2-3 days (high value)
- **Phase 5** (Performance): ~1 day (polish)

**Original Total**: ~9-13 days for complete refactoring

## Risk Mitigation

1. **Incremental Approach**: Refactor one service/component at a time
2. **Test Coverage**: Maintain/improve test coverage throughout
3. **Feature Parity**: Ensure no functionality is lost during refactoring
4. **Code Reviews**: Thorough review of each phase
5. **Rollback Plan**: Keep original code in feature branches until refactoring is complete

## Success Metrics

### Phase 1A (Emergency Integration)
- [ ] queryService.executeQuery() is used in App.jsx (not duplicated logic)
- [ ] responseService functions are used in App.jsx (parsing logic removed)
- [ ] useStreamingResults hook is used in App.jsx (manual state removed)
- [ ] App.jsx reduced to <800 lines
- [ ] All existing functionality works identically
- [ ] Services show up in App.jsx imports

### Phase 1B (Hook Extraction)
- [ ] useDatabaseConfig replaces database-related useState calls
- [ ] useQueryExecution replaces execution-related useState calls
- [ ] useQueryHistory replaces history-related useState calls
- [ ] useTheme replaces theme-related useState calls
- [ ] App.jsx reduced to <500 lines
- [ ] React hooks count in App.jsx reduced to <20

### Phase 1C (Component Decomposition)
- [ ] App.jsx reduced to 200-300 lines (orchestration only)
- [ ] 5 focused components created and integrated
- [ ] Each component has single responsibility
- [ ] Components use appropriate custom hooks
- [ ] Component interfaces are clean (minimal props)

### Final Success Criteria
- [ ] All business logic covered by unit tests (>90%)
- [ ] No functionality regressions throughout refactoring
- [ ] Improved development velocity for new features
- [ ] Reduced bug reports related to state management
- [ ] Improved code review speed and quality

## 📋 VERDICT ON CURRENT STATE

**Status**: Refactoring is 30% complete but **0% effective**
**Issue**: Built great foundations but failed to migrate existing code
**Priority**: Immediate integration work (Phase 1A) required to realize any benefits
**Risk**: Current state is worse than original (more complexity, no benefits)

**Next Action**: Execute Phase 1A (Emergency Integration) to make services actually useful