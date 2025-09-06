const { contextBridge, ipcRenderer } = require('electron');

// Expose absolute model/wasm paths
const paths = ipcRenderer.sendSync('get-model-paths-sync');
contextBridge.exposeInMainWorld('__MODELS_DIR__', paths.modelsDir);
contextBridge.exposeInMainWorld('__WASM_DIR__', paths.wasmDir);

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  httpRequest: (options) => ipcRenderer.invoke('http-request', options),
  
  // Command execution
  runCommand: (options) => ipcRenderer.invoke('run-command', options),
  
  // Database operations
  database: {
    saveQuery: (queryData) => ipcRenderer.invoke('db-save-query', queryData),
    getRecentQueries: (limit) => ipcRenderer.invoke('db-get-recent-queries', limit),
    getQueryById: (id) => ipcRenderer.invoke('db-get-query-by-id', id),
    searchQueries: (searchTerm, limit) => ipcRenderer.invoke('db-search-queries', searchTerm, limit),
    getQueriesByType: (queryType, limit) => ipcRenderer.invoke('db-get-queries-by-type', queryType, limit),
    updateQueryStatus: (id, status, executionTimeMs) => ipcRenderer.invoke('db-update-query-status', id, status, executionTimeMs),
    deleteQuery: (id) => ipcRenderer.invoke('db-delete-query', id),
    getStats: () => ipcRenderer.invoke('db-get-stats')
  },
  
  // Platform info
  platform: process.platform,
  
  // Version info
  versions: {
    node: process.versions.node,
    electron: process.versions.electron,
    chrome: process.versions.chrome
  },

  // LLM status
  llm: {
    status: () => ipcRenderer.invoke('llm-status'),
    update: (status) => ipcRenderer.send('llm-status-update', status),
  },

  // Paths helper
  getModelPaths: () => ipcRenderer.invoke('get-model-paths')
});