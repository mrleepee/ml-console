import { describe, it, expect, beforeEach } from 'vitest';
import { XQueryFoldingProvider } from './xqueryFoldingProvider';

describe('XQueryFoldingProvider', () => {
  let provider;
  let mockModel;
  let mockToken;

  beforeEach(() => {
    provider = new XQueryFoldingProvider();
    mockToken = { isCancellationRequested: false };
  });

  const createMockModel = (content) => ({
    getValue: () => content,
    getLineCount: () => content.split('\n').length,
    getLineContent: (lineNumber) => content.split('\n')[lineNumber - 1]
  });

  describe('XQuery Comments', () => {
    it('should fold single-line block comments', () => {
      const content = `(: This is a comment
spanning multiple lines
:)
let $x := 1`;

      mockModel = createMockModel(content);
      const ranges = provider.provideFoldingRanges(mockModel, {}, mockToken);

      expect(ranges).toHaveLength(1);
      expect(ranges[0]).toEqual({
        start: 1,
        end: 3,
        kind: 1 // Comment
      });
    });

    it('should not fold single-line comments', () => {
      const content = `(: Single line comment :)
let $x := 1`;

      mockModel = createMockModel(content);
      const ranges = provider.provideFoldingRanges(mockModel, {}, mockToken);

      expect(ranges).toHaveLength(0);
    });

    it('should handle nested comments correctly', () => {
      const content = `(: Outer comment
(: Inner comment :)
still in outer comment
:)
let $x := 1`;

      mockModel = createMockModel(content);
      const ranges = provider.provideFoldingRanges(mockModel, {}, mockToken);

      expect(ranges).toHaveLength(1);
      expect(ranges[0]).toEqual({
        start: 1,
        end: 4,
        kind: 1 // Comment
      });
    });
  });

  describe('FLWOR Expressions', () => {
    it('should fold basic FLWOR expressions', () => {
      const content = `for $item in collection("data")
let $value := $item/value
where $value > 10
order by $value
return $item`;

      mockModel = createMockModel(content);
      const ranges = provider.provideFoldingRanges(mockModel, {}, mockToken);

      expect(ranges).toHaveLength(1);
      expect(ranges[0]).toEqual({
        start: 1, // for clause
        end: 5,   // return clause
        kind: 0   // Region
      });
    });

    it('should fold nested FLWOR expressions', () => {
      const content = `for $doc in collection("outer")
return
  for $item in $doc/items
  let $value := $item/value
  return $value;`;

      mockModel = createMockModel(content);
      const ranges = provider.provideFoldingRanges(mockModel, {}, mockToken);

      expect(ranges).toHaveLength(2);
      // Outer FLWOR
      expect(ranges[0]).toEqual({
        start: 1,
        end: 5,
        kind: 0
      });
      // Inner FLWOR
      expect(ranges[1]).toEqual({
        start: 3,
        end: 5,
        kind: 0
      });
    });

    it('should handle FLWOR with complex return expressions', () => {
      const content = `for $item in collection("data")
let $value := $item/value
return
  <result>
    <value>{$value}</value>
    <processed>{fn:current-dateTime()}</processed>
  </result>;`;

      mockModel = createMockModel(content);
      const ranges = provider.provideFoldingRanges(mockModel, {}, mockToken);

      expect(ranges).toHaveLength(1);
      expect(ranges[0]).toEqual({
        start: 1,
        end: 7,
        kind: 0
      });
    });
  });

  describe('Curly Braces', () => {
    it('should fold curly brace blocks', () => {
      const content = `let $obj := {
  "key1": "value1",
  "key2": "value2",
  "nested": {
    "inner": "value"
  }
}`;

      mockModel = createMockModel(content);
      const ranges = provider.provideFoldingRanges(mockModel, {}, mockToken);

      expect(ranges).toHaveLength(2);
      // Outer brace
      expect(ranges[0]).toEqual({
        start: 1,
        end: 7,
        kind: 0
      });
      // Inner brace
      expect(ranges[1]).toEqual({
        start: 4,
        end: 6,
        kind: 0
      });
    });

    it('should handle XQuery expressions with braces', () => {
      const content = `<result>{
  for $i in 1 to 10
  return <item>{$i}</item>
}</result>`;

      mockModel = createMockModel(content);
      const ranges = provider.provideFoldingRanges(mockModel, {}, mockToken);

      expect(ranges).toHaveLength(2);
      // Outer brace for XML expression
      expect(ranges[0]).toEqual({
        start: 1,
        end: 4,
        kind: 0
      });
      // FLWOR expression
      expect(ranges[1]).toEqual({
        start: 2,
        end: 3,
        kind: 0
      });
    });
  });

  describe('XML Elements', () => {
    it('should fold XML elements', () => {
      const content = `<root>
  <item id="1">
    <title>First Item</title>
    <description>A detailed description</description>
  </item>
  <item id="2">
    <title>Second Item</title>
  </item>
</root>`;

      mockModel = createMockModel(content);
      const ranges = provider.provideFoldingRanges(mockModel, {}, mockToken);

      expect(ranges).toHaveLength(3);
      // Root element
      expect(ranges[0]).toEqual({
        start: 1,
        end: 9,
        kind: 0
      });
      // First item
      expect(ranges[1]).toEqual({
        start: 2,
        end: 5,
        kind: 0
      });
      // Second item
      expect(ranges[2]).toEqual({
        start: 6,
        end: 8,
        kind: 0
      });
    });

    it('should handle XML with namespaces', () => {
      const content = `<ns:root xmlns:ns="http://example.com">
  <ns:item>
    <ns:title>Namespaced Element</ns:title>
  </ns:item>
</ns:root>`;

      mockModel = createMockModel(content);
      const ranges = provider.provideFoldingRanges(mockModel, {}, mockToken);

      expect(ranges).toHaveLength(2);
      // Root element
      expect(ranges[0]).toEqual({
        start: 1,
        end: 5,
        kind: 0
      });
      // Item element
      expect(ranges[1]).toEqual({
        start: 2,
        end: 4,
        kind: 0
      });
    });

    it('should not fold self-closing XML elements', () => {
      const content = `<root>
  <item id="1"/>
  <item id="2"/>
</root>`;

      mockModel = createMockModel(content);
      const ranges = provider.provideFoldingRanges(mockModel, {}, mockToken);

      expect(ranges).toHaveLength(1);
      expect(ranges[0]).toEqual({
        start: 1,
        end: 4,
        kind: 0
      });
    });
  });

  describe('Function Definitions', () => {
    it('should fold function definitions', () => {
      const content = `declare function local:process-item($item as element()) as element() {
  let $value := $item/value
  return
    <processed>
      <original>{$item}</original>
      <value>{$value}</value>
    </processed>
};`;

      mockModel = createMockModel(content);
      const ranges = provider.provideFoldingRanges(mockModel, {}, mockToken);

      expect(ranges).toHaveLength(1);
      expect(ranges[0]).toEqual({
        start: 1,
        end: 8,
        kind: 0
      });
    });

    it('should handle multiple function definitions', () => {
      const content = `declare function local:func1($x) {
  $x + 1
};

declare function local:func2($y) {
  $y * 2
};`;

      mockModel = createMockModel(content);
      const ranges = provider.provideFoldingRanges(mockModel, {}, mockToken);

      expect(ranges).toHaveLength(2);
      expect(ranges[0]).toEqual({
        start: 1,
        end: 3,
        kind: 0
      });
      expect(ranges[1]).toEqual({
        start: 5,
        end: 7,
        kind: 0
      });
    });
  });

  describe('Helper Methods', () => {
    it('should detect strings correctly', () => {
      expect(provider.isInString('let $x := "test"', 10)).toBe(false);
      expect(provider.isInString('let $x := "test"', 12)).toBe(true);
      expect(provider.isInString("let $x := 'test'", 12)).toBe(true);
      expect(provider.isInString('let $x := "test" + "more"', 20)).toBe(true);
    });

    it('should identify FLWOR keywords', () => {
      expect(provider.isFLWORStart('for $item in collection')).toBe(true);
      expect(provider.isFLWORStart('let $value := $item')).toBe(true);
      expect(provider.isFLWORStart('where $value > 0')).toBe(false);
      expect(provider.isFLWORStart('return $value')).toBe(false);
    });

    it('should identify return clauses', () => {
      expect(provider.isReturnClause('return $item')).toBe(true);
      expect(provider.isReturnClause('return <result/>')).toBe(true);
      expect(provider.isReturnClause('let $return := 1')).toBe(false);
    });

    it('should find common indentation', () => {
      const lines = ['  line1', '  line2', '    line3', '  line4'];
      expect(provider.getCommonIndent(lines)).toBe(2);

      const lines2 = ['    line1', '      line2', '    line3'];
      expect(provider.getCommonIndent(lines2)).toBe(4);

      const lines3 = ['line1', '  line2'];
      expect(provider.getCommonIndent(lines3)).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle cancellation token', () => {
      const content = 'for $i in 1 to 100\nreturn $i';
      mockModel = createMockModel(content);
      mockToken.isCancellationRequested = true;

      const ranges = provider.provideFoldingRanges(mockModel, {}, mockToken);

      expect(ranges).toEqual([]);
    });

    it('should handle malformed XQuery gracefully', () => {
      const content = 'for $item\nlet\nwhere\nreturn';
      mockModel = createMockModel(content);

      const ranges = provider.provideFoldingRanges(mockModel, {}, mockToken);

      // Should not throw and return reasonable results
      expect(ranges).toBeInstanceOf(Array);
    });
  });
});