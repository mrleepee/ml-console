# Bundle Size Analysis - Baseline Metrics

**Date**: October 1, 2025
**Vite Version**: 6.3.5
**Build Configuration**: Phase 1 improvements applied

## Baseline Bundle Size

### Production Build (`npm run build`)

```
dist/index.html                     0.55 kB │ gzip:   0.33 kB
dist/assets/index-myetsB0S.css     94.12 kB │ gzip:  15.55 kB
dist/assets/monaco-DGO1LHqt.js     21.82 kB │ gzip:   7.65 kB
dist/assets/index-BOv-bae5.js   1,243.58 kB │ gzip: 256.11 kB
```

**Total Bundle Size**:
- Raw: **1.36 MB** (1,360 KB)
- Gzipped: **280 KB** (including all assets)
- Total dist size: **2.0 MB** (includes themes)

### Bundle Composition

1. **Main Application Bundle** (`index-BOv-bae5.js`): 1.24 MB
   - Contains: React, App code, utilities, ANTLR parser, Monaco dependencies
   - Gzipped: 256 KB

2. **Monaco Editor Chunk** (`monaco-DGO1LHqt.js`): 22 KB
   - Contains: @monaco-editor/react wrapper
   - Gzipped: 7.65 KB
   - **Note**: This is ONLY the React wrapper, not the full Monaco editor

3. **Styles** (`index-myetsB0S.css`): 94 KB
   - Contains: Tailwind CSS, DaisyUI components
   - Gzipped: 15.55 KB

4. **Monaco Themes** (`config/monaco-themes/themes/`): ~475 KB
   - 55 theme JSON files
   - Loaded on-demand via fetch()
   - Not included in main bundle

### Monaco Editor Analysis

**Current State**:
- Monaco is NOT tree-shaken despite `vite-plugin-monaco-editor` not being used
- The `monaco-DGO1LHqt.js` chunk (22 KB) is just the React wrapper
- Full Monaco editor code appears to be bundled in `index-BOv-bae5.js`
- XQuery language mode is custom-implemented via ANTLR

**Monaco in `node_modules`**: 98 MB (uncompressed)
**Monaco in production bundle**: Estimated ~200-300 KB (needs verification)

### Build Warnings

```
(!) /Users/lpollington/Dev/ml-console/src/utils/monacoXquery.js is dynamically imported
by /Users/lpollington/Dev/ml-console/src/utils/monacoOptimizations.js but also statically
imported by /Users/lpollington/Dev/ml-console/src/App.jsx,
/Users/lpollington/Dev/ml-console/src/components/MonacoViewer.jsx,
/Users/lpollington/Dev/ml-console/src/components/QueryEditor.jsx,
dynamic import will not move module into another chunk.
```

**Impact**: `monacoXquery.js` cannot be code-split because it's both:
- Statically imported by App.jsx, QueryEditor, MonacoViewer
- Dynamically imported by monacoOptimizations.js

**Recommendation**: Convert to static imports only OR dynamic imports only.

```
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
```

**Analysis**: Main bundle (1.24 MB) exceeds recommended 500 KB limit by **~750 KB**.

## Phase 1 Improvements Applied

### R1: Unified Vitest Setup ✅
- **Status**: Already correct
- `vitest.config.js` correctly references `./src/test/setup.jsx`
- No changes needed

### R5: Static Asset Emission ✅
- **Plugin**: `vite-plugin-static-copy` v3.1.3
- **Configuration**: Copies `config/monaco-themes/themes` → `dist/config/monaco-themes/themes`
- **Result**: ✅ Successfully copied 55 theme files (475 KB total)
- **Verification**: Themes accessible at runtime via fetch()

### R6: Bundle Analysis ✅
- **Plugin**: `rollup-plugin-visualizer` v6.0.3
- **Output**: `dist/stats.html` (217 KB)
- **Features**: Gzip/Brotli size analysis, interactive treemap
- **Manual Chunks**: Separated Monaco wrapper into `monaco-DGO1LHqt.js`

## Phase 2 Implementation Plan

### Priority 1: Code Split ANTLR Parser (⭐⭐⭐⭐⭐)

**Impact**: Reduce initial bundle by ~1.2 MB (65%) → **Target: <600 KB initial**

**Current Problem**:
- Parser is imported statically in multiple files
- Entire parser loads on app startup
- Users without XQuery editing don't need it

**Solution**: Lazy load parser only when XQuery language support is needed

**Implementation Steps**:

1. **Create async parser loader** (`src/utils/xquery-parser/loader.js`):
```javascript
// Lazy load ANTLR parser modules
let parserPromise = null;

export async function loadXQueryParser() {
  if (!parserPromise) {
    parserPromise = Promise.all([
      import('./XQueryLexer.js'),
      import('./XQueryParser.js'),
      import('./VariableExtractor.js'),
      import('antlr4')
    ]);
  }
  return parserPromise;
}
```

2. **Update monacoXquery.js** to load parser on-demand:
```javascript
// Replace static imports with dynamic
export async function registerXQueryLanguage(monaco) {
  const [{ XQueryLexer }, { XQueryParser }, { VariableExtractor }] =
    await loadXQueryParser();

  // Register language with loaded modules
  monaco.languages.register({ id: 'xquery' });
  // ... rest of registration
}
```

3. **Update QueryEditor.jsx** to handle async registration:
```javascript
useEffect(() => {
  loader.init().then(async monaco => {
    monacoRef.current = monaco;
    defineCustomMonacoThemes(monaco);

    // Lazy load XQuery language support
    if (language === 'xquery') {
      await monacoOptimizationManager.registerXQueryLanguageOptimized(monaco);
    }
  });
}, [language]); // Re-run when language changes
```

**Expected Result**:
- Initial bundle: ~600 KB (down from 1.79 MB)
- XQuery chunk: ~1.2 MB (loads on first XQuery editor mount)
- First load improvement: **67% reduction**

### Priority 2: Fix monacoXquery.js Mixed Import Warning (⭐⭐⭐⭐)

**Current Issue**:
```
monacoXquery.js is dynamically imported by monacoOptimizations.js
but also statically imported by App.jsx, QueryEditor.jsx, MonacoViewer.jsx
```

**Solution**: Convert ALL imports to dynamic (aligns with Priority 1)

**Files to Update**:
1. Remove static imports from:
   - `src/App.jsx`
   - `src/components/QueryEditor.jsx`
   - `src/components/MonacoViewer.jsx`

2. Keep only dynamic import in `monacoOptimizations.js`

**Expected Result**:
- Build warning eliminated
- Enables proper code splitting
- monacoXquery.js can be chunked separately

### Priority 3: Lazy Load YAML Parser (⭐⭐⭐)

**Impact**: Reduce initial bundle by ~80 KB (4.3%)

**Current Problem**:
- YAML library imported statically for xquery.yaml config
- Entire YAML parser loaded upfront
- Only needed when registering XQuery language

**Solution**: Convert YAML to JSON at build time OR lazy load

**Option A: Build-time conversion** (Recommended):
```javascript
// vite.config.js - Add custom plugin
function yamlToJson() {
  return {
    name: 'yaml-to-json',
    transform(code, id) {
      if (id.endsWith('?raw') && id.includes('.yaml')) {
        const yaml = require('yaml');
        const parsed = yaml.parse(code);
        return `export default ${JSON.stringify(parsed)}`;
      }
    }
  };
}
```

**Option B: Lazy load YAML parser**:
```javascript
// marklogicConfigLoader.js
async function loadConfig() {
  const yaml = await import('yaml');
  const config = await fetch('./config/marklogic/xquery.yaml?raw');
  return yaml.parse(await config.text());
}
```

**Expected Result**:
- Remove yaml dependency from main bundle (-80 KB)
- Faster initial load

### Priority 4: Analyze Monaco Editor Size (⭐⭐)

**Current State**:
- Monaco wrapper already code-split (monaco-DGO1LHqt.js: 22 KB)
- Monaco editor core embedded in main bundle
- Need to measure actual Monaco size

**Investigation Needed**:
- Monaco may already be efficiently tree-shaken
- Check if `@monaco-editor/react` includes full editor
- Consider manual Monaco loader if bundle is large

**Deferred until after Priority 1-3** (may not be needed)

### Priority 5: Tailwind CSS Optimization (⭐)

**Current**: 94 KB raw / 15.55 KB gzipped

**Low Priority** because:
- Gzip compression very effective (83% reduction)
- Only 15.55 KB over network
- Other optimizations have higher impact

**Future Consideration**:
- Audit unused DaisyUI components
- Consider PurgeCSS for additional reduction

## Success Metrics

### Phase 1 (Achieved) ✅
- ✅ Bundle analysis available (`dist/stats.html`)
- ✅ Theme assets copied to production build
- ✅ Gzip/Brotli sizes measured
- ✅ Baseline metrics documented

### Phase 2 Targets (Updated with Detailed Analysis)

| Metric | Current | Target | Improvement |
|--------|---------|--------|-------------|
| **Initial Bundle** | 1.79 MB | <600 KB | **67% reduction** |
| **Initial Gzipped** | 327 KB | <150 KB | **54% reduction** |
| **XQuery Chunk** | (in main) | ~1.2 MB | Lazy loaded |
| **Build Warnings** | 1 mixed import | 0 | **100% resolved** |

**Priority Implementation Order**:
1. ⭐⭐⭐⭐⭐ Code split ANTLR parser → -1.2 MB
2. ⭐⭐⭐⭐ Fix monacoXquery.js imports → eliminates warning
3. ⭐⭐⭐ Lazy load YAML parser → -80 KB
4. ⭐⭐ Investigate Monaco size (conditional)
5. ⭐ CSS optimization (future)

## Detailed Dependency Analysis (via dist/stats.html)

### Top 10 Largest Dependencies

**Total Bundle**: 1.79 MB raw / 327.34 KB gzipped

| Dependency | Raw Size | % of Bundle | Gzipped | Description |
|------------|----------|-------------|---------|-------------|
| **XQueryParser.js** | 698.64 KB | 37.56% | ~140 KB | ANTLR-generated parser |
| **antlr4.web.mjs** | 304.80 KB | 16.39% | 42.04 KB | ANTLR runtime library |
| **XQueryLexer.js** | 205.59 KB | 11.05% | ~41 KB | ANTLR-generated lexer |
| **react-dom** | 131.45 KB | 7.07% | 42.06 KB | React DOM renderer |
| **yaml** library | ~80 KB | ~4.3% | ~20 KB | YAML parser (xquery.yaml config) |
| **React** | ~80 KB | ~4.3% | ~25 KB | React core |
| **Scheduler** | ~10 KB | ~0.5% | ~3 KB | React scheduler |
| **App components** | ~50 KB | ~2.7% | ~12 KB | Application code |
| **Monaco utilities** | ~40 KB | ~2.2% | ~10 KB | Theme/editor utils |
| **Other dependencies** | ~200 KB | ~10.8% | ~50 KB | Misc utilities |

### Critical Findings

#### 🔴 ANTLR Parser: 1.21 MB (65% of bundle!)

**Combined Size**:
- XQueryParser.js: 698.64 KB (37.56%)
- XQueryLexer.js: 205.59 KB (11.05%)
- antlr4 runtime: 304.80 KB (16.39%)
- **Total: ~1.21 MB raw** (~223 KB gzipped)

**Impact**: The XQuery parser accounts for **nearly two-thirds** of the entire application bundle. This is by far the largest optimization opportunity.

**Why it's large**:
- ANTLR generates extensive state machines for parsing
- Full XQuery grammar is complex (expressions, functions, paths, FLWOR, etc.)
- Runtime includes parser engine, lexer engine, error recovery, tree walking

**Code Splitting Opportunity**: ⭐⭐⭐⭐⭐ (Highest Priority)
- Parser only needed when editor mounts
- Can be lazy-loaded via dynamic import
- Would reduce initial bundle by ~1.2 MB (65%)

#### 🟡 React Ecosystem: ~220 KB (12%)

**Components**:
- react-dom: 131.45 KB (7.07%)
- react: ~80 KB (4.3%)
- scheduler: ~10 KB (0.5%)

**Code Splitting Opportunity**: ⭐ (Low Priority)
- React must be in main bundle (required immediately)
- Already efficiently tree-shaken
- Gzip compression effective (42 KB)

#### 🟢 YAML Library: ~80 KB (4.3%)

**Usage**: Parses `config/marklogic/xquery.yaml` for function definitions

**Code Splitting Opportunity**: ⭐⭐⭐ (Medium Priority)
- Only needed when loading XQuery language config
- Could be lazy-loaded with parser registration
- Would reduce bundle by ~80 KB

**Alternative**: Consider parsing YAML at build time and importing as JSON

## Conclusion

### Phase 1 Results ✅

Successfully established baseline metrics and infrastructure:
- ✅ Static theme assets deploy correctly (475 KB themes via vite-plugin-static-copy)
- ✅ Bundle analysis infrastructure (`rollup-plugin-visualizer`)
- ✅ Detailed dependency size breakdown via `dist/stats.html`
- ✅ Identified ANTLR parser as 65% of bundle (1.21 MB!)

### Phase 2 Strategy

**Key Finding**: ANTLR XQuery parser dominates bundle (65% / 1.21 MB)

**Optimization Approach**:
1. **Code split ANTLR parser** → Reduce initial load by 67%
2. **Fix mixed import warnings** → Enable proper chunking
3. **Lazy load YAML parser** → Additional 80 KB reduction
4. **Measure results** → Verify <600 KB initial bundle

**Expected Outcome**:
- Initial bundle: **1.79 MB → ~600 KB** (67% smaller)
- XQuery features lazy-loaded on first use
- Better user experience for non-XQuery workflows

**Next Action**: Implement Priority 1 (ANTLR code splitting) from Phase 2 plan above.
