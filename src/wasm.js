// Chargement du module .wasm et gestion de la memoire (utilisable dans le navigateur et dans Node).
import { kernelQ16 } from './filters.js';

const BASE = 65536; // la 1re page de memoire est reservee

export async function loadWasm(source) {
  let instance;
  if (source instanceof ArrayBuffer || ArrayBuffer.isView(source)) {
    ({ instance } = await WebAssembly.instantiate(source, {}));
  } else {
    const res = await fetch(source);
    try { ({ instance } = await WebAssembly.instantiateStreaming(res.clone(), {})); }
    catch { ({ instance } = await WebAssembly.instantiate(await res.arrayBuffer(), {})); }
  }
  const ex = instance.exports;

  return function runWasm(name, src, w, h, { radius = 8 } = {}) {
    const n = src.length, kBytes = (2 * radius + 1) * 4;
    const need = BASE + 3 * n + kBytes + 64;
    const have = ex.memory.buffer.byteLength;
    if (need > have) ex.memory.grow(Math.ceil((need - have) / 65536));
    const mem = new Uint8Array(ex.memory.buffer);
    const pIn = BASE, pOut = pIn + n, pTmp = pOut + n, pK = pTmp + n;
    mem.set(src, pIn);
    if (name === 'grayscale') ex.grayscale(pIn, pOut, n);
    else if (name === 'sepia') ex.sepia(pIn, pOut, n);
    else if (name === 'blur') {
      new Int32Array(ex.memory.buffer, pK, 2 * radius + 1).set(kernelQ16(radius));
      ex.blurPass(pIn, pTmp, w, h, pK, radius, 0);
      ex.blurPass(pTmp, pOut, w, h, pK, radius, 1);
    } else if (name === 'sobel') ex.sobel(pIn, pOut, pTmp, w, h);
    return new Uint8ClampedArray(ex.memory.buffer.slice(pOut, pOut + n));
  };
}
