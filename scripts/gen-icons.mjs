// Generates the extension's PNG icons (16/48/128) from code — no image editor,
// no dependencies. Draws a white magnifying glass on the popup's brand-blue
// (#0a66c2) rounded square. Re-run with `npm run icons` if the design changes.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'icons');
const SIZES = [16, 48, 128];
const BRAND = [10, 102, 194]; // #0a66c2
const WHITE = [255, 255, 255];

/** CRC32 (per PNG spec). */
function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let k = 0; k < 8; k++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

/** Encode an RGBA pixel buffer (size*size*4) as a PNG buffer. */
function encodePng(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  // 10,11,12 = compression/filter/interlace = 0

  // Raw scanlines, each prefixed with filter byte 0.
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * size * 4, (y + 1) * size * 4);
  }

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Shortest distance from point p to segment a-b, all in normalized coords. */
function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function drawIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const corner = 0.22; // rounded-corner radius (normalized)
  const lensX = 0.42;
  const lensY = 0.42;
  const lensOuter = 0.26;
  const lensInner = 0.155;
  const handleHalf = 0.055;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Sample at pixel center, normalized to 0..1.
      const nx = (x + 0.5) / size;
      const ny = (y + 0.5) / size;

      // Rounded-square mask: transparent outside the rounded rect.
      const rx = Math.max(corner - nx, nx - (1 - corner), 0);
      const ry = Math.max(corner - ny, ny - (1 - corner), 0);
      const inRounded = Math.hypot(rx, ry) <= corner;

      let color = null;
      let alpha = 0;
      if (inRounded) {
        color = BRAND;
        alpha = 255;
        const d = Math.hypot(nx - lensX, ny - lensY);
        const onRing = d <= lensOuter && d >= lensInner;
        const onHandle = distToSegment(nx, ny, 0.6, 0.6, 0.82, 0.82) <= handleHalf && d > lensInner;
        if (onRing || onHandle) color = WHITE;
      }

      const i = (y * size + x) * 4;
      rgba[i] = color ? color[0] : 0;
      rgba[i + 1] = color ? color[1] : 0;
      rgba[i + 2] = color ? color[2] : 0;
      rgba[i + 3] = alpha;
    }
  }
  return encodePng(size, rgba);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of SIZES) {
  const png = drawIcon(size);
  writeFileSync(resolve(OUT_DIR, `icon${size}.png`), png);
  console.log(`icon${size}.png (${png.length} bytes)`);
}
console.log('Icons written to src/icons/');
