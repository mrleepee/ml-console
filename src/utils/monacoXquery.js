import { buildXQueryLanguageConfig } from './monacoXqueryConfig';

export const XQUERY_LANGUAGE = 'xquery-ml';

let registered = false;

const signatureFor = (config) => JSON.stringify({
  keywords: config.keywords,
  builtins: config.builtins,
  completionItemsLength: config.completionItems?.length ?? 0
});

let lastSignature = null;

export const registerXQueryLanguage = (monaco, overrides) => {
  if (!monaco?.languages) return;

  const config = buildXQueryLanguageConfig({ overrides });
  const signature = signatureFor(config);

  if (registered && signature === lastSignature) return;

  if (!registered) {
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
    registered = true;
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
        [/[{}()\[\]]/, '@brackets'],
        [/[;,]/, 'delimiter'],
        [/:=/, 'operator'],
        [/\beq\b|\bne\b|\blt\b|\ble\b|\bgt\b|\bge\b/, 'operator'],
        [/\bis\b|\bisnot\b|\binstance\s+of\b|\btreat\s+as\b/, 'operator'],
        [/\bto\b|\bmod\b|\bdiv\b|\bidiv\b/, 'operator'],
        [/[<>=!|+\-*/%]/, 'operator'],
        [/[a-zA-Z_][\w\-]*:[a-zA-Z_][\w\-]*(?=\s*\()/, 'type.identifier'],
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
      ]
    }
  });

  lastSignature = signature;
};

export const __resetXQueryRegistrationForTests = () => {
  registered = false;
  lastSignature = null;
};
