const baseKeywords = [
  'xquery', 'version', 'module', 'namespace', 'import', 'schema', 'element',
  'function', 'variable', 'option', 'declare', 'default', 'collation', 'boundary-space',
  'ordering', 'construction', 'base-uri', 'copy-namespaces', 'preserve', 'strip',
  'no-preserve', 'inherit', 'no-inherit', 'for', 'let', 'where', 'return', 'some',
  'every', 'satisfies', 'typeswitch', 'switch', 'case', 'if', 'then', 'else', 'try',
  'catch', 'or', 'and', 'not', 'to', 'in', 'as', 'at', 'instance', 'of', 'treat',
  'castable', 'cast', 'external', 'stable', 'order', 'by', 'ascending', 'descending',
  'empty', 'greatest', 'least', 'group'
];

const baseBuiltins = ['fn', 'xs', 'map', 'array', 'math', 'json'];

const markLogicKeywords = ['xdmp', 'cts'];

const markLogicBuiltins = [
  'xdmp', 'cts', 'sem', 'geo', 'spell', 'thsr', 'alert', 'cpf', 'op', 'temporal'
];

const defaultConfig = {
  keywords: baseKeywords,
  builtins: baseBuiltins,
  completionItems: []
};

const markLogicConfig = {
  keywords: markLogicKeywords,
  builtins: markLogicBuiltins,
  completionItems: []
};

const uniq = (items) => Array.from(new Set(items.filter(Boolean)));

export const buildXQueryLanguageConfig = ({ overrides = {}, includeMarkLogic = true } = {}) => {
  const configs = [defaultConfig];
  if (includeMarkLogic) configs.push(markLogicConfig);
  if (overrides && Object.keys(overrides).length > 0) configs.push(overrides);

  const merged = configs.reduce((acc, cfg) => {
    if (!cfg) return acc;
    if (cfg.keywords) acc.keywords = acc.keywords.concat(cfg.keywords);
    if (cfg.builtins) acc.builtins = acc.builtins.concat(cfg.builtins);
    if (cfg.completionItems) acc.completionItems = acc.completionItems.concat(cfg.completionItems);
    return acc;
  }, { keywords: [], builtins: [], completionItems: [] });

  return {
    keywords: uniq(merged.keywords),
    builtins: uniq(merged.builtins),
    completionItems: merged.completionItems
  };
};

export const defaultXQueryLanguageConfig = defaultConfig;
export const markLogicXQueryLanguageConfig = markLogicConfig;
