import { buildXQueryLanguageConfig } from './monacoXqueryConfig';

export const XQUERY_LANGUAGE = 'xquery-ml';

const registeredInstances = new WeakSet();

const signatureFor = (config) => JSON.stringify({
  keywords: config.keywords,
  builtins: config.builtins,
  completionItems: config.completionItems
});

const instanceSignatures = new WeakMap();

// Context-dependent FLWOR keywords that should be filtered from global list
const CONTEXTUAL_FLWOR_KEYWORDS = ['group', 'order', 'by', 'stable', 'ascending', 'descending', 'empty', 'greatest', 'least'];
const CONTEXTUAL_FLWOR_KEYWORD_LOOKUP = new Set(CONTEXTUAL_FLWOR_KEYWORDS);

export const registerXQueryLanguage = (monaco, overrides) => {
  if (!monaco?.languages) return;

  const config = buildXQueryLanguageConfig({ overrides });
  // Filter context-dependent keywords from tokenizer to prevent over-highlighting
  const tokenProviderKeywords = config.keywords.filter((keyword) => !CONTEXTUAL_FLWOR_KEYWORD_LOOKUP.has(keyword));
  const signature = signatureFor({
    ...config,
    keywords: tokenProviderKeywords
  });

  const lastSignature = instanceSignatures.get(monaco);
  if (registeredInstances.has(monaco) && signature === lastSignature) return;

  if (!registeredInstances.has(monaco)) {
    const existing = typeof monaco.languages.getLanguages === 'function'
      ? monaco.languages.getLanguages().some((lang) => lang.id === XQUERY_LANGUAGE)
      : false;

    if (!existing) {
      monaco.languages.register({
        id: XQUERY_LANGUAGE,
        extensions: ['.xq', '.xql', '.xqm', '.xqy', '.xquery'],
        aliases: ['XQuery (ML)', 'xquery-ml', 'XQuery', 'xquery'],
        mimetypes: ['application/xquery']
      });
    }
    registeredInstances.add(monaco);
  }

  monaco.languages.setLanguageConfiguration(XQUERY_LANGUAGE, {
    comments: { blockComment: ['(:', ':)'] },
    brackets: [['{', '}'], ['[', ']'], ['(', ')']],
    autoClosingPairs: [
      { open: '"', close: '"', notIn: ['string'] },
      { open: "'", close: "'", notIn: ['string'] },
      { open: '(:', close: ':)', notIn: ['string'] },
      { open: '{', close: '}', notIn: ['string'] },
      { open: '[', close: ']' },
      { open: '(', close: ')' }
    ],
    surroundingPairs: [
      { open: '"', close: '"' },
      { open: "'", close: "'" },
      { open: '(', close: ')' },
      { open: '[', close: ']' },
      { open: '{', close: '}' }
    ]
  });

  monaco.languages.setMonarchTokensProvider(XQUERY_LANGUAGE, {
    defaultToken: '',
    ignoreCase: true,
    brackets: [
      { open: '{', close: '}', token: 'delimiter.curly' },
      { open: '[', close: ']', token: 'delimiter.square' },
      { open: '(', close: ')', token: 'delimiter.parenthesis' }
    ],
    keywords: tokenProviderKeywords,
    builtins: config.builtins,
    tokenizer: {
      root: [
        [/\(:/, 'comment', '@comment'],
        { include: '@strings' },
        { include: '@numbers' },
        [/\$[a-zA-Z_][\w\-]*/, 'variable'],

        // FLWOR expression entry points (must come before XML to catch FLWOR patterns)
        [/\bfor\s+(?:tumbling|sliding)\s+window\b/, { token: 'keyword.flwor', next: '@flwor_window' }],
        [/\bfor\b/, { token: 'keyword.flwor', next: '@flwor_for' }],
        [/\blet\b/, { token: 'keyword.flwor', next: '@flwor_let' }],
        [/\bwhere\b/, { token: 'keyword.flwor', next: '@flwor_where' }],
        [/\bgroup\s+by\b/, { token: 'keyword.flwor', next: '@flwor_group' }],
        [/\bcount\b(?=\s+\$)/, { token: 'keyword.flwor', next: '@flwor_count' }],
        [/\bstable\s+order\s+by\b|\border\s+by\b/, { token: 'keyword.flwor', next: '@flwor_order' }],
        [/\breturn\b/, { token: 'keyword.flwor', next: '@flwor_return' }],

        // XML/HTML embedding support (Phase 2 enhancement)
        [/<\?[\w\-]+/, 'metatag', '@xml_processing_instruction'],
        [/<!\[CDATA\[/, 'string.cdata', '@xml_cdata'],
        [/<!--/, 'comment.xml', '@xml_comment'],
        [/<!DOCTYPE\s+/, 'metatag', '@xml_doctype'],
        [/<![A-Z]+/, 'metatag', '@xml_declaration'],
        [/<\/([a-zA-Z_][\w\-]*:)?[a-zA-Z_][\w\-]*\s*>/, 'tag'],
        [/<([a-zA-Z_][\w\-]*:)?[a-zA-Z_][\w\-]*/, 'tag', '@xml_tag'],

        [/[{}()\[\]]/, '@brackets'],
        [/[;,]/, 'delimiter'],
        [/:=/, 'operator'],
        [/\beq\b|\bne\b|\blt\b|\ble\b|\bgt\b|\bge\b/, 'operator'],
        [/\bis\b|\bisnot\b|\binstance\s+of\b|\btreat\s+as\b/, 'operator'],
        [/\bto\b|\bmod\b|\bdiv\b|\bidiv\b/, 'operator'],
        [/[<>=!|+\-*/%]/, 'operator'],
        [/[a-zA-Z_][\w\-]*:[a-zA-Z_][\w\-]*(?=\s*\()/, 'type.identifier'], // namespace:function() patterns
        [/[a-zA-Z_][\w\-]*(?=\s*\()/, {
          cases: {
            '@keywords': 'keyword',  // Don't highlight keywords as functions
            '@default': 'type.identifier' // But do highlight user functions
          }
        }],
        [/@?[a-zA-Z_][\w\-.]*/, {
          cases: {
            '@keywords': 'keyword',
            '@builtins': 'type.identifier',
            '@default': 'identifier'
          }
        }]
      ],
      comment: [
        [/\(:/, 'comment', '@push'],
        [/:\)/, 'comment', '@pop'],
        [/[^():]+/, 'comment'],
        [/./, 'comment']
      ],
      numbers: [[/\b\d+(\.\d+)?\b/, 'number']],
      strings: [
        [/"/, { token: 'string.quote', next: '@string_double' }],
        [/'/, { token: 'string.quote', next: '@string_single' }]
      ],
      string_double: [
        [/""/, 'string'],
        [/"/, { token: 'string.quote', next: '@pop' }],
        [/[^"]+/, 'string']
      ],
      string_single: [
        [/''/, 'string'],
        [/'/, { token: 'string.quote', next: '@pop' }],
        [/[^']+/, 'string']
      ],

      // XML/HTML embedding states (Phase 2 enhancement)
      xml_processing_instruction: [
        [/\?>/, 'metatag', '@pop'],
        [/[^?]+/, 'metatag'],
        [/./, 'metatag']
      ],

      xml_cdata: [
        [/\]\]>/, 'string.cdata', '@pop'],
        [/[^\]]+/, 'string.cdata'],
        [/./, 'string.cdata']
      ],

      xml_tag: [
        [/\s+/, ''],
        // Attribute names (with namespace support) - match before general tag name
        [/([a-zA-Z_][\w\-]*:)?[a-zA-Z_][\w\-]*(?=\s*=)/, 'attribute.name'],
        [/=/, 'delimiter'],
        // Attribute values with XQuery expression support
        [/"/, { token: 'attribute.value', next: '@xml_attr_double' }],
        [/'/, { token: 'attribute.value', next: '@xml_attr_single' }],
        // Self-closing or opening tag end
        [/\/?>/, { token: 'tag', next: '@pop' }],
        // Tag name should be last to avoid capturing attribute names
        [/([a-zA-Z_][\w\-]*:)?[a-zA-Z_][\w\-]*/, 'tag']
      ],

      xml_attr_double: [
        // XQuery expressions within attribute values: {expr}
        [/\{/, { token: 'delimiter.curly', next: '@xquery_in_attr_double' }],
        [/""/, 'attribute.value'],
        [/"/, { token: 'attribute.value', next: '@pop' }],
        [/[^"{}]+/, 'attribute.value']
      ],

      xml_attr_single: [
        // XQuery expressions within attribute values: {expr}
        [/\{/, { token: 'delimiter.curly', next: '@xquery_in_attr_single' }],
        [/''/, 'attribute.value'],
        [/'/, { token: 'attribute.value', next: '@pop' }],
        [/[^'{}]+/, 'attribute.value']
      ],

      // XQuery expressions inside XML attributes - track brace depth
      xquery_in_attr_double: [
        [/\{/, { token: 'delimiter.curly', next: '@push' }], // Nested braces
        [/\}/, { token: 'delimiter.curly', next: '@pop' }],   // Pop back to xml_attr_double or nested xquery
        { include: '@root' } // Include all root XQuery rules
      ],

      xquery_in_attr_single: [
        [/\{/, { token: 'delimiter.curly', next: '@push' }], // Nested braces
        [/\}/, { token: 'delimiter.curly', next: '@pop' }],   // Pop back to xml_attr_single or nested xquery
        { include: '@root' } // Include all root XQuery rules
      ],

      // Additional XML constructs (Phase 2 enhancement)
      xml_comment: [
        [/-->/, 'comment.xml', '@pop'],
        [/[^-]+/, 'comment.xml'],
        [/-/, 'comment.xml']
      ],

      xml_doctype: [
        [/>/, 'metatag', '@pop'],
        [/\[/, 'metatag', '@xml_doctype_internal'],
        [/[^>\[]+/, 'metatag']
      ],

      xml_doctype_internal: [
        [/\]/, 'metatag', '@pop'],
        [/<!--/, 'comment.xml', '@xml_comment'],
        [/<!\w+/, 'metatag'],
        [/[^\]<]+/, 'metatag']
      ],

      xml_declaration: [
        [/>/, 'metatag', '@pop'],
        [/[^>]+/, 'metatag']
      ],

      // FLWOR expression states (XQuery 3.0+ support)
      flwor_expression: [
        [/\bfor\s+(?:tumbling|sliding)\s+window\b/, { token: 'keyword.flwor', next: '@flwor_window' }],
        [/\bfor\b/, { token: 'keyword.flwor', next: '@flwor_for' }],
        [/\blet\b/, { token: 'keyword.flwor', next: '@flwor_let' }],
        [/\bwhere\b/, { token: 'keyword.flwor', next: '@flwor_where' }],
        [/\bgroup\s+by\b/, { token: 'keyword.flwor', next: '@flwor_group' }],
        [/\bstable\s+order\s+by\b|\border\s+by\b/, { token: 'keyword.flwor', next: '@flwor_order' }],
        [/\breturn\b/, { token: 'keyword.flwor', next: '@flwor_return' }],
        { include: '@root' }
      ],

      flwor_for: [
        [/\$[a-zA-Z_][\w\-]*/, 'variable'],
        [/\bat\b/, 'keyword.flwor'],
        [/\bas\b/, 'keyword.flwor'],
        [/\ballowing\s+empty\b/, 'keyword.flwor'],
        [/\bin\b/, { token: 'keyword.flwor', next: '@pop' }],
        { include: '@root' }
      ],

      flwor_let: [
        [/\$[a-zA-Z_][\w\-]*/, 'variable'],
        [/\bas\b/, 'keyword.flwor'],
        [/:=/, { token: 'operator', next: '@pop' }],
        { include: '@root' }
      ],

      flwor_where: [
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
        [/\bcount\b/, 'keyword.flwor'],
        [/\$[a-zA-Z_][\w\-]*/, 'variable'], // count variable
        [/\bfor\b/, { token: 'keyword.flwor', next: '@flwor_for' }],
        [/\blet\b/, { token: 'keyword.flwor', next: '@flwor_let' }],
        [/\bwhere\b/, { token: 'keyword.flwor', next: '@flwor_where' }],
        [/\border\s+by\b/, { token: 'keyword.flwor', next: '@flwor_order' }],
        [/\breturn\b/, { token: 'keyword.flwor', next: '@flwor_return' }],
        { include: '@root' }
      ],

      flwor_order: [
        [/\bascending\b|\bdescending\b/, 'keyword.flwor'],
        [/\bempty\s+(?:greatest|least)\b/, 'keyword.flwor'],
        [/\bcollation\b/, 'keyword.flwor'],
        [/\breturn\b/, { token: 'keyword.flwor', next: '@flwor_return' }],
        { include: '@root' }
      ],

      flwor_return: [
        [/\{/, { token: 'delimiter.curly', next: '@push' }],
        [/\}/, { token: 'delimiter.curly', next: '@pop' }],
        { include: '@flwor_nested' }
      ],

      flwor_window: [
        [/\$[a-zA-Z_][\w\-]*/, 'variable'],
        [/\bin\b/, 'keyword.flwor'],
        [/\bonly\s+(?:start|end)\b/, 'keyword.flwor'],
        [/\bstart\b/, 'keyword.flwor'],
        [/\bend\b/, 'keyword.flwor'],
        [/\bat\b/, 'keyword.flwor'],
        [/\bwhen\b/, 'keyword.flwor'],
        [/\bprevious\b/, 'keyword.flwor'],
        [/\bnext\b/, 'keyword.flwor'],
        [/\breturn\b/, { token: 'keyword.flwor', next: '@flwor_return' }],
        { include: '@root' }
      ],

      flwor_count: [
        [/\$[a-zA-Z_][\w\-]*/, 'variable', '@pop'], // count variable binding
        { include: '@root' }
      ],

      flwor_nested: [
        [/\bfor\b/, { token: 'keyword.flwor', next: '@flwor_for' }],
        [/\blet\b/, { token: 'keyword.flwor', next: '@flwor_let' }],
        [/\breturn\b/, { token: 'keyword.flwor', next: '@flwor_return' }],
        { include: '@flwor_expression' }
      ]
    }
  });

  instanceSignatures.set(monaco, signature);

  return config;
};

export const __resetXQueryRegistrationForTests = () => {
  // Clear all per-instance tracking for tests
  // Note: WeakSet/WeakMap don't have clear() method, but test stubs are recreated each time
};
