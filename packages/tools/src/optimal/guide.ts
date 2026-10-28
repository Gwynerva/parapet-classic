/**
 * A guide for ranking search states (not a bound): the time to go around the level's blocks to
 * each flag, from a Dijkstra over tile cells with rough speeds per direction, and the best
 * order through the flags that are left (Held–Karp over the same field distances). The body
 * centre's cell is looked up, since the feet sit on the boundary of a solid tile.
 */
import type { Level } from '@parapet/sim';
import type { ContestMode } from '../tas/model.ts';

/** Tiles that block a body: full blocks, walls, ledged blocks, posts. */
const SOLID = new Set([1, 5, 6, 13, 14, 17, 18, 19, 21, 25, 26]);

export interface GuideSpeeds {
  /** Units per step running, climbing and falling. */
  run: number;
  climb: number;
  fall: number;
}

export const DEFAULT_SPEEDS: GuideSpeeds = { run: 115, climb: 45, fall: 200 };

export class Guide {
  private readonly w: number;
  private readonly h: number;
  /** One field per target: steps to go from each cell. */
  private readonly fields: Float64Array[];
  private readonly n: number;
  private readonly mode: ContestMode;
  /** Flags: `tour[mask * n + j]` = steps from target j through all of `mask`. */
  private readonly tour: Float64Array;
  /** Sprint: steps from target k through the rest of the chain to the finish. */
  private readonly chain: Float64Array;

  constructor(level: Level, mode: ContestMode, speeds: GuideSpeeds = DEFAULT_SPEEDS) {
    this.w = level.width;
    this.h = level.height;
    this.mode = mode;
    const goals: number[][] = level.checkpoints.map((p) => [
      p.y * this.w + p.x,
      (p.y - 1) * this.w + p.x,
    ]);
    if (mode === 'sprint' && level.finish) {
      const f = level.finish;
      goals.push([f.y * this.w + f.x, (f.y - 1) * this.w + f.x]);
    }
    this.n = goals.length;
    this.fields = goals.map((g) => this.dijkstra(level, g, speeds));
    const at = (from: number, to: number): number =>
      Math.min(...goals[from]!.map((c) => this.fields[to]![c]!));
    const nf = level.checkpoints.length;
    this.tour = new Float64Array((1 << nf) * nf);
    for (let mask = 1; mask < 1 << nf; mask++) {
      for (let j = 0; j < nf; j++) {
        if ((mask & (1 << j)) === 0) continue;
        const rest = mask & ~(1 << j);
        let best = rest === 0 ? 0 : Infinity;
        for (let k = 0; k < nf; k++) {
          if (rest & (1 << k)) best = Math.min(best, at(j, k) + this.tour[rest * nf + k]!);
        }
        this.tour[mask * nf + j] = best;
      }
    }
    this.chain = new Float64Array(this.n + 1);
    for (let k = this.n - 2; k >= 0; k--) this.chain[k] = at(k, k + 1) + this.chain[k + 1]!;
  }

  private dijkstra(level: Level, goal: number[], s: GuideSpeeds): Float64Array {
    const { w, h } = this;
    const dist = new Float64Array(w * h).fill(Infinity);
    const free = (x: number, y: number): boolean => {
      const t = level.tileAt(x, y);
      return t >= 0 && !SOLID.has(t);
    };
    // A plain binary heap of [cost, cell].
    const heap: [number, number][] = [];
    const push = (c: number, i: number): void => {
      heap.push([c, i]);
      let k = heap.length - 1;
      while (k > 0) {
        const p = (k - 1) >> 1;
        if (heap[p]![0] <= heap[k]![0]) break;
        [heap[p], heap[k]] = [heap[k]!, heap[p]!];
        k = p;
      }
    };
    const pop = (): [number, number] => {
      const top = heap[0]!;
      const last = heap.pop()!;
      if (heap.length > 0) {
        heap[0] = last;
        let k = 0;
        for (;;) {
          const l = 2 * k + 1;
          const r = l + 1;
          let m = k;
          if (l < heap.length && heap[l]![0] < heap[m]![0]) m = l;
          if (r < heap.length && heap[r]![0] < heap[m]![0]) m = r;
          if (m === k) break;
          [heap[m], heap[k]] = [heap[k]!, heap[m]!];
          k = m;
        }
      }
      return top;
    };
    for (const g of goal) {
      dist[g] = 0;
      push(0, g);
    }
    // Edges run backwards (from a cell towards cells that can reach it): moving from (nx,ny)
    // to (x,y) costs by the direction of that move.
    const run = 1024 / s.run;
    const climb = 1024 / s.climb;
    const fall = 1024 / s.fall;
    while (heap.length > 0) {
      const [c, i] = pop();
      if (c > dist[i]!) continue;
      const x = i % w;
      const y = (i / w) | 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h || !free(nx, ny)) continue;
          // The mover goes from (nx,ny) to (x,y): up when dy < 0 from its point of view.
          const vert = dy > 0 ? climb : dy < 0 ? fall : 0;
          const cost = Math.max(dx !== 0 ? run : 0, vert);
          const nc = c + cost;
          const j = ny * w + nx;
          if (nc < dist[j]!) {
            dist[j] = nc;
            push(nc, j);
          }
        }
      }
    }
    return dist;
  }

  /** Steps the guide expects from a body centre at (cx, cy) in units with `mask` left. */
  steps(cx: number, cy: number, mask: number): number {
    const tx = Math.min(this.w - 1, Math.max(0, cx >> 10));
    const ty = Math.min(this.h - 1, Math.max(0, cy >> 10));
    let cell = ty * this.w + tx;
    // A centre inside a block (a snap, a ledge): use the cell above it.
    if (this.fields[0]![cell] === Infinity && ty > 0) cell -= this.w;
    if (this.mode === 'flags') {
      const nf = this.n;
      const m = mask & ((1 << nf) - 1);
      if (m === 0) return 0;
      let best = Infinity;
      for (let j = 0; j < nf; j++) {
        if (m & (1 << j)) best = Math.min(best, this.fields[j]![cell]! + this.tour[m * nf + j]!);
      }
      return best;
    }
    let next = 0;
    while (next < this.n - 1 && (mask & (1 << next)) === 0) next++;
    return this.fields[next]![cell]! + this.chain[next]!;
  }
}
