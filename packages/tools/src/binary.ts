/**
 * Big-endian binary reader.
 *
 * Every multi-byte value inside the jar (index, palettes, sprite packs, data blobs, scenes,
 * strings) is big-endian, as written by a Java DataOutputStream.
 */
export class BinaryReader {
  readonly bytes: Uint8Array;
  readonly label: string;
  pos: number;
  private readonly view: DataView;

  constructor(bytes: Uint8Array, label = 'data') {
    this.bytes = bytes;
    this.label = label;
    this.pos = 0;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  get length(): number {
    return this.bytes.length;
  }

  get remaining(): number {
    return this.bytes.length - this.pos;
  }

  get atEnd(): boolean {
    return this.pos >= this.bytes.length;
  }

  u8(): number {
    this.need(1);
    const v = this.view.getUint8(this.pos);
    this.pos += 1;
    return v;
  }

  i8(): number {
    this.need(1);
    const v = this.view.getInt8(this.pos);
    this.pos += 1;
    return v;
  }

  u16(): number {
    this.need(2);
    const v = this.view.getUint16(this.pos);
    this.pos += 2;
    return v;
  }

  i16(): number {
    this.need(2);
    const v = this.view.getInt16(this.pos);
    this.pos += 2;
    return v;
  }

  i32(): number {
    this.need(4);
    const v = this.view.getInt32(this.pos);
    this.pos += 4;
    return v;
  }

  u32(): number {
    this.need(4);
    const v = this.view.getUint32(this.pos);
    this.pos += 4;
    return v;
  }

  /** Returns a view (not a copy) of the next `count` bytes. */
  take(count: number): Uint8Array {
    this.need(count);
    const v = this.bytes.subarray(this.pos, this.pos + count);
    this.pos += count;
    return v;
  }

  skip(count: number): void {
    this.need(count);
    this.pos += count;
  }

  peekI16(): number {
    this.need(2);
    return this.view.getInt16(this.pos);
  }

  /** Throws unless every byte of the buffer has been consumed. */
  assertAtEnd(): void {
    if (this.pos !== this.bytes.length) {
      throw new Error(`${this.label}: ${this.remaining} unread byte(s) after offset ${this.pos}`);
    }
  }

  private need(count: number): void {
    if (count < 0 || this.pos + count > this.bytes.length) {
      throw new RangeError(
        `${this.label}: reading ${count} byte(s) at offset ${this.pos} overruns the ${this.bytes.length}-byte buffer`,
      );
    }
  }
}

/** Interprets a whole buffer as big-endian signed 16-bit values (the length must be even). */
export function readI16Array(bytes: Uint8Array, label = 'data'): number[] {
  const r = new BinaryReader(bytes, label);
  const out: number[] = [];
  while (!r.atEnd) out.push(r.i16());
  return out;
}

/** Interprets a whole buffer as big-endian signed 32-bit values (the length must be a multiple of 4). */
export function readI32Array(bytes: Uint8Array, label = 'data'): number[] {
  const r = new BinaryReader(bytes, label);
  const out: number[] = [];
  while (!r.atEnd) out.push(r.i32());
  return out;
}
