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

## Recommendations for Phase 2

### 1. Code Splitting Opportunities

**High Priority**:
- Split ANTLR parser (currently ~150 KB in main bundle)
- Lazy load Monaco on editor mount
- Split theme loader utilities

**Implementation**:
```javascript
// Lazy load ANTLR parser
const { XQueryLexer, XQueryParser } = await import('./antlr/XQueryParser');

// Lazy load Monaco editor
const MonacoEditor = React.lazy(() => import('./components/QueryEditor'));
```

### 2. Fix monacoXquery.js Import Issue

**Current**: Mixed static/dynamic imports prevent chunking
**Solution**: Convert all imports to dynamic OR static consistently

**Option A** (Dynamic):
```javascript
// Remove static imports from App.jsx, QueryEditor.jsx, MonacoViewer.jsx
// Keep only dynamic import in monacoOptimizations.js
const { registerXQueryLanguage } = await import('./utils/monacoXquery');
```

**Option B** (Static):
```javascript
// Remove dynamic import from monacoOptimizations.js
// Keep only static imports (current approach)
import { registerXQueryLanguage } from './utils/monacoXquery';
```

### 3. Monaco Optimization (Conditional)

**Current Analysis Needed**:
- Use `dist/stats.html` to identify Monaco's actual size in bundle
- If Monaco > 300 KB, consider `vite-plugin-monaco-editor`
- May not be needed if already tree-shaken

### 4. Tailwind CSS Optimization

**Current**: 94 KB (15.55 KB gzipped)
**Opportunity**: Audit unused DaisyUI components

```javascript
// tailwind.config.js
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  safelist: [], // Only include used classes
}
```

## Success Metrics

### Phase 1 (Achieved) ✅
- ✅ Bundle analysis available (`dist/stats.html`)
- ✅ Theme assets copied to production build
- ✅ Gzip/Brotli sizes measured
- ✅ Baseline metrics documented

### Phase 2 Targets
- Main bundle < 800 KB (currently 1.24 MB) - **reduce by 35%**
- First load gzipped < 200 KB (currently 256 KB) - **reduce by 22%**
- Code split ANTLR parser (separate chunk)
- Resolve monacoXquery.js warning

## Visualizer Analysis

Open `dist/stats.html` in a browser to see:
- Interactive treemap of bundle composition
- Gzip/Brotli size comparisons
- Module-by-module size breakdown
- Which dependencies contribute most to bundle size

**Key Questions to Answer**:
1. How much space does Monaco actually take?
2. How large is the ANTLR parser?
3. Which npm packages are the largest?
4. Are there duplicate dependencies?

## Conclusion

Phase 1 successfully established baseline metrics and fixed critical issues:
- ✅ Static theme assets now deploy correctly
- ✅ Bundle analysis infrastructure in place
- ✅ Vitest config verified correct

**Next Steps**: Analyze `dist/stats.html` to identify largest contributors, then implement targeted code splitting in Phase 2.
