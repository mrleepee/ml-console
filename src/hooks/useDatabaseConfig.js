import { useState, useCallback, useEffect, useRef } from 'react';
import { getServers, getDatabases, parseDatabaseConfigs } from '../utils/databaseApi';
import { checkConnection } from '../ipc/queryClient';

/**
 * Custom hook for managing database configuration state
 *
 * Manages:
 * - Server connection (server, username, password)
 * - Available database configurations
 * - Selected database configuration
 * - Connection status and health checking
 *
 * @param {Object} options Configuration options
 * @param {string} options.initialServer Initial server hostname
 * @param {string} options.initialUsername Initial username
 * @param {string} options.initialPassword Initial password
 * @returns {Object} Database configuration state and controls
 */
export default function useDatabaseConfig({
  initialServer = 'localhost',
  initialUsername = 'admin',
  initialPassword = 'admin'
} = {}) {

  // Connection configuration
  const [server, setServer] = useState(initialServer);
  const [username, setUsername] = useState(initialUsername);
  const [password, setPassword] = useState(initialPassword);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  // Database configuration state
  const [selectedDatabaseConfig, setSelectedDatabaseConfig] = useState({
    name: '',
    id: '',
    modulesDatabase: '',
    modulesDatabaseId: ''
  });
  const [databaseConfigs, setDatabaseConfigs] = useState([]);

  // Ref for immediate access (avoiding React batching issues)
  const currentDatabaseConfigRef = useRef(null);

  // Keep ref in sync with state
  useEffect(() => {
    currentDatabaseConfigRef.current = selectedDatabaseConfig;
  }, [selectedDatabaseConfig]);

  // Server URL derivation
  const serverUrl = `http://${server}:8000`;

  // Simple HTTP request helper (works in both Electron and web)
  const makeRequest = useCallback(async (options) => {
    try {
      if (window.electronAPI && window.electronAPI.httpRequest) {
        const response = await window.electronAPI.httpRequest(options);
        return response;
      } else {
        const resp = await fetch(options.url, {
          method: options.method || 'GET',
          headers: options.headers || {},
          body: options.body,
        });
        const text = await resp.text();
        return { status: resp.status, body: text };
      }
    } catch (error) {
      throw new Error(`Request failed: ${error.message}`);
    }
  }, []);

  // Connection health check
  const checkConnectionHealth = useCallback(async () => {
    try {
      setConnectionStatus('connecting');
      const response = await checkConnection({
        url: `http://${server}:7997/LATEST/healthcheck`,
        username,
        password,
        timeout: 10000,
      });
      setConnectionStatus(response.ok ? 'connected' : 'error');
    } catch (err) {
      console.error('Connection check failed:', err);
      setConnectionStatus('error');
    }
  }, [server, username, password]);

  // Build database configurations with cancellation support
  const getDatabaseConfigs = useCallback(async (signal) => {
    try {
      const [serversData, databasesData] = await Promise.all([
        getServers(server, username, password, makeRequest),
        getDatabases(server, username, password, makeRequest)
      ]);

      // Check if cancelled before proceeding
      if (signal?.aborted) return;

      const configs = parseDatabaseConfigs(serversData, databasesData);
      setDatabaseConfigs(configs);

      // Use functional update to avoid stale closure issues
      setSelectedDatabaseConfig(currentConfig => {
        const currentIsValid = configs.some(c => c.name === currentConfig.name && c.id === currentConfig.id);
        if (!currentIsValid && configs.length > 0) {
          // Also update the ref immediately
          currentDatabaseConfigRef.current = configs[0];
          return configs[0];
        }
        // Update ref with current valid config
        currentDatabaseConfigRef.current = currentConfig;
        return currentConfig;
      });
    } catch (err) {
      if (err.name === 'AbortError' || signal?.aborted) {
        console.log('Database config loading was cancelled');
        return;
      }
      console.error('Get database configs error:', err);
      const errorMsg = `Failed to get database configurations: ${err.message}. Please check your server connection and credentials.`;
      setConnectionStatus('error');
      setDatabaseConfigs([]);
      setSelectedDatabaseConfig({ name: '', id: '', modulesDatabase: '', modulesDatabaseId: '' });
      throw new Error(errorMsg);
    }
  }, [server, username, password, makeRequest]);

  // Auto-refresh database configs when connection parameters change
  useEffect(() => {
    if (!username || !password || !server) return;

    const controller = new AbortController();
    getDatabaseConfigs(controller.signal);

    return () => controller.abort();
  }, [username, password, server, getDatabaseConfigs]);

  // Select database by ID
  const selectDatabase = useCallback((databaseId) => {
    const config = databaseConfigs.find(c => c.id === databaseId);
    if (config) {
      setSelectedDatabaseConfig(config);
      currentDatabaseConfigRef.current = config;
    }
  }, [databaseConfigs]);

  // Select database by config object
  const selectDatabaseConfig = useCallback((config) => {
    if (config) {
      setSelectedDatabaseConfig(config);
      currentDatabaseConfigRef.current = config;
    }
  }, []);

  // Refresh database configurations
  const refresh = useCallback(async () => {
    const controller = new AbortController();
    try {
      await getDatabaseConfigs(controller.signal);
    } catch (err) {
      // Error is already handled in getDatabaseConfigs
      throw err;
    }
  }, [getDatabaseConfigs]);

  // Update connection settings
  const updateConnection = useCallback((newServer, newUsername, newPassword) => {
    if (newServer !== undefined) setServer(newServer);
    if (newUsername !== undefined) setUsername(newUsername);
    if (newPassword !== undefined) setPassword(newPassword);
  }, []);

  return {
    // Connection state
    server,
    username,
    password,
    serverUrl,
    connectionStatus,

    // Database configuration state
    selectedDatabaseConfig,
    databaseConfigs,

    // Immediate access ref (for avoiding React batching)
    currentDatabaseConfigRef,

    // Actions
    setServer,
    setUsername,
    setPassword,
    selectDatabase,
    selectDatabaseConfig,
    updateConnection,
    refresh,
    checkConnectionHealth,

    // Computed values
    isConnected: connectionStatus === 'connected',
    hasConfigs: databaseConfigs.length > 0,
    hasValidSelection: selectedDatabaseConfig.id && databaseConfigs.length > 0,
  };
}