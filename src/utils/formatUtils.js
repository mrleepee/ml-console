export function formatXmlPretty(rawText) {
  try {
    const tokens = rawText.replace(/>\s+</g, '><').split(/(<[^>]+>)/g).filter(Boolean);
    let indentLevel = 0;
    const indentUnit = '  ';
    const lines = [];
    for (const token of tokens) {
      const isTag = token.startsWith('<') && token.endsWith('>');
      if (isTag) {
        const t = token.trim();
        const isClosing = /^<\//.test(t);
        const isSelfClosing = /\/>$/.test(t) || /^<\?/.test(t) || /^<!/.test(t);
        if (isClosing) indentLevel = Math.max(indentLevel - 1, 0);
        lines.push(`${indentUnit.repeat(indentLevel)}${t}`);
        if (!isClosing && !isSelfClosing) indentLevel += 1;
      } else {
        const text = token.trim();
        if (text) lines.push(`${indentUnit.repeat(indentLevel)}${text}`);
      }
    }
    return lines.join('\n');
  } catch {
    return rawText;
  }
}

export function getRawContent(record) {
  const content = record.content || '';
  const contentType = (record.contentType || '').toLowerCase();
  if (contentType.includes('json')) {
    try {
      return JSON.stringify(JSON.parse(content), null, 2);
    } catch {
      return content;
    }
  }
  if (contentType.includes('xml')) return formatXmlPretty(content);
  return content;
}
