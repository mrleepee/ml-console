import parseHeaders from 'parse-headers';

/**
 * @typedef {Object} ResultRecord
 * @property {string} contentType - MIME type of the payload
 * @property {string} primitive - XQuery primitive annotation
 * @property {string} uri - Source URI returned by MarkLogic
 * @property {string} path - Node path for structured primitives
 * @property {string} content - Raw textual content of the record
 */

export class ResponseServiceError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'ResponseServiceError';
    this.code = code;
  }
}

export function escapeRegExp(str = '') {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const ensureRecord = (record = {}) => ({
  contentType: record.contentType || '',
  primitive: record.primitive || '',
  uri: record.uri || '',
  path: record.path || '',
  content: record.content ?? '',
});

export function ensureResultInterface(records = []) {
  return records.map(ensureRecord);
}

const MULTIPART_HEADER_REGEX = /content-type:\s*multipart\/[\w.+-]+;\s*boundary=(?:"([^"]+)"|([^;\r\n]+))/i;

export function extractMultipartBoundary(responseText = '') {
  if (!responseText) return null;
  const headerBlockMatch = /^(.*?)(?:\r?\n){2}/s.exec(responseText);
  if (headerBlockMatch) {
    const headerBlock = headerBlockMatch[1];
    const match = MULTIPART_HEADER_REGEX.exec(headerBlock);
    if (match) {
      return (match[1] || match[2] || '').trim();
    }
  }

  const fallback = /^--([^\r\n-]+)(?:--)?\s*$/m.exec(responseText);
  return fallback ? fallback[1].replace(/"/g, '').trim() : null;
}

export function parseResponse(responseText = '') {
  const txt = String(responseText).replace(/^\uFEFF/, '');
  const separatorMatch = /\r?\n\r?\n/.exec(txt);
  if (!separatorMatch) {
    return [ensureRecord({ content: txt })];
  }

  const rawHeaders = txt.slice(0, separatorMatch.index);
  const content = txt.slice(separatorMatch.index + separatorMatch[0].length);
  const headers = parseHeaders(rawHeaders);

  return [ensureRecord({
    contentType: headers['content-type'],
    primitive: headers['x-primitive'],
    uri: headers['x-uri'],
    path: headers['x-path'],
    content,
  })];
}

export function parseMultipartToTableData(responseText = '') {
  if (!responseText) return [];

  const boundary = extractMultipartBoundary(responseText);
  if (!boundary) {
    return parseResponse(responseText);
  }

  const escapedBoundary = escapeRegExp(boundary);
  const delimiter = new RegExp(`--${escapedBoundary}(?:--)?\\s*`, 'g');
  const parts = String(responseText).split(delimiter);
  const results = [];

  for (const part of parts) {
    const trimmedPart = part.trim();
    if (!trimmedPart) continue;
    const headersPresent = /content-type:/i.test(trimmedPart);
    if (!headersPresent) continue;
    if (/^content-type:\s*multipart\//i.test(trimmedPart)) continue;
    results.push(...parseResponse(trimmedPart));
  }

  return ensureResultInterface(results);
}

export const MAX_JOIN_LENGTH = 5_000_000;

const safeJoinContents = (records) => {
  let totalLength = 0;
  const parts = [];
  for (const record of records) {
    const content = String(record.content ?? '');
    totalLength += content.length;
    if (totalLength > MAX_JOIN_LENGTH) {
      throw new ResponseServiceError('Result payload exceeds safe concatenation threshold', 'RESULT_TOO_LARGE');
    }
    parts.push(content);
  }
  return parts.join('\n');
};

export function parseMultipartResponse(responseText = '') {
  const tableData = parseMultipartToTableData(responseText);
  return safeJoinContents(tableData);
}

export function formatXmlPretty(rawText = '') {
  try {
    const tokens = String(rawText)
      .replace(/>\s+</g, '><')
      .split(/(<[^>]+>)/g)
      .filter(Boolean);

    let indentLevel = 0;
    const indentUnit = '  ';
    const lines = [];

    for (const token of tokens) {
      const isTag = token.startsWith('<') && token.endsWith('>');
      if (isTag) {
        const trimmedToken = token.trim();
        const isClosing = /^<\//.test(trimmedToken);
        const isSelfClosing = /\/>$/.test(trimmedToken) || /^<\?/.test(trimmedToken) || /^<!/.test(trimmedToken);
        if (isClosing) indentLevel = Math.max(indentLevel - 1, 0);
        lines.push(`${indentUnit.repeat(indentLevel)}${trimmedToken}`);
        if (!isClosing && !isSelfClosing) indentLevel += 1;
      } else {
        const text = token.trim();
        if (text) {
          lines.push(`${indentUnit.repeat(indentLevel)}${text}`);
        }
      }
    }

    return lines.join('\n');
  } catch {
    return String(rawText);
  }
}

export function formatJsonPretty(rawText = '') {
  try {
    const parsed = JSON.parse(rawText);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return String(rawText);
  }
}

export function formatRecordContent(record) {
  if (!record) return '';
  const content = record.content ?? '';
  const contentType = (record.contentType || '').toLowerCase();

  if (contentType.includes('json')) {
    return formatJsonPretty(content);
  }

  if (contentType.includes('xml') || contentType.includes('html')) {
    return formatXmlPretty(content);
  }

  return content;
}

export function toResultEnvelope(serviceResult) {
  if (!serviceResult) {
    return { rows: [], rawText: '', formattedText: '', totalRecords: 0, streamIndex: null };
  }

  if (serviceResult.mode === 'stream') {
    return {
      rows: [],
      rawText: '',
      formattedText: '',
      totalRecords: serviceResult.totalRecords || 0,
      streamIndex: serviceResult.streamIndex || null,
    };
  }

  const rows = ensureResultInterface(serviceResult.tableData || []);
  return {
    rows,
    rawText: serviceResult.raw || '',
    formattedText: serviceResult.formatted || safeJoinContents(rows),
    totalRecords: rows.length,
    streamIndex: null,
  };
}
