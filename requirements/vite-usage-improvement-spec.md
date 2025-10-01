# Vite Usage Improvement Requirements

## Background
- Current renderer build uses a minimal `vite.config.js` tailored only for React and hard-codes settings for Electron preview ports.
- Vitest configuration is duplicated between `vite.config.js` and `vitest.config.js`, causing diverging setup options.
- The renderer bundle includes Monaco Editor and ancillary assets without targeted optimization, increasing build size and load time.
- Static assets such as Monaco theme JSON files live under `config/` and are not copied into the production `dist/` output, creating runtime fetch failures.

## Goals
- Consolidate Vite configuration for predictable dev/test pipelines across renderer and Vitest.
- Improve Electron integration by relying on maintained Vite plugins instead of custom shell orchestration.
- Reduce renderer bundle weight and provide tooling to monitor bundle growth.
- Ensure static configuration assets required at runtime are available in dev, preview, and packaged builds.

## Current Pain Points
1. `vite.config.js` references `./src/test/setup.js` while Vitest actually relies on `src/test/setup.jsx`, so Vite-driven test entry points lack Electron mocks and crash.
2. Vitest options live in both `vite.config.js` and `vitest.config.js`, causing inconsistent behavior depending on the entry command.
3. Dev workflow chains `concurrently`, `wait-on`, and a raw Electron launch, which is brittle and duplicates capability already provided by the Vite Electron ecosystem.
4. Monaco Editor ships all worker scripts and language support, inflating the renderer output size.
5. Monaco theme JSON files under `config/monaco-themes` are not emitted into `dist/`, so production builds cannot load themes at runtime.
6. No bundle analysis tooling runs as part of the build, leaving bundle regressions undetected.

## Scope
- Renderer build tooling, Vitest configuration, and Electron dev orchestration.
- Monaco-related bundling, worker handling, and static asset packaging.
- Build-time analysis tooling focused on bundle structure.

### Out of Scope
- Changes to Monaco feature behavior beyond build/packaging adjustments.
- Electron main-process logic unrelated to build/startup.
- UI/UX modifications aside from impacts of Monaco theme asset availability.

## Functional Requirements

### R1: Unified Vitest Setup
- Replace the `test` block in `vite.config.js` with a reference to `vitest.config.js`, or ensure both configs import a shared definition so the setup file is `src/test/setup.jsx` for every test runner invocation.
- Confirm the unified configuration includes existing exclusions (`tests/**`, `node_modules/**`) and global registrations.

### R2: Electron-Oriented Dev Flow
- Integrate [`vite-plugin-electron`](https://github.com/vitejs/awesome-vite#electron) to manage the main and preload processes during development and build.
- Remove redundant `concurrently`/`wait-on` scripts once the plugin handles server readiness and Electron relaunch.

### R3: Renderer Polyfills and Externals
- Add [`vite-plugin-electron-renderer`](https://github.com/vitejs/awesome-vite#electron) so renderer bundles share Electron/Node dependencies correctly and avoid manual global assumptions.
- Configure externals to prevent bundling Electron built-ins.

### R4: Monaco Optimization
- Adopt [`vite-plugin-monaco-editor`](https://github.com/vitejs/awesome-vite#framework-integrations) to include only the Monaco languages/workers required for the console’s XQuery workflow.
- Verify the plugin’s options preserve the current Monaco features (themes, autocompletion) while reducing bundle size.

### R5: Static Asset Emission
- Use [`vite-plugin-static-copy`](https://github.com/vitejs/awesome-vite#utilities) to copy `config/monaco-themes/**` into `dist/config/monaco-themes/**` during `vite build`.
- Ensure development (`vite dev`), preview (`vite preview`), and packaged Electron builds resolve `/config/monaco-themes/...` requests successfully.

### R6: Bundle Insight
- Configure [`rollup-plugin-visualizer`](https://github.com/vitejs/awesome-vite#build--analysis) (exposed as a Vite plugin) with a command such as `npm run build:analyze` to generate an interactive report under `dist/analyze.html`.
- Document how to open the report and use it to monitor Monaco, highlight.js, and DaisyUI contribution to bundle size.

## Non-Functional Requirements
- Maintain compatibility with existing Electron preview port environment variables (`PREVIEW_PORT`).
- Keep `npm run test` and `npm run dev` entry points unchanged for developers, aside from internal orchestration improvements.
- Ensure no new global dependencies or services are required; all plugins must install as devDependencies.

## Dependencies
- Vite v6.x (already in use).
- Electron v30 (already in use) compatible with `vite-plugin-electron`.
- Node.js version consistent with project tooling (see workspace defaults).

## Acceptance Criteria
- Running `npm run test` loads `src/test/setup.jsx` regardless of invocation path and completes without missing Electron mocks.
- `npm run dev` starts Vite and Electron via `vite-plugin-electron` with automatic relaunch on source changes.
- Production build artifacts in `dist/` contain Monaco worker files only for required languages and include copied theme JSON assets.
- Executing the bundle analysis command produces an HTML report highlighting bundle composition.
- CI (if configured) runs with updated scripts without additional manual steps.

## Risks & Mitigations
- **Plugin adoption churn:** Vet plugin configuration in a feature branch with regression testing before merging.
- **Monaco feature regression:** Run existing Monaco-focused tests (`tests/monaco-query-editor.spec.ts`, unit suites) after enabling the optimization plugin.
- **Electron packaging impact:** Verify `npm run dist` consumes the new build output without reworking electron-builder targets.
