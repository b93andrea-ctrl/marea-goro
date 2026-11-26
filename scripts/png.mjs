// Lettore PNG minimo, senza dipendenze, per leggere i colori delle mappe Shyfer sui server di GitHub.
// Supporta immagini non interlacciate: RGB / RGBA a 8 bit e a palette (1, 2, 4, 8 bit, con trasparenza tRNS).
// `inflate` è una funzione (anche asincrona) che decomprime dati zlib: in Node zlib.inflateSync.
export async function decodePNG(bytes, inflate) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const u32 = i => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
  let p = 8, W = 0, H = 0, depth = 0, ctype = 0, interlace = 0, palette = null, trns = null;
  const idat = [];
  while (p < b.length) {
    const len = u32(p), type = String.fromCharCode(b[p + 4], b[p + 5], b[p + 6], b[p + 7]), d = b.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { W = u32(p + 8); H = u32(p + 12); depth = d[8]; ctype = d[9]; interlace = d[12]; }
    else if (type === 'PLTE') palette = d.slice();
    else if (type === 'tRNS') trns = d.slice();
    else if (type === 'IDAT') idat.push(d);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (interlace) throw new Error('PNG interlacciato non supportato');
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ctype];
  const bpp = Math.max(1, (ch * depth) >> 3), stride = (W * ch * depth + 7) >> 3;
  let n = 0; for (const c of idat) n += c.length;
  const z = new Uint8Array(n); { let o = 0; for (const c of idat) { z.set(c, o); o += c.length; } }
  const raw = new Uint8Array(await inflate(z));
  const img = new Uint8Array(H * stride);
  for (let y = 0; y < H; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride, up = dst - stride;
    for (let x = 0; x < stride; x++) {
      const r = raw[src + x], a = x >= bpp ? img[dst + x - bpp] : 0, c = y ? img[up + x] : 0, ul = (y && x >= bpp) ? img[up + x - bpp] : 0;
      let v;
      if (f === 0) v = r;
      else if (f === 1) v = r + a;
      else if (f === 2) v = r + c;
      else if (f === 3) v = r + ((a + c) >> 1);
      else { const pp = a + c - ul, pa = Math.abs(pp - a), pb = Math.abs(pp - c), pc = Math.abs(pp - ul); v = r + (pa <= pb && pa <= pc ? a : pb <= pc ? c : ul); }
      img[dst + x] = v & 255;
    }
  }
  // pixel RGBA
  const rgba = (x, y) => {
    const row = y * stride;
    if (ctype === 6) { const i = row + x * 4; return [img[i], img[i + 1], img[i + 2], img[i + 3]]; }
    if (ctype === 2) { const i = row + x * 3; return [img[i], img[i + 1], img[i + 2], 255]; }
    if (ctype === 3) {
      const bit = x * depth, byte = img[row + (bit >> 3)], k = (byte >> (8 - depth - (bit & 7))) & ((1 << depth) - 1);
      return [palette[k * 3], palette[k * 3 + 1], palette[k * 3 + 2], trns && k < trns.length ? trns[k] : 255];
    }
    if (ctype === 0) { const v = img[row + x]; return [v, v, v, 255]; }
    const i = row + x * 2; return [img[i], img[i], img[i], img[i + 1]];
  };
  return { width: W, height: H, rgba };
}
