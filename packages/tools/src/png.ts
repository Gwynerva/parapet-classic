/**
 * Minimal PNG encoder: 8-bit RGBA, one zlib-compressed IDAT, filter type 0 on every row, and
 * a decoder for the PNGs this project writes (8-bit RGBA or RGB, not interlaced).
 * (A plain codec of its own; it has nothing to do with the runtime PNG builder of the game.)
 */
import { deflateSync, inflateSync } from 'node:zlib';
import { crc32 } from './crc32.ts';

const SIGNATURE = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);

export function encodePng(width: number, height: number, rgba: Uint8Array): Uint8Array {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new RangeError(`png: invalid size ${width}x${height}`);
  }
  if (rgba.length !== width * height * 4) {
    throw new RangeError(`png: expected ${width * height * 4} RGBA bytes, got ${rgba.length}`);
  }
  const stride = width * 4;
  const raw = new Uint8Array((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0;
    raw.set(rgba.subarray(y * stride, (y + 1) * stride), rowStart + 1);
  }
  const ihdr = new Uint8Array(13);
  const view = new DataView(ihdr.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0; // compression method
  ihdr[11] = 0; // filter method
  ihdr[12] = 0; // interlace
  const idat = new Uint8Array(deflateSync(raw, { level: 9 }));
  return concat([
    SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', new Uint8Array(0)),
  ]);
}

/** Reads the image size from the IHDR chunk of a PNG. */
export function readPngSize(png: Uint8Array): { width: number; height: number } {
  for (let i = 0; i < SIGNATURE.length; i++) {
    if (png[i] !== SIGNATURE[i]) throw new Error('png: bad signature');
  }
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  if (view.getUint32(8) !== 13 || String.fromCharCode(...png.subarray(12, 16)) !== 'IHDR') {
    throw new Error('png: IHDR not found');
  }
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

/** Decodes an 8-bit RGBA or RGB, non-interlaced PNG into RGBA bytes. */
export function decodePng(png: Uint8Array): { width: number; height: number; rgba: Uint8Array } {
  const { width, height } = readPngSize(png);
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const depth = png[24];
  const colourType = png[25];
  if (depth !== 8 || (colourType !== 6 && colourType !== 2) || png[28] !== 0) {
    throw new Error(
      `png: only 8-bit RGB(A) without interlace (depth ${depth}, type ${colourType})`,
    );
  }
  const channels = colourType === 6 ? 4 : 3;
  const idat: Uint8Array[] = [];
  for (let pos = 8; pos < png.length;) {
    const length = view.getUint32(pos);
    const type = String.fromCharCode(...png.subarray(pos + 4, pos + 8));
    if (type === 'IDAT') idat.push(png.subarray(pos + 8, pos + 8 + length));
    if (type === 'IEND') break;
    pos += 12 + length;
  }
  const raw = new Uint8Array(inflateSync(concat(idat)));
  const stride = width * channels;
  const pixels = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!;
    const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? pixels[y * stride + x - channels]! : 0;
      const b = y > 0 ? pixels[(y - 1) * stride + x]! : 0;
      const c = x >= channels && y > 0 ? pixels[(y - 1) * stride + x - channels]! : 0;
      let v = row[x]!;
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      pixels[y * stride + x] = v & 0xff;
    }
  }
  if (channels === 4) return { width, height, rgba: pixels };
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = pixels[i * 3]!;
    rgba[i * 4 + 1] = pixels[i * 3 + 1]!;
    rgba[i * 4 + 2] = pixels[i * 3 + 2]!;
    rgba[i * 4 + 3] = 255;
  }
  return { width, height, rgba };
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  let total = 0;
  for (const part of parts) total += part.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}
