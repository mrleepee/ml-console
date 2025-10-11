# React Best Practices Requirements

Source: React Best Practices – A 10-Point Guide (UXPin, 2024-09-05)

## Status Snapshot
- Master Component Nesting and Parent-Child Relationships: partial
- Optimize Re-Renders: needs attention
- Master Prop Drilling and Context API: aligned
- Employ React Hooks: aligned
- Maintain a Consistent Code Style: aligned with minor gaps
- Keep a Clear Folder Structure: partial
- Agree on Naming Conventions: aligned
- Optimize Component Loading: needs attention
- Make Use of Functional Components: aligned
- Set up Error Boundaries: missing
- Supplemental tips from article: needs attention

## Priority Ranking

### High Priority (Critical Performance & Architecture)

1. **Optimize Re-Renders** (STATUS: needs attention)
   - Impact: Performance degradation from unnecessary renders
   - Blockers: `MemoMonacoEditor` recreated every render in [App.jsx:360-420](src/App.jsx#L360-L420)
   - Inline arrow handlers causing re-renders in [ThemeSelector.jsx:115-175](src/components/ThemeSelector.jsx#L115-L175), [DatabaseSelector.jsx:68-104](src/components/DatabaseSelector.jsx#L68-L104), [QueryHistoryPanel.jsx:90-178](src/components/QueryHistoryPanel.jsx#L90-L178)
   - Keys using index fallbacks: `db-${index}-${config.id}` in [DatabaseSelector.jsx:94](src/components/DatabaseSelector.jsx#L94)

2. **Optimize Component Loading** (STATUS: needs attention)
   - Impact: Large initial bundle, slow time-to-interactive
   - Actions: Lazy-load Monaco editor components, defer theme catalog loading in [ThemeSelector.jsx:24-120](src/components/ThemeSelector.jsx#L24-L120)

3. **Set up Error Boundaries** (STATUS: missing)
   - Impact: Production stability risk—uncaught errors crash entire UI
   - Actions: Create top-level error boundary, wrap editor/history/streaming result trees

### Medium Priority (Architecture & Maintainability)

4. **Master Component Nesting and Parent-Child Relationships** (STATUS: partial)
   - Impact: Maintainability, testability
   - Actions: Extract record rendering and Monaco viewer logic from [App.jsx:200-420](src/App.jsx#L200-L420) into dedicated components

5. **Keep a Clear Folder Structure** (STATUS: partial)
   - Impact: Developer experience, onboarding
   - Actions: Move query history UI, streaming controls, Monaco helpers out of App.jsx into `src/components/` and `src/services/`

### Low Priority (Code Quality)

6. **Supplemental tips from article** (STATUS: needs attention)
   - Impact: Code quality, debugging efficiency
   - Actions: Refactor inline arrows to memoized handlers, add `React.forwardRef` for Monaco wrappers, document React DevTools usage

7. **Maintain a Consistent Code Style** (STATUS: aligned with minor gaps)
   - Impact: Code cleanliness
   - Actions: Remove debug logging from [App.jsx:51](src/App.jsx#L51)

### Already Aligned (No Action Needed)

- **Master Prop Drilling and Context API**: Editor preferences use context correctly
- **Employ React Hooks**: Consistent functional component patterns with proper hooks
- **Agree on Naming Conventions**: PascalCase components, camelCase hooks
- **Make Use of Functional Components**: No class components in codebase

## Detailed Requirements

### Master Component Nesting and Parent-Child Relationships
Article direction: keep parents focused on orchestration and push UI duties into dedicated children.
Current code: `src/App.jsx:1` concentrates query execution, streaming, history, and embeds `MonacoEditor` definitions, increasing coupling.
Requirements:
- Extract record rendering and Monaco viewer logic into standalone modules under `src/components/` so `App` only wires data (refactor `src/App.jsx:200-420`).
- Introduce container components for query history and result navigation instead of handling layout and side-effects inside `App`.

### Optimize Re-Renders
Article direction: rely on memoization utilities and avoid recreating handlers or component factories during render.
Current code: `MemoMonacoEditor` is recreated on each render because it is defined inside `App` (`src/App.jsx:360-420`). Inline arrow handlers dominate JSX (`src/components/ThemeSelector.jsx:115-175`, `src/components/DatabaseSelector.jsx:68-104`, `src/components/QueryHistoryPanel.jsx:90-178`).
Requirements:
- Hoist `MonacoEditor` and the `React.memo` wrapper to module scope or separate files so memoization remains effective.
- Replace inline handler arrows with memoized callbacks via `useCallback` or method references to avoid unnecessary re-renders.
- Ensure list keys rely solely on stable domain identifiers; drop index fallbacks such as `db-${index}-${config.id}` (`src/components/DatabaseSelector.jsx:94`).

### Master Prop Drilling and Context API
Article direction: prevent deep prop chains by leveraging context for shared state.
Current code: Editor preferences already flow through context (`src/contexts/EditorPreferencesContext.jsx:1-170`) and hooks re-export the API.
Requirements:
- Continue routing cross-cutting concerns (theme, preferences, connection state) through context or dedicated hooks instead of expanding prop chains from `App`.

### Employ React Hooks
Article direction: prefer hooks for state, effects, and side-effects in functional components.
Current code: Functional components consistently use `useState`, `useEffect`, `useMemo`, and `useCallback` where appropriate (`src/components/QueryEditor.jsx:1-210`, `src/components/ThemeSelector.jsx:1-210`).
Requirements:
- Preserve hook-based state management; avoid regressing to class components.
- Review effect dependency arrays whenever new props or state values are introduced to prevent stale closures.

### Maintain a Consistent Code Style
Article direction: enforce uniform styling for readability and collaboration.
Current code: ESLint-style naming, docblocks, and Tailwind utility classes are consistent, but debug logging remains in production components (`src/App.jsx:51`).
Requirements:
- Remove transient console logging once debugging is complete.
- Keep shared formatting helpers (e.g., Tailwind class patterns) centralized to avoid drift.

### Keep a Clear Folder Structure
Article direction: organize components and logic into intuitive directories.
Current code: `src/components/`, `src/hooks/`, and `src/contexts/` follow conventions, yet `src/App.jsx` still houses multiple view layers and service calls.
Requirements:
- Move query history UI, streaming result controls, and Monaco helpers into purpose-built components/modules under `src/components/` and `src/services/`.
- Document the intended layout hierarchy in `README.md` when large restructures occur.

### Agree on Naming Conventions
Article direction: adopt consistent naming for files, variables, and props.
Current code: PascalCase components, camelCase hooks, and descriptive prop names match the guidance.
Requirements:
- Keep future modules aligned with the existing casing scheme; update lint rules if new patterns appear.

### Optimize Component Loading
Article direction: lazy-load heavy components and split bundles.
Current code: `MonacoViewer` already uses `React.lazy` (`src/components/MonacoViewer.jsx:1-120`), but `QueryEditor` and the inlined Monaco editor in `App` import `@monaco-editor/react` eagerly (`src/components/QueryEditor.jsx:1-20`, `src/App.jsx:2`).
Requirements:
- Lazy-load editor-heavy components (primary query editor, result viewer) and provide fallbacks to reduce initial bundle cost.
- Defer loading of theme catalogs and other large data until the selector opens (`src/components/ThemeSelector.jsx:24-120`).

### Make Use of Functional Components
Article direction: favor functional components augmented by hooks.
Current code: All reviewed components are functional; no class components remain.
Requirements:
- Maintain functional implementations; if shared lifecycle logic emerges, move it into reusable hooks rather than class components.

### Set up Error Boundaries
Article direction: guard UI trees against runtime crashes using error boundaries.
Current code: no error boundary implementation exists under `src/` (`rg "ErrorBoundary" src` returned empty).
Requirements:
- Implement a top-level error boundary component under `src/components/` and wrap critical trees (editor, history, streamed results) within it.
- Provide user-facing fallback UI and logging hooks for captured errors.

### Supplemental Tips from the Article
Article direction: avoid arrow functions in JSX props, prefer `React.memo`, use `React.forwardRef` when wrapping components, leverage DevTools.
Current code: Inline arrow props persist (`src/components/QueryHistoryPanel.jsx:90-169`); memoization is uneven; no forwardRef usage for higher-order wrappers.
Requirements:
- Refactor frequently re-rendered lists and controls to use memoized handlers and `React.memo` wrappers where profiling shows benefits.
- Adopt `React.forwardRef` when exposing wrapped Monaco components so parent refs remain functional.
- Document React DevTools usage in contributor guidelines to reinforce debugging discipline.

