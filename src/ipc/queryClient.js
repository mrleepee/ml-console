const getElectronAPI = () => (typeof window !== 'undefined' ? window.electronAPI : undefined);

const normalizeHeaders = (headers = {}) => {
  if (!headers || typeof headers.forEach === 'function') {
    const result = {};
    if (headers && typeof headers.forEach === 'function') {
      headers.forEach((value, key) => {
        result[String(key).toLowerCase()] = value;
      });
    }
    return result;
  }

  return Object.keys(headers).reduce((acc, key) => {
    acc[String(key).toLowerCase()] = headers[key];
    return acc;
  }, {});
};

export async function request({ url, method = 'GET', headers = {}, body, username, password, signal }) {
  const electronAPI = getElectronAPI();

  if (electronAPI?.httpRequest) {
    const response = await electronAPI.httpRequest({ url, method, headers, body, username, password });
    return {
      status: response?.status ?? 0,
      headers: normalizeHeaders(response?.headers || {}),
      body: response?.body ?? '',
    };
  }

  const resp = await fetch(url, { method, headers, body, signal });
  const text = await resp.text();
  return {
    status: resp.status,
    headers: normalizeHeaders(resp.headers),
    body: text,
  };
}

export async function sendQuery({
  url,
  method = 'POST',
  headers = {},
  body,
  username,
  password,
  preferStream = true,
}) {
  const electronAPI = getElectronAPI();

  if (preferStream && electronAPI?.streamToDisk) {
    const result = await electronAPI.streamToDisk({ url, method, headers, body, username, password });
    if (!result?.success) {
      throw new Error(result?.error || 'Stream failed');
    }
    return { kind: 'stream', index: result.index };
  }

  const response = await request({ url, method, headers, body, username, password });
  return { kind: 'buffer', response };
}

export async function readStreamParts(directory, start = 0, limit = 50) {
  const electronAPI = getElectronAPI();
  if (!electronAPI?.readStreamParts) {
    throw new Error('Streaming is not supported in this environment');
  }

  const result = await electronAPI.readStreamParts(directory, start, limit);
  if (!result?.success) {
    throw new Error(result?.error || 'Failed to read stream parts');
  }

  return result;
}

export async function cancelQuery(requestId) {
  const electronAPI = getElectronAPI();
  if (!electronAPI?.cancelQuery) {
    return false;
  }
  try {
    await electronAPI.cancelQuery(requestId);
    return true;
  } catch (error) {
    console.error('Failed to cancel query:', error);
    return false;
  }
}

export async function checkConnection({ url, username, password, timeout }) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  let timeoutId;

  if (controller && timeout) {
    timeoutId = setTimeout(() => controller.abort(), timeout);
  }

  try {
    const response = await request({ url, method: 'GET', username, password, signal: controller?.signal });
    return response;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export function supportsStreaming() {
  return Boolean(getElectronAPI()?.streamToDisk);
}

export default {
  sendQuery,
  request,
  readStreamParts,
  cancelQuery,
  checkConnection,
  supportsStreaming,
};
