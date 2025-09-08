const { ipcMain } = require('electron');
const http = require('http');
const https = require('https');
const { URL } = require('url');

/**
 * Perform an HTTP(S) request to the MarkLogic /v1/eval endpoint and
 * emit progress events indicating the total number of bytes received.
 *
 * @param {Object} options - Request options (method, headers, body, url)
 * @returns {Promise<Buffer>} Resolves with the full response body
 */
function evalStream(options) {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(options.url);
      const isHttps = url.protocol === 'https:';
      const httpModule = isHttps ? https : http;

      const req = httpModule.request({
        method: options.method || 'POST',
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        headers: options.headers || {},
      }, (res) => {
        const chunks = [];
        let total = 0;

        res.on('data', (chunk) => {
          chunks.push(chunk);
          total += chunk.length;
          ipcMain.emit('eval-stream-progress', total);
        });

        res.on('end', () => {
          resolve(Buffer.concat(chunks));
        });
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
