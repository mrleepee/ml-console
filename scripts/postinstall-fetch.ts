/*
  Optional offline-first downloader, disabled by default.
  Set ENABLE_OFFLINE_MODEL_FETCH=1 to enable and provide MODEL_URLS json.
*/
import { createWriteStream, promises as fs } from 'fs';
import path from 'path';
import https from 'https';
import crypto from 'crypto';

async function sha256(filePath: string) {
  const hash = crypto.createHash('sha256');
  const data = await fs.readFile(filePath);
  hash.update(data);
  return hash.digest('hex');
}

function download(url: string, out: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(out);
    https.get(url, (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve()));
    }).on('error', reject);
  });
}

async function main() {
  if (process.env.ENABLE_OFFLINE_MODEL_FETCH !== '1') return;
  const userData = process.env.MODELS_DIR || path.join(process.cwd(), 'models');
  await fs.mkdir(userData, { recursive: true });
  const configStr = process.env.MODEL_URLS || '[]';
  const list: Array<{ url: string; sha256: string; dest: string }> = JSON.parse(configStr);
  for (const item of list) {
    const dest = path.join(userData, item.dest);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await download(item.url, dest);
    const digest = await sha256(dest);
    if (digest !== item.sha256) throw new Error(`SHA mismatch for ${dest}`);
  }
}

main().catch((e) => {
  console.error('postinstall-fetch failed:', e.message);
  process.exit(1);
});


