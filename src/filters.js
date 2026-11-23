// Memes algorithmes que assembly/index.ts, en JavaScript pur (arithmetique entiere identique).
export function kernelQ16(radius) {
  const sigma = Math.max(radius / 2, 0.5), k = new Int32Array(2 * radius + 1);
  let sum = 0;
  const f = k.map((_, i) => Math.exp(-((i - radius) ** 2) / (2 * sigma * sigma)));
  f.forEach((v) => (sum += v));
  let acc = 0;
  for (let i = 0; i < k.length; i++) { k[i] = Math.round((f[i] / sum) * 65536); acc += k[i]; }
  k[radius] += 65536 - acc; // somme exacte = 65536
  return k;
}

export function grayscale(src, dst) {
  for (let i = 0; i < src.length; i += 4) {
    const g = (src[i] * 77 + src[i + 1] * 150 + src[i + 2] * 29) >> 8;
    dst[i] = dst[i + 1] = dst[i + 2] = g; dst[i + 3] = src[i + 3];
  }
}

export function sepia(src, dst) {
  for (let i = 0; i < src.length; i += 4) {
    const r = src[i], g = src[i + 1], b = src[i + 2];
    dst[i] = Math.min((r * 402 + g * 787 + b * 194) >> 10, 255);
    dst[i + 1] = Math.min((r * 357 + g * 702 + b * 172) >> 10, 255);
    dst[i + 2] = Math.min((r * 279 + g * 547 + b * 134) >> 10, 255);
    dst[i + 3] = src[i + 3];
  }
}

export function blurPass(src, dst, w, h, kernel, radius, vertical) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0;
      for (let k = -radius; k <= radius; k++) {
        let xx = x, yy = y;
        if (vertical) yy = Math.min(Math.max(y + k, 0), h - 1); else xx = Math.min(Math.max(x + k, 0), w - 1);
        const wt = kernel[k + radius], o = (yy * w + xx) << 2;
        r += src[o] * wt; g += src[o + 1] * wt; b += src[o + 2] * wt;
      }
      const d = (y * w + x) << 2;
      dst[d] = (r + 32768) >> 16; dst[d + 1] = (g + 32768) >> 16; dst[d + 2] = (b + 32768) >> 16; dst[d + 3] = src[d + 3];
    }
  }
}

export function blur(src, dst, w, h, radius) {
  const kernel = kernelQ16(radius), tmp = new Uint8ClampedArray(src.length);
  blurPass(src, tmp, w, h, kernel, radius, 0);
  blurPass(tmp, dst, w, h, kernel, radius, 1);
}

export function sobel(src, dst, w, h) {
  const gray = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) { const o = i << 2; gray[i] = (src[o] * 77 + src[o + 1] * 150 + src[o + 2] * 29) >> 8; }
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(y - 1, 0) * w, y1 = y * w, y2 = Math.min(y + 1, h - 1) * w;
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(x - 1, 0), x2 = Math.min(x + 1, w - 1);
      const a = gray[y0 + x0], b = gray[y0 + x], c = gray[y0 + x2], d = gray[y1 + x0];
      const f = gray[y1 + x2], g = gray[y2 + x0], hh = gray[y2 + x], j = gray[y2 + x2];
      const gx = c + 2 * f + j - (a + 2 * d + g), gy = g + 2 * hh + j - (a + 2 * b + c);
      const m = Math.min(Math.abs(gx) + Math.abs(gy), 255), o = (y1 + x) << 2;
      dst[o] = dst[o + 1] = dst[o + 2] = m; dst[o + 3] = 255;
    }
  }
}

// API commune : run(nom, pixels, w, h, options) -> Uint8ClampedArray
export function runJS(name, src, w, h, { radius = 8 } = {}) {
  const dst = new Uint8ClampedArray(src.length);
  if (name === 'grayscale') grayscale(src, dst);
  else if (name === 'sepia') sepia(src, dst);
  else if (name === 'blur') blur(src, dst, w, h, radius);
  else if (name === 'sobel') sobel(src, dst, w, h);
  return dst;
}
