#!/usr/bin/env node
/**
 * Dev server for the Director's Monitor. No dependencies.
 *
 *   node site/serve.mjs [--data <dir>] [--port 8787] [--host 0.0.0.0]
 *
 * Serves site/ at / and maps /data/* to the data directory (default: <repo>/.monitor).
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SITE_DIR, '..');

const args = parseArgs(process.argv.slice(2));
const DATA_DIR = path.resolve(args.data || path.join(ROOT, '.monitor'));
const PORT = Number(args.port || process.env.PORT || 8787);
const HOST = args.host || '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
};

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      if (v !== undefined) out[k] = v;
      else if (argv[i + 1] && !argv[i + 1].startsWith('--')) out[k] = argv[++i];
      else out[k] = true;
    }
  }
  return out;
}

function resolveSafe(baseDir, urlPath) {
  const rel = path.normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '');
  const file = path.join(baseDir, rel);
  const relToBase = path.relative(baseDir, file);
  if (relToBase.startsWith('..') || path.isAbsolute(relToBase)) return null;
  return file;
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}

function serveFile(req, res, file) {
  let stat;
  try { stat = fs.statSync(file); } catch { return false; }
  if (stat.isDirectory()) {
    file = path.join(file, 'index.html');
    try { stat = fs.statSync(file); } catch { return false; }
  }
  const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': stat.size, 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
  if (req.method === 'HEAD') { res.end(); return true; }
  fs.createReadStream(file).pipe(res);
  return true;
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'method not allowed');
  let urlPath;
  try { urlPath = new URL(req.url, 'http://x').pathname; } catch { return send(res, 400, 'bad request'); }

  if (urlPath === '/data' || urlPath.startsWith('/data/')) {
    const file = resolveSafe(DATA_DIR, urlPath.slice('/data'.length) || '/');
    if (!file) return send(res, 403, 'forbidden');
    if (serveFile(req, res, file)) return;
    return send(res, 404, 'not found', { 'Content-Type': 'text/plain' });
  }

  const file = resolveSafe(SITE_DIR, urlPath);
  if (!file) return send(res, 403, 'forbidden');
  if (serveFile(req, res, file)) return;
  send(res, 404, 'not found', { 'Content-Type': 'text/plain' });
});

server.listen(PORT, HOST, () => {
  const dataState = fs.existsSync(path.join(DATA_DIR, 'takes.json')) ? 'takes.json found' : 'no takes.json → site shows the waiting state';
  console.log(`Director's Monitor dev server`);
  console.log(`  site  http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/`);
  console.log(`  data  ${DATA_DIR}  (${dataState})`);
});
