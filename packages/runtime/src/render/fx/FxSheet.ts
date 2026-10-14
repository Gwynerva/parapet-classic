/**
 * An effects file made ready to draw for one accent colour: its sprites as RGBA pixels packed
 * in reading order, its colour tokens resolved, its emitters with their trigger bits. Pure; the
 * canvas is made by whoever draws.
 */
import { cssColor, DEFAULT_ACCENT, mixRgb, parseColor, type Rgb, type Rgba } from '../color.ts';
import { packRows } from '../pack.ts';
import type { FxEmitter, FxFile, FxTrigger, Range } from './FxData.ts';
import { triggerBit } from './Motion.ts';
import { paintRows } from '../Raster.ts';

export interface FxFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CompiledEmitter {
  name: string;
  spec: FxEmitter;
  whileBits: number;
  enterBits: number;
  moves: ReadonlySet<number>;
  /** Sprite ids in the sheet (`frames` of the compiled effects). */
  frames: number[];
  /** The `sets` of the sprite, as sprite ids: each particle plays one of them. */
  sets: number[][];
  /** Resolved CSS colours of rect particles. */
  colors: string[];
}

export interface CompiledFx {
  file: FxFile;
  accent: string;
  width: number;
  height: number;
  data: Uint8ClampedArray;
  /** Sprite id → its rectangle in `data`. */
  frames: FxFrame[];
  spriteIds: ReadonlyMap<string, number>;
  emitters: ReadonlyMap<string, CompiledEmitter>;
  /** Resolves a colour token (`accent`, a palette character or `#rrggbb`) to CSS. */
  color(token: string): string;
  /** Lazily made by the drawing side (a canvas holding `data`). */
  image?: unknown;
}

const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];

/** `c` moved towards `to` by `t`, keeping its alpha. */
function mix(c: Rgba, to: Rgb, t: number): Rgba {
  return [...mixRgb(c, to, t), c[3]];
}

function css(c: Rgba): string {
  return c[3] === 255 ? cssColor(c) : cssColor(c, Number((c[3] / 255).toFixed(3)));
}

/** The colour of a token for an accent. */
export function resolveToken(token: string, palette: Record<string, string>, accent: string): Rgba {
  const a = parseColor(accent) ?? parseColor(DEFAULT_ACCENT)!;
  const value = palette[token] ?? token;
  if (value === 'accent') return a;
  if (value === 'accent.light') return mix(a, WHITE, 0.8);
  if (value === 'accent.dark') return mix(a, BLACK, 0.45);
  return parseColor(value) ?? [255, 255, 255, 255];
}

function bits(list: readonly FxTrigger[] | undefined): number {
  let b = 0;
  for (const t of list ?? []) b |= triggerBit(t);
  return b;
}

const cache = new WeakMap<FxFile, Map<string, CompiledFx>>();

/** `fx` ready to draw in `accent` (cached per file and accent). */
export function compileFx(fx: FxFile, accent: string): CompiledFx {
  let byAccent = cache.get(fx);
  if (!byAccent) {
    byAccent = new Map();
    cache.set(fx, byAccent);
  }
  const hit = byAccent.get(accent);
  if (hit) return hit;
  const palette = fx.palette ?? {};
  const names = Object.keys(fx.sprites ?? {});
  const grids = names.map((n) => (fx.sprites![n] ?? []).map((r) => Array.from(r)));
  const packing = packRows(
    names.map((n, i) => ({ key: n, w: grids[i]![0]?.length ?? 0, h: grids[i]!.length })),
    128,
    1,
  );
  const width = packing.width;
  const height = packing.height;
  const data = new Uint8ClampedArray(width * height * 4);
  const atlas = { width, height, data };
  const frames: FxFrame[] = [];
  const spriteIds = new Map<string, number>();
  const colours = new Map<string, Rgba>();
  const colourOf = (ch: string): Rgba => {
    let c = colours.get(ch);
    if (!c) {
      c = resolveToken(ch, palette, accent);
      colours.set(ch, c);
    }
    return c;
  };
  names.forEach((name, id) => {
    const cell = packing.cells.get(name)!;
    const grid = grids[id]!;
    frames[id] = { x: cell.x, y: cell.y, w: cell.w, h: cell.h };
    spriteIds.set(name, id);
    paintRows(atlas, grid, (ch) => (ch === '.' ? null : colourOf(ch)), cell.x, cell.y);
  });
  const ids = (names: string[]): number[] =>
    names.map((f) => spriteIds.get(f) ?? -1).filter((i) => i >= 0);
  const emitters = new Map<string, CompiledEmitter>();
  for (const [name, spec] of Object.entries(fx.emitters ?? {})) {
    emitters.set(name, {
      name,
      spec,
      whileBits: bits(spec.while),
      enterBits: bits(spec.enter),
      moves: new Set(spec.moves ?? []),
      frames: ids(spec.sprite?.frames ?? []),
      sets: (spec.sprite?.sets ?? []).map(ids).filter((set) => set.length > 0),
      colors: (spec.rect?.colors ?? []).map((c) => css(colourOf(c))),
    });
  }
  const compiled: CompiledFx = {
    file: fx,
    accent,
    width,
    height,
    data,
    frames,
    spriteIds,
    emitters,
    color: (token) => css(colourOf(token)),
  };
  byAccent.set(accent, compiled);
  return compiled;
}

/** A value of a range (`rand` gives 0..1). */
export function pick(r: Range | undefined, rand: () => number, fallback = 0): number {
  if (r === undefined) return fallback;
  if (typeof r === 'number') return r;
  return r[0] + (r[1] - r[0]) * rand();
}
