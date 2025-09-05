import React, { useCallback, useEffect, useRef } from 'react';
import Editor, { useMonaco } from '@monaco-editor/react';

// XQuery language configuration
const xqueryConfig = {
  keywords: [
    'xquery', 'version', 'encoding', 'declare', 'function', 'variable', 'option', 'import', 'module',
    'namespace', 'boundary-space', 'default', 'collation', 'base-uri', 'construction', 'ordering',
    'empty', 'greatest', 'least', 'preserve', 'no-preserve', 'inherit', 'no-inherit', 'strip',
    'for', 'let', 'where', 'order', 'by', 'return', 'if', 'then', 'else', 'some', 'every', 'in',
    'satisfies', 'to', 'div', 'idiv', 'mod', 'union', 'intersect', 'except', 'instance', 'of',
    'treat', 'as', 'castable', 'cast', 'eq', 'ne', 'lt', 'le', 'gt', 'ge', 'is', 'isnot',
    'and', 'or', 'not', 'typeswitch', 'case', 'try', 'catch', 'switch', 'validate', 'text',
    'node', 'comment', 'processing-instruction', 'document-node', 'element', 'attribute',
    'schema-element', 'schema-attribute', 'empty-sequence', 'item', 'document', 'ascending',
    'descending', 'stable', 'external', 'at', 'child', 'descendant', 'attribute', 'self',
    'descendant-or-self', 'following-sibling', 'following', 'parent', 'ancestor',
    'preceding-sibling', 'preceding', 'ancestor-or-self'
  ],
  operators: [
    '=', '!=', '<', '<=', '>', '>=', '+', '-', '*', 'div', 'idiv', 'mod', 'eq', 'ne', 'lt', 'le', 'gt', 'ge',
    'is', 'isnot', 'and', 'or', 'not', 'union', '|', 'intersect', 'except', 'to', 'instance of',
    'treat as', 'castable as', 'cast as'
  ],
  brackets: [
    ['{', '}', 'delimiter.curly'],
    ['[', ']', 'delimiter.bracket'],
    ['(', ')', 'delimiter.parenthesis']
  ],
  tokenizer: {
    root: [
      // XQuery version declaration
      [/xquery\s+version\s+"[^"]*"/, 'keyword.version'],
      
      // Comments
      [/\(:/, 'comment', '@comment'],
      
      // Strings
      [/"([^"\\]|\\.)*"/, 'string'],
      [/'([^'\\]|\\.)*'/, 'string'],
      
      // Numbers
      [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
      [/\d+/, 'number'],
      
      // Keywords
      [/[a-zA-Z_][\w]*/, {
        cases: {
          '@keywords': 'keyword',
          '@default': 'identifier'
        }
      }],
      
      // XPath axes
      [/(child|descendant|attribute|self|descendant-or-self|following-sibling|following|parent|ancestor|preceding-sibling|preceding|ancestor-or-self)::/,'keyword.axis'],
      
      // Operators
      [/[=!<>]=?/, 'operator'],
      [/[+\-*]/, 'operator'],
      [/\bor\b|\band\b|\bnot\b/, 'operator'],
      
      // Delimiters
      [/[{}()\[\]]/, '@brackets'],
      [/[;,.]/, 'delimiter'],
      
      // Whitespace
      [/\s+/, 'white'],
    ],
    
    comment: [
      [/[^(:)]+/, 'comment'],
      [/:\)/, 'comment', '@pop'],
      [/[(:)]/, 'comment']
    ],
  },
};

// SPARQL language configuration
const sparqlConfig = {
  keywords: [
    'BASE', 'PREFIX', 'SELECT', 'DISTINCT', 'REDUCED', 'CONSTRUCT', 'DESCRIBE', 'ASK',
    'FROM', 'NAMED', 'WHERE', 'ORDER', 'BY', 'ASC', 'DESC', 'LIMIT', 'OFFSET',
    'UNION', 'OPTIONAL', 'GRAPH', 'FILTER', 'EXISTS', 'NOT', 'BIND', 'VALUES',
    'MINUS', 'SERVICE', 'SILENT', 'UNDEF', 'DEFAULT', 'ALL', 'WITH', 'USING',
    'INSERT', 'DELETE', 'DATA', 'LOAD', 'CLEAR', 'CREATE', 'DROP', 'COPY',
    'MOVE', 'ADD', 'TO', 'INTO', 'DT', 'LANG', 'LANGMATCHES', 'DATATYPE',
    'BOUND', 'IRI', 'URI', 'BNODE', 'RAND', 'ABS', 'CEIL', 'FLOOR', 'ROUND',
    'CONCAT', 'SUBSTR', 'STRLEN', 'REPLACE', 'UCASE', 'LCASE', 'ENCODE_FOR_URI',
    'CONTAINS', 'STRSTARTS', 'STRENDS', 'STRBEFORE', 'STRAFTER', 'YEAR', 'MONTH',
    'DAY', 'HOURS', 'MINUTES', 'SECONDS', 'TIMEZONE', 'TZ', 'NOW', 'UUID',
    'STRUUID', 'MD5', 'SHA1', 'SHA256', 'SHA384', 'SHA512', 'COALESCE', 'IF',
    'STRLANG', 'STRDT', 'SAMETERM', 'ISIRI', 'ISURI', 'ISBLANK', 'ISLITERAL',
    'ISNUMERIC', 'REGEX', 'true', 'false'
  ],
  operators: [
    '=', '!=', '<', '<=', '>', '>=', '+', '-', '*', '/', '&&', '||', '!', 'IN', 'NOT IN'
  ],
  brackets: [
    ['{', '}', 'delimiter.curly'],
    ['[', ']', 'delimiter.bracket'],
    ['(', ')', 'delimiter.parenthesis']
  ],
  tokenizer: {
    root: [
      // Comments
      [/#.*$/, 'comment'],
      
      // IRIs and URIs
      [/<[^<>\s]*>/, 'string.iri'],
      
      // Prefixed names
      [/[a-zA-Z_][\w\-]*:[a-zA-Z_][\w\-]*/, 'string.prefixed'],
      
      // Strings
      [/"([^"\\]|\\.)*"/, 'string'],
      [/'([^'\\]|\\.)*'/, 'string'],
      [/"""[^]*?"""/, 'string'], // Triple quoted strings
      [/'''[^]*?'''/, 'string'], // Triple quoted strings
      
      // Numbers
      [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
      [/\d+/, 'number'],
      
      // Keywords (case-insensitive)
      [/[a-zA-Z_][\w]*/, {
        cases: {
          '@keywords': 'keyword',
          '@default': 'identifier'
        }
      }],
      
      // Variables
      [/\?[a-zA-Z_][\w]*/, 'variable'],
      [/\$[a-zA-Z_][\w]*/, 'variable'],
      
      // Operators
      [/[=!<>]=?/, 'operator'],
      [/[+\-*/]/, 'operator'],
      [/&&|\|\||!/, 'operator'],
      
      // Delimiters
      [/[{}()\[\]]/, '@brackets'],
      [/[;,.]/, 'delimiter'],
      
      // Whitespace
      [/\s+/, 'white'],
    ],
  },
};

function QueryEditor({ 
  value, 
  onChange, 
  onKeyDown, 
  language = 'javascript', 
  placeholder = 'Enter your query here...', 
  disabled = false 
}) {
  const monaco = useMonaco();
  const editorRef = useRef(null);

  // Register custom languages when Monaco is available
  useEffect(() => {
    if (monaco) {
      // Register XQuery
      if (!monaco.languages.getLanguages().find(lang => lang.id === 'xquery')) {
        monaco.languages.register({ id: 'xquery' });
        monaco.languages.setMonarchTokensProvider('xquery', xqueryConfig);
        monaco.languages.setLanguageConfiguration('xquery', {
          comments: {
            blockComment: ['(:', ':)']
          },
          brackets: xqueryConfig.brackets,
          autoClosingPairs: [
            { open: '{', close: '}' },
            { open: '[', close: ']' },
            { open: '(', close: ')' },
            { open: '"', close: '"' },
            { open: "'", close: "'" },
          ],
          surroundingPairs: [
            { open: '{', close: '}' },
            { open: '[', close: ']' },
            { open: '(', close: ')' },
            { open: '"', close: '"' },
            { open: "'", close: "'" },
          ],
        });
      }

      // Register SPARQL
      if (!monaco.languages.getLanguages().find(lang => lang.id === 'sparql')) {
        monaco.languages.register({ id: 'sparql' });
        monaco.languages.setMonarchTokensProvider('sparql', sparqlConfig);
        monaco.languages.setLanguageConfiguration('sparql', {
          comments: {
            lineComment: '#'
          },
          brackets: sparqlConfig.brackets,
          autoClosingPairs: [
            { open: '{', close: '}' },
            { open: '[', close: ']' },
            { open: '(', close: ')' },
            { open: '"', close: '"' },
            { open: "'", close: "'" },
            { open: '<', close: '>' },
          ],
          surroundingPairs: [
            { open: '{', close: '}' },
            { open: '[', close: ']' },
            { open: '(', close: ')' },
            { open: '"', close: '"' },
            { open: "'", close: "'" },
            { open: '<', close: '>' },
          ],
        });
      }
    }
  }, [monaco]);

  // Map query types to Monaco language IDs
  const getMonacoLanguage = useCallback((queryType) => {
    switch (queryType) {
      case 'xquery': return 'xquery';
      case 'javascript': return 'javascript';
      case 'sparql': return 'sparql';
      default: return 'plaintext';
    }
  }, []);

  const handleEditorMount = useCallback((editor, monaco) => {
    editorRef.current = editor;

    // Add Ctrl+Enter keyboard shortcut
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      if (onKeyDown) {
        onKeyDown({ key: 'Enter', ctrlKey: true, preventDefault: () => {} });
      }
    });
  }, [onKeyDown]);

  const handleEditorChange = useCallback((value) => {
    if (onChange) {
      onChange({ target: { value: value || '' } });
    }
  }, [onChange]);

  return (
    <div className="query-editor">
      <Editor
        height="200px"
        language={getMonacoLanguage(language)}
        value={value}
        onChange={handleEditorChange}
        onMount={handleEditorMount}
        options={{
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          fontSize: 13,
          fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace",
          lineNumbers: 'on',
          folding: true,
          foldingStrategy: 'indentation',
          showFoldingControls: 'mouseover',
          lineDecorationsWidth: 10,
          lineNumbersMinChars: 3,
          renderLineHighlight: 'none',
          selectOnLineNumbers: false,
          automaticLayout: true,
          tabSize: 2,
          insertSpaces: true,
          detectIndentation: true,
          formatOnPaste: true,
          formatOnType: false,
          readOnly: disabled,
          placeholder: placeholder,
          suggestOnTriggerCharacters: true,
          acceptSuggestionOnCommitCharacter: true,
          acceptSuggestionOnEnter: 'on',
          quickSuggestions: true,
          parameterHints: { enabled: true },
          // Enable bracket matching
          matchBrackets: 'always',
          // Auto closing brackets
          autoClosingBrackets: 'always',
          autoClosingQuotes: 'always',
          autoSurround: 'languageDefined',
        }}
        theme="vs"
      />
    </div>
  );
}

export default QueryEditor;