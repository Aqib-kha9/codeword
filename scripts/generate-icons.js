// Generates the PWA PNG icons with zero external dependencies.
// Run with:  node scripts/generate-icons.js
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const OUT_DIR = path.join(__dirname, "..", "public", "icons");

// --- Minimal PNG encoder -----------------------------------------------------
const CRC_TABLE = (() => {
  const table = new Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter type: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- Drawing helpers ---------------------------------------------------------
function lerp(a, b, t) {
  return a + (b - a) * t;
}

function background(v) {
  const top = [64, 122, 106];
  const bottom = [38, 82, 71];
  return [
    lerp(top[0], bottom[0], v),
    lerp(top[1], bottom[1], v),
    lerp(top[2], bottom[2], v),
  ];
}

function insideRoundRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

function insideAnnulus(x, y, cx, cy, rOut, rIn) {
  const d = Math.hypot(x - cx, y - cy);
  return d <= rOut && d >= rIn;
}

// scale < 1 shrinks the artwork toward the centre (safe zone for maskable).
function sampleColor(u, v, scale) {
  const su = 0.5 + (u - 0.5) / scale;
  const sv = 0.5 + (v - 0.5) / scale;
  const bg = background(v);
  let col = bg;

  // Lock body
  if (insideRoundRect(su, sv, 0.29, 0.5, 0.71, 0.82, 0.055)) {
    col = [255, 255, 255];
  }
  // Shackle (upper half ring)
  if (sv <= 0.5 && insideAnnulus(su, sv, 0.5, 0.5, 0.17, 0.115)) {
    col = [255, 255, 255];
  }
  // Keyhole (cut-out)
  if (Math.hypot(su - 0.5, sv - 0.62) <= 0.048) {
    col = bg;
  }
  if (su >= 0.478 && su <= 0.522 && sv >= 0.62 && sv <= 0.71) {
    col = bg;
  }
  return col;
}

function renderIcon(size, scale) {
  const SS = 4; // supersampling for smooth edges
  const rgba = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const u = (x + (sx + 0.5) / SS) / size;
          const v = (y + (sy + 0.5) / SS) / size;
          const c = sampleColor(u, v, scale);
          r += c[0];
          g += c[1];
          b += c[2];
        }
      }
      const n = SS * SS;
      const idx = (y * size + x) * 4;
      rgba[idx] = Math.round(r / n);
      rgba[idx + 1] = Math.round(g / n);
      rgba[idx + 2] = Math.round(b / n);
      rgba[idx + 3] = 255;
    }
  }
  return encodePNG(size, size, rgba);
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const targets = [
    { file: "icon-192.png", size: 192, scale: 0.92 },
    { file: "icon-512.png", size: 512, scale: 0.92 },
    { file: "icon-maskable-512.png", size: 512, scale: 0.72 },
  ];
  for (const t of targets) {
    const buf = renderIcon(t.size, t.scale);
    fs.writeFileSync(path.join(OUT_DIR, t.file), buf);
    console.log(`Generated ${t.file} (${buf.length} bytes)`);
  }
}

main();
