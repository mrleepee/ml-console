import rawMarkLogicXQueryConfig from '../../config/marklogic/xquery.yaml?raw';

let cachedConfig = null;
let yamlModule = null;

const emptyConfig = Object.freeze({
  keywords: [],
  builtins: [],
  completionItems: [],
});

const normalizeArray = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim());
};

/**
 * Lazy load YAML parser to reduce initial bundle size.
 * YAML is only needed when loading XQuery language configuration.
 */
async function loadYaml() {
  if (!yamlModule) {
    yamlModule = await import('yaml');
  }
  return yamlModule;
}

export const getMarkLogicXQueryLanguageConfig = async () => {
  if (cachedConfig) return cachedConfig;
  try {
    const { parse } = await loadYaml();
    const parsed = parse(rawMarkLogicXQueryConfig) ?? {};
    const keywords = normalizeArray(parsed.keywords);
    const builtins = normalizeArray(parsed.builtins);
    const completionItems = Array.isArray(parsed.completionItems)
      ? parsed.completionItems
          .filter((item) => item && typeof item.label === 'string' && item.label.trim().length > 0)
          .map((item) => ({
            ...item,
            label: item.label.trim(),
            ...(item.insertText && typeof item.insertText === 'string' ? { insertText: item.insertText.trim() } : {}),
            ...(item.detail && typeof item.detail === 'string' ? { detail: item.detail.trim() } : {}),
            ...(item.documentation && typeof item.documentation === 'string' ? { documentation: item.documentation.trim() } : {})
          }))
      : [];
    cachedConfig = {
      keywords,
      builtins,
      completionItems,
    };
  } catch (error) {
    console.warn('Failed to load MarkLogic XQuery config. Falling back to defaults.', error);
    cachedConfig = emptyConfig;
  }
  return cachedConfig;
};

export const __resetMarkLogicConfigCacheForTests = () => {
  cachedConfig = null;
};

export const __setMarkLogicConfigOverrideForTests = (config) => {
  cachedConfig = config;
};

export const emptyMarkLogicConfig = emptyConfig;
