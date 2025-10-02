import { describe, expect, it, vi, beforeEach } from 'vitest';
import { executeQuery } from './queryService';
import * as queryClient from '../ipc/queryClient';

vi.mock('../ipc/queryClient', () => ({
  sendQuery: vi.fn(),
}));

const buildParams = (overrides = {}) => ({
  query: '1 to 10',
  queryType: 'xquery',
  databaseConfig: { id: '123', modulesDatabaseId: '456' },
  serverUrl: 'http://localhost:8000',
  auth: { username: 'admin', password: 'admin' },
  preferStream: true,
  ...overrides,
});

describe('queryService.executeQuery', () => {
  beforeEach(() => {
    queryClient.sendQuery.mockReset();
  });

  it('validates that query text exists', async () => {
    await expect(executeQuery(buildParams({ query: '   ' }))).rejects.toThrow('Query text is required');
  });

  it('validates that a database is selected', async () => {
    await expect(executeQuery(buildParams({ databaseConfig: {} }))).rejects.toThrow('A database must be selected before executing queries');
  });

  it('executes an XQuery request through the adapter', async () => {
    queryClient.sendQuery.mockResolvedValue({
      kind: 'buffer',
      response: {
        status: 200,
        headers: { 'content-type': 'text/plain' },
        body: [
          'Content-Type: text/plain',
          '',
          'result',
        ].join('\r\n'),
      },
    });

    const result = await executeQuery(buildParams());

    expect(queryClient.sendQuery).toHaveBeenCalledWith(expect.objectContaining({
      url: 'http://localhost:8000/v1/eval',
      method: 'POST',
      preferStream: true,
    }));

    // Verify REST API form body format (not xdmp:eval-in wrapper)
    const { body, headers } = queryClient.sendQuery.mock.calls[0][0];
    expect(headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(body).toContain('xquery=');
    expect(body).toContain('database=');

    const decodedBody = decodeURIComponent(body);
    expect(decodedBody).toContain('1 to 10');
    expect(decodedBody).toContain('database=123');

    expect(result.mode).toBe('buffer');
    expect(result.tableData).toHaveLength(1);
    expect(result.formatted).toBe('result');
  });

  it('returns streaming metadata when adapter streams to disk', async () => {
    queryClient.sendQuery.mockResolvedValue({
      kind: 'stream',
      index: { dir: '/tmp', parts: [1, 2, 3] },
    });

    const result = await executeQuery(buildParams());
    expect(result.mode).toBe('stream');
    expect(result.totalRecords).toBe(3);
    expect(result.streamIndex).toMatchObject({ dir: '/tmp' });
  });

  it('throws when the adapter reports a non-success status', async () => {
    queryClient.sendQuery.mockResolvedValue({
      kind: 'buffer',
      response: { status: 500, body: 'Internal error', headers: {} },
    });

    await expect(executeQuery(buildParams())).rejects.toThrow('Internal error');
  });

  it('honours the preferStream flag when disabled', async () => {
    queryClient.sendQuery.mockResolvedValue({
      kind: 'buffer',
      response: {
        status: 200,
        headers: {},
        body: [
          'Content-Type: text/plain',
          '',
          'result',
        ].join('\r\n'),
      },
    });

    await executeQuery(buildParams({ preferStream: false }));
    expect(queryClient.sendQuery).toHaveBeenCalledWith(expect.objectContaining({ preferStream: false }));
  });
});
