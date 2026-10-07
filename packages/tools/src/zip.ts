/**
 * Minimal zip reader: parses the central directory and extracts stored (method 0) and
 * deflated (method 8) entries. Enough for a J2ME jar; no zip64, no encryption.
 */
import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { crc32 } from './crc32.ts';

const SIG_LOCAL_HEADER = 0x04034b50;
const SIG_CENTRAL_HEADER = 0x02014b50;
const SIG_END_OF_CENTRAL_DIR = 0x06054b50;
const END_RECORD_SIZE = 22;
const MAX_COMMENT_SIZE = 0xffff;

export interface ZipEntry {
  name: string;
  /** 0 = stored, 8 = deflated. */
  method: number;
  compressedSize: number;
  size: number;
  crc32: number;
  /** Offset of the local file header inside the archive. */
  headerOffset: number;
}

export class ZipArchive {
  readonly entries: Map<string, ZipEntry>;
  private readonly data: Uint8Array;
  private readonly view: DataView;

  constructor(data: Uint8Array) {
    this.data = data;
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    this.entries = this.readCentralDirectory();
  }

  static fromFile(path: string): ZipArchive {
    return new ZipArchive(new Uint8Array(readFileSync(path)));
  }

  names(): string[] {
    return [...this.entries.keys()];
  }

  has(name: string): boolean {
    return this.entries.has(name);
  }

  entry(name: string): ZipEntry {
    const entry = this.entries.get(name);
    if (!entry) throw new Error(`zip: no entry named "${name}"`);
    return entry;
  }

  /** Returns the decompressed content of an entry, verified against its CRC-32. */
  read(name: string): Uint8Array {
    const entry = this.entry(name);
    const h = entry.headerOffset;
    if (h + 30 > this.data.length || this.view.getUint32(h, true) !== SIG_LOCAL_HEADER) {
      throw new Error(`zip: bad local header for "${name}" at ${h}`);
    }
    const nameLength = this.view.getUint16(h + 26, true);
    const extraLength = this.view.getUint16(h + 28, true);
    const start = h + 30 + nameLength + extraLength;
    const end = start + entry.compressedSize;
    if (end > this.data.length) throw new Error(`zip: entry "${name}" overruns the archive`);
    const compressed = this.data.subarray(start, end);
    let out: Uint8Array;
    if (entry.method === 0) {
      out = compressed.slice();
    } else if (entry.method === 8) {
      out = new Uint8Array(inflateRawSync(compressed));
    } else {
      throw new Error(`zip: unsupported compression method ${entry.method} for "${name}"`);
    }
    if (out.length !== entry.size) {
      throw new Error(`zip: "${name}" inflated to ${out.length} bytes, expected ${entry.size}`);
    }
    if (crc32(out) !== entry.crc32) throw new Error(`zip: CRC mismatch for "${name}"`);
    return out;
  }

  private readCentralDirectory(): Map<string, ZipEntry> {
    const eocd = this.findEndRecord();
    const count = this.view.getUint16(eocd + 10, true);
    const directoryOffset = this.view.getUint32(eocd + 16, true);
    const entries = new Map<string, ZipEntry>();
    const decoder = new TextDecoder();
    let p = directoryOffset;
    for (let i = 0; i < count; i++) {
      if (p + 46 > this.data.length || this.view.getUint32(p, true) !== SIG_CENTRAL_HEADER) {
        throw new Error(`zip: bad central directory header #${i} at ${p}`);
      }
      const method = this.view.getUint16(p + 10, true);
      const crc = this.view.getUint32(p + 16, true);
      const compressedSize = this.view.getUint32(p + 20, true);
      const size = this.view.getUint32(p + 24, true);
      const nameLength = this.view.getUint16(p + 28, true);
      const extraLength = this.view.getUint16(p + 30, true);
      const commentLength = this.view.getUint16(p + 32, true);
      const headerOffset = this.view.getUint32(p + 42, true);
      const name = decoder.decode(this.data.subarray(p + 46, p + 46 + nameLength));
      entries.set(name, { name, method, compressedSize, size, crc32: crc, headerOffset });
      p += 46 + nameLength + extraLength + commentLength;
    }
    return entries;
  }

  private findEndRecord(): number {
    const lowest = Math.max(0, this.data.length - END_RECORD_SIZE - MAX_COMMENT_SIZE);
    for (let p = this.data.length - END_RECORD_SIZE; p >= lowest; p--) {
      if (this.view.getUint32(p, true) === SIG_END_OF_CENTRAL_DIR) return p;
    }
    throw new Error('zip: end of central directory record not found');
  }
}
