/**
 * A search layer: the distinct states reached on one step, as rows in one growing buffer, with
 * an open-addressing table over full-row comparison (no state is ever merged on a hash alone).
 */
import { STATE_INTS } from './engine.ts';

function hashRow(a: Int32Array, o: number): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < STATE_INTS; i++) {
    h = Math.imul(h ^ a[o + i]!, 0x01000193);
    h ^= h >>> 15;
  }
  return h >>> 0;
}

export class Layer {
  rows: Int32Array;
  /** Per row: index of its parent in the previous layer and the press that led here. */
  parent: Int32Array;
  press: Uint8Array;
  count = 0;
  private table: Int32Array;
  private hashes: Uint32Array;

  constructor(wanted = 1024) {
    // The table's probing masks the slot, so the size must be a power of two.
    const capacity = 1 << Math.max(4, 32 - Math.clz32(wanted - 1));
    this.rows = new Int32Array(capacity * STATE_INTS);
    this.parent = new Int32Array(capacity);
    this.press = new Uint8Array(capacity);
    this.hashes = new Uint32Array(capacity);
    this.table = new Int32Array(capacity * 2).fill(-1);
  }

  get capacity(): number {
    return this.parent.length;
  }

  clear(): void {
    this.count = 0;
    this.table.fill(-1);
  }

  private grow(): void {
    const cap = this.capacity * 2;
    const rows = new Int32Array(cap * STATE_INTS);
    rows.set(this.rows);
    this.rows = rows;
    const parent = new Int32Array(cap);
    parent.set(this.parent);
    this.parent = parent;
    const press = new Uint8Array(cap);
    press.set(this.press);
    this.press = press;
    const hashes = new Uint32Array(cap);
    hashes.set(this.hashes);
    this.hashes = hashes;
    this.table = new Int32Array(cap * 2).fill(-1);
    const mask = this.table.length - 1;
    for (let i = 0; i < this.count; i++) {
      let s = this.hashes[i]! & mask;
      while (this.table[s] !== -1) s = (s + 1) & mask;
      this.table[s] = i;
    }
  }

  /** Adds the row at `a[o]` unless an equal row is there; returns its index and whether new. */
  add(a: Int32Array, o: number, parent: number, press: number): number {
    if (this.count >= this.capacity) this.grow();
    const h = hashRow(a, o);
    const mask = this.table.length - 1;
    let s = h & mask;
    for (;;) {
      const i = this.table[s]!;
      if (i === -1) break;
      if (this.hashes[i] === h && this.equal(i, a, o)) return i;
      s = (s + 1) & mask;
    }
    const i = this.count++;
    this.rows.set(a.subarray(o, o + STATE_INTS), i * STATE_INTS);
    this.parent[i] = parent;
    this.press[i] = press;
    this.hashes[i] = h;
    this.table[s] = i;
    return i;
  }

  private equal(i: number, a: Int32Array, o: number): boolean {
    const rows = this.rows;
    const b = i * STATE_INTS;
    for (let k = 0; k < STATE_INTS; k++) if (rows[b + k] !== a[o + k]) return false;
    return true;
  }
}
