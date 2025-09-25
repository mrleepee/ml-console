import parseHeaders from 'parse-headers';

export function escapeRegExp(str = '') {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function parseResponse(responseText = '') {
  const txt = String(responseText).replace(/^\uFEFF/, '');
  const separatorMatch = /\r?\n\r?\n/.exec(txt);
  if (!separatorMatch) {
    return [{ contentType: '', primitive: '', uri: '', path: '', content: txt }];
  }

  const rawHeaders = txt.slice(0, separatorMatch.index);
  const content = txt.slice(separatorMatch.index + separatorMatch[0].length);
  const headers = parseHeaders(rawHeaders);

  return [{
    contentType: headers['content-type'] || '',
    primitive: headers['x-primitive'] || '',
    uri: headers['x-uri'] || '',
    path: headers['x-path'] || '',
    content,
  }];
}

export function parseMultipartToTableData(responseText = '') {
  if (!responseText) return [];

  const boundaryMatch = String(responseText).match(/^--([^\r\n-]+)(?:--)?\s*$/m);
  if (!boundaryMatch) {
    return parseResponse(responseText);
  }

  const boundary = boundaryMatch[1];
  const escapedBoundary = escapeRegExp(boundary);
  const parts = String(responseText).split(new RegExp(`--${escapedBoundary}(?:--)?\\s*`, 'g'));
  const results = [];

  for (const part of parts) {
    const trimmedPart = part.trim();
    if (!trimmedPart) continue;
    const parsedRecords = parseResponse(trimmedPart);
    results.push(...parsedRecords);
  }

  return results;
}

export function parseMultipartResponse(responseText = '') {
  const tableData = parseMultipartToTableData(responseText);
  return tableData.map((record) => record.content || '').join('\n');
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
