// Filtres image en AssemblyScript -> WebAssembly.
// Les pixels sont en RGBA (4 octets/pixel). Toutes les fonctions travaillent sur des pointeurs
// dans la memoire lineaire ; le JS reserve les tampons a partir de l'octet 65536.

@inline function px(p: usize, i: i32): i32 { return <i32>load<u8>(p + <usize>i); }

export function grayscale(src: usize, dst: usize, len: i32): void {
  for (let i = 0; i < len; i += 4) {
    const g = (px(src, i) * 77 + px(src, i + 1) * 150 + px(src, i + 2) * 29) >> 8;
    store<u8>(dst + <usize>i, <u8>g);
    store<u8>(dst + <usize>i + 1, <u8>g);
    store<u8>(dst + <usize>i + 2, <u8>g);
    store<u8>(dst + <usize>i + 3, <u8>px(src, i + 3));
  }
}

export function sepia(src: usize, dst: usize, len: i32): void {
  for (let i = 0; i < len; i += 4) {
    const r = px(src, i), g = px(src, i + 1), b = px(src, i + 2);
    store<u8>(dst + <usize>i, <u8>min((r * 402 + g * 787 + b * 194) >> 10, 255));
    store<u8>(dst + <usize>i + 1, <u8>min((r * 357 + g * 702 + b * 172) >> 10, 255));
    store<u8>(dst + <usize>i + 2, <u8>min((r * 279 + g * 547 + b * 134) >> 10, 255));
    store<u8>(dst + <usize>i + 3, <u8>px(src, i + 3));
  }
}

// Flou gaussien separable : passe horizontale (vertical = 0) ou verticale (vertical = 1).
// Noyau en virgule fixe Q16 (somme = 65536) : 2 * radius + 1 entiers i32 a l'adresse `kernel`.
export function blurPass(src: usize, dst: usize, w: i32, h: i32, kernel: usize, radius: i32, vertical: i32): void {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0;
      for (let k = -radius; k <= radius; k++) {
        let xx = x, yy = y;
        if (vertical) { yy = min(max(y + k, 0), h - 1); } else { xx = min(max(x + k, 0), w - 1); }
        const wt = load<i32>(kernel + (<usize>(k + radius) << 2));
        const o = (yy * w + xx) << 2;
        r += px(src, o) * wt; g += px(src, o + 1) * wt; b += px(src, o + 2) * wt;
      }
      const d = (y * w + x) << 2;
      store<u8>(dst + <usize>d, <u8>((r + 32768) >> 16));
      store<u8>(dst + <usize>d + 1, <u8>((g + 32768) >> 16));
      store<u8>(dst + <usize>d + 2, <u8>((b + 32768) >> 16));
      store<u8>(dst + <usize>d + 3, <u8>px(src, d + 3));
    }
  }
}

// Detection de contours (Sobel). `gray` = tampon de travail de w*h octets.
export function sobel(src: usize, dst: usize, gray: usize, w: i32, h: i32): void {
  for (let i = 0, n = w * h; i < n; i++) {
    const o = i << 2;
    store<u8>(gray + <usize>i, <u8>((px(src, o) * 77 + px(src, o + 1) * 150 + px(src, o + 2) * 29) >> 8));
  }
  for (let y = 0; y < h; y++) {
    const y0 = max(y - 1, 0) * w, y1 = y * w, y2 = min(y + 1, h - 1) * w;
    for (let x = 0; x < w; x++) {
      const x0 = max(x - 1, 0), x2 = min(x + 1, w - 1);
      const a = <i32>load<u8>(gray + <usize>(y0 + x0)), b = <i32>load<u8>(gray + <usize>(y0 + x));
      const c = <i32>load<u8>(gray + <usize>(y0 + x2)), d = <i32>load<u8>(gray + <usize>(y1 + x0));
      const f = <i32>load<u8>(gray + <usize>(y1 + x2)), g = <i32>load<u8>(gray + <usize>(y2 + x0));
      const hh = <i32>load<u8>(gray + <usize>(y2 + x)), j = <i32>load<u8>(gray + <usize>(y2 + x2));
      const gx = (c + 2 * f + j) - (a + 2 * d + g);
      const gy = (g + 2 * hh + j) - (a + 2 * b + c);
      const m = <u8>min(abs(gx) + abs(gy), 255);
      const o = (y1 + x) << 2;
      store<u8>(dst + <usize>o, m); store<u8>(dst + <usize>o + 1, m); store<u8>(dst + <usize>o + 2, m);
      store<u8>(dst + <usize>o + 3, 255);
    }
  }
}
