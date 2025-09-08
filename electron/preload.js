const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  httpRequest: (options) => ipcRenderer.invoke('http-request', options),
  evalStream: (options) => ipcRenderer.invoke('eval-stream', options),
  onEvalStreamProgress: (callback) => {
    const handler = (_event, total) => callback(total);
    ipcRenderer.on('eval-stream-progress', handler);
    return () => ipcRenderer.removeListener('eval-stream-progress', handler);
  },
  
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
  }
});
