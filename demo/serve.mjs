// Two origins for a deterministic demo:
//   http://localhost:5173  - the dApp
//   http://127.0.0.1:5174  - "DemoTrack Analytics", a tracker that logs what it receives
// Different hostnames make them different sites, so the tracker is a third party.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.zip': 'application/zip',
};

async function serveFile(res, dir, path) {
  const root = join(here, dir);
  const file = join(root, path === '/' ? 'index.html' : path);
  if (!file.startsWith(root)) return res.writeHead(403).end();
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(data);
  } catch {
    res.writeHead(404).end('not found');
  }
}

// The site and demo dApp live in docs/ (published with GitHub Pages).
createServer((req, res) => {
  let path = new URL(req.url, 'http://x').pathname;
  if (path.endsWith('/')) path += 'index.html';
  return serveFile(res, '../docs', path);
}).listen(5173, 'localhost', () => console.log('site      http://localhost:5173   dApp http://localhost:5173/demo/'));

const log = [];
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };

createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'OPTIONS') return res.writeHead(204, cors).end();
  if (url.pathname === '/') return serveFile(res, 'tracker', '/index.html');
  if (url.pathname === '/leaky-analytics.js') return serveFile(res, '../docs/demo', '/leaky-analytics.js');
  if (url.pathname === '/log') return res.writeHead(200, { ...cors, 'content-type': 'application/json' }).end(JSON.stringify(log));
  if (url.pathname === '/reset') {
    log.length = 0;
    return res.writeHead(200, cors).end('ok');
  }
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const entry = { at: new Date().toISOString(), method: req.method, path: url.pathname + url.search, body };
    log.push(entry);
    console.log(`[DemoTrack] received ${entry.method} ${entry.path} ${body ? 'body=' + body.slice(0, 120) : ''}`);
    res.writeHead(204, cors).end();
  });
}).listen(5174, '127.0.0.1', () => console.log('tracker   http://127.0.0.1:5174  (open it to watch what it receives)'));
