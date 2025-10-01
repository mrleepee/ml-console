# Electron Mock Requirements

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

### R1: Bridge Parity
- Expose all preload keys: `httpRequest`, `evalStream`, `streamToDisk`, `readStreamParts`, `onEvalStreamProgress`, `runCommand`, full `database` namespace, `platform`, and `versions` (`electron/preload.js:5-41`).
- Include the missing `cancelQuery` method expected by `src/ipc/queryClient.js:78-90`; document the preload delta if production code needs alignment.

### R2: HTTP & Streaming Controls
- `httpRequest` default: resolve with `{ status: 200, headers: { 'content-type': 'application/json' }, body: '{}' }`.
- `streamToDisk` default: resolve with `{ success: true, index: { parts: [] } }` and accept overrides for URL/method-specific behavior.
- `readStreamParts` default: resolve with `{ success: true, parts: [], totalParts: 0 }`; throw descriptive error if invoked without a configured directory to aid debugging.
- `onEvalStreamProgress` must register a listener and return an unsubscribe function; emit via a helper `emitEvalStreamProgress(total: number)` exposed to tests.
- `evalStream` mock should reuse the streaming helpers so code paths treating it as a direct IPC handler succeed.

### R3: Command Execution
- Implement `runCommand` as a `vi.fn` returning `{ success: true, stdout: '', stderr: '' }` by default.
- Provide a hook (e.g., `setRunCommandHandler`) to swap behavior per test.

### R4: Database API Coverage
- Supply mocks for `saveQuery`, `getRecentQueries`, `getQueryById`, `searchQueries`, `getQueriesByType`, `updateQueryStatus`, `deleteQuery`, and `getStats` with sensible defaults (`{ success: true, … }`).
- Allow per-method override via dependency injection (e.g., factory accepts partial overrides) without mutating shared state across test files.

### R5: Cancellation Support
- Define `cancelQuery` to resolve by default and record invocations so tests can assert `window.electronAPI.cancelQuery` usage.
- Expose helper `setCancelQueryHandler` to simulate rejection scenarios.

### R6: Environment Metadata
- Provide deterministic `platform` (default `'darwin'`) and `versions` object (mock Node/Electron/Chrome strings) so UI can render version badges in tests.
- Permit overriding via factory options for platform-specific logic.

### R7: Reset & Lifecycle
- Export `installElectronMock(options)` and `resetElectronMock()` utilities. `reset` must restore defaults, clear all spies, and remove event listeners.
- Ensure `beforeEach` in `src/test/setup.jsx` calls `resetElectronMock()` to avoid cross-test pollution.

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
