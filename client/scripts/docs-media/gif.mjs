// A small animated GIF encoder for pixel art, so the docs media need no extra tools: one global palette (the most
// common 5-bit colours of all frames, nearest-colour mapping), integer upscaling without smoothing, LZW compression,
// and an endless loop. After the first frame, pixels that did not change are transparent, which keeps files small.
// encodeGif(frames, { width, height, scale, delayMs }); each frame is RGBA, width × height.

function buildPalette(frames) {
  const counts = new Map();
  for (const f of frames) {
    for (let i = 0; i < f.length; i += 4) {
      const key = ((f[i] >> 3) << 10) | ((f[i + 1] >> 3) << 5) | (f[i + 2] >> 3);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  // Index 255 is reserved for "unchanged" (transparent).
  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 255)
    .map(([k]) => k);
  const palette = top.map((k) => [
    ((k >> 10) & 31) * 8 + 4,
    ((k >> 5) & 31) * 8 + 4,
    (k & 31) * 8 + 4,
  ]);
  while (palette.length < 256) palette.push([0, 0, 0]);
  return palette;
}

function indexer(palette) {
  const cache = new Map();
  return (r, g, b) => {
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    let best = cache.get(key);
    if (best !== undefined) return best;
    let bestD = Infinity;
    for (let i = 0; i < 255; i++) {
      const [pr, pg, pb] = palette[i];
      const d = (pr - r) ** 2 + (pg - g) ** 2 + (pb - b) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    cache.set(key, best);
    return best;
  };
}

/** GIF LZW for 8-bit indices, emitted as data sub-blocks. */
function lzw(indices) {
  const minCode = 8;
  const clear = 1 << minCode;
  const eoi = clear + 1;
  const out = [];
  let bitBuf = 0,
    bitLen = 0,
    codeSize = minCode + 1;
  const emit = (code) => {
    bitBuf |= code << bitLen;
    bitLen += codeSize;
    while (bitLen >= 8) {
      out.push(bitBuf & 255);
      bitBuf >>>= 8;
      bitLen -= 8;
    }
  };
  let dict = new Map();
  let next = eoi + 1;
  emit(clear);
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const key = prefix * 256 + k;
    const found = dict.get(key);
    if (found !== undefined) {
      prefix = found;
      continue;
    }
    emit(prefix);
    if (next < 4096) {
      dict.set(key, next++);
      if (next > 1 << codeSize && codeSize < 12) codeSize++;
    } else {
      emit(clear);
      dict = new Map();
      next = eoi + 1;
      codeSize = minCode + 1;
    }
    prefix = k;
  }
  emit(prefix);
  emit(eoi);
  if (bitLen > 0) out.push(bitBuf & 255);
  const blocks = [minCode];
  for (let i = 0; i < out.length; i += 255) {
    const chunk = out.slice(i, i + 255);
    blocks.push(chunk.length, ...chunk);
  }
  blocks.push(0);
  return blocks;
}

export function encodeGif(frames, { width, height, scale = 1, delayMs = 100 }) {
  const W = width * scale,
    H = height * scale;
  const palette = buildPalette(frames);
  const toIndex = indexer(palette);
  const bytes = [];
  const u16 = (v) => bytes.push(v & 255, (v >> 8) & 255);
  bytes.push(...Buffer.from('GIF89a'));
  u16(W);
  u16(H);
  bytes.push(0xf7, 0, 0); // global colour table, 256 entries
  for (const [r, g, b] of palette) bytes.push(r, g, b);
  bytes.push(0x21, 0xff, 11, ...Buffer.from('NETSCAPE2.0'), 3, 1, 0, 0, 0); // loop forever
  const TRANSPARENT = 255;
  frames.forEach((f, n) => {
    const previous = n > 0 ? frames[n - 1] : undefined;
    const delay = Math.round(delayMs / 10);
    // Disposal 1 (keep the frame), with a transparent index from the second frame on.
    bytes.push(
      0x21,
      0xf9,
      4,
      previous ? 0x05 : 0x04,
      delay & 255,
      (delay >> 8) & 255,
      TRANSPARENT,
      0,
    );
    bytes.push(0x2c);
    u16(0);
    u16(0);
    u16(W);
    u16(H);
    bytes.push(0);
    const indices = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      const sy = Math.floor(y / scale);
      for (let x = 0; x < W; x++) {
        const i = (sy * width + Math.floor(x / scale)) * 4;
        const same =
          previous &&
          previous[i] === f[i] &&
          previous[i + 1] === f[i + 1] &&
          previous[i + 2] === f[i + 2];
        indices[y * W + x] = same ? TRANSPARENT : toIndex(f[i], f[i + 1], f[i + 2]);
      }
    }
    const data = lzw(indices);
    for (const b of data) bytes.push(b);
  });
  bytes.push(0x3b);
  return Buffer.from(bytes);
}
