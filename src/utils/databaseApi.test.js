import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getServers, getDatabases, parseDatabaseConfigs } from './databaseApi.js';

// Mock data for MarkLogic Management API responses
const mockServersResponse = {
  "server-default-list": {
    "list-items": {
      "list-item": [
        {
          "idref": "8000",
          "nameref": "App-Services",
          "typeref": "http",
          "contentDatabase": "7682138842179613689",
          "modulesDatabase": "15944027002351853507"
        },
        {
          "idref": "8001",
          "nameref": "Admin",
          "typeref": "http",
          "contentDatabase": "12142949855174069457",
          "modulesDatabase": "15944027002351853507"
        },
        {
          "idref": "8002",
          "nameref": "Manage",
          "typeref": "http",
          "contentDatabase": "12142949855174069457",
          "modulesDatabase": "15944027002351853507"
        }
      ]
    }
  }
};

const mockDatabasesResponse = {
  "database-default-list": {
    "list-items": {
      "list-item": [
        {
          "idref": "7682138842179613689",
          "nameref": "Documents"
        },
        {
          "idref": "12142949855174069457",
          "nameref": "Security"
        },
        {
          "idref": "15944027002351853507",
          "nameref": "Modules"
        },
        {
          "idref": "123456789",
          "nameref": "prime-content"
        },
        {
          "idref": "987654321",
          "nameref": "prime-content-modules"
        }
      ]
    }
  }
};

describe('databaseApi', () => {
  let mockMakeRequest;

  beforeEach(() => {
    mockMakeRequest = vi.fn();
  });

  describe('getServers', () => {
    it('should fetch servers successfully', async () => {
      // Arrange
      mockMakeRequest.mockResolvedValue({
        status: 200,
        body: JSON.stringify(mockServersResponse)
      });

      // Act
      const result = await getServers('localhost', 'admin', 'admin', mockMakeRequest);

      // Assert
      expect(mockMakeRequest).toHaveBeenCalledWith({
        url: 'http://localhost:8002/manage/v2/servers?format=json',
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        username: 'admin',
        password: 'admin'
      });
      expect(result).toEqual(mockServersResponse);
    });

    it('should throw error on HTTP failure', async () => {
      // Arrange
      mockMakeRequest.mockResolvedValue({
        status: 401,
        statusText: 'Unauthorized'
      });

      // Act & Assert
      await expect(getServers('localhost', 'admin', 'admin', mockMakeRequest))
        .rejects.toThrow('Failed to get servers: 401 Unauthorized');
    });

    it('should handle JSON parsing errors gracefully', async () => {
      // Arrange
      mockMakeRequest.mockResolvedValue({
        status: 200,
        body: 'invalid json'
      });

      // Act & Assert
      await expect(getServers('localhost', 'admin', 'admin', mockMakeRequest))
        .rejects.toThrow();
    });
  });

  describe('getDatabases', () => {
    it('should fetch databases successfully', async () => {
      // Arrange
      mockMakeRequest.mockResolvedValue({
        status: 200,
        body: JSON.stringify(mockDatabasesResponse)
      });

      // Act
      const result = await getDatabases('localhost', 'admin', 'admin', mockMakeRequest);

      // Assert
      expect(mockMakeRequest).toHaveBeenCalledWith({
        url: 'http://localhost:8002/manage/v2/databases?format=json',
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        username: 'admin',
        password: 'admin'
      });
      expect(result).toEqual(mockDatabasesResponse);
    });

    it('should throw error on HTTP failure', async () => {
      // Arrange
      mockMakeRequest.mockResolvedValue({
        status: 500,
        statusText: 'Internal Server Error'
      });

      // Act & Assert
      await expect(getDatabases('localhost', 'admin', 'admin', mockMakeRequest))
        .rejects.toThrow('Failed to get databases: 500 Internal Server Error');
    });
  });

  describe('parseDatabaseConfigs', () => {
    it('should parse server and database data correctly', () => {
      // Act
      const result = parseDatabaseConfigs(mockServersResponse, mockDatabasesResponse);

      // Assert
      expect(result).toHaveLength(6); // 3 from servers + 3 standalone databases

      // Check server-based configurations
      const appServicesConfig = result.find(config => config.serverName === 'App-Services');
      expect(appServicesConfig).toEqual({
        id: '7682138842179613689',
        name: 'Documents',
        modulesDatabase: 'Modules',
        modulesDatabaseId: '15944027002351853507',
        serverId: '8000',
        serverName: 'App-Services'
      });

      // Check standalone database configurations - should use specific modules database
      const primeContentConfig = result.find(config => config.name === 'prime-content');
      expect(primeContentConfig).toEqual({
        id: '123456789',
        name: 'prime-content',
        modulesDatabase: 'prime-content-modules',
        modulesDatabaseId: '987654321',
        serverId: null,
        serverName: null
      });

      // Check that the modules database itself is configured correctly
      const primeContentModulesConfig = result.find(config => config.name === 'prime-content-modules');
      expect(primeContentModulesConfig).toEqual({
        id: '987654321',
        name: 'prime-content-modules',
        modulesDatabase: 'Modules',
        modulesDatabaseId: '15944027002351853507',
        serverId: null,
        serverName: null
      });
    });

    it('should handle missing data gracefully', () => {
      // Act
      const result = parseDatabaseConfigs({}, {});

      // Assert
      expect(result).toEqual([]);
    });

    it('should handle malformed server data', () => {
      // Arrange
      const malformedServerData = {
        "server-default-list": {
          "list-items": {
            "list-item": [
              {
                "idref": "8000",
                "nameref": "App-Services",
                "typeref": "http"
                // Missing contentDatabase and modulesDatabase
              }
            ]
          }
        }
      };

      // Act
      const result = parseDatabaseConfigs(malformedServerData, mockDatabasesResponse);

      // Assert
      expect(result).toHaveLength(5); // Should still process standalone databases
    });

    it('should only process HTTP servers', () => {
      // Arrange
      const mixedServersData = {
        "server-default-list": {
          "list-items": {
            "list-item": [
              {
                "idref": "7997",
                "nameref": "HealthCheck",
                "typeref": "http",
                "contentDatabase": "7682138842179613689",
                "modulesDatabase": "15944027002351853507"
              },
              {
                "idref": "8050",
                "nameref": "XDBCServer",
                "typeref": "xdbc",
                "contentDatabase": "7682138842179613689",
                "modulesDatabase": "15944027002351853507"
              }
            ]
          }
        }
      };

      // Act
      const result = parseDatabaseConfigs(mixedServersData, mockDatabasesResponse);

      // Assert  
      // Should have 1 HTTP server config + 4 standalone databases (excluding Documents which is used by the server)
      expect(result).toHaveLength(5);
      expect(result.find(config => config.serverName === 'HealthCheck')).toBeDefined();
      expect(result.find(config => config.serverName === 'XDBCServer')).toBeUndefined();
    });

    it('should use Modules as default modules database when no specific modules database exists', () => {
      // Arrange - Use data that includes Modules but no specific modules database for test-db
      const testDatabasesData = {
        "database-default-list": {
          "list-items": {
            "list-item": [
              {
                "idref": "15944027002351853507",
                "nameref": "Modules"
              },
              {
                "idref": "999999999",
                "nameref": "test-db"
              }
            ]
          }
        }
      };

      // Act
      const result = parseDatabaseConfigs({}, testDatabasesData);

      // Assert
      const standaloneConfig = result.find(config => config.name === 'test-db');
      expect(standaloneConfig.modulesDatabase).toBe('Modules');
      expect(standaloneConfig.modulesDatabaseId).toBe('15944027002351853507');
    });

    it('should fall back to same database as modules database when Modules not available', () => {
      // Arrange
      const databasesWithoutModules = {
        "database-default-list": {
          "list-items": {
            "list-item": [
              {
                "idref": "123456789",
                "nameref": "prime-content"
              }
            ]
          }
        }
      };

      // Act
      const result = parseDatabaseConfigs({}, databasesWithoutModules);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].modulesDatabase).toBe('prime-content');
      expect(result[0].modulesDatabaseId).toBe('123456789');
    });

    it('should match database-specific modules databases by naming convention', () => {
      // Arrange
      const customDatabasesData = {
        "database-default-list": {
          "list-items": {
            "list-item": [
              {
                "idref": "111111111",
                "nameref": "my-app-content"
              },
              {
                "idref": "222222222",
                "nameref": "my-app-content-modules"
              },
              {
                "idref": "333333333",
                "nameref": "other-database"
              }
            ]
          }
        }
      };

      // Act
      const result = parseDatabaseConfigs({}, customDatabasesData);

      // Assert
      expect(result).toHaveLength(3);
      
      // Check that my-app-content uses my-app-content-modules
      const appContentConfig = result.find(config => config.name === 'my-app-content');
      expect(appContentConfig.modulesDatabase).toBe('my-app-content-modules');
      expect(appContentConfig.modulesDatabaseId).toBe('222222222');
      
      // Check that other-database falls back to itself (no Modules db available)
      const otherDbConfig = result.find(config => config.name === 'other-database');
      expect(otherDbConfig.modulesDatabase).toBe('other-database');
      expect(otherDbConfig.modulesDatabaseId).toBe('333333333');
    });
  });
});