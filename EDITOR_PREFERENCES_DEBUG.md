# Editor Preferences Issue Analysis

## Problem Statement

The Monaco editor font size controls in the ML Console application are not working. Users can see the UI state change (font size display updates from 25px → 24px → 25px), but the actual Monaco editor text size does not change visually.

## Current Implementation

### Editor Preferences System
- **Hook**: `src/hooks/useEditorPreferences.js` - Manages localStorage persistence and preference state
- **Controls**: `src/components/QueryEditorControls.jsx` - UI controls for font size +/- buttons
- **Integration**: `src/components/QueryEditor.jsx` and `src/components/MonacoViewer.jsx` - Monaco editor integration

### Font Size Control Flow
1. User clicks font size +/- button
2. `useEditorPreferences` hook updates `fontSize` state
3. React state update triggers `useEffect` in QueryEditor/MonacoViewer
4. `useEffect` calls `editor.updateOptions({ fontSize: newValue })`
5. ❌ **Monaco editor text size does not change visually**

## Investigation History

### Attempted Solutions

#### 1. Initial Implementation (Failed)
```javascript
// Separate useEffect for preferences
useEffect(() => {
  if (editorRef.current) {
    editorRef.current.updateOptions({
      fontSize: preferences.fontSize,
      // ...other options
    });
  }
}, [preferences.fontSize, ...]);
```
**Issue**: useEffect hooks not executing properly, dependencies missing from theme loading.

#### 2. Dependency Array Fix (Failed)
```javascript
// Added preferences to theme useEffect dependencies
}, [theme, preferences.fontSize, preferences.lineNumbers, preferences.wordWrap, preferences.minimap]);
```
**Issue**: Still not working after restart.

#### 3. Theme Reload Approach (Current - Still Failing)
```javascript
// Single useEffect that reloads theme with all preferences
useEffect(() => {
  if (editorRef.current && monacoRef.current && isValidTheme(theme)) {
    loadAndDefineTheme(monacoRef.current, theme).then(() => {
      editorRef.current.updateOptions({
        theme: themeId,
        fontSize: preferences.fontSize,
        lineNumbers: preferences.lineNumbers,
        wordWrap: preferences.wordWrap,
        minimap: { enabled: preferences.minimap },
      });
    });
  }
}, [theme, preferences.fontSize, preferences.lineNumbers, preferences.wordWrap, preferences.minimap]);
```
**Issue**: Theme reloading approach still not working.

## Observed Behavior

### What Works
- ✅ UI state updates correctly (font size display changes)
- ✅ localStorage persistence (preferences saved/loaded)
- ✅ Other editor controls (theme changes work perfectly)
- ✅ Font size changes work **when theme is changed**

### What Doesn't Work
- ❌ Monaco editor font size doesn't change when +/- buttons clicked
- ❌ `editor.updateOptions()` calls appear to have no visual effect
- ❌ Font size only updates if theme is switched

### Key Insight
**Font updates only work if you switch the Monaco theme.** This suggests the theme loading process correctly applies all options, but isolated `updateOptions()` calls do not.

## Technical Details

### Monaco Editor Integration
- Uses `@monaco-editor/react` package
- Editor instances stored in `editorRef.current`
- Theme system loads custom themes via `loadAndDefineTheme()`

### State Management
- `useEditorPreferences` hook manages preferences with localStorage
- React state updates trigger useEffect hooks
- Font size range: 8px to 32px with 1px increments

### Logging Output
```javascript
// Added logging shows:
console.log('📈 Increasing font size from 25px to 26px'); // ✅ Triggers
console.log('Reloading theme with preferences:', { fontSize: 26 }); // ✅ Triggers
console.log('Successfully applied theme and preferences'); // ✅ Triggers
```

## Debugging Attempts

### Browser Tools MCP
- Attempted to use browser-tools MCP for DOM inspection
- Chrome extension setup required but not completed
- Unable to inspect Monaco editor DOM directly

### Console Logging
- Added extensive logging to track state changes
- Confirmed all React hooks and functions execute correctly
- Confirmed `updateOptions()` calls are made with correct values

### Manual Testing
- Confirmed theme changes apply font preferences correctly
- Confirmed isolated font size changes do not work
- UI controls respond but Monaco editor remains unchanged

## Potential Root Causes

### 1. Monaco Editor updateOptions() Limitations
- Monaco may not respect fontSize changes after initial render
- May require full theme reload or editor recreation

### 2. CSS Override Issues
- External CSS may be overriding Monaco's font-size styles
- Theme definitions may have hardcoded font sizes

### 3. React/Monaco Integration Issues
- `@monaco-editor/react` wrapper may not propagate options correctly
- Timing issues between React renders and Monaco updates

### 4. Theme System Interference
- Custom theme loading may reset options after updateOptions() calls
- Theme cache may be preventing option updates

## Next Steps

### Immediate Actions
1. **Force Theme Reload**: Instead of `updateOptions()`, trigger complete theme reload on preference changes
2. **DOM Inspection**: Set up browser-tools properly to inspect Monaco DOM
3. **Minimal Reproduction**: Create isolated test case with just Monaco + font size

### Alternative Approaches
1. **Editor Recreation**: Recreate Monaco editor instance on font size change
2. **CSS Variables**: Use CSS custom properties to control font size
3. **Theme Variants**: Create theme variants with different font sizes
4. **Monaco Direct API**: Bypass React wrapper, use Monaco API directly

### Investigation Priorities
1. Determine why `updateOptions()` calls don't affect visual rendering
2. Understand the relationship between theme loading and option persistence
3. Identify if this is a Monaco, React wrapper, or application-specific issue

## Environment
- **Framework**: React with Vite
- **Monaco**: `@monaco-editor/react`
- **Platform**: Electron app with web interface
- **Browser**: Chrome-based renderer in Electron

## Files Modified
- `src/hooks/useEditorPreferences.js` - Enhanced logging
- `src/components/QueryEditor.jsx` - Theme reload approach
- `src/components/MonacoViewer.jsx` - Theme reload approach
- `src/components/QueryEditorControls.jsx` - Font size controls

---

**Status**: Issue persists after multiple attempted solutions. Need deeper investigation into Monaco editor behavior and potentially alternative implementation approach.