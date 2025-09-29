import { sendQuery } from '../ipc/queryClient';
import { parseMultipartToTableData, parseMultipartResponse } from './responseService';

const QUERY_TYPES = ['xquery', 'javascript', 'sparql'];

const sanitizeServerUrl = (serverUrl) => String(serverUrl || '').replace(/\/+$/, '');

// SECURITY: Removed vulnerable string interpolation approach
// Query injection vulnerability fixed by using MarkLogic REST API parameters
// instead of xdmp:eval-in wrapper with string concatenation

const buildRequest = ({ query, queryType, databaseConfig }) => {
  const db = databaseConfig || {};
  const databaseId = db.id;
  const modulesDatabaseId = db.modulesDatabaseId;

  if (!query || !String(query).trim()) {
    throw new Error('Query text is required');
  }

  if (!databaseId) {
    throw new Error('A database must be selected before executing queries');
  }

  if (!QUERY_TYPES.includes(queryType)) {
    throw new Error(`Unsupported query type: ${queryType}`);
  }

  // Build request body using MarkLogic REST API parameters
  // SECURITY: Direct parameter passing prevents query injection
  const modulesPart = modulesDatabaseId && modulesDatabaseId !== '0'
    ? `&modules=${encodeURIComponent(modulesDatabaseId)}`
    : '';

  const queryParam = queryType === 'javascript' ? 'javascript' : 'xquery';
  const body = `${queryParam}=${encodeURIComponent(query)}&database=${encodeURIComponent(databaseId)}${modulesPart}`;

  return {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  };
};

export async function executeQuery({
  query,
  queryType = 'xquery',
  databaseConfig,
  serverUrl,
  auth,
  preferStream = true,
}) {
  const baseUrl = sanitizeServerUrl(serverUrl || '');
  const requestUrl = `${baseUrl}/v1/eval`;
  const { headers, body } = buildRequest({ query, queryType, databaseConfig });

  const result = await sendQuery({
    url: requestUrl,
    method: 'POST',
    headers,
    body,
    username: auth?.username,
    password: auth?.password,
    preferStream,
  });

  if (result.kind === 'stream') {
    return {
      mode: 'stream',
      streamIndex: result.index,
      totalRecords: (result.index?.parts || []).length,
    };
  }

  const { response } = result;
  if (response.status < 200 || response.status >= 300) {
    const message = response.body || `HTTP ${response.status}`;
    throw new Error(message);
  }

  const rawResponse = response.body || '';
  const tableData = parseMultipartToTableData(rawResponse);
  const normalized = parseMultipartResponse(rawResponse) || 'Query executed successfully (no results)';

  return {
    mode: 'buffer',
    raw: rawResponse,
    tableData,
    formatted: normalized,
    headers: response.headers,
    status: response.status,
  };
}

export default {
  executeQuery,
};
