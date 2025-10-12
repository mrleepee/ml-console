# Technical Debt

## Query History Panel Code Duplication

**Issue:** The Query History panel implementation is duplicated in two locations:

1. **Active Implementation:** [src/App.jsx:787-883](src/App.jsx#L787-L883) - Inline JSX rendering
2. **Unused Component:** [src/components/QueryHistoryPanel.jsx](src/components/QueryHistoryPanel.jsx) - Reusable component (never imported)

**Impact:**
- Changes must be made in two places (e.g., arrow direction fix required edits to both files)
- Future divergence guaranteed as only App.jsx is actually rendered
- Increased maintenance burden and bug surface area

**Resolution:**
Replace the inline implementation in App.jsx with the QueryHistoryPanel component:

```jsx
// In App.jsx, replace lines 787-883 with:
import QueryHistoryPanel from './components/QueryHistoryPanel';

// Then use it:
<QueryHistoryPanel
  showHistory={showHistory}
  onToggleHistory={() => setShowHistory(!showHistory)}
  queryHistory={queryHistory}
  historyLoading={historyLoading}
  onLoadQuery={loadQueryFromHistory}
  onDeleteQuery={deleteQueryFromHistory}
  onRefreshHistory={loadQueryHistory}
/>
```

**Benefits:**
- Single source of truth
- Easier testing and maintenance
- Consistent behavior across potential future uses

**Created:** 2025-10-07
**Related Commits:** c41a675 (QueryHistoryPanel fix), ce352db (App.jsx fix)
