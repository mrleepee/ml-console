/**
 * Unit tests for databaseApi.js
 */

import { describe, it, expect, vi } from 'vitest';
import { getServers, getDatabases, parseDatabaseConfigs } from './databaseApi.js';

// Mock the makeRequest function
const createMockMakeRequest = (response) => {
  return vi.fn().mockResolvedValue(response);
};

describe('databaseApi', () => {
  describe('getServers', () => {
    it('should successfully parse valid JSON response', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          'server-default-list': {
            'list-items': {
              'list-item': [
                { idref: '1', nameref: 'test-server', typeref: 'http' }
              ]
            }
          }
        })
      };

      const makeRequest = createMockMakeRequest(mockResponse);
      const result = await getServers('localhost', 'admin', 'admin', makeRequest);

      expect(result).toEqual({
        'server-default-list': {
          'list-items': {
            'list-item': [
              { idref: '1', nameref: 'test-server', typeref: 'http' }
            ]
          }
        }
      });
    });

    it('should throw error for HTML response (404)', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/html' },
        body: '<!doctype html><html><body>404 Not Found</body></html>'
      };

      const makeRequest = createMockMakeRequest(mockResponse);
      
      await expect(getServers('localhost', 'admin', 'admin', makeRequest))
        .rejects
        .toThrow('Failed to get servers from localhost: servers: Server returned HTML instead of JSON. This usually indicates a 404 error or server misconfiguration.');
    });

    it('should throw error for invalid JSON', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        body: 'invalid json {'
      };

      const makeRequest = createMockMakeRequest(mockResponse);
      
      await expect(getServers('localhost', 'admin', 'admin', makeRequest))
        .rejects
        .toThrow('Failed to get servers from localhost: servers: Invalid JSON response. Parse error:');
    });

    it('should throw error for HTTP error status', async () => {
      const mockResponse = {
        status: 404,
        statusText: 'Not Found',
        headers: { 'content-type': 'application/json' },
        body: '{"error": "not found"}'
      };

      const makeRequest = createMockMakeRequest(mockResponse);
      
      await expect(getServers('localhost', 'admin', 'admin', makeRequest))
        .rejects
        .toThrow('Failed to get servers from localhost: servers: HTTP 404 Not Found');
    });

    it('should throw error for empty response', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        body: ''
      };

      const makeRequest = createMockMakeRequest(mockResponse);
      
      await expect(getServers('localhost', 'admin', 'admin', makeRequest))
        .rejects
        .toThrow('Failed to get servers from localhost: servers: Empty or invalid response body');
    });
  });

  describe('getDatabases', () => {
    it('should successfully parse valid JSON response', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          'database-default-list': {
            'list-items': {
              'list-item': [
                { idref: '1', nameref: 'test-db' }
              ]
            }
          }
        })
      };

      const makeRequest = createMockMakeRequest(mockResponse);
      const result = await getDatabases('localhost', 'admin', 'admin', makeRequest);

      expect(result).toEqual({
        'database-default-list': {
          'list-items': {
            'list-item': [
              { idref: '1', nameref: 'test-db' }
            ]
          }
        }
      });
    });

    it('should throw error for HTML response', async () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/html' },
        body: '<html><body>Error</body></html>'
      };

      const makeRequest = createMockMakeRequest(mockResponse);
      
      await expect(getDatabases('localhost', 'admin', 'admin', makeRequest))
        .rejects
        .toThrow('Failed to get databases from localhost: databases: Server returned HTML instead of JSON');
    });
  });

  describe('parseDatabaseConfigs', () => {
    it('should parse server and database data correctly', () => {
      const serversData = {
        'server-default-list': {
          'list-items': {
            'list-item': [
              {
                idref: 'server1',
                nameref: 'test-server',
                typeref: 'http',
                contentDatabase: 'content-db',
                modulesDatabase: 'modules-db'
              }
            ]
          }
        }
      };

      const databasesData = {
        'database-default-list': {
          'list-items': {
            'list-item': [
              { idref: 'content-db', nameref: 'Documents' },
              { idref: 'modules-db', nameref: 'Modules' }
            ]
          }
        }
      };

      const result = parseDatabaseConfigs(serversData, databasesData);

      expect(result).toEqual([
        {
          id: 'content-db',
          name: 'Documents',
          modulesDatabase: 'Modules',
          modulesDatabaseId: 'modules-db',
          serverId: 'server1',
          serverName: 'test-server'
        },
        {
          id: 'modules-db',
          name: 'Modules',
          modulesDatabase: 'Modules',
          modulesDatabaseId: 'modules-db',
          serverId: null,
          serverName: null
        }
      ]);
    });

    it('should handle empty data gracefully', () => {
      const result = parseDatabaseConfigs({}, {});
      expect(result).toEqual([]);
    });

    it('should handle null/undefined data gracefully', () => {
      const result = parseDatabaseConfigs(null, undefined);
      expect(result).toEqual([]);
    });

    it('should add standalone databases', () => {
      const serversData = { 'server-default-list': { 'list-items': { 'list-item': [] } } };
      const databasesData = {
        'database-default-list': {
          'list-items': {
            'list-item': [
              { idref: 'standalone-db', nameref: 'StandaloneDB' }
            ]
          }
        }
      };

      const result = parseDatabaseConfigs(serversData, databasesData);

      expect(result).toEqual([
        {
          id: 'standalone-db',
          name: 'StandaloneDB',
          modulesDatabase: 'StandaloneDB',
          modulesDatabaseId: 'standalone-db',
          serverId: null,
          serverName: null
        }
      ]);
    });

    it('should handle database-specific modules database', () => {
      const serversData = { 'server-default-list': { 'list-items': { 'list-item': [] } } };
      const databasesData = {
        'database-default-list': {
          'list-items': {
            'list-item': [
              { idref: 'content-db', nameref: 'prime-content' },
              { idref: 'modules-db', nameref: 'prime-content-modules' }
            ]
          }
        }
      };

      const result = parseDatabaseConfigs(serversData, databasesData);

      expect(result).toEqual([
        {
          id: 'content-db',
          name: 'prime-content',
          modulesDatabase: 'prime-content-modules',
          modulesDatabaseId: 'modules-db',
          serverId: null,
          serverName: null
        },
        {
          id: 'modules-db',
          name: 'prime-content-modules',
          modulesDatabase: 'prime-content-modules',
          modulesDatabaseId: 'modules-db',
          serverId: null,
          serverName: null
        }
      ]);
    });
  });
});