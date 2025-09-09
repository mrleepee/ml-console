export function getLanguageFromContentType(contentType) {
  if (!contentType) return 'plaintext';
  const type = contentType.toLowerCase();
  if (type.includes('json')) return 'json';
  if (type.includes('xml')) return 'xml';
  if (type.includes('html')) return 'html';
  if (type.includes('javascript') || type.includes('js')) return 'javascript';
  return 'plaintext';
}

export function getLanguageFromQueryType(queryType) {
  switch (queryType) {
    case 'javascript':
      return 'javascript';
    case 'xquery':
      return 'xml';
    case 'sparql':
      return 'sql';
    default:
      return 'plaintext';
  }
}
