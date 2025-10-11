import { getAllAvailableThemes } from './themeLoader';
import { registerXQueryLanguage, XQUERY_LANGUAGE } from '../services/monaco/monacoXquery';

const XQUERY_TEST_FIXTURE = `
(: Comprehensive XQuery test fixture for theme validation :)
xquery version "3.0-ml";

(: Basic FLWOR with nested XML :)
for $doc in fn:collection("documents")
let $metadata := $doc//meta
where $metadata/@type = "article"
order by $metadata/@created descending
return
  <result>
    <title>{fn:string($doc//title)}</title>
    <count>{fn:count($doc//paragraph)}</count>
  </result>

(: Advanced FLWOR with window expressions :)
for tumbling window $week in (1 to 365)
  start at $start when ($start - 1) mod 7 = 0
  end at $end when $start = $end + 6
let $data := fn:collection("logs")[day = $week]
group by $category := $data/@category
order by fn:count($data) descending
return map:new((
  map:entry("week", $start),
  map:entry("category", $category),
  map:entry("total", fn:count($data))
))

(: XML with embedded XQuery expressions :)
<report created="{fn:current-dateTime()}">
  <summary total="{fn:count(//item)}">{
    for $item in //item[priority = "high"]
    return <urgent>{$item/title}</urgent>
  }</summary>
  <!-- CDATA and processing instructions -->
  <![CDATA[Raw data: {special characters}]]>
  <?xml-stylesheet type="text/xsl" href="report.xsl"?>
</report>

(: Function calls and operators :)
let $users := xdmp:eval('fn:collection("users")')
let $filtered := $users[cts:search(., cts:word-query("active"))]
return if (fn:exists($filtered)) then
  fn:string-join(for $u in $filtered return $u/@name, ", ")
else
  "No active users found"
`;

export class ThemeTestFramework {
  constructor(monaco) {
    this.monaco = monaco;
    this.themes = [];
    this.snapshots = new Map();
  }

  async initialize() {
    if (!this.monaco?.editor) {
      throw new Error('Monaco editor instance required');
    }

    this.themes = getAllAvailableThemes();
    console.log(`Initialized theme testing for ${this.themes.length} themes`);
  }

  createTestEditor() {
    const container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    document.body.appendChild(container);

    registerXQueryLanguage(this.monaco);

    const editor = this.monaco.editor.create(container, {
      value: XQUERY_TEST_FIXTURE,
      language: XQUERY_LANGUAGE,
      theme: 'vs',
      automaticLayout: false,
      minimap: { enabled: false },
      scrollbar: { vertical: 'hidden', horizontal: 'hidden' }
    });

    return { editor, container };
  }

  captureTokenSnapshot(editor, themeName) {
    const model = editor.getModel();
    if (!model) return null;

    const lineCount = model.getLineCount();
    const tokenData = [];

    for (let lineNumber = 1; lineNumber <= lineCount; lineNumber++) {
      try {
        const lineTokens = model.tokenization?.getLineTokens?.(lineNumber);
        if (lineTokens) {
          const tokens = [];
          for (let i = 0; i < lineTokens.getCount(); i++) {
            const startOffset = lineTokens.getStartOffset(i);
            const endOffset = lineTokens.getEndOffset(i);
            const tokenType = lineTokens.getClassName(i);
            const tokenText = model.getValueInRange({
              startLineNumber: lineNumber,
              startColumn: startOffset + 1,
              endLineNumber: lineNumber,
              endColumn: endOffset + 1
            });

            if (tokenText.trim()) {
              tokens.push({
                text: tokenText,
                type: tokenType,
                start: startOffset,
                end: endOffset
              });
            }
          }
          if (tokens.length > 0) {
            tokenData.push({ line: lineNumber, tokens });
          }
        }
      } catch (error) {
        console.warn(`Token capture failed for line ${lineNumber} in theme ${themeName}:`, error);
      }
    }

    return {
      theme: themeName,
      timestamp: new Date().toISOString(),
      totalLines: lineCount,
      tokenizedLines: tokenData.length,
      tokens: tokenData
    };
  }

  async testTheme(themeName) {
    const { editor, container } = this.createTestEditor();

    try {
      await new Promise((resolve) => {
        editor.setModel(editor.getModel());
        this.monaco.editor.setTheme(themeName);

        setTimeout(() => {
          const snapshot = this.captureTokenSnapshot(editor, themeName);
          this.snapshots.set(themeName, snapshot);
          resolve();
        }, 100);
      });
    } catch (error) {
      console.error(`Theme test failed for ${themeName}:`, error);
      this.snapshots.set(themeName, {
        theme: themeName,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    } finally {
      editor.dispose();
      container.remove();
    }
  }

  async runAllThemeTests() {
    console.log('Starting automated theme testing...');
    const startTime = Date.now();

    for (const theme of this.themes) {
      await this.testTheme(theme.name);
      console.log(`✓ Tested theme: ${theme.name}`);
    }

    const duration = Date.now() - startTime;
    console.log(`Completed theme testing in ${duration}ms`);

    return this.generateReport();
  }

  generateReport() {
    const successful = [];
    const failed = [];
    const tokenStats = {};

    for (const [themeName, snapshot] of this.snapshots) {
      if (snapshot.error) {
        failed.push({ theme: themeName, error: snapshot.error });
      } else {
        successful.push(themeName);

        const tokenTypes = new Set();
        snapshot.tokens?.forEach(lineData => {
          lineData.tokens.forEach(token => {
            tokenTypes.add(token.type);
          });
        });

        tokenStats[themeName] = {
          totalTokens: snapshot.tokens?.reduce((sum, line) => sum + line.tokens.length, 0) || 0,
          uniqueTypes: tokenTypes.size,
          tokenizedLines: snapshot.tokenizedLines || 0
        };
      }
    }

    return {
      summary: {
        totalThemes: this.themes.length,
        successful: successful.length,
        failed: failed.length,
        timestamp: new Date().toISOString()
      },
      successful,
      failed,
      tokenStats,
      snapshots: Object.fromEntries(this.snapshots)
    };
  }

  validateTokenConsistency() {
    if (this.snapshots.size === 0) return { consistent: false, message: 'No snapshots available' };

    const baselineTheme = this.snapshots.keys().next().value;
    const baseline = this.snapshots.get(baselineTheme);

    if (!baseline?.tokens) return { consistent: false, message: 'Invalid baseline snapshot' };

    const inconsistencies = [];

    for (const [themeName, snapshot] of this.snapshots) {
      if (themeName === baselineTheme || snapshot.error) continue;

      if (!snapshot.tokens || snapshot.tokens.length !== baseline.tokens.length) {
        inconsistencies.push({
          theme: themeName,
          issue: 'Line count mismatch',
          expected: baseline.tokens.length,
          actual: snapshot.tokens?.length || 0
        });
        continue;
      }

      for (let i = 0; i < baseline.tokens.length; i++) {
        const baselineTokens = baseline.tokens[i].tokens;
        const currentTokens = snapshot.tokens[i].tokens;

        if (baselineTokens.length !== currentTokens.length) {
          inconsistencies.push({
            theme: themeName,
            issue: `Token count mismatch on line ${baseline.tokens[i].line}`,
            expected: baselineTokens.length,
            actual: currentTokens.length
          });
        }
      }
    }

    return {
      consistent: inconsistencies.length === 0,
      inconsistencies,
      message: inconsistencies.length === 0
        ? 'All themes show consistent token structure'
        : `Found ${inconsistencies.length} inconsistencies across themes`
    };
  }
}

export const createThemeTestSuite = (monaco) => new ThemeTestFramework(monaco);