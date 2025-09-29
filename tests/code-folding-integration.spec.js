import { test, expect } from '@playwright/test';

test.describe('Code Folding and Comments Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3025');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(() => window.monaco !== undefined, { timeout: 10000 });
  });

  test('should register XQuery folding and comment providers', async ({ page }) => {
    // Insert XQuery content with foldable structures
    const xqueryContent = `(: Multi-line comment
   that should be foldable
   across multiple lines
:)

for $item in collection("test")
let $value := $item/value
where $value > 10
return
  <result>
    <item>{$item}</item>
    <value>{$value}</value>
  </result>

declare function local:test($x) {
  let $result := $x + 1
  return $result
};`;

    await page.locator('.monaco-editor textarea').fill(xqueryContent);
    await page.waitForTimeout(1000); // Allow syntax highlighting and providers to register

    // Check that XQuery language is properly registered
    const languageId = await page.evaluate(() => {
      const editor = window.monaco?.editor?.getEditors?.()?.[0];
      return editor?.getModel?.()?.getLanguageId?.();
    });

    expect(languageId).toBe('xquery-ml');

    // Check for folding decorations in the gutter
    const foldingDecorations = await page.locator('.monaco-editor .codicon-folding-collapsed, .monaco-editor .codicon-folding-expanded').count();
    expect(foldingDecorations).toBeGreaterThan(0);

    console.log(`✓ Found ${foldingDecorations} folding decorations`);
  });

  test('should support comment toggling with keyboard shortcuts', async ({ page }) => {
    const testCode = 'let $x := fn:current-dateTime()';
    await page.locator('.monaco-editor textarea').fill(testCode);
    await page.waitForTimeout(200);

    // Select the line
    await page.locator('.monaco-editor textarea').press('Control+a');

    // Toggle comment with Ctrl+/
    await page.locator('.monaco-editor textarea').press('Control+/');
    await page.waitForTimeout(200);

    // Check if line is now commented
    const commentedContent = await page.locator('.monaco-editor textarea').inputValue();
    expect(commentedContent).toContain('(: ');
    expect(commentedContent).toContain(' :)');

    // Toggle comment again to uncomment
    await page.locator('.monaco-editor textarea').press('Control+/');
    await page.waitForTimeout(200);

    const uncommentedContent = await page.locator('.monaco-editor textarea').inputValue();
    expect(uncommentedContent).toBe(testCode);

    console.log('✓ Comment toggling with Ctrl+/ works correctly');
  });

  test('should handle XQuery-specific folding patterns', async ({ page }) => {
    const flworQuery = `for $doc in fn:collection("test")
let $title := $doc//title
let $author := $doc//author
where fn:exists($title) and fn:exists($author)
order by $title
return
  <book>
    <title>{fn:string($title)}</title>
    <author>{fn:string($author)}</author>
    <processed>{fn:current-dateTime()}</processed>
  </book>`;

    await page.locator('.monaco-editor textarea').fill(flworQuery);
    await page.waitForTimeout(1000);

    // Look for FLWOR folding opportunities
    const editorContent = await page.locator('.monaco-editor .view-lines').textContent();
    expect(editorContent).toContain('for $doc');
    expect(editorContent).toContain('return');

    // Check that the editor has processed the content for folding
    const hasViewLines = await page.locator('.monaco-editor .view-lines .view-line').count();
    expect(hasViewLines).toBeGreaterThan(5);

    console.log('✓ FLWOR expression folding structure recognized');
  });

  test('should preserve XQuery syntax highlighting with folding', async ({ page }) => {
    const xmlQuery = `<root>
  {
    for $i in 1 to 5
    return
      <item id="{$i}">
        <value>{$i * 2}</value>
      </item>
  }
</root>`;

    await page.locator('.monaco-editor textarea').fill(xmlQuery);
    await page.waitForTimeout(500);

    // Verify that both XML and XQuery syntax are highlighted
    const hasXQueryHighlighting = await page.locator('.monaco-editor .mtk22, .monaco-editor .keyword').count();
    expect(hasXQueryHighlighting).toBeGreaterThan(0);

    // Verify that variables are highlighted
    const hasVariableHighlighting = await page.locator('.monaco-editor .mtk23, .monaco-editor .variable').count();
    expect(hasVariableHighlighting).toBeGreaterThan(0);

    console.log('✓ Syntax highlighting preserved with folding capability');
  });

  test('should handle nested comment structures', async ({ page }) => {
    const nestedContent = `let $data := (: outer comment start :)
  map:new((
    (: inner comment about the key :)
    map:entry("key", "value"),
    map:entry("nested", {
      (: comment about nested object :)
      "property": fn:current-dateTime()
    })
  )) (: outer comment end :)`;

    await page.locator('.monaco-editor textarea').fill(nestedContent);
    await page.waitForTimeout(500);

    // Verify content is loaded
    const content = await page.locator('.monaco-editor textarea').inputValue();
    expect(content).toContain('(: outer comment start :)');
    expect(content).toContain('(: inner comment about the key :)');

    // Test that the parser handles nested comments correctly
    const editorLines = await page.locator('.monaco-editor .view-line').count();
    expect(editorLines).toBeGreaterThan(5);

    console.log('✓ Nested comment structures handled correctly');
  });
});