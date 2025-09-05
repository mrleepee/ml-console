const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const crypto = require('crypto');
const QueryRepository = require('./database');

let mainWindow;
let queryRepository;

function createWindow() {
  console.log('Creating Electron window...');
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'default',
    show: true
  });
  
  console.log('Window created, loading content...');

  // Load the React app
  const isDev = !app.isPackaged;
  if (isDev) {
    const previewPort = process.env.PREVIEW_PORT || '1420';
    const devUrl = `http://localhost:${previewPort}`;
    console.log(`Loading development server at ${devUrl}`);

    // Wait for dev server before loading to avoid blank window
    waitForServer(devUrl, 30000, 500)
      .then(() => {
        console.log('Dev server detected, loading URL...');
        mainWindow.loadURL(devUrl);
      })
      .catch((err) => {
        console.warn('Dev server not detected within timeout, attempting to load anyway:', err?.message || err);
        mainWindow.loadURL(devUrl);
      });
    
    // Enable DevTools for debugging (but not during tests)
    if (process.env.MOCK_HTTP !== '1') {
      mainWindow.webContents.openDevTools();
    }
    
    // Forward console logs from renderer to main process
    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
      const levelStr = typeof level === 'string' ? level : String(level);
      console.log(`[RENDERER-${levelStr.toUpperCase()}] ${message}`);
    });
    
    // Handle loading events
    mainWindow.webContents.on('did-finish-load', () => {
      console.log('✅ Page loaded successfully!');
    });
    
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.log('❌ Failed to load:', errorCode, errorDescription);
      console.log('Retrying in 2 seconds...');
      setTimeout(() => {
        const fallbackPort = process.env.PREVIEW_PORT || '1420';
        mainWindow.loadURL(`http://localhost:${fallbackPort}`);
      }, 2000);
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Poll for dev server availability
function waitForServer(urlString, timeoutMs = 30000, intervalMs = 500) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const urlObj = new URL(urlString);
    const isHttps = urlObj.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    const tryRequest = () => {
      const req = httpModule.request({
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: '/',
        method: 'HEAD',
      }, (res) => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 500) {
          resolve(true);
        } else {
          retry();
        }
      });
      req.on('error', retry);
      req.end();
    };

    const retry = () => {
      if (Date.now() - start > timeoutMs) {
        reject(new Error('Timeout waiting for dev server'));
        return;
      }
      setTimeout(tryRequest, intervalMs);
    };

    tryRequest();
  });
}

app.whenReady().then(() => {
  // Initialize database
  try {
    queryRepository = new QueryRepository();
    console.log('Query repository initialized');
  } catch (error) {
    console.error('Failed to initialize query repository:', error);
  }
  
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Close database connection before quitting
    if (queryRepository) {
      queryRepository.close();
    }
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Digest Authentication Helper
function createDigestResponse(username, password, method, uri, realm, nonce, qop, nc, cnonce) {
  const ha1 = crypto.createHash('md5').update(`${username}:${realm}:${password}`).digest('hex');
  const ha2 = crypto.createHash('md5').update(`${method}:${uri}`).digest('hex');
  const response = crypto.createHash('md5').update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`).digest('hex');
  return response;
}

function parseWWWAuthenticate(authHeader) {
  const auth = {};
  authHeader.replace(/(\w+)="([^"]*)"|\w+=([^,]*)/g, (match, key, value1, value2) => {
    auth[key] = value1 || value2;
  });
  return auth;
}

// HTTP Request Handler with Digest Auth
ipcMain.handle('http-request', async (event, options) => {
  // Test harness mock: short-circuit network calls when MOCK_HTTP is enabled
  if (process.env.MOCK_HTTP === '1') {
    console.log('MOCK HTTP REQUEST:', options.url, options.body);
    
    const boundary = 'mockboundary123';
    
    // Handle database discovery request
    if (options.body && options.body.includes('xdmp:databases()')) {
      const dbParts = [
        `--${boundary}`,
        'Content-Type: text/plain',
        'X-Primitive: xs:string',
        '',
        'Documents',
        `--${boundary}`,
        'Content-Type: text/plain', 
        'X-Primitive: xs:string',
        '',
        'Test-Database',
        `--${boundary}--`
      ].join('\r\n');
      return {
        status: 200,
        headers: { 'content-type': `multipart/mixed; boundary=${boundary}` },
        body: dbParts
      };
    }
    
    // Handle regular query request - return XML pathway data
    const part = [
      `--${boundary}`,
      'Content-Type: application/xml',
      'X-Primitive: element()',
      'X-URI: pathway/mock',
      'X-Path: /pathway',
      '',
      '<pathway><pathway-uri>pathway/mock</pathway-uri><pathway-status>active</pathway-status></pathway>'
    ].join('\r\n');
    const body = `${part}\r\n--${boundary}--`;
    return {
      status: 200,
      headers: { 'content-type': `multipart/mixed; boundary=${boundary}` },
      body
    };
  }
  console.log('=== HTTP REQUEST ===');
  console.log('URL:', options.url);
  console.log('Method:', options.method);
  console.log('Headers:', options.headers);
  
  return new Promise((resolve, reject) => {
    const url = new URL(options.url);
    const isHttps = url.protocol === 'https:';
    const httpModule = isHttps ? https : http;
    
    const requestOptions = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      rejectUnauthorized: false, // For self-signed certificates
      timeout: options.timeout || 30000 // Default 30 seconds
    };

    // First request - may get 401 with digest challenge
    const firstRequest = httpModule.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log('First response status:', res.statusCode);
        
        if (res.statusCode === 401 && options.username && options.password) {
          // Handle digest authentication
          const authHeader = res.headers['www-authenticate'];
          console.log('Auth header:', authHeader);
          
          if (authHeader && authHeader.startsWith('Digest')) {
            const authParams = parseWWWAuthenticate(authHeader);
            const nc = '00000001';
            const cnonce = crypto.randomBytes(16).toString('hex');
            const qop = authParams.qop || 'auth';
            
            const digestResponse = createDigestResponse(
              options.username,
              options.password,
              options.method || 'GET',
              url.pathname + url.search,
              authParams.realm,
              authParams.nonce,
              qop,
              nc,
              cnonce
            );
            
            const authorizationHeader = `Digest username="${options.username}", realm="${authParams.realm}", nonce="${authParams.nonce}", uri="${url.pathname + url.search}", qop=${qop}, nc=${nc}, cnonce="${cnonce}", response="${digestResponse}"`;
            
            console.log('Authorization header:', authorizationHeader);
            
            // Second request with digest auth
            const secondRequestOptions = {
              ...requestOptions,
              headers: {
                ...requestOptions.headers,
                'Authorization': authorizationHeader
              }
            };
            
            const secondRequest = httpModule.request(secondRequestOptions, (authRes) => {
              let authData = '';
              authRes.on('data', (chunk) => authData += chunk);
              authRes.on('end', () => {
                console.log('Auth response status:', authRes.statusCode);
                console.log('Auth response body preview:', authData.substring(0, 200));
                
                resolve({
                  status: authRes.statusCode,
                  headers: authRes.headers,
                  body: authData
                });
              });
            });
            
            secondRequest.on('error', (err) => {
              console.error('Second request error:', err);
              reject(err);
            });
            
            secondRequest.on('timeout', () => {
              secondRequest.destroy();
              reject(new Error('Request timeout'));
            });
            
            if (options.body) {
              secondRequest.write(options.body);
            }
            secondRequest.end();
          } else {
            reject(new Error('Digest authentication required but not supported by server'));
          }
        } else {
          // No auth needed or auth failed
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data
          });
        }
      });
    });
    
    firstRequest.on('error', (err) => {
      console.error('First request error:', err);
      reject(err);
    });
    
    firstRequest.on('timeout', () => {
      firstRequest.destroy();
      reject(new Error('Request timeout'));
    });
    
    if (options.body) {
      firstRequest.write(options.body);
    }
    firstRequest.end();
  });
});

// Database IPC Handlers
ipcMain.handle('db-save-query', async (event, queryData) => {
  if (!queryRepository) {
    return { success: false, error: 'Database not initialized' };
  }
  
  const { content, queryType, databaseName, embedding, executionTimeMs, status } = queryData;
  return queryRepository.saveQuery(content, queryType, databaseName, embedding, executionTimeMs, status);
});

ipcMain.handle('db-get-recent-queries', async (event, limit = 15) => {
  if (!queryRepository) {
    return { success: false, error: 'Database not initialized', queries: [] };
  }
  
  return queryRepository.getRecentQueries(limit);
});

ipcMain.handle('db-get-query-by-id', async (event, id) => {
  if (!queryRepository) {
    return { success: false, error: 'Database not initialized' };
  }
  
  return queryRepository.getQueryById(id);
});

ipcMain.handle('db-search-queries', async (event, searchTerm, limit = 15) => {
  if (!queryRepository) {
    return { success: false, error: 'Database not initialized', queries: [] };
  }
  
  return queryRepository.searchQueries(searchTerm, limit);
});

ipcMain.handle('db-get-queries-by-type', async (event, queryType, limit = 15) => {
  if (!queryRepository) {
    return { success: false, error: 'Database not initialized', queries: [] };
  }
  
  return queryRepository.getQueriesByType(queryType, limit);
});

ipcMain.handle('db-update-query-status', async (event, id, status, executionTimeMs) => {
  if (!queryRepository) {
    return { success: false, error: 'Database not initialized' };
  }
  
  return queryRepository.updateQueryStatus(id, status, executionTimeMs);
});

ipcMain.handle('db-delete-query', async (event, id) => {
  if (!queryRepository) {
    return { success: false, error: 'Database not initialized' };
  }
  
  return queryRepository.deleteQuery(id);
});

ipcMain.handle('db-get-stats', async (event) => {
  if (!queryRepository) {
    return { success: false, error: 'Database not initialized' };
  }
  
  return queryRepository.getStats();
});