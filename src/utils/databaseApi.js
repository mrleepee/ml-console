/**
 * Database API utilities for MarkLogic REST Management API
 */

/**
 * Safely parse JSON response with error handling
 * @param {string} responseBody - Response body to parse
 * @param {string} endpoint - Endpoint name for error context
 * @returns {Object} Parsed JSON object
 * @throws {Error} If response is not valid JSON
 */
function safeJsonParse(responseBody, endpoint) {
  if (!responseBody || typeof responseBody !== 'string') {
    throw new Error(`${endpoint}: Empty or invalid response body`);
  }

  // Check if response looks like HTML (common error response)
  if (responseBody.trim().toLowerCase().startsWith('<!doctype') || 
      responseBody.trim().toLowerCase().startsWith('<html')) {
    throw new Error(`${endpoint}: Server returned HTML instead of JSON. This usually indicates a 404 error or server misconfiguration.`);
  }

  try {
    return JSON.parse(responseBody);
  } catch (parseError) {
    // Provide more context about what we received
    const preview = responseBody.substring(0, 200);
    throw new Error(`${endpoint}: Invalid JSON response. Parse error: ${parseError.message}. Response preview: ${preview}...`);
  }
}

/**
 * Validate response status and content type
 * @param {Object} response - Response object
 * @param {string} endpoint - Endpoint name for error context
 * @throws {Error} If response is not valid
 */
function validateResponse(response, endpoint) {
  if (!response) {
    throw new Error(`${endpoint}: No response received`);
  }

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`${endpoint}: HTTP ${response.status} ${response.statusText || 'Unknown Error'}`);
  }

  // Check content type if available
  const contentType = response.headers?.['content-type'] || response.headers?.['Content-Type'];
  if (contentType && !contentType.includes('application/json')) {
    console.warn(`${endpoint}: Unexpected content type: ${contentType}. Expected application/json.`);
  }
}

/**
 * Get all servers from MarkLogic Management API
 * @param {string} server - Server hostname
 * @param {string} username - Username for authentication
 * @param {string} password - Password for authentication
 * @param {function} makeRequest - Request function from the main app
 * @returns {Promise<Object>} Server configuration data
 */
export async function getServers(server, username, password, makeRequest) {
  const endpoint = 'servers';
  
  try {
    const response = await makeRequest({
      url: `http://${server}:8002/manage/v2/servers?format=json`,
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
      username,
      password,
    });

    validateResponse(response, endpoint);
    return safeJsonParse(response.body, endpoint);
  } catch (error) {
    // Re-throw with more context
    throw new Error(`Failed to get servers from ${server}: ${error.message}`);
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
  const endpoint = 'databases';
  
  try {
    const response = await makeRequest({
      url: `http://${server}:8002/manage/v2/databases?format=json`,
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
      username,
      password,
    });

    validateResponse(response, endpoint);
    return safeJsonParse(response.body, endpoint);
  } catch (error) {
    // Re-throw with more context
    throw new Error(`Failed to get databases from ${server}: ${error.message}`);
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