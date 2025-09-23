import { buildXQueryLanguageConfig } from './monacoXqueryConfig';

export const XQUERY_LANGUAGE = 'xquery';

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
        extensions: ['.xqy', '.xquery'],
        aliases: ['XQuery', 'xquery']
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
        [/[{}()\[\]]/, '@brackets'],
        [/[;,]/, 'delimiter'],
        [/[<>=!|+\-*/%]/, 'operator'],
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
