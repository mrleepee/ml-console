import { sendQuery } from '../ipc/queryClient';
import { parseMultipartToTableData, parseMultipartResponse } from './responseService';

const QUERY_TYPES = ['xquery', 'javascript', 'sparql'];

const sanitizeServerUrl = (serverUrl) => String(serverUrl || '').replace(/\/+$/, '');

const wrapInEval = (query, databaseId, modulesDatabaseId) => {
  const escaped = String(query ?? '').replace(/"/g, '""');
  if (modulesDatabaseId && modulesDatabaseId !== '0') {
    return `xdmp:eval-in("${escaped}", ${databaseId}, (), ${modulesDatabaseId})`;
  }
  return `xdmp:eval-in("${escaped}", ${databaseId})`;
};

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

  if (queryType === 'javascript') {
    const modulesPart = modulesDatabaseId && modulesDatabaseId !== '0'
      ? `&modules=${encodeURIComponent(modulesDatabaseId)}`
      : '';
    const body = `javascript=${encodeURIComponent(query)}&database=${encodeURIComponent(databaseId)}${modulesPart}`;
    return {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    };
  }

  const wrappedQuery = queryType === 'sparql'
    ? wrapInEval(query, databaseId, modulesDatabaseId)
    : wrapInEval(query, databaseId, modulesDatabaseId);

  return {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `${queryType === 'javascript' ? 'javascript' : 'xquery'}=${encodeURIComponent(wrappedQuery)}`,
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
