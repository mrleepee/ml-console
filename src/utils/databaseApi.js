/**
 * Database API utilities for MarkLogic REST Management API
 */

/**
 * Get all servers from MarkLogic Management API
 * @param {string} server - Server hostname
 * @param {string} username - Username for authentication
 * @param {string} password - Password for authentication
 * @param {function} makeRequest - Request function from the main app
 * @returns {Promise<Object>} Server configuration data
 */
export async function getServers(server, username, password, makeRequest) {
  const response = await makeRequest({
    url: `http://${server}:8002/manage/v2/servers?format=json`,
    method: "GET",
    headers: {
      "Accept": "application/json",
    },
    username,
    password,
  });

  if (response.status >= 200 && response.status < 300) {
    return JSON.parse(response.body);
  } else {
    throw new Error(`Failed to get servers: ${response.status} ${response.statusText}`);
  }
}

/**
 * Get all databases from MarkLogic Management API
 * @param {string} server - Server hostname
 * @param {string} username - Username for authentication
 * @param {string} password - Password for authentication
 * @param {function} makeRequest - Request function from the main app
 * @returns {Promise<Object>} Database configuration data
 */
export async function getDatabases(server, username, password, makeRequest) {
  const response = await makeRequest({
    url: `http://${server}:8002/manage/v2/databases?format=json`,
    method: "GET",
    headers: {
      "Accept": "application/json",
    },
    username,
    password,
  });

  if (response.status >= 200 && response.status < 300) {
    return JSON.parse(response.body);
  } else {
    throw new Error(`Failed to get databases: ${response.status} ${response.statusText}`);
  }
}

/**
 * Parse server and database JSON responses to create database-modules configurations
 * @param {Object} serversData - JSON response from servers endpoint
 * @param {Object} databasesData - JSON response from databases endpoint
 * @returns {Array} Array of database configuration objects
 */
export function parseDatabaseConfigs(serversData, databasesData) {
  const configs = [];
  const databasesById = {};
  const databasesByName = {};

  // Index databases by ID and name for quick lookup
  if (databasesData && databasesData['database-default-list'] && databasesData['database-default-list']['list-items']) {
    databasesData['database-default-list']['list-items']['list-item'].forEach(db => {
      databasesById[db.idref] = db;
      databasesByName[db.nameref] = db;
    });
  }

  // Process servers to extract database configurations
  if (serversData && serversData['server-default-list'] && serversData['server-default-list']['list-items']) {
    serversData['server-default-list']['list-items']['list-item'].forEach(server => {
      // Only process HTTP servers (App Services servers)
      if (server.typeref === 'http') {
        const contentDatabaseRef = server.contentDatabase;
        const modulesDatabaseRef = server.modulesDatabase;

        if (contentDatabaseRef && modulesDatabaseRef) {
          const contentDb = databasesById[contentDatabaseRef];
          const modulesDb = databasesById[modulesDatabaseRef];

          if (contentDb && modulesDb) {
            configs.push({
              id: contentDatabaseRef,
              name: contentDb.nameref,
              modulesDatabase: modulesDb.nameref,
              modulesDatabaseId: modulesDatabaseRef,
              serverId: server.idref,
              serverName: server.nameref
            });
          }
        }
      }
    });
  }

  // Also add standalone databases (not associated with any server)
  Object.values(databasesByName).forEach(db => {
    const existingConfig = configs.find(config => config.id === db.idref);
    if (!existingConfig) {
      // Try to find a matching modules database by naming convention
      let modulesDbName = 'Modules'; // Default fallback
      let modulesDbId = databasesByName['Modules']?.idref || db.idref;
      
      // Check for database-specific modules database (e.g., "prime-content" -> "prime-content-modules")
      const potentialModulesDbName = `${db.nameref}-modules`;
      if (databasesByName[potentialModulesDbName]) {
        modulesDbName = potentialModulesDbName;
        modulesDbId = databasesByName[potentialModulesDbName].idref;
      }
      // If no specific modules database and no generic Modules database, use the same database
      else if (!databasesByName['Modules']) {
        modulesDbName = db.nameref;
        modulesDbId = db.idref;
      }

      configs.push({
        id: db.idref,
        name: db.nameref,
        modulesDatabase: modulesDbName,
        modulesDatabaseId: modulesDbId,
        serverId: null,
        serverName: null
      });
    }
  });

  return configs;
}