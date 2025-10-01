# Electron Mock Requirements

## Implementation Status

### Phase 1: Core Mock Infrastructure ✅ COMPLETE
**Branch**: `feature/electron-mock-phase1`
**Commits**: 09e8b52, c4f95fe
**Status**: Implemented and passing core tests (databaseApi 12/12, services 18/19)

**Delivered**:
- Complete mock factory in `src/test/electronMock.js` with all preload.js APIs
- Install/reset lifecycle helpers with `beforeEach` integration
- Full streaming mock suite: `streamToDisk`, `readStreamParts`, `onEvalStreamProgress`, `evalStream`
- All database methods matching production schema: `searchQueries`, `getQueriesByType`, `updateQueryStatus`, `getStats`
- Platform and versions metadata with defaults
- DOM globals setup for React compatibility

**Known Issues**:
- Some test files (`useQueryHistory.simple.test.js`) set `global.window = {}` which wipes DOM constructors - requires test file updates (not mock issues)
- One service test failing due to unrelated query formatting

### Phase 2: Test Scenario Flexibility ✅ COMPLETE
**Branch**: `feature/electron-mock-phase2`
**Commits**: ab1d5a2, d917694
**Status**: Implemented with comprehensive examples and Codex-reviewed fixes

**Delivered**:
- `setDatabaseOverrides()` - Override any database method per-test with call history clearing
- `setRunCommandHandler()` - Customize command execution with error prevention
- `emitStreamProgress()` - Emit progress events for UI testing
- `setPlatform()` / `setAppVersions()` - Override environment metadata per-test
- Factory options for `installElectronMock()` - Configure at install time
- Module state management - Centralized tracking prevents cross-test pollution
- Comprehensive examples file with 20+ usage patterns

**Critical Fixes (Codex Review)**:
- Added `mockClear()` before applying overrides to prevent call history pollution
- Guard against null/undefined in setDatabaseOverrides (treats as restore defaults)
- Error handling for setRunCommandHandler called before init
- Fixed example file with proper beforeEach and async/await patterns

### Phase 3: Maintenance & Alignment 📋 FUTURE
- Automated parity checker
- Usage documentation
- Type definitions

---

## Background
- Renderer code depends on the preload bridge (`electron/preload.js`) for IPC helpers, streaming, and database access.
- Vitest suite currently stubs only `httpRequest` plus a partial `database` object (`src/test/setup.jsx:100-129`).
- Any test touching streaming, command execution, or extended database methods throws because those APIs are undefined.
- `src/ipc/queryClient.js` and `src/components/StreamedResultViewer.jsx` already expect richer Electron behavior, so gaps block future coverage.

## Goals
- Provide a single Electron mock factory that mirrors every property exposed by `contextBridge.exposeInMainWorld('electronAPI', …)`.
- Allow tests to opt into scenario-specific responses without rewriting global state.
- Keep mocks deterministic, easily resettable, and friendly to Vitest spying (`vi.fn`).

## Scope
- Vitest environment setup (`src/test/setup.jsx`) and any shared helpers used to install/uninstall the mock.
- Renderer-facing Electron API surface only (no main-process behavior beyond return payload shapes).

### Out of Scope
- Changes to Playwright `_electron` integration tests.
- Alterations to production preload logic beyond documenting expectations.

## Functional Requirements

### R1: Bridge Parity ✅ COMPLETE (Phase 1)
- Expose all preload keys: `httpRequest`, `evalStream`, `streamToDisk`, `readStreamParts`, `onEvalStreamProgress`, `runCommand`, full `database` namespace, `platform`, and `versions` (`electron/preload.js:5-41`).
- ~~Include the missing `cancelQuery` method expected by `src/ipc/queryClient.js:78-90`~~ **Decision**: Removed from mock as it doesn't exist in `electron/preload.js`. `queryClient.cancelQuery` already handles absence gracefully by returning `false`.

### R2: HTTP & Streaming Controls ✅ COMPLETE (Phase 1)
- `httpRequest` default: resolve with MarkLogic management API responses for servers/databases, generic multipart for queries.
- `streamToDisk` default: resolve with `{ success: true, index: { directory, totalParts: 10, metadata } }`.
- `readStreamParts` default: resolve with `{ success: true, parts: [...], hasMore }`.
- `onEvalStreamProgress` registers listener and returns unsubscribe function; internal helper `_emitProgress` available.
- `evalStream` mock returns `{ success: true, data }`.

### R3: Command Execution ✅ COMPLETE
- **Phase 1**: Implement `runCommand` as `vi.fn` returning `{ success: true, stdout, stderr, exitCode: 0 }`.
- **Phase 2**: `setRunCommandHandler(handler)` for per-test overrides with call history clearing and initialization safety.

### R4: Database API Coverage ✅ COMPLETE
- **Phase 1**: All 8 methods implemented with production-accurate schemas.
- **Phase 2**: `setDatabaseOverrides(overrides)` for per-method injection with:
  - Call history clearing to prevent test pollution
  - Null-safe (treats falsy as restore defaults)
  - No global state mutation between tests

### R5: Cancellation Support ❌ NOT NEEDED
- ~~Define `cancelQuery`~~ **Decision**: Not in preload.js, `queryClient` handles gracefully.

### R6: Environment Metadata ✅ COMPLETE
- **Phase 1**: `platform` and `versions` with sensible defaults.
- **Phase 2**:
  - `setPlatform(platform)` for per-test override
  - `setAppVersions(versions)` for version testing
  - Factory options support at install time
  - Reset clears all overrides

### R7: Reset & Lifecycle ✅ COMPLETE (Phase 1)
- `installElectronMock()` and `resetElectronMock()` exported from `src/test/electronMock.js`.
- `beforeEach` in `src/test/setup.jsx` calls `resetElectronMock()` and clears log capture.
- `afterAll` restores `console.log`.

## Non-Functional Requirements
- Implementation must use `vi.fn()` for every callable to keep compatibility with existing assertion patterns.
- All defaults must be synchronous or resolved promises to avoid hanging Vitest runs.
- No mutation of global objects other than `window.electronAPI` and helper namespaces installed by the mock.

## Acceptance Criteria
- Vitest suites touching streaming (`queryClient.readStreamParts`, `supportsStreaming`) run without throwing.
- Future tests can assert progress callbacks by driving `emitEvalStreamProgress`.
- Query history hooks can exercise `searchQueries`, `getQueriesByType`, and `updateQueryStatus` without adding ad-hoc stubs.
- Cancelling a query in tests returns `true` without manual boilerplate.
- `resetElectronMock()` invoked in `beforeEach` keeps test state isolated (verified by introducing overrides in one test and confirming absence in the next).

## Open Questions
- Should the mock surface file-system side effects for streamed data (temporary directories, persisted parts)? Proposed answer: not initially; return in-memory structures unless integration tests demand more fidelity.
- Do we need a CLI hook to toggle between fetch and Electron paths during tests? Pending confirmation after adopting the mock factory.
