const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const crypto = require('crypto');
const { spawn } = require('child_process');
const fs = require('fs');
const fsp = require('fs/promises');
const QueryRepository = require('./database');
const evalStream = require('./eval-stream');

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
    
    // DevTools can be opened manually with Cmd+Option+I when needed
    // Commented out to avoid interference with Playwright testing
    // if (process.env.MOCK_HTTP !== '1') {
    //   mainWindow.webContents.openDevTools();
    // }
    
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

app.whenReady().then(async () => {
  // Initialize database
  try {
    queryRepository = new QueryRepository();
    console.log('Query repository initialized successfully');
  } catch (error) {
    console.error('Failed to initialize query repository:', error);
    // Don't create window if database fails - this is critical
    console.error('Cannot start application without database');
    app.quit();
    return;
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
    
    // Handle regular query request - return multiple XML records for navigation testing
    const parts = [
      [
        `--${boundary}`,
        'Content-Type: application/xml',
        'X-Primitive: element()',
        'X-URI: pathway/mock-1',
        'X-Path: /pathway[1]',
        '',
        '<pathway><pathway-uri>pathway/mock-1</pathway-uri><pathway-status>active</pathway-status><id>1</id></pathway>'
      ].join('\r\n'),
      [
        `--${boundary}`,
        'Content-Type: application/json',
        'X-Primitive: object-node()',
        'X-URI: product/mock-2',
        'X-Path: /product[1]',
        '',
        '{"id": 2, "name": "Test Product", "status": "available", "price": 29.99}'
      ].join('\r\n'),
      [
        `--${boundary}`,
        'Content-Type: text/plain',
        'X-Primitive: xs:string',
        'X-URI: text/mock-3',
        'X-Path: /text()[1]',
        '',
        'This is a simple text record for testing navigation between different content types.'
      ].join('\r\n'),
      [
        `--${boundary}`,
        'Content-Type: application/xml',
        'X-Primitive: element()',
        'X-URI: config/mock-4',
        'X-Path: /config[1]',
        '',
        '<config><setting name="debug">true</setting><setting name="timeout">5000</setting><version>1.2.3</version></config>'
      ].join('\r\n')
    ];
    const body = `${parts.join('\r\n')}\r\n--${boundary}--`;
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
      // SECURITY: Only disable TLS verification in development mode with explicit opt-in
      rejectUnauthorized: !(process.env.NODE_ENV === 'development' && process.env.ALLOW_INSECURE_TLS === 'true'),
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
          // SECURITY: Removed auth header logging to prevent credential exposure
          
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
            
            // SECURITY: Removed credential logging to prevent credential exposure
            
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

// Command execution handler for running tests
ipcMain.handle('run-command', async (event, options) => {
  const { command, cwd } = options;
  
  return new Promise((resolve, reject) => {
    console.log(`Running command: ${command} in ${cwd || process.cwd()}`);
    
    // Parse command and arguments
    const parts = command.split(' ');
    const cmd = parts[0];
    const args = parts.slice(1);
    
    const child = spawn(cmd, args, {
      cwd: cwd || process.cwd(),
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      console.log(`Command finished with code ${code}`);
      resolve({
        code,
        stdout,
        stderr,
        success: code === 0
      });
    });
    
    child.on('error', (error) => {
      console.error('Command error:', error);
      reject(error);
    });
    
    // Set a timeout to prevent hanging
    setTimeout(() => {
      child.kill();
      reject(new Error('Command timeout'));
    }, 300000); // 5 minutes timeout
  });
});

ipcMain.handle('eval-stream', async (event, options) => {
  return evalStream(options);
});

ipcMain.on('eval-stream-progress', (event, total) => {
  if (mainWindow) {
    mainWindow.webContents.send('eval-stream-progress', total);
  }
});

// --- Helpers for streaming to disk ---
function parseHeadersBlock(raw) {
  const headers = {};
  raw.split(/\r?\n/).forEach((line) => {
    const idx = line.indexOf(':');
    if (idx > -1) {
      const key = line.slice(0, idx).trim().toLowerCase();
      const value = line.slice(idx + 1).trim();
      headers[key] = value;
    }
  });
  return headers;
}

function extractBoundary(contentType) {
  if (!contentType) return null;
  const m = /boundary=([^;\s]+)/i.exec(contentType);
  return m ? m[1].trim() : null;
}

async function writeMultipartToDisk(bodyText, contentType) {
  const boundary = extractBoundary(contentType);
  const userDataDir = app.getPath('userData');
  const streamDir = path.join(userDataDir, 'streams', String(Date.now()));
  await fsp.mkdir(streamDir, { recursive: true });

  const index = { dir: streamDir, parts: [] };

  if (!boundary) {
    // Single part fallback
    const fileName = 'part-0.txt';
    await fsp.writeFile(path.join(streamDir, fileName), bodyText, 'utf8');
    index.parts.push({
      contentType: (contentType || '').toString(),
      primitive: '',
      uri: '',
      path: '',
      bytes: Buffer.byteLength(bodyText),
      file: fileName,
    });
    await fsp.writeFile(path.join(streamDir, 'index.json'), JSON.stringify(index, null, 2), 'utf8');
    return index;
  }

  const escaped = boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const segments = bodyText.split(new RegExp(`--${escaped}(?:--)?\\s*`, 'g'));
  let partNum = 0;
  for (const seg of segments) {
    const part = seg.trim();
    if (!part) continue;
    const m = /\r?\n\r?\n/.exec(part);
    if (!m) continue;
    const rawHeaders = part.slice(0, m.index);
    const content = part.slice(m.index + m[0].length);
    const headers = parseHeadersBlock(rawHeaders);
    const fileName = `part-${partNum}.txt`;
    await fsp.writeFile(path.join(streamDir, fileName), content, 'utf8');
    index.parts.push({
      contentType: headers['content-type'] || '',
      primitive: headers['x-primitive'] || '',
      uri: headers['x-uri'] || '',
      path: headers['x-path'] || '',
      bytes: Buffer.byteLength(content),
      file: fileName,
    });
    partNum += 1;
  }
  await fsp.writeFile(path.join(streamDir, 'index.json'), JSON.stringify(index, null, 2), 'utf8');
  return index;
}

async function httpRequestWithDigest(options) {
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
      rejectUnauthorized: false,
      timeout: options.timeout || 300000,
    };

    const firstRequest = httpModule.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode === 401 && options.username && options.password) {
          const authHeader = res.headers['www-authenticate'];
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
            const secondRequestOptions = { ...requestOptions, headers: { ...requestOptions.headers, Authorization: authorizationHeader } };
            const secondRequest = httpModule.request(secondRequestOptions, (authRes) => {
              let authData = '';
              authRes.on('data', (chunk) => (authData += chunk));
              authRes.on('end', () => {
                resolve({ status: authRes.statusCode, headers: authRes.headers, body: authData });
              });
            });
            secondRequest.on('error', reject);
            secondRequest.on('timeout', () => {
              secondRequest.destroy();
              reject(new Error('Request timeout'));
            });
            if (options.body) secondRequest.write(options.body);
            secondRequest.end();
          } else {
            reject(new Error('Digest authentication required but not supported by server'));
          }
        } else {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });
    firstRequest.on('error', reject);
    firstRequest.on('timeout', () => {
      firstRequest.destroy();
      reject(new Error('Request timeout'));
    });
    if (options.body) firstRequest.write(options.body);
    firstRequest.end();
  });
}

ipcMain.handle('http-request-stream-to-disk', async (event, options) => {
  // Support MOCK_HTTP path by reusing existing mock construction above
  if (process.env.MOCK_HTTP === '1') {
    const boundary = 'mockboundary123';
    const parts = [
      [
        `--${boundary}`,
        'Content-Type: application/xml',
        'X-Primitive: element()',
        'X-URI: pathway/mock-1',
        'X-Path: /pathway[1]',
        '',
        '<pathway><pathway-uri>pathway/mock-1</pathway-uri><pathway-status>active</pathway-status><id>1</id></pathway>'
      ].join('\r\n'),
      [
        `--${boundary}`,
        'Content-Type: application/json',
        'X-Primitive: object-node()',
        'X-URI: product/mock-2',
        'X-Path: /product[1]',
        '',
        '{"id": 2, "name": "Test Product", "status": "available", "price": 29.99}'
      ].join('\r\n'),
      [
        `--${boundary}`,
        'Content-Type: text/plain',
        'X-Primitive: xs:string',
        'X-URI: text/mock-3',
        'X-Path: /text()[1]',
        '',
        'This is a simple text record for testing pagination.'
      ].join('\r\n')
    ];
    const body = `${parts.join('\r\n')}\r\n--${boundary}--`;
    const index = await writeMultipartToDisk(body, `multipart/mixed; boundary=${boundary}`);
    return { success: true, index };
  }

  const resp = await httpRequestWithDigest(options);
  if (resp.status < 200 || resp.status >= 300) {
    return { success: false, error: `HTTP ${resp.status}` };
  }
  const contentType = resp.headers['content-type'] || resp.headers['Content-Type'] || '';
  const index = await writeMultipartToDisk(resp.body || '', contentType);
  return { success: true, index };
});

ipcMain.handle('read-stream-parts', async (event, dir, start, count) => {
  try {
    const idxPath = path.join(dir, 'index.json');
    if (!fs.existsSync(idxPath)) return { success: false, error: 'Index not found' };
    const index = JSON.parse(await fsp.readFile(idxPath, 'utf8'));
    const s = Math.max(0, parseInt(start || 0, 10));
    const c = Math.max(0, parseInt(count || 0, 10));
    const end = Math.min(index.parts.length, s + c);
    const slice = [];
    for (let i = s; i < end; i++) {
      const p = index.parts[i];
      const content = await fsp.readFile(path.join(dir, p.file), 'utf8');
      slice.push({ index: i, contentType: p.contentType, primitive: p.primitive, uri: p.uri, path: p.path, content });
    }
    return { success: true, records: slice, total: index.parts.length };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
