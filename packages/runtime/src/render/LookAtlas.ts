/**
 * A look as one editable picture: every part in a cell of its own, in reading order (left to
 * right, top to bottom, a row per body part), with room around it to draw bigger. Artists export
 * it, paint over it in any editor and import it back; the dev page shows a dropped atlas at
 * once. The same layout is computed for the same look and options, and a side-car JSON keeps
 * it next to the picture.
 *
 * Mirrored pictures (`flip` keys) are shown as they appear on screen and turned back on import.
 * Each part's point (where the game centres it) is the centre of its cell; on import a picture
 * is cropped symmetrically around it, keeping the original's width and height parity so the
 * part sits exactly as before in both facings.
 *
 * Pure: RGBA bytes in and out.
 */
import {
  expandPartKey,
  keyChain,
  keyId,
  LOOK_SPRITES,
  parseColor,
  partKeyText,
  type LookData,
  type ResolvedLook,
} from './Look.ts';
import { skinSwap } from './CharacterRenderer.ts';
import { buildLookLayer } from './LookSheet.ts';
import { packRows } from './pack.ts';
import { mirrorImage, newImage, sheetFrame, type RgbaImage, type RgbaSheet } from './Raster.ts';
import { FAMILY_NAMES, familyOf, isLimb, rotationIndex } from './Rig.ts';
import { rotsprite } from './rotsprite.ts';

/** One part of the atlas. */
export interface AtlasCell {
  /** Canonical part key, or `<attachment>@<key>`. */
  key: string;
  /** What a person reads: "forearm 1 · near · seen mirrored". */
  label: string;
  family: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Size of the picture the cell holds now. */
  pictureW: number;
  pictureH: number;
  /** Shown mirrored (as on screen) and stored the other way round. */
  mirrored: boolean;
}

export interface LookAtlasLayout {
  look: string;
  margin: number;
  width: number;
  height: number;
  cells: AtlasCell[];
}

export interface AtlasOptions {
  /** Free pixels around every picture (default 4). */
  margin?: number;
  /** More keys to give cells (`17:right`, `25:left`, `cape@57`), drawn from what they show now. */
  add?: readonly string[];
  /** Only the pictures the look changes (default: every body part). */
  changedOnly?: boolean;
}

/** Characters for new palette entries (no ".", which is transparent, and no space). */
export const PALETTE_CHARS = Array.from(
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*+=?@!^~-_<>/|:;,' +
    'αβγδεζηθικλμνξπρστυφχψωБГДЖЗИЛПФЦЧШЩЭЮЯ',
);

const SIDE_ORDER = ['', 'near', 'far'];

function keyLabel(key: string): string {
  const [head, ...quals] = key.split(':');
  const id = Number(head);
  const family = FAMILY_NAMES[familyOf(id)] ?? 'part';
  const words = [`${family} ${id}`];
  for (const q of quals) words.push(q === 'flip' ? 'mirrored' : q === 'noflip' ? 'unmirrored' : q);
  return words.join(' · ');
}

function sortKey(key: string): [number, number, number, number] {
  const [head, ...quals] = key.split(':');
  const id = Number(head);
  const side = SIDE_ORDER.indexOf(quals.find((q) => q === 'near' || q === 'far') ?? '');
  const flip = quals.includes('flip') ? 2 : quals.includes('noflip') ? 1 : 0;
  // Faces right after the heads.
  const fam = familyOf(id);
  return [fam === 1 ? 0.5 : fam, id, side, flip];
}

function compareKeys(a: string, b: string): number {
  const ka = sortKey(a);
  const kb = sortKey(b);
  for (let i = 0; i < 4; i++) if (ka[i] !== kb[i]) return ka[i]! - kb[i]!;
  return 0;
}

export interface Pic {
  w: number;
  h: number;
  data: Uint8ClampedArray;
}

/** The pictures a look shows for its keys, through its built layer. */
export function pictures(base: RgbaSheet, look: ResolvedLook): (key: string) => Pic | null {
  const layer = buildLookLayer(base, look);
  const sheet: RgbaSheet = { image: layer, frames: layer.frames, fallback: base };
  const cut = (id: number): Pic | null => {
    const found = sheetFrame(sheet, id);
    if (!found) return null;
    const f = found.frame;
    const src = found.sheet.image;
    const data = new Uint8ClampedArray(f.w * f.h * 4);
    for (let y = 0; y < f.h; y++) {
      const o = ((f.y + y) * src.width + f.x) * 4;
      data.set(src.data.subarray(o, o + f.w * 4), y * f.w * 4);
    }
    return { w: f.w, h: f.h, data };
  };
  return (key: string): Pic | null => {
    const at = key.indexOf('@');
    if (at >= 0) {
      const id = layer.keys.get(key);
      return id === undefined ? null : cut(id);
    }
    const id = keyId(key);
    const quals = key.split(':').slice(1);
    const side = quals.find((q) => q === 'near' || q === 'far') as 'near' | 'far' | undefined;
    const flip = quals.includes('flip');
    for (const k of keyChain(id, side, flip)) {
      const layerId = layer.keys.get(k);
      if (layerId !== undefined) return cut(layerId);
    }
    // The base character's own picture (its skin rules: another head, the male torso).
    const drawn = skinSwap(look.base)(id, 0, 0);
    return drawn < 0 ? null : cut(drawn);
  };
}

/** The canonical keys of a written list (`17:right` → its two keys), dropping bad ones. */
function canonical(keys: readonly string[]): string[] {
  const out: string[] = [];
  for (const k of keys) {
    const at = k.indexOf('@');
    const name = at >= 0 ? k.slice(0, at + 1) : '';
    const expanded = expandPartKey(at >= 0 ? k.slice(at + 1) : k);
    if (typeof expanded === 'string') continue;
    for (const e of expanded) out.push(name + partKeyText(e));
  }
  return out;
}

/** The cells of a look's atlas. */
export function atlasLayout(
  base: RgbaSheet,
  look: ResolvedLook,
  options: AtlasOptions = {},
): LookAtlasLayout {
  const margin = options.margin ?? 4;
  const pic = pictures(base, look);
  const keys = new Set<string>();
  if (!options.changedOnly) for (const id of LOOK_SPRITES) keys.add(String(id));
  for (const k of Object.keys(look.parts)) keys.add(k);
  for (const k of Object.keys(look.overlays)) keys.add(k);
  for (const r of look.recolor) for (const id of r.sprites) keys.add(String(id));
  for (const k of canonical(options.add ?? [])) if (!k.includes('@')) keys.add(k);
  const partKeys = [...keys].filter((k) => LOOK_SPRITES.has(keyId(k))).sort(compareKeys);
  const attachKeys: string[] = [];
  for (const [name, a] of Object.entries(look.attachments)) {
    for (const k of Object.keys(a.sprites).sort(compareKeys)) attachKeys.push(`${name}@${k}`);
  }
  for (const k of canonical(options.add ?? [])) {
    if (k.includes('@') && !attachKeys.includes(k)) attachKeys.push(k);
  }

  const items: {
    key: string;
    family: number;
    w: number;
    h: number;
    pw: number;
    ph: number;
    breakBefore: boolean;
  }[] = [];
  let lastGroup = '';
  for (const key of [...partKeys, ...attachKeys]) {
    const at = key.indexOf('@');
    const partKey = at >= 0 ? key.slice(at + 1) : key;
    const id = keyId(partKey);
    const family = familyOf(id);
    const group = at >= 0 ? key.slice(0, at) : String(family);
    let p = pic(key);
    if (!p && at >= 0) {
      // A new attachment starts as an empty picture the size of its part.
      const part = pic(partKey);
      p = { w: part?.w ?? 8, h: part?.h ?? 8, data: new Uint8ClampedArray(0) };
    }
    if (!p) continue;
    items.push({
      key,
      family,
      w: p.w + margin * 2,
      h: p.h + margin * 2,
      pw: p.w,
      ph: p.h,
      breakBefore: group !== lastGroup,
    });
    lastGroup = group;
  }
  const packing = packRows(items, 512, 2);
  const cells: AtlasCell[] = items.map((it) => {
    const r = packing.cells.get(it.key)!;
    const at = it.key.indexOf('@');
    const partKey = at >= 0 ? it.key.slice(at + 1) : it.key;
    const mirrored = partKey.split(':').includes('flip');
    const label = at >= 0 ? `${it.key.slice(0, at)} @ ${keyLabel(partKey)}` : keyLabel(it.key);
    return {
      key: it.key,
      label: mirrored ? `${label} (as seen)` : label,
      family: it.family,
      x: r.x,
      y: r.y,
      w: r.w,
      h: r.h,
      pictureW: it.pw,
      pictureH: it.ph,
      mirrored,
    };
  });
  return { look: look.id, margin, width: packing.width, height: packing.height, cells };
}

/** The atlas picture of a look in `layout` (transparent around the parts). */
export function exportAtlas(
  base: RgbaSheet,
  look: ResolvedLook,
  layout: LookAtlasLayout,
): RgbaImage {
  const out = newImage(layout.width, layout.height);
  const pic = pictures(base, look);
  for (const cell of layout.cells) {
    const p = pic(cell.key);
    if (!p || p.data.length === 0) continue;
    let img: RgbaImage = { width: p.w, height: p.h, data: p.data };
    if (cell.mirrored) img = mirrorImage(img);
    const ox = cell.x + (cell.w >> 1) - (p.w >> 1);
    const oy = cell.y + (cell.h >> 1) - (p.h >> 1);
    for (let y = 0; y < p.h; y++) {
      const s = y * p.w * 4;
      out.data.set(img.data.subarray(s, s + p.w * 4), ((oy + y) * out.width + ox) * 4);
    }
  }
  return out;
}

/** The smallest span of the given parity, centred on `point` like the game centres parts. */
function span(point: number, min: number, max: number, parity: number): [number, number] {
  for (let w = 1; w < 4096; w++) {
    if (parity >= 0 && (w & 1) !== parity) continue;
    const x0 = point - (w >> 1);
    if (x0 <= min && x0 + w - 1 >= max) return [x0, w];
  }
  return [min, max - min + 1];
}

function hex2(v: number): string {
  return v.toString(16).padStart(2, '0');
}

/**
 * A palette that grows: the character of a colour, a new one from `PALETTE_CHARS` for a colour
 * not in it yet (null when they run out).
 */
export function paletteWriter(start: Record<string, string>): {
  palette: Record<string, string>;
  charOf: (r: number, g: number, b: number, a: number) => string | null;
} {
  const palette: Record<string, string> = { ...start };
  const byColour = new Map<string, string>();
  for (const [ch, c] of Object.entries(palette)) {
    const rgba = parseColor(c);
    if (rgba) byColour.set(rgba[3] === 255 ? c.slice(0, 7).toLowerCase() : c.toLowerCase(), ch);
  }
  const free = PALETTE_CHARS.filter((c) => !(c in palette));
  const charOf = (r: number, g: number, b: number, a: number): string | null => {
    const colour = '#' + hex2(r) + hex2(g) + hex2(b) + (a < 255 ? hex2(a) : '');
    let ch = byColour.get(colour);
    if (!ch) {
      ch = free.shift();
      if (!ch) return null;
      palette[ch] = colour;
      byColour.set(colour, ch);
    }
    return ch;
  };
  return { palette, charOf };
}

/** Rows of palette characters for RGBA pixels (alpha below 128 is `.`), or null. */
export function picToRows(
  p: { w: number; h: number; data: Uint8ClampedArray },
  charOf: (r: number, g: number, b: number, a: number) => string | null,
): string[] | null {
  const rows: string[] = [];
  for (let y = 0; y < p.h; y++) {
    let row = '';
    for (let x = 0; x < p.w; x++) {
      const o = (y * p.w + x) * 4;
      if (p.data[o + 3]! < 128) {
        row += '.';
        continue;
      }
      const ch = charOf(p.data[o]!, p.data[o + 1]!, p.data[o + 2]!, p.data[o + 3]!);
      if (!ch) return null;
      row += ch;
    }
    rows.push(row);
  }
  return rows;
}

/**
 * The turned pictures of a part made from its upright one: for every key of `from` (an upright
 * sprite id, maybe with side and mirroring), the pictures of the next three ids turned by
 * 22.5°, 45° and 67.5° clockwise, the way the original's pre-turned body parts are.
 */
export function rotateParts(
  base: RgbaSheet,
  look: ResolvedLook,
  from: readonly string[],
): { parts: Map<string, string[]>; palette: Record<string, string>; problems: string[] } {
  const pic = pictures(base, look);
  const { palette, charOf } = paletteWriter(look.palette);
  const parts = new Map<string, string[]>();
  const problems: string[] = [];
  for (const key of canonical(from)) {
    // An attachment's picture turns with its part: `cape@57` gives `cape@58`…
    const at = key.indexOf('@');
    const name = at >= 0 ? key.slice(0, at + 1) : '';
    const partKey = at >= 0 ? key.slice(at + 1) : key;
    const id = keyId(partKey);
    const quals = partKey.slice(String(id).length);
    if (rotationIndex(id) !== 0) {
      problems.push(`${key}: not an upright picture`);
      continue;
    }
    const p = pic(key);
    if (!p) {
      problems.push(`${key}: no picture`);
      continue;
    }
    for (let k = 1; k <= 3; k++) {
      const target = id + k;
      if (rotationIndex(target) !== k || familyOf(target) !== familyOf(id)) break;
      const turned = rotsprite({ w: p.w, h: p.h, px: p.data }, 22.5 * k);
      const rows = picToRows({ w: turned.w, h: turned.h, data: turned.px }, charOf);
      if (!rows) {
        problems.push(`${key}: too many colours`);
        break;
      }
      parts.set(`${name}${target}${quals}`, rows);
    }
  }
  return { parts, palette, problems };
}

export interface AtlasImport {
  /** Pictures changed by the artist, as rows, per canonical key (`name@key` for attachments). */
  pictures: Map<string, string[]>;
  /** The palette with the new colours added. */
  palette: Record<string, string>;
  problems: string[];
}

/**
 * Reads an edited atlas: every cell that differs from what the look shows now becomes a picture
 * (rows of palette characters), cropped around the part's point.
 */
export function importAtlas(
  base: RgbaSheet,
  look: ResolvedLook,
  layout: LookAtlasLayout,
  image: RgbaImage,
): AtlasImport {
  const problems: string[] = [];
  if (image.width < layout.width || image.height < layout.height) {
    problems.push(
      `the picture is ${image.width}x${image.height}, the atlas ${layout.width}x${layout.height}`,
    );
    return { pictures: new Map(), palette: { ...look.palette }, problems };
  }
  const now = exportAtlas(base, look, layout);
  const { palette, charOf } = paletteWriter(look.palette);

  const result = new Map<string, string[]>();
  for (const cell of layout.cells) {
    // Unchanged cells keep what the look has.
    let same = true;
    for (let y = cell.y; y < cell.y + cell.h && same; y++) {
      for (let x = cell.x; x < cell.x + cell.w; x++) {
        const a = (y * image.width + x) * 4;
        const b = (y * now.width + x) * 4;
        const ia = image.data[a + 3]! >= 128 ? 1 : 0;
        const nb = now.data[b + 3]! >= 128 ? 1 : 0;
        if (
          ia !== nb ||
          (ia &&
            (image.data[a] !== now.data[b] ||
              image.data[a + 1] !== now.data[b + 1] ||
              image.data[a + 2] !== now.data[b + 2]))
        ) {
          same = false;
          break;
        }
      }
    }
    if (same) continue;
    // The cell, turned back to how it is stored.
    let cellImg = newImage(cell.w, cell.h);
    for (let y = 0; y < cell.h; y++) {
      const o = ((cell.y + y) * image.width + cell.x) * 4;
      cellImg.data.set(image.data.subarray(o, o + cell.w * 4), y * cell.w * 4);
    }
    if (cell.mirrored) cellImg = mirrorImage(cellImg);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let y = 0; y < cell.h; y++) {
      for (let x = 0; x < cell.w; x++) {
        if (cellImg.data[(y * cell.w + x) * 4 + 3]! < 128) continue;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
    if (minX === Infinity) {
      // Erased: a single transparent pixel hides the part.
      result.set(cell.key, ['.']);
      continue;
    }
    // Margins are equal on both sides, so mirroring keeps the part's point in the middle.
    const [x0, w] = span(cell.w >> 1, minX, maxX, cell.pictureW & 1);
    const [y0, h] = span(cell.h >> 1, minY, maxY, cell.pictureH & 1);
    const rows: string[] = [];
    let ok = true;
    for (let y = y0; y < y0 + h && ok; y++) {
      let row = '';
      for (let x = x0; x < x0 + w; x++) {
        const inside = x >= 0 && y >= 0 && x < cell.w && y < cell.h;
        const o = (y * cell.w + x) * 4;
        if (!inside || cellImg.data[o + 3]! < 128) {
          row += '.';
          continue;
        }
        const ch = charOf(
          cellImg.data[o]!,
          cellImg.data[o + 1]!,
          cellImg.data[o + 2]!,
          cellImg.data[o + 3]!,
        );
        if (!ch) {
          problems.push(`${cell.key}: too many colours`);
          ok = false;
          break;
        }
        row += ch;
      }
      rows.push(row);
    }
    if (ok) result.set(cell.key, rows);
  }
  return { pictures: result, palette, problems };
}

/**
 * Writes imported pictures into a written look: as `parts` (and attachment sprites), with the
 * pairs of keys that are one limb or one side of the head folded back into `left` / `right`.
 */
export function applyImport(look: LookData, imported: AtlasImport): LookData {
  const out: LookData = { ...look, palette: imported.palette };
  const parts: Record<string, string[] | null> = {};
  // Written keys standing for several (`left`, `right`) are split where a picture replaces one.
  for (const [key, rows] of Object.entries(look.parts ?? {})) {
    const expanded = expandPartKey(key);
    const split =
      typeof expanded !== 'string' &&
      expanded.length > 1 &&
      expanded.some((e) => imported.pictures.has(partKeyText(e)));
    if (split) for (const e of expanded as { id: number }[]) parts[partKeyText(e)] = rows;
    else parts[key] = rows;
  }
  const attachments = { ...(look.attachments ?? {}) };
  for (const [key, rows] of imported.pictures) {
    const at = key.indexOf('@');
    if (at >= 0) {
      const name = key.slice(0, at);
      const a = attachments[name] ?? { layer: 'back' as const, sprites: {} };
      attachments[name] = { ...a, sprites: { ...a.sprites, [key.slice(at + 1)]: rows } };
    } else {
      parts[key] = rows;
    }
  }
  // Fold canonical pairs back into the aliases people write.
  const same = (a: string, b: string): boolean =>
    !!parts[a] && !!parts[b] && JSON.stringify(parts[a]) === JSON.stringify(parts[b]);
  for (const key of Object.keys(parts)) {
    const id = keyId(key);
    if (isLimb(familyOf(id))) {
      for (const [alias, a, b] of [
        ['right', `${id}:near:noflip`, `${id}:far:flip`],
        ['left', `${id}:near:flip`, `${id}:far:noflip`],
      ] as const) {
        if (same(a, b)) {
          parts[`${id}:${alias}`] = parts[a]!;
          delete parts[a];
          delete parts[b];
        }
      }
    } else {
      for (const [alias, k] of [
        ['left', `${id}:flip`],
        ['right', `${id}:noflip`],
      ] as const) {
        if (parts[k]) {
          parts[`${id}:${alias}`] = parts[k]!;
          delete parts[k];
        }
      }
    }
  }
  out.parts = parts;
  if (Object.keys(attachments).length > 0) out.attachments = attachments;
  // Keep `near` out: its pictures now live in `parts`.
  if (out.near) {
    for (const [k, rows] of Object.entries(out.near)) parts[`${k}:near`] ??= rows;
    delete out.near;
  }
  return out;
}
