# Phase 2 Week 2: Enhanced FLWOR Implementation (Revised)

## Codex Review Findings Addressed

**Critical Risks Identified:**
- ❌ Incomplete FLWOR coverage (missing window keywords, nested clauses)
- ❌ Theme testing scalability (54 browsers will timeout CI)
- ❌ Electron asset loading failure (fetch('/themes/') breaks when packaged)
- ❌ Timeline unrealistic (grammar + automation in 1 week)

**Revised Strategy: Focus on FLWOR Excellence**

## Week 2 Scope: Enhanced FLWOR Only

**Theme system moved to Week 3** to allow proper implementation of both.

### Complete XQuery 3.0+ FLWOR Support

#### 1. Core Extended Clauses
```xquery
for $item at $pos in $collection
let $value := compute($item)
where $value > 10
group by $category := $item/category
count $total
order by $category ascending empty least collation "unicode"
return element result {
  attribute category { $category },
  attribute count { $total },
  $item
}
```

#### 2. Window Expressions (Complete XQuery 3.0 Implementation)
```xquery
for tumbling window $w in (1 to 10)
    start at $s when true
    end at $e when $e - $s eq 2
return <window>{$w}</window>

for sliding window $w in (1 to 10)
    start at $s when $s mod 2 eq 0
    only end at $e when $e - $s eq 1
return <window>{$w}</window>

for tumbling window $w in (1 to 10)
    start at $s when true
    only end at $e when $e - $s eq 2
    previous $prev
    next $next
return <window start="{$s}" end="{$e}" prev="{$prev}" next="{$next}">{$w}</window>
```

#### 3. Advanced FLWOR Features
- **Positional Variables**: `for $item at $pos in $seq`
- **Grouping**: `group by $key := expr`
- **Aggregation**: `count $var` (bound to preceding `for` or `let`)
- **Ordering Options**: `stable order by`, `ascending`/`descending`, `empty greatest`/`empty least`
- **Collation**: `collation "unicode"`
- **Let Bindings**: `let $var := expr`
- **Type Annotations**: `for $item as item()+ in $seq`
- **Allowing Empty**: `for $item allowing empty in $seq` (contextual binding)

## Technical Implementation

### 1. Monaco Monarch Grammar Extensions

```javascript
// Enhanced FLWOR state machine with correct Monaco syntax
flwor_expression: [
  // Window expressions must be checked before general 'for' pattern
  [/\bfor\s+(tumbling|sliding)\s+window\b/, 'keyword.flwor', '@flwor_window'],

  // Core FLWOR keywords with proper state transitions
  [/\bfor\b/, 'keyword.flwor', '@flwor_for'],
  [/\blet\b/, 'keyword.flwor', '@flwor_let'],
  [/\bwhere\b/, 'keyword.flwor', '@flwor_where'],
  [/\bgroup\s+by\b/, 'keyword.flwor', '@flwor_group'],
  [/\bstable\s+order\s+by\b|\border\s+by\b/, 'keyword.flwor', '@flwor_order'],
  [/\breturn\b/, 'keyword.flwor', '@flwor_return'],

  { include: '@root' }
],

// State definitions with correct Monaco syntax and context handling
flwor_for: [
  [/\$[a-zA-Z_][\w\-]*/, 'variable'],
  [/\bat\b/, 'keyword.flwor'], // positional variable
  [/\bas\b/, 'keyword.flwor'], // type annotation
  [/\ballowing\s+empty\b/, 'keyword.flwor'], // context-specific highlighting
  [/\bin\b/, 'keyword.flwor', '@pop'], // terminate for clause
  { include: '@root' }
],

flwor_let: [
  [/\$[a-zA-Z_][\w\-]*/, 'variable'],
  [/\bas\b/, 'keyword.flwor'], // type annotation
  [/:=/, 'operator', '@pop'], // terminate let clause
  { include: '@root' }
],

flwor_where: [
  // Transition to next FLWOR clause states instead of just popping
  [/\bfor\b/, { token: 'keyword.flwor', next: '@flwor_for' }],
  [/\blet\b/, { token: 'keyword.flwor', next: '@flwor_let' }],
  [/\bgroup\s+by\b/, { token: 'keyword.flwor', next: '@flwor_group' }],
  [/\border\s+by\b/, { token: 'keyword.flwor', next: '@flwor_order' }],
  [/\breturn\b/, { token: 'keyword.flwor', next: '@flwor_return' }],
  { include: '@root' }
],

flwor_group: [
  [/\$[a-zA-Z_][\w\-]*/, 'variable'],
  [/:=/, 'operator'],
  // Split count and variable for proper tokenization
  [/\bcount\b/, 'keyword.flwor'],
  [/\$[a-zA-Z_][\w\-]*/, 'variable'], // count variable
  // Transition to next FLWOR clause states
  [/\bfor\b/, { token: 'keyword.flwor', next: '@flwor_for' }],
  [/\blet\b/, { token: 'keyword.flwor', next: '@flwor_let' }],
  [/\bwhere\b/, { token: 'keyword.flwor', next: '@flwor_where' }],
  [/\border\s+by\b/, { token: 'keyword.flwor', next: '@flwor_order' }],
  [/\breturn\b/, { token: 'keyword.flwor', next: '@flwor_return' }],
  { include: '@root' }
],

flwor_order: [
  [/\bascending\b|\bdescending\b/, 'keyword.flwor'],
  [/\bempty\s+(greatest|least)\b/, 'keyword.flwor'], // multi-word pattern
  [/\bcollation\b/, 'keyword.flwor'],
  [/\breturn\b/, { token: 'keyword.flwor', next: '@flwor_return' }], // transition to return state
  { include: '@root' }
],

flwor_return: [
  [/\{/, { token: 'delimiter.curly', next: '@push' }], // Track nested expressions
  [/\}/, { token: 'delimiter.curly', next: '@pop' }],
  { include: '@flwor_nested' } // Handle nested FLWOR
],

flwor_window: [
  [/\$[a-zA-Z_][\w\-]*/, 'variable'], // window variable
  [/\bin\b/, 'keyword.flwor'],
  // Correct XQuery 3.0 window clause syntax: start $var (at $pos)? when
  [/\bstart\b/, 'keyword.flwor'],
  [/\bend\b/, 'keyword.flwor'],
  [/\bonly\s+(start|end)\b/, 'keyword.flwor'],
  [/\bat\b/, 'keyword.flwor'], // positional binding
  [/\bwhen\b/, 'keyword.flwor'], // clause condition
  [/\bprevious\b/, 'keyword.flwor'], // window modifiers
  [/\bnext\b/, 'keyword.flwor'],
  [/\breturn\b/, { token: 'keyword.flwor', next: '@flwor_return' }], // transition to return state
  { include: '@root' }
],

// Nested FLWOR handling with proper unwinding
flwor_nested: [
  // Push into full FLWOR state machine for nested expressions
  [/\bfor\b/, { token: 'keyword.flwor', next: '@flwor_for' }],
  [/\blet\b/, { token: 'keyword.flwor', next: '@flwor_let' }],
  [/\breturn\b/, { token: 'keyword.flwor', next: '@pop' }], // Exit current level
  { include: '@flwor_expression' }
]
```

### 2. Comprehensive Keyword Extension

Add to `config/marklogic/xquery.yaml`:

```yaml
keywords:
  # Existing Phase 1 keywords...

  # Core FLWOR keywords (already exist)
  - for
  - let
  - where
  - order
  - by
  - return

  # Existing ordering keywords (safe to include)
  - ascending
  - descending
  - collation

  # NOTE: Context-dependent keywords NOT added to prevent over-highlighting:
  # - group, stable, empty, greatest, least (handled in grammar patterns only)
  # - tumbling, sliding, window, previous, next (handled in grammar patterns only)
  # - count, allowing, start, end, only (handled in grammar patterns only)

# All FLWOR extensions handled via Monaco grammar multi-word patterns:
# - "group by" (in @flwor_group state)
# - "stable order by" (in @flwor_order state)
# - "allowing empty" (in @flwor_for state)
# - "for tumbling window" / "for sliding window" (in root state)
# - "count $var" (in @flwor_group state)
# - "empty greatest" / "empty least" (in @flwor_order state)
# - "start at $var when" / "end at $var when" (in @flwor_window state)
# - "only start" / "only end" (in @flwor_window state)
# - "previous $var" / "next $var" (in @flwor_window state)
```

### 3. Monaco Tokenizer Integration

```javascript
// Integration into main tokenizer root state
root: [
  // Existing tokenizer rules...

  // Window expressions MUST come before general FLWOR detection
  [/\bfor\s+(tumbling|sliding)\s+window\b/, 'keyword.flwor', '@flwor_window'],

  // General FLWOR detection and state transition
  [/\bfor\b(?=\s+[\$a-zA-Z])/, 'keyword.flwor', '@flwor_expression'],
  [/\blet\b(?=\s+\$)/, 'keyword.flwor', '@flwor_expression'],
  [/\bwhere\b/, 'keyword.flwor', '@flwor_expression'],
  [/\bgroup\s+by\b/, 'keyword.flwor', '@flwor_group'],
  [/\bstable\s+order\s+by\b|\border\s+by\b/, 'keyword.flwor', '@flwor_order'],
  [/\breturn\b/, 'keyword.flwor', '@flwor_return'],

  // Continue with other root rules...
],

// Configuration update for new keyword mappings
keywords: [...existingKeywords, ...flworKeywords],
```

### 4. Root Tokenizer Integration Steps

1. **Add FLWOR Entry Points**: Modify root state to detect FLWOR expressions
2. **Update Keyword Arrays**: Merge new FLWOR keywords into existing configuration
3. **Handle State Re-entry**: Ensure @root includes don't create infinite loops
4. **Preserve Existing Behavior**: Guard against breaking non-FLWOR XQuery

## Implementation Strategy (Extended Timeline)

### Day 1-2: Grammar Foundation & Root Integration
- Extend Monaco tokenizer with all XQuery 3.0 FLWOR keywords
- Implement FLWOR entry points in root tokenizer state
- Add comprehensive regex patterns for window expressions with all modifiers
- Wire new states into Monaco configuration maps

### Day 3-4: Advanced Features & State Machine
- Implement all FLWOR clause states with proper termination conditions
- Add positional variables, grouping, counting, and window modifiers
- Handle ordering options, collation, and contextual keyword binding
- Implement nested FLWOR unwinding with @push/@pop mechanics

### Day 5-6: Integration & Comprehensive Testing
- Create test suites for all FLWOR constructs including edge cases
- Add negative test cases to prevent false positives
- Integration testing with existing XML embedding
- Performance validation for complex nested expressions
- Document new grammar behavior and update README

### Day 7: Risk Mitigation & Validation
- Smoke test Electron build to validate no packaging regressions
- Verify theme compatibility with new tokenizer states
- Create rollback procedures and document known limitations
- Performance benchmarking with large FLWOR expressions

## Test Coverage Strategy

### Unit Tests (Comprehensive Coverage)
```javascript
describe('Enhanced FLWOR Support', () => {
  // Core window expressions
  it('should tokenize tumbling window with all modifiers', () => {
    const xquery = `
      for tumbling window $w in (1 to 10)
          start at $s when true
          only end at $e when $e - $s eq 2
          previous $prev next $next
      return $w
    `;
    // Verify: tumbling, window, start, at, when, only, end, previous, next
  });

  it('should tokenize sliding window expressions', () => {
    const xquery = `
      for sliding window $w in (1 to 10)
          start at $s when $s mod 2 eq 0
          end at $e when $e - $s eq 1
      return $w
    `;
    // Verify: sliding, window, start, at, end, at, when clauses
  });

  // Context-sensitive keywords
  it('should tokenize count only in group by context', () => {
    const xqueryValid = `
      for $item in $collection
      group by $cat := $item/category
      count $total
      return $total
    `;
    const xqueryInvalid = `
      let $count := "should not highlight as FLWOR keyword"
      return $count
    `;
    // Verify context-sensitive highlighting
  });

  it('should tokenize allowing empty only in for context', () => {
    const xquery = `
      for $item allowing empty in $collection
      return $item
    `;
    // Verify contextual "allowing empty" highlighting
  });

  // Nested FLWOR expressions
  it('should handle nested FLWOR with proper unwinding', () => {
    const xquery = `
      for $item in $collection
      let $nested := (
        for $sub in $item/children
        group by $type := $sub/type
        count $subtotal
        order by $type ascending empty least
        return map { $type: $subtotal }
      )
      group by $category := $item/category
      return map { $category: $nested }
    `;
    // Verify nested state @push/@pop mechanics
  });

  // Ordering and collation
  it('should tokenize complex ordering clauses', () => {
    const xquery = `
      for $item in $collection
      stable order by $item/name ascending empty greatest,
                      $item/date descending empty least
                      collation "http://www.w3.org/2005/xpath-functions/collation/codepoint"
      return $item
    `;
    // Verify: stable, order, by, ascending, descending, empty, greatest, least, collation
  });

  // Negative cases
  it('should not over-highlight keywords outside FLWOR', () => {
    const xquery = `
      let $window := "not a window expression"
      let $start := "not a window clause"
      let $count := "not a FLWOR count"
      return ($window, $start, $count)
    `;
    // Verify no false positives for contextual keywords
  });

  // Edge cases
  it('should handle complex mixed FLWOR constructs', () => {
    const xquery = `
      for $item at $pos in $collection
      let $value as xs:double := $item/value
      where $value > 0
      group by $category := $item/@type
      count $itemCount
      for sliding window $recent in $item/history
          start at $start when true
          only end at $end when $end - $start eq 5
      stable order by $category collation "unicode"
      return element result {
        attribute pos { $pos },
        attribute count { $itemCount },
        $recent
      }
    `;
    // Verify complex multi-clause FLWOR with all features
  });
});
```

### Integration Tests
```javascript
describe('FLWOR Integration with XML Embedding', () => {
  it('should handle FLWOR expressions within XML attributes', () => {
    const xquery = `
      <results>
      {
        for $item in $collection
        group by $category := $item/type
        count $total
        return <category name="{$category}" count="{$total}">
          {
            for $subitem in $item[type eq $category]
            order by $subitem/name
            return <item>{$subitem/name/text()}</item>
          }
        </category>
      }
      </results>
    `;
    // Verify FLWOR tokenization within XML context
  });

  it('should maintain XML tokenization within FLWOR return clauses', () => {
    const xquery = `
      for sliding window $batch in $data
          start at $s when true
          end at $e when $e - $s eq 10
      return
        <batch start="{$s}" end="{$e}">
          <![CDATA[Raw data: {string-join($batch, ',')}]]>
          <!-- Processed {count($batch)} items -->
        </batch>
    `;
    // Verify XML constructs (CDATA, comments) within FLWOR
  });
});

describe('Performance Integration', () => {
  it('should handle deeply nested FLWOR without tokenizer slowdown', () => {
    // Large FLWOR expressions with multiple nesting levels
    // Performance benchmark: < 100ms tokenization
  });

  it('should maintain syntax highlighting performance with mixed content', () => {
    // Combined FLWOR + XML + XQuery expressions
    // Memory usage validation for complex tokenizer state
  });
});
```

### Regression Tests
```javascript
describe('FLWOR Regression Prevention', () => {
  it('should not break existing XQuery 1.0 tokenization', () => {
    const basicXQuery = `
      for $item in collection('test')
      where $item/value > 10
      order by $item/name
      return $item
    `;
    // Verify existing FLWOR still works correctly
  });

  it('should not interfere with function call detection', () => {
    const xquery = `
      let $result := my-function($param)
      let $count := count($sequence)
      return ($result, $count)
    `;
    // Verify function calls still highlighted correctly
  });
});
```

## Success Criteria

### Functional Requirements
- ✅ Complete XQuery 3.0+ FLWOR keyword support
- ✅ Proper tokenization of window expressions
- ✅ Nested FLWOR expression handling
- ✅ Integration with existing XML embedding

### Quality Requirements
- ✅ 100% test coverage on new FLWOR components
- ✅ Zero regressions in existing functionality
- ✅ Performance maintained for complex expressions

### Documentation
- ✅ Updated Monaco grammar documentation
- ✅ FLWOR usage examples in README
- ✅ Technical implementation notes

## Week 3 Preparation

With FLWOR solidly implemented, Week 3 can focus exclusively on:
- Theme system automation (54 Monaco themes)
- Electron asset loading fixes
- Code folding implementation
- Comment toggling
- Performance validation

## Risk Mitigation

### Technical Risks Addressed
- **State Machine Complexity**:
  - All states now have explicit termination conditions
  - Context-sensitive keyword handling prevents over-highlighting
  - Nested FLWOR unwinding with proper @push/@pop mechanics
- **Performance Impact**:
  - Daily benchmarking with large files during implementation
  - Performance integration tests with < 100ms tokenization requirement
  - Memory usage validation for complex state transitions
- **Regression Risk**:
  - Comprehensive regression test suite for existing XQuery 1.0 behavior
  - Integration testing with XML embedding from Phase 1
  - Negative test cases to prevent false positive highlighting

### Timeline Risks Mitigated
- **Extended Timeline**: Realistic 7-day implementation with daily checkpoints
- **Risk Checkpoints**:
  - Day 7 includes Electron packaging smoke test
  - Theme compatibility validation before Week 3
  - Performance validation with complex expressions
- **Incremental Validation**: Daily codex reviews of implementation progress
- **Fallback Planning**: Core window expressions prioritized over advanced modifiers

### Deferred Risk Management
- **Electron Asset Loading**: Smoke test on Day 7 to validate no regressions
- **Theme System Scaling**: Interim validation that FLWOR states don't break themes
- **CI Timeout Issues**: Performance benchmarks establish tokenization limits

---

**Realistic Timeline**: 7 days focused on comprehensive FLWOR implementation with risk mitigation checkpoints.