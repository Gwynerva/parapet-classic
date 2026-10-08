/**
 * A look as a small sprite layer over the base atlas: only the pictures the look changes
 * (recoloured, painted over, redrawn, per side, attached) are packed into it, everything else
 * is still drawn from the base atlas (`SpriteSheet` fallback). `lookSwap` picks, for every part
 * of every frame, the most specific picture for its side and mirroring.
 *
 * Pure: works on RGBA bytes, so the tools build exactly what the game draws.
 */
import { skinSwap } from './CharacterRenderer.ts';
import {
  expandPartKey,
  keyChain,
  keyId,
  LOOK_SPRITES,
  parseColor,
  partKeyText,
  pivotOf,
  type LookAttachment,
  type LookRecolor,
  type ResolvedLook,
  type Rgba,
} from './Look.ts';
import { packRows } from './pack.ts';
import type { AttachLookup, PartContext, SpriteSwap } from './Pose.ts';
import { sheetFrame, type RgbaSheet } from './Raster.ts';
import { familyOf, isLimb, partSide, rotationIndex, Side } from './Rig.ts';
import { rotsprite } from './rotsprite.ts';

/** Sprite ids of a layer start here (the atlas uses 0..313). */
export const LAYER_ID_BASE = 1024;
/** Lookup result: the look has no picture, the base character's rule applies. */
export const FALLTHROUGH = -2;
/** Highest sprite id a look key may use, plus one. */
const ID_LIMIT = 140;

const ATTACH_LAYERS = { back: 0, under: 1, over: 2, front: 3, hips: 4 } as const;

export interface LayerFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LookLayer {
  look: ResolvedLook;
  width: number;
  height: number;
  data: Uint8ClampedArray;
  /** Indexed by layer sprite id (from `LAYER_ID_BASE`). */
  frames: (LayerFrame | undefined)[];
  /** `slotIndex(id, side, flip)` → layer id, or `FALLTHROUGH`. */
  parts: Int32Array;
  /** `slotIndex(id, side, flip)` → pairs (layer, layer id) of the attachments, or null. */
  attachments: (Int32Array | null)[];
  /** Ids the look has a picture for (any side). */
  ids: ReadonlySet<number>;
  /** Pictures that could not be built as written (overlays of the wrong size). */
  problems: string[];
  /** Canonical key → layer id of its picture (attachments as `name@key`). */
  keys: ReadonlyMap<string, number>;
}

export function slotIndex(id: number, side: number, flip: boolean): number {
  return (id * 3 + side) * 2 + (flip ? 1 : 0);
}

interface Picture {
  w: number;
  h: number;
  px: Uint8ClampedArray;
}

function blank(w: number, h: number): Picture {
  return { w, h, px: new Uint8ClampedArray(w * h * 4) };
}

function copyPicture(p: Picture): Picture {
  return { w: p.w, h: p.h, px: p.px.slice() };
}

function paletteOf(look: ResolvedLook): Map<string, Rgba> {
  const out = new Map<string, Rgba>();
  for (const [ch, colour] of Object.entries(look.palette)) {
    const c = parseColor(colour);
    if (c) out.set(ch, c);
  }
  return out;
}

function gridPicture(rows: readonly string[], palette: ReadonlyMap<string, Rgba>): Picture {
  const grid = rows.map((r) => Array.from(r));
  const w = grid[0]?.length ?? 0;
  const p = blank(w, grid.length);
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < w; x++) {
      const c = palette.get(grid[y]![x] ?? '.');
      if (!c) continue;
      const o = (y * w + x) * 4;
      p.px[o] = c[0];
      p.px[o + 1] = c[1];
      p.px[o + 2] = c[2];
      p.px[o + 3] = c[3];
    }
  }
  return p;
}

/** The base character's picture for a keyframe sprite: its skin rule over the atlas. */
function basePicture(base: RgbaSheet, character: number, id: number): Picture | null {
  const rule = skinSwap(character);
  const drawn = rule(id, 0, 0);
  if (drawn < 0) return null;
  const found = sheetFrame(base, drawn);
  if (!found) return null;
  const f = found.frame;
  const src = found.sheet.image;
  const p = blank(f.w, f.h);
  for (let y = 0; y < f.h; y++) {
    const o = ((f.y + y) * src.width + f.x) * 4;
    p.px.set(src.data.subarray(o, o + f.w * 4), y * f.w * 4);
  }
  return p;
}

function recolor(p: Picture, look: ResolvedLook, id: number): boolean {
  let changed = false;
  for (const r of look.recolor) {
    if (r.on !== undefined || !r.sprites.includes(id)) continue;
    if (applyRecolor(p, r)) changed = true;
  }
  return changed;
}

/** One recolour rule over a picture; whether a pixel changed. */
function applyRecolor(p: Picture, r: LookRecolor): boolean {
  let changed = false;
  const map = new Map<number, Rgba>();
  for (const [from, to] of Object.entries(r.map)) {
    const a = parseColor(from);
    const b = parseColor(to);
    if (a && b) map.set((a[0] << 16) | (a[1] << 8) | a[2], b);
  }
  for (let o = 0; o < p.px.length; o += 4) {
    if (p.px[o + 3]! < 128) continue;
    const to = map.get((p.px[o]! << 16) | (p.px[o + 1]! << 8) | p.px[o + 2]!);
    if (!to) continue;
    p.px[o] = to[0];
    p.px[o + 1] = to[1];
    p.px[o + 2] = to[2];
    p.px[o + 3] = to[3];
    changed = true;
  }
  return changed;
}

function overlay(p: Picture, rows: readonly string[], palette: ReadonlyMap<string, Rgba>): boolean {
  const grid = rows.map((r) => Array.from(r));
  if (grid.length !== p.h || (grid[0]?.length ?? 0) !== p.w) return false;
  for (let y = 0; y < p.h; y++) {
    for (let x = 0; x < p.w; x++) {
      const ch = grid[y]![x] ?? '.';
      if (ch === '.') continue;
      const o = (y * p.w + x) * 4;
      const c = ch === ' ' ? null : palette.get(ch);
      p.px[o] = c?.[0] ?? 0;
      p.px[o + 1] = c?.[1] ?? 0;
      p.px[o + 2] = c?.[2] ?? 0;
      p.px[o + 3] = c?.[3] ?? 0;
    }
  }
  return true;
}

function sideName(side: number): 'near' | 'far' | undefined {
  return side === Side.NEAR ? 'near' : side === Side.FAR ? 'far' : undefined;
}

/**
 * A part's or an attachment's picture: with a pivot `+`, padded so the pivot is its centre pixel
 * (the part's point) and its size has the parity of the part's (so both mirror around the same
 * point); else as drawn, centred there.
 */
function pivotedPicture(
  rows: readonly string[],
  palette: ReadonlyMap<string, Rgba>,
  part: Picture | null,
): Picture {
  const pivot = pivotOf(rows);
  if (!pivot) return gridPicture(rows, palette);
  const p = gridPicture(pivot.rows, palette);
  const pw = (part?.w ?? 1) & 1;
  const ph = (part?.h ?? 1) & 1;
  const cx = Math.max(pivot.x, p.w - pivot.x - pw);
  const cy = Math.max(pivot.y, p.h - pivot.y - ph);
  const w = 2 * cx + pw;
  const h = 2 * cy + ph;
  const out: Picture = { w, h, px: new Uint8ClampedArray(w * h * 4) };
  const left = cx - pivot.x;
  const top = cy - pivot.y;
  for (let y = 0; y < p.h; y++) {
    out.px.set(p.px.subarray(y * p.w * 4, (y + 1) * p.w * 4), ((top + y) * w + left) * 4);
  }
  return out;
}

/** Builds the layer of `look` over the base atlas `base`. */
export function buildLookLayer(base: RgbaSheet, look: ResolvedLook): LookLayer {
  const palette = paletteOf(look);
  const problems: string[] = [];
  const pictures = new Map<string, Picture | null>();
  const defined = new Set<string>();
  const ids = new Set<number>();
  for (const key of [...Object.keys(look.parts), ...Object.keys(look.overlays)]) {
    defined.add(key);
    ids.add(keyId(key));
  }
  // A part drawn upright turns by itself into its pictures turned 22.5°, 45° and 67.5°, unless
  // those are drawn too: draw a big armour plate once and it follows every pose.
  const turnedFrom = new Map<string, { from: string; degrees: number }>();
  for (const key of Object.keys(look.parts)) {
    const id = keyId(key);
    if (rotationIndex(id) !== 0) continue;
    const quals = key.slice(String(id).length);
    for (let k = 1; k <= 3; k++) {
      const target = id + k;
      if (rotationIndex(target) !== k || familyOf(target) !== familyOf(id)) break;
      const turned = `${target}${quals}`;
      if (turned in look.parts) continue;
      turnedFrom.set(turned, { from: key, degrees: 22.5 * k });
      defined.add(turned);
      ids.add(target);
    }
  }
  // Recolours of one side: their pictures are defined at the keys they name.
  const keyRecolors = new Map<string, LookRecolor[]>();
  for (const r of look.recolor) {
    if (r.on === undefined) continue;
    for (const id of r.sprites) {
      const keys = expandPartKey(`${id}:${r.on}`);
      if (typeof keys === 'string') continue;
      for (const k of keys) {
        const text = partKeyText(k);
        keyRecolors.set(text, [...(keyRecolors.get(text) ?? []), r]);
        defined.add(text);
        ids.add(id);
      }
    }
  }
  for (const r of look.recolor) {
    if (r.on !== undefined) continue;
    for (const id of r.sprites) {
      if (!LOOK_SPRITES.has(id)) continue;
      const p = basePicture(base, look.base, id);
      if (p && recolor(p, look, id)) {
        defined.add(String(id));
        ids.add(id);
      }
    }
  }

  /** The picture of a canonical key (built from the next defined, less specific one). */
  const pictureOf = (key: string, chain: readonly string[]): Picture | null => {
    if (pictures.has(key)) return pictures.get(key) ?? null;
    let result: Picture | null;
    const rows = look.parts[key];
    const turn = turnedFrom.get(key);
    if (rows) {
      result = pivotedPicture(rows, palette, basePicture(base, look.base, keyId(key)));
    } else if (turn) {
      const upright = pictureOf(turn.from, keyChain(keyId(turn.from), undefined, false));
      result = upright ? rotsprite(upright, turn.degrees) : null;
    } else {
      const at = chain.indexOf(key);
      const parent = chain.slice(at + 1).find((k) => defined.has(k));
      const id = keyId(key);
      let start: Picture | null;
      if (parent) {
        const p = pictureOf(parent, chain);
        start = p ? copyPicture(p) : null;
      } else {
        start = basePicture(base, look.base, id);
        if (start) recolor(start, look, id);
      }
      result = start;
      if (start) for (const r of keyRecolors.get(key) ?? []) applyRecolor(start, r);
      const over = look.overlays[key];
      if (over && start && !overlay(start, over, palette)) {
        problems.push(
          `overlay ${key} is ${Array.from(over[0] ?? '').length}x${over.length}, the picture ${start.w}x${start.h}`,
        );
      }
    }
    pictures.set(key, result);
    return result;
  };

  // Every (id, side, flip) a part can be drawn as → the first defined key of its chain.
  const parts = new Int32Array(ID_LIMIT * 6).fill(FALLTHROUGH);
  const attachments: (Int32Array | null)[] = new Array<Int32Array | null>(ID_LIMIT * 6).fill(null);
  const chosen = new Map<number, string>();
  const order: { key: string; picture: Picture }[] = [];
  const byContent = new Map<string, string>();
  const layerKeyOf = new Map<string, string>();
  const addPicture = (key: string, picture: Picture): void => {
    const sig = `${picture.w}x${picture.h}:${signature(picture.px)}`;
    const same = byContent.get(sig);
    if (same) {
      layerKeyOf.set(key, same);
      return;
    }
    byContent.set(sig, key);
    layerKeyOf.set(key, key);
    order.push({ key, picture });
  };

  for (const id of [...ids].sort((a, b) => a - b)) {
    const limb = isLimb(familyOf(id));
    for (const side of limb ? [Side.FAR, Side.NEAR] : [Side.MID]) {
      for (const flip of [false, true]) {
        const chain = keyChain(id, sideName(side), flip);
        const key = chain.find((k) => defined.has(k));
        if (!key) continue;
        const picture = pictureOf(key, chain);
        if (!picture) continue;
        if (!layerKeyOf.has(key)) addPicture(key, picture);
        chosen.set(slotIndex(id, side, flip), key);
      }
    }
  }
  const attachList: { layer: number; name: string; a: LookAttachment }[] = Object.entries(
    look.attachments,
  ).map(([name, a]) => ({ layer: ATTACH_LAYERS[a.layer], name, a }));
  const attachChosen = new Map<number, { layer: number; key: string }[]>();
  for (const { layer, name, a } of attachList) {
    const attachIds = new Set(Object.keys(a.sprites).map(keyId));
    for (const id of attachIds) {
      const limb = isLimb(familyOf(id));
      for (const side of limb ? [Side.FAR, Side.NEAR] : [Side.MID]) {
        for (const flip of [false, true]) {
          const k = keyChain(id, sideName(side), flip).find((c) => c in a.sprites);
          if (!k) continue;
          const key = `${name}@${k}`;
          if (!layerKeyOf.has(key)) {
            const partKey = chosen.get(slotIndex(id, side, flip));
            const parent =
              (partKey ? pictures.get(partKey) : null) ?? basePicture(base, look.base, id);
            addPicture(key, pivotedPicture(a.sprites[k]!, palette, parent));
          }
          const slot = slotIndex(id, side, flip);
          const list = attachChosen.get(slot) ?? [];
          list.push({ layer, key });
          attachChosen.set(slot, list);
        }
      }
    }
  }

  const packing = packRows(
    order.map((o) => ({ key: o.key, w: o.picture.w, h: o.picture.h })),
    256,
    1,
  );
  const width = packing.width;
  const height = packing.height;
  const data = new Uint8ClampedArray(width * height * 4);
  const frames: (LayerFrame | undefined)[] = [];
  const layerIds = new Map<string, number>();
  order.forEach((o, i) => {
    const cell = packing.cells.get(o.key)!;
    const id = LAYER_ID_BASE + i;
    frames[id] = { x: cell.x, y: cell.y, w: o.picture.w, h: o.picture.h };
    layerIds.set(o.key, id);
    for (let y = 0; y < o.picture.h; y++) {
      const s = y * o.picture.w * 4;
      data.set(o.picture.px.subarray(s, s + o.picture.w * 4), ((cell.y + y) * width + cell.x) * 4);
    }
  });
  const keys = new Map<string, number>();
  for (const [key, layerKey] of layerKeyOf) keys.set(key, layerIds.get(layerKey)!);
  for (const [slot, key] of chosen) parts[slot] = keys.get(key)!;
  for (const [slot, list] of attachChosen) {
    const pairs = new Int32Array(list.length * 2);
    list.forEach((e, i) => {
      pairs[i * 2] = e.layer;
      pairs[i * 2 + 1] = keys.get(e.key)!;
    });
    attachments[slot] = pairs;
  }
  return { look, width, height, data, frames, parts, attachments, ids, problems, keys };
}

/** A compact text signature of picture bytes (for sharing identical pictures). */
function signature(px: Uint8ClampedArray): string {
  let h1 = 0x811c9dc5;
  let h2 = 0;
  for (let i = 0; i < px.length; i++) {
    h1 = Math.imul(h1 ^ px[i]!, 0x01000193);
    h2 = (h2 * 31 + px[i]!) | 0;
  }
  return `${(h1 >>> 0).toString(16)}${(h2 >>> 0).toString(16)}${px.length}`;
}

/** How a part is seen, for parts drawn without a context (seen as authored). */
const UNMIRRORED: PartContext = { flipX: false, bodyFlip: false };

/**
 * The sprite swap of a character wearing `layer` (`face`: the blinking face this frame, or -1):
 * pictures of the look by side and mirroring, the base character's rules for the rest.
 */
export function lookSwap(layer: LookLayer, face = -1): SpriteSwap {
  const character = layer.look.base;
  const rule = skinSwap(character);
  // Blinking shows a face picture: the look's own, or Blaise's unless the look has its own head
  // (her face would pop up on it).
  const blinks = face >= 0 && (layer.ids.has(face) || (character === 0 && !layer.ids.has(25)));
  const keyOf = (id: number, t: number): number =>
    blinks && id === 25 && (t === 0 || t === 4) ? face : id;
  const slotOf = (key: number, t: number, primitive: number, part: PartContext): number => {
    const limb = isLimb(familyOf(key));
    const side = limb ? partSide(key, primitive) : Side.MID;
    // Arms and legs follow the body; the head and the trunk show the side actually seen.
    const flip = limb ? part.bodyFlip : part.flipX !== t >= 4;
    return slotIndex(key, side, flip);
  };
  const swap = ((id: number, t: number, primitive: number, part?: PartContext): number => {
    const key = keyOf(id, t);
    if (key >= ID_LIMIT) return rule(key, t, primitive);
    const found = layer.parts[slotOf(key, t, primitive, part ?? UNMIRRORED)]!;
    return found !== FALLTHROUGH ? found : rule(key, t, primitive);
  }) as SpriteSwap;
  if (Object.keys(layer.look.attachments).length > 0) {
    const attach: AttachLookup = (id, t, primitive, part, out) => {
      const key = keyOf(id, t);
      if (key >= ID_LIMIT) return 0;
      const pairs = layer.attachments[slotOf(key, t, primitive, part)];
      if (!pairs) return 0;
      for (let i = 0; i < pairs.length; i++) out.push(pairs[i]!);
      return pairs.length / 2;
    };
    swap.attach = attach;
  }
  return swap;
}
