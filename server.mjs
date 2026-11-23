// Petit serveur statique sans dependance. Affiche aussi l'adresse a ouvrir depuis un telephone (meme Wi-Fi).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url)), start = Number(process.env.PORT) || 8080;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.svg': 'image/svg+xml' };

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const path = normalize(url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname));
  if (path.includes('..')) { res.writeHead(403).end(); return; }
  try {
    const data = await readFile(join(root, path));
    res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream' }).end(data);
  } catch { res.writeHead(404).end('Introuvable'); }
});

// Si le port est occupe, on essaie automatiquement le suivant.
function listen(port, tries = 0) {
  server.once('error', (e) => {
    if (e.code === 'EADDRINUSE' && tries < 20) { console.log(`Port ${port} occupe, essai du ${port + 1}...`); listen(port + 1, tries + 1); }
    else throw e;
  });
  server.listen(port, '0.0.0.0', () => {
    server.removeAllListeners('error');
    console.log(`Ordinateur : http://localhost:${port}`);
    for (const list of Object.values(networkInterfaces()))
      for (const i of list || []) if (i.family === 'IPv4' && !i.internal) console.log(`Telephone  : http://${i.address}:${port}`);
  });
}
listen(start);
