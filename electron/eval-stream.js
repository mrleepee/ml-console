const { ipcMain } = require('electron');
const http = require('http');
const https = require('https');
const { URL } = require('url');

/**
 * Fetch a URL and stream the response, emitting byte progress via IPC.
 * @param {Object} options
 * @param {string} options.url The URL to request
 * @param {string} [options.method] HTTP method
 * @param {Object} [options.headers] Request headers
 * @param {string|Buffer} [options.body] Optional request body
 * @returns {Promise<{status:number, headers:Object, body:string}>}
 */
function evalStream(options = {}) {
  return new Promise((resolve, reject) => {
    try {
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
      };

      const req = httpModule.request(requestOptions, (res) => {
        const chunks = [];
        let total = 0;

        res.on('data', (chunk) => {
          chunks.push(chunk);
          total += chunk.length;
          // Emit progress so renderer can update UI
          ipcMain.emit('eval-stream-progress', total);
        });

        res.on('end', () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks).toString(),
          });
        });

        res.on('error', reject);
      });

      req.on('error', reject);

      if (options.body) {
        req.write(options.body);
      }

      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = evalStream;
