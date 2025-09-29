import { buildXQueryLanguageConfig } from './monacoXqueryConfig';

export const XQUERY_LANGUAGE = 'xquery-ml';

const registeredInstances = new WeakSet();

const signatureFor = (config) => JSON.stringify({
  keywords: config.keywords,
  builtins: config.builtins,
  completionItems: config.completionItems
});

const instanceSignatures = new WeakMap();

export const registerXQueryLanguage = (monaco, overrides) => {
  if (!monaco?.languages) return;

  const config = buildXQueryLanguageConfig({ overrides });
  const signature = signatureFor(config);

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
    keywords: config.keywords,
    builtins: config.builtins,
    tokenizer: {
      root: [
        [/\(:/, 'comment', '@comment'],
        { include: '@strings' },
        { include: '@numbers' },
        [/\$[a-zA-Z_][\w\-]*/, 'variable'],

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
