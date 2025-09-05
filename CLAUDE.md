# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ML Console is an Electron-based desktop application for executing XQuery and JavaScript queries against MarkLogic databases. The app provides a query console interface with digest authentication support and includes a test harness for endpoint validation.

## Development Commands

### Core Development
- `npm run dev` - Start development server (Vite frontend at localhost:1420) and Electron
- `npm run build` - Build production version  
- `npm run preview` - Preview production build
- `npm run electron` - Launch Electron with existing server
- `npm run electron-dev` - Start Vite and Electron together
- `npm run dist` - Build production and package the Electron app

### Testing
- `npm run e2e` - Run Playwright E2E tests
- `npm run e2e:headed` - Run E2E tests with browser UI visible
- `npm run e2e:electron` - Run Electron-specific E2E tests with mocked HTTP

### Dependencies
- **@monaco-editor/react**: Monaco Editor React wrapper for syntax highlighting
- **better-sqlite3**: Local query history storage
- **highlight.js**: Alternative syntax highlighting (used alongside Monaco)
- **@playwright/test**: E2E testing framework for Electron apps

### Running the App
- `npm run dev` - Start Vite and Electron with hot reload
- `npm run dist` - Build distributable Electron application

## Architecture

### Frontend (React + Vite)
- **App.jsx**: Main application component with query console interface
- **TestHarness.jsx**: Comprehensive testing component for MarkLogic endpoints

### Backend (Electron)
- Electron main process (`electron/main.js`) handles HTTP requests
- Implements Digest authentication for MarkLogic App Services
- Secure IPC exposure via `electron/preload.js`
- Test mode support with `MOCK_HTTP` environment variable

### Testing (Playwright)
- E2E tests in `tests/electron.spec.ts` validate Electron app functionality
- Mocked HTTP responses for reliable testing without MarkLogic dependency
- Tests record rendering, Monaco editor formatting, and UI interactions

### Key Features
- Dual-tab interface: Query Console and Test Harness
- Support for both XQuery and JavaScript query execution
- Real-time query results with multipart/mixed response parsing
- Monaco Editor integration for syntax highlighting and code formatting
- Connection testing with multiple MarkLogic endpoints
- Session ID management for query context
- Table view with structured record display and navigation

### HTTP Request Flow
The app uses the Electron main process for requests:
1. Frontend invokes `window.electronAPI.httpRequest` with URL, method, headers, body
2. Electron main handles digest authentication challenges automatically
3. Response parsed for multipart/mixed content from MarkLogic `/v1/eval` endpoint

### MarkLogic Integration
- Primary endpoint: `/v1/eval` for query execution
- Test endpoints: Query Console endpoints (`/qconsole/endpoints/*`)
- Default database ID: `7682138842179613689`
- Authentication: Digest auth with configurable credentials

## Important Notes

### Digest Authentication
- Implemented in `electron/main.js` using Node `crypto`
- Handles WWW-Authenticate challenges and generates proper Authorization headers

### Development Environment
- Vite dev server runs on port 1420
- HMR on port 1421
- E2E tests use port 1421 with mocked HTTP responses

### Monaco Editor Integration
- **Record Rendering**: Monaco editor displays query results with syntax highlighting
- **Language Detection**: Content-Type headers map to Monaco language modes (JSON, XML, HTML, JavaScript)
- **Auto-formatting**: JSON and XML content automatically formatted on render
- **Features**: Line numbers, folding, word wrap, read-only mode for results
- **Performance**: Memoized component prevents unnecessary re-renders

### View Modes
- **Table View**: Structured display of multipart records with Monaco editor per record
  - Fixed navigation buttons (↑ Prev/↓ Next) in results header
  - Record counter showing current position (e.g., "2 / 5")
  - Smooth scroll-to-record functionality
  - Active record highlighting with visual emphasis
  - Keyboard shortcuts: Ctrl+↑ (previous), Ctrl+↓ (next)
- **Parsed Text**: Clean text output using Monaco editor
- **Raw Output**: Unprocessed multipart response with Monaco editor

### E2E Testing
- **Playwright Integration**: Automated testing of Electron app functionality
- **Mocked HTTP**: Tests use `MOCK_HTTP=1` environment variable for reliable testing
- **Record Validation**: Tests verify proper record rendering and Monaco editor formatting
- **UI Testing**: Validates query execution, view mode switching, and navigation features