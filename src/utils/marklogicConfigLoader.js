import { parse } from 'yaml';
import rawMarkLogicXQueryConfig from '../../config/marklogic/xquery.yaml?raw';

let cachedConfig = null;

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

export const getMarkLogicXQueryLanguageConfig = () => {
  if (cachedConfig) return cachedConfig;
  try {
    const parsed = parse(rawMarkLogicXQueryConfig) ?? {};
    const keywords = normalizeArray(parsed.keywords);
    const builtins = normalizeArray(parsed.builtins);
    const completionItems = Array.isArray(parsed.completionItems)
      ? parsed.completionItems.filter((item) => item && typeof item.label === 'string')
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
