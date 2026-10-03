// Serves the production build (with its service worker) for the installable-app E2E test, proxying the same paths to
// the API as the dev server (proxy.conf.mjs). Usage: node e2e/serve-dist.mjs <port>
import { createReadStream, existsSync, statSync } from 'node:fs';
import { request, createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import proxy from '../proxy.conf.mjs';

const port = Number(process.argv[2] ?? 4201);
const root = fileURLToPath(new URL('../dist/slovion/browser/', import.meta.url));
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
};

createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const prefix = Object.keys(proxy).find((p) => path === p || path.startsWith(p + '/'));
  if (prefix) {
    const target = new URL(req.url, proxy[prefix].target);
    const upstream = request(
      target,
      { method: req.method, headers: { ...req.headers, host: target.host } },
      (answer) => {
        res.writeHead(answer.statusCode ?? 502, answer.headers);
        answer.pipe(res);
      },
    );
    upstream.on('error', () => res.writeHead(502).end());
    req.pipe(upstream);
    return;
  }

  // Files as built; any other path is an app route and gets index.html.
  let file = normalize(join(root, path));
  if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory())
    file = join(root, 'index.html');
  res.writeHead(200, {
    'Content-Type': types[extname(file)] ?? 'application/octet-stream',
    'Cache-Control': 'no-cache',
  });
  createReadStream(file).pipe(res);
}).listen(port, () => console.log(`Serving the production build on http://localhost:${port}`));
