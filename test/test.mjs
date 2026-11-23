// Verifie que JS et Wasm donnent exactement les memes pixels, et affiche un chronometrage indicatif.
import { readFileSync } from 'node:fs';
import { runJS } from '../src/filters.js';
import { loadWasm } from '../src/wasm.js';

const W = 1200, H = 800;
const img = new Uint8ClampedArray(W * H * 4);
let s = 12345;
for (let i = 0; i < img.length; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; img[i] = i % 4 === 3 ? 255 : (s >> 16) & 255; }

const runWasm = await loadWasm(readFileSync(new URL('../build/filtre.wasm', import.meta.url)));
let ok = true;
for (const name of ['grayscale', 'sepia', 'blur', 'sobel']) {
  const opts = { radius: 6 };
  let t = performance.now(); const a = runJS(name, img, W, H, opts); const tj = performance.now() - t;
  t = performance.now(); const b = runWasm(name, img, W, H, opts); const tw = performance.now() - t;
  const same = a.length === b.length && a.every((v, i) => v === b[i]);
  ok &&= same;
  console.log(`${same ? 'OK ' : 'ECHEC'} ${name.padEnd(10)} JS ${tj.toFixed(0)} ms | Wasm ${tw.toFixed(0)} ms`);
}
process.exit(ok ? 0 : 1);
