# UI Real Estate Optimization - Requirements & Specification

## Overview
Maximize user workspace efficiency by providing configurable layout controls for the editor and results panes.

## User Story
As a MarkLogic developer, I want to customize my workspace layout so that I can optimize screen real estate based on my current task (writing queries vs analyzing results).

## Requirements

### 1. Configurable Pane Heights (Settings-Based)
**Requirement:** Allow users to configure editor and results pane heights as percentages in Settings.

- **Settings Location:** Settings tab → Layout section
- **Configuration:**
  - Editor Height: Percentage slider (20% - 80%, default 40%)
  - Results Height: Automatically calculated (100% - editor height)
- **Persistence:** Settings persist across sessions (localStorage)
- **Constraints:**
  - Editor minimum: 20% (ensures usability)
  - Editor maximum: 80% (ensures results visible)
  - Total must equal 100% (editor + results)

**Acceptance Criteria:**
- [ ] Settings tab contains "Layout" section
- [ ] Editor height slider with percentage display
- [ ] Results height auto-calculated and displayed
- [ ] Changes apply immediately without page refresh
- [ ] Settings persist in localStorage
- [ ] Query History pane unaffected by changes

---

### 2. Full Screen (Maximize/Minimize) Buttons
**Requirement:** Provide quick maximize/minimize toggles for editor and results panes.

- **Button Placement:**
  - Editor: Top-right corner of editor pane (near Execute button)
  - Results: Top-right corner of results pane (near Table View dropdown)
- **Behavior:**
  - **Maximize:** Expand pane to ~90% of available height, collapse other pane to ~10%
  - **Minimize:** Restore to configured percentages from Settings
  - **Icon:** Expand/collapse arrows or maximize/minimize icons
- **State Management:**
  - Only one pane can be maximized at a time
  - Maximizing editor minimizes results (and vice versa)
  - State is temporary (not persisted, reverts on refresh)
- **Query History:** Unaffected by maximize/minimize actions

**Acceptance Criteria:**
- [ ] Maximize button visible on editor pane
- [ ] Maximize button visible on results pane
- [ ] Clicking maximize expands pane to ~90%, collapses other to ~10%
- [ ] Clicking minimize restores configured percentages
- [ ] Only one pane maximized at a time
- [ ] Icons change based on state (maximize ⇄ minimize)
- [ ] Query History remains visible and functional
- [ ] State does not persist (refresh resets to settings)

---

### 3. Compact Results Header
**Requirement:** Reduce vertical space used by results header to maximize result viewing area.

- **Current State:** 2 header lines with default line height
- **Target State:** 2 header lines with reduced line height (compact)
- **Elements to Compact:**
  - Line 1: "Results" title, Table View dropdown, pagination controls
  - Line 2: Content Type, Datatype, XPath information
- **Design:**
  - Reduce padding/margins between lines
  - Reduce font size if needed (maintain readability)
  - Use flexbox alignment for vertical centering
  - Target: Reduce header from ~80px to ~50px (example)

**Acceptance Criteria:**
- [ ] Results header visually more compact
- [ ] All controls remain accessible and clickable
- [ ] Text remains readable
- [ ] Header height reduced by ~30-40%
- [ ] No layout shifts or overflow issues

---

## Technical Architecture

### State Management
```typescript
// Settings state (persisted)
interface LayoutSettings {
  editorHeightPercent: number; // 20-80, default 40
  resultsHeightPercent: number; // auto-calculated
}

// Runtime state (temporary)
interface LayoutState {
  isEditorMaximized: boolean;
  isResultsMaximized: boolean;
}
```

### Component Changes

**Settings Component:**
- Add Layout section with slider control
- Implement localStorage persistence
- Emit layout change events

**App/Main Layout:**
- Subscribe to layout settings changes
- Apply height percentages via inline styles or CSS variables
- Handle maximize/minimize button clicks

**Editor Pane:**
- Add maximize/minimize button
- Bind height to settings/state

**Results Pane:**
- Add maximize/minimize button
- Bind height to settings/state
- Compact header styles

### CSS Approach
```css
/* CSS Variables for dynamic heights */
:root {
  --editor-height: 40%;
  --results-height: 60%;
}

.editor-pane {
  height: var(--editor-height);
}

.results-pane {
  height: var(--results-height);
}

/* Compact header */
.results-header {
  padding: 0.25rem 0.5rem; /* reduced from default */
  gap: 0.25rem; /* reduced spacing */
  min-height: 50px; /* compact target */
}
```

---

## Non-Functional Requirements

### Performance
- Layout changes must be instant (<50ms perceived lag)
- No jank or layout shifts during transitions
- Smooth animations (optional, 200ms max)

### Accessibility
- Buttons must have ARIA labels (e.g., "Maximize editor", "Minimize results")
- Keyboard shortcuts optional (Ctrl+Shift+E for editor, Ctrl+Shift+R for results)
- Focus management maintained during maximize/minimize

### Browser Compatibility
- Must work in Electron (primary target)
- Should work in modern browsers (Chrome, Firefox, Safari)

### User Experience
- Settings provide predictable, persistent layout
- Maximize/minimize provides quick, temporary adjustments
- Query History always accessible (no layout conflicts)

---

## Out of Scope
- Horizontal split (editor/results side-by-side) - future enhancement
- Resizable dividers (drag to resize) - future enhancement
- Multiple layout presets (e.g., "Writing", "Debugging") - future enhancement
- Floating/detached panes - future enhancement

---

## Success Metrics
- Users can configure workspace layout to preference
- Quick maximize/minimize reduces clicks needed for common tasks
- Compact header increases visible result rows per screen

## Implementation Status

### Phase 1: Settings-Based Height Configuration ✅ COMPLETED

**Implemented:**
- ✅ Added `editorHeightPercent` (20-80%, default 40%) and `resultsHeightPercent` (auto) to EditorPreferencesContext
- ✅ Added validation and clamping on localStorage load (20-80% range enforcement)
- ✅ Created Layout section in Settings tab with range slider (20-80%, step 5)
- ✅ Applied height via inline style: `height: ${editorHeightPercent}vh`
- ✅ Automatic localStorage persistence via existing context mechanism
- ✅ Added ARIA label for accessibility
- ✅ Real-time UI updates when slider changes

**Files Modified:**
- [src/contexts/EditorPreferencesContext.jsx](src/contexts/EditorPreferencesContext.jsx) - Added layout preferences with validation
- [src/App.jsx](src/App.jsx) - Added Layout section to Settings, applied heights to Query editor

**Testing Verified:**
- Slider updates from 40% → 60% reflected immediately in UI
- localStorage correctly stores: `editorHeightPercent: 60, resultsHeightPercent: 40`
- Editor container applies: `height: 60vh` (computed to 560.398px)
- Results height auto-calculates and displays: "40% (auto)"
- Invalid values from localStorage are clamped to 20-80% range

**Codex Review Addressed:**
- ✅ Fixed slider to use clamped `updatePreferences()` for consistency
- ✅ Added validation on localStorage load to clamp out-of-range values
- ✅ Added ARIA label to slider for accessibility
- ⚠️ Known limitation: Fixed `minHeight: 260px` on editor can cause mismatch on small viewports (acceptable trade-off)

**Acceptance Criteria:**
- ✅ Settings tab contains "Layout" section
- ✅ Editor height slider with percentage display
- ✅ Results height auto-calculated and displayed
- ✅ Changes apply immediately without page refresh
- ✅ Settings persist in localStorage
- ✅ Query History pane unaffected by changes

---

### Phase 2: Maximize/Minimize Buttons
**Status:** Not started

### Phase 3: Compact Results Header
**Status:** Not started
