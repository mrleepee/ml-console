import parseHeaders from 'parse-headers';

export function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function parseResponse(responseText) {
  const txt = responseText.replace(/^\uFEFF/, '');
  const m = /\r?\n\r?\n/.exec(txt);
  if (!m) {
    return [{ contentType: '', primitive: '', uri: '', path: '', content: txt }];
  }
  const rawHeaders = txt.slice(0, m.index);
  const content = txt.slice(m.index + m[0].length);
  const h = parseHeaders(rawHeaders);
  return [{
    contentType: h['content-type'] || '',
    primitive: h['x-primitive'] || '',
    uri: h['x-uri'] || '',
    path: h['x-path'] || '',
    content,
  }];
}

export function parseMultipartToTableData(responseText) {
  if (!responseText) return [];
  const results = [];
  const boundaryMatch = responseText.match(/^--([^\r\n-]+)(?:--)?\s*$/m);
  if (!boundaryMatch) return parseResponse(responseText);
  const boundary = boundaryMatch[1];
  const escapedBoundary = escapeRegExp(boundary);
  const parts = responseText.split(new RegExp(`--${escapedBoundary}(?:--)?\\s*`, 'g'));
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const parsedRecords = parseResponse(trimmed);
    results.push(...parsedRecords);
  }
  return results;
}

export function parseMultipartResponse(responseText) {
  const tableData = parseMultipartToTableData(responseText);
  return tableData.map((record) => record.content).join('\n');
}
