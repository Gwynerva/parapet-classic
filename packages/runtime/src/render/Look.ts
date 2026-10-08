/**
 * Looks: outfits for the character skeleton, written as text pixel art so they can be read and
 * reviewed like code (`content/bosses/<boss>/looks/<look>.json`, see the README there).
 *
 * A look starts from an original character (`base`, 0 = Blaise) and changes its pictures:
 *
 * - `recolor`: exact colour replacements inside chosen sprites (clothes, skin, shoes);
 * - `overlays`: pixels painted over a picture of the same size: `.` keeps the pixel, a space
 *   erases it, a palette character paints it (glasses, a cap, a hairstyle);
 * - `parts`: pictures redrawn from scratch as rows of palette characters, `.` transparent, of
 *   any size: a heavy breastplate, a thin leg, a skirt. A part is drawn centred on the original
 *   part's point, or with its pivot `+` there. Drawn upright, a part turns by itself into its
 *   pictures turned 22.5°, 45° and 67.5° (unless those are drawn too);
 * - `attachments`: gear of any size hung on a part (a sword on the back, pauldrons, a reactor on
 *   the chest), drawn behind the whole body, just under or over the part, or in front of
 *   everything. It turns with the part. A `+` in a picture marks its pivot, the pixel that sits
 *   on the part's point (without one the picture is centred there, like a part);
 * - `ribbons`: cloth that trails the movement, drawn by the effects: a flat band in colours (a
 *   scarf, a plume) or a `texture` stretched along the chain (a cape, a sash; a bag on a strap
 *   with one stiff segment swings like a pendulum);
 * - `effect`: the effect variants worn with this outfit, when they differ from the boss's.
 *
 * Keys of `parts`, `overlays` and attachment pictures name a sprite in Blaise's numbering (the
 * keyframes' ids, plus the faces 76–79) and may say when the picture applies:
 *
 *     <id>                    always
 *     <id>:near | <id>:far    on the near or the far arm or leg only
 *     <id>:flip | <id>:noflip only when the part is drawn mirrored / not mirrored
 *     <id>:near:flip …        both
 *     <id>:left | <id>:right  the character's own left or right: for arms and legs the limb
 *                             (right = near while facing right, far while facing left), for the
 *                             head and the body the side of it that is seen
 *
 * The most specific picture wins (`id:side:flip`, `id:side`, `id:flip`, `id`, then the base
 * character's). Pictures are stored as the renderer draws them before mirroring; the atlas tool
 * shows mirrored ones as they appear on screen.
 *
 * `extends` builds a look on another one (a kit shared by several outfits): fields are merged
 * key by key, the child winning, `null` deleting; `recolor` rules run parent first.
 *
 * This module is pure (no DOM).
 */
import { Family, familyOf, isLimb } from './Rig.ts';

export interface LookRecolor {
  sprites: number[];
  /** `#rrggbb` → `#rrggbb` or `#rrggbbaa` (`#00000000` erases). */
  map: Record<string, string>;
  /**
   * Only on these pictures, a key qualifier (`left`, `right`, `near`, `far`, `flip`…): one
   * side of the body in other colours (a dark arm, a tattooed half of the face).
   */
  on?: string;
}

/** `hips`: over both legs, under the head and the near arm (a skirt, tassets, coat tails). */
export type AttachLayerName = 'back' | 'under' | 'over' | 'front' | 'hips';

export interface LookAttachment {
  layer: AttachLayerName;
  /** Part key → rows of palette characters (one picture per rotation of the part). */
  sprites: Record<string, string[]>;
}

/**
 * Cloth trailing a point of the body: a chain of segments, drawn as a tapering band of colours
 * or as a picture stretched along it.
 */
export interface LookRibbon {
  /** `back`: the upper back, between the shoulders (a cape); `neck`: the nape. */
  anchor: 'neck' | 'back' | 'head' | 'chest' | 'hips' | 'hand.near' | 'hand.far';
  /** Pixels from the anchor; +x is behind the runner, +y down. */
  offset?: [number, number];
  /** Segments of the chain (default: about one per 4 rows of the texture); 1 is a pendulum. */
  segments?: number;
  /** Length of a segment in pixels (default: the texture's rows shared out). */
  length?: number;
  /** Band: width at the root and at the tip, in pixels. */
  width?: number | [number, number];
  /** Band: colours along it (palette characters or `#rrggbb`), root first. */
  colors?: string[];
  /**
   * The cloth as a picture hanging from the anchor (palette characters, `.` transparent): rows
   * run along the chain, the first at the anchor; a `+` in the first row marks the column the
   * chain runs through (default the middle).
   */
  texture?: string[];
  /** 0..1: how much the chain keeps straight (a stiff cape, a bag on a strap). Default 0. */
  stiffness?: number;
  /** Pixels per second² downwards (default 220). */
  gravity?: number;
  /** Fraction of velocity lost per second (default 2.5). */
  drag?: number;
  /** Drawn behind the body (default) or in front. */
  layer?: 'behind' | 'front';
}

/** Segments and their length of a ribbon, from its fields or its texture. */
export function ribbonChain(r: LookRibbon): { segments: number; length: number } {
  const rows = r.texture?.length ?? 0;
  const segments = r.segments ?? (rows > 0 ? Math.max(2, Math.min(12, Math.round(rows / 4))) : 6);
  const length = r.length ?? (rows > 0 ? rows / segments : 3);
  return { segments, length };
}

export interface LookData {
  id: string;
  /** The look this one is built on. */
  extends?: string;
  /** A kit: only for building other looks on, never worn. */
  abstract?: boolean;
  /** Original character whose body-part rules the look follows (0 Blaise). */
  base?: number;
  /** Colour of the look's name tag and trails, `#rrggbb`. */
  accent?: string;
  /** Pixel characters → `#rrggbb` or `#rrggbbaa`; `.` is always transparent. */
  palette?: Record<string, string>;
  recolor?: LookRecolor[];
  overlays?: Record<string, string[] | null>;
  parts?: Record<string, string[] | null>;
  /** Old form of `parts["<id>:near"]`. */
  near?: Record<string, string[]>;
  attachments?: Record<string, LookAttachment | null>;
  ribbons?: Record<string, LookRibbon | null>;
  /** Effect variants worn with this outfit instead of the boss's (`null` clears a parent's). */
  effect?: string[] | null;
}

/** A look with its parents merged in and every key in its canonical form. */
export interface ResolvedLook {
  id: string;
  base: number;
  accent: string;
  palette: Record<string, string>;
  recolor: LookRecolor[];
  overlays: Record<string, string[]>;
  parts: Record<string, string[]>;
  attachments: Record<string, LookAttachment>;
  ribbons: Record<string, LookRibbon>;
  /** Effect variants of this outfit, or null for the boss's own. */
  effect: string[] | null;
}

/** Sprites a look may change: the body parts of the character object and the faces. */
export const LOOK_SPRITES: ReadonlySet<number> = new Set([
  ...Array.from({ length: 65 }, (_, i) => i + 1),
  76,
  77,
  78,
  79,
]);

/** Deepest chain of `extends`. */
export const MAX_EXTENDS = 4;

export type Rgba = readonly [number, number, number, number];

/** `#rgb`, `#rrggbb` or `#rrggbbaa` → RGBA bytes, or null. */
export function parseColor(text: string): Rgba | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(text);
  if (!m) return null;
  let hex = m[1]!;
  if (hex.length === 3) hex = hex.replace(/./g, (c) => c + c);
  const v = (i: number): number => parseInt(hex.slice(i, i + 2), 16);
  return [v(0), v(2), v(4), hex.length === 8 ? v(6) : 255];
}

/** A canonical part key: a sprite, maybe a side, maybe a mirroring. */
export interface PartKey {
  id: number;
  side?: 'near' | 'far';
  flip?: boolean;
}

export function partKeyText(k: PartKey): string {
  let s = String(k.id);
  if (k.side) s += ':' + k.side;
  if (k.flip !== undefined) s += k.flip ? ':flip' : ':noflip';
  return s;
}

/**
 * The canonical keys a written key stands for (`left`/`right` expand to two keys on a limb),
 * or a problem.
 */
export function expandPartKey(text: string): PartKey[] | string {
  const [head, ...quals] = text.split(':');
  const id = Number(head);
  if (!/^\d+$/.test(head ?? '') || !LOOK_SPRITES.has(id)) return `${text}: not a body part`;
  const limb = isLimb(familyOf(id));
  let side: 'near' | 'far' | undefined;
  let flip: boolean | undefined;
  let body: 'left' | 'right' | undefined;
  for (const q of quals) {
    if (q === 'near' || q === 'far') {
      if (side) return `${text}: two sides`;
      side = q;
    } else if (q === 'flip' || q === 'noflip') {
      if (flip !== undefined) return `${text}: two mirrorings`;
      flip = q === 'flip';
    } else if (q === 'left' || q === 'right') {
      if (body) return `${text}: two sides`;
      body = q;
    } else {
      return `${text}: unknown qualifier "${q}"`;
    }
  }
  if (side && !limb) return `${text}: only arms and legs have a near and a far side`;
  if (body) {
    if (side || flip !== undefined) return `${text}: left/right goes alone`;
    if (!limb) return [{ id, flip: body === 'left' }];
    // Facing right the near side is the right one; facing left (mirrored) the left one.
    return body === 'right'
      ? [
          { id, side: 'near', flip: false },
          { id, side: 'far', flip: true },
        ]
      : [
          { id, side: 'near', flip: true },
          { id, side: 'far', flip: false },
        ];
  }
  return [{ id, side, flip }];
}

/** The keys to try for a part drawn on `side` (undefined in the middle), most specific first. */
export function keyChain(id: number, side: 'near' | 'far' | undefined, flip: boolean): string[] {
  const f = flip ? ':flip' : ':noflip';
  return side
    ? [`${id}:${side}${f}`, `${id}:${side}`, `${id}${f}`, `${id}`]
    : [`${id}${f}`, `${id}`];
}

function expandMap<T>(
  map: Record<string, T | null> | undefined,
  what: string,
  problems: string[],
): Map<string, T | null> {
  const out = new Map<string, T | null>();
  for (const [key, value] of Object.entries(map ?? {})) {
    const keys = expandPartKey(key);
    if (typeof keys === 'string') {
      problems.push(`${what} ${keys}`);
      continue;
    }
    for (const k of keys) {
      const text = partKeyText(k);
      if (out.has(text)) problems.push(`${what} ${key}: ${text} is given twice`);
      out.set(text, value);
    }
  }
  return out;
}

function mergeInto<T>(target: Record<string, T>, layer: Map<string, T | null>): void {
  for (const [key, value] of layer) {
    if (value === null) delete target[key];
    else target[key] = value;
  }
}

/**
 * The look `id` with its parents merged in, from all looks by id; `problems` collects what is
 * wrong on the way (unknown parents, cycles, bad keys). Null when it cannot be built at all.
 */
export function resolveLook(
  id: string,
  all: ReadonlyMap<string, LookData>,
  problems: string[] = [],
): ResolvedLook | null {
  const chain: LookData[] = [];
  for (let cur: string | undefined = id; cur !== undefined;) {
    const look = all.get(cur);
    if (!look) {
      problems.push(`${id}: look "${cur}" does not exist`);
      return null;
    }
    if (chain.includes(look)) {
      problems.push(`${id}: extends itself through "${cur}"`);
      return null;
    }
    chain.unshift(look);
    if (chain.length > MAX_EXTENDS + 1) {
      problems.push(`${id}: more than ${MAX_EXTENDS} levels of extends`);
      return null;
    }
    cur = look.extends;
  }
  const out: ResolvedLook = {
    id,
    base: 0,
    accent: '#ff3ea5',
    palette: {},
    recolor: [],
    overlays: {},
    parts: {},
    attachments: {},
    ribbons: {},
    effect: null,
  };
  for (const look of chain) {
    const p: string[] = [];
    if (look.base !== undefined) out.base = look.base;
    if (look.accent !== undefined) out.accent = look.accent;
    Object.assign(out.palette, look.palette ?? {});
    out.recolor.push(...(look.recolor ?? []));
    mergeInto(out.overlays, expandMap(look.overlays, 'overlay', p));
    const parts = expandMap(look.parts, 'part', p);
    for (const [key, rows] of Object.entries(look.near ?? {})) {
      parts.set(`${key}:near`, rows);
    }
    mergeInto(out.parts, parts);
    for (const [name, a] of Object.entries(look.attachments ?? {})) {
      if (a === null) {
        delete out.attachments[name];
        continue;
      }
      const sprites = expandMap(a.sprites, `attachment ${name}`, p);
      const merged: Record<string, string[]> = {};
      mergeInto(merged, sprites);
      out.attachments[name] = { layer: a.layer, sprites: merged };
    }
    for (const [name, r] of Object.entries(look.ribbons ?? {})) {
      if (r === null) delete out.ribbons[name];
      else out.ribbons[name] = r;
    }
    if (look.effect !== undefined) out.effect = look.effect;
    problems.push(...p.map((s) => `${look.id}: ${s}`));
  }
  return out;
}

/** Resolves a look that stands alone (no `extends`). */
export function resolveSingle(look: LookData, problems: string[] = []): ResolvedLook | null {
  return resolveLook(look.id, new Map([[look.id, look]]), problems);
}

const LAYERS: readonly AttachLayerName[] = ['back', 'under', 'over', 'front', 'hips'];

/** What is wrong with a written look's own fields (ids, colours, recolours), or nothing. */
export function lookDataProblems(look: LookData): string[] {
  const out: string[] = [];
  if (!/^[a-z][a-z0-9-]*$/.test(look.id)) out.push(`id "${look.id}" must be kebab-case`);
  if (look.base !== undefined && (!Number.isInteger(look.base) || look.base < 0 || look.base > 9)) {
    out.push(`base ${look.base} is not an original character`);
  }
  if (look.accent !== undefined && !parseColor(look.accent)) {
    out.push(`accent ${look.accent} is not a colour`);
  }
  for (const [ch, colour] of Object.entries(look.palette ?? {})) {
    if (Array.from(ch).length !== 1 || ch === '.' || ch === ' ') {
      out.push(`palette key "${ch}" must be one character, not "." or a space`);
    }
    if (!parseColor(colour)) out.push(`palette "${ch}": ${colour} is not a colour`);
  }
  for (const [i, r] of (look.recolor ?? []).entries()) {
    for (const id of r.sprites) {
      if (!LOOK_SPRITES.has(id)) out.push(`recolor ${i}: sprite ${id} is not a body part`);
    }
    for (const [from, to] of Object.entries(r.map)) {
      if (!parseColor(from) || !parseColor(to)) out.push(`recolor ${i}: ${from} → ${to}`);
    }
    if (r.on !== undefined) {
      for (const id of r.sprites) {
        const keys = expandPartKey(`${id}:${r.on}`);
        if (typeof keys === 'string') out.push(`recolor ${i}: ${keys}`);
      }
    }
  }
  for (const [name, a] of Object.entries(look.attachments ?? {})) {
    if (a && !LAYERS.includes(a.layer)) out.push(`attachment ${name}: layer "${a.layer}"`);
  }
  for (const [name, r] of Object.entries(look.ribbons ?? {})) {
    if (r) out.push(...ribbonProblems(r).map((s) => `ribbon ${name}: ${s}`));
  }
  if (look.effect) {
    if (!Array.isArray(look.effect) || look.effect.some((v) => typeof v !== 'string' || !v)) {
      out.push('effect must be a list of variant names');
    }
  }
  return out;
}

/** What is wrong with a ribbon's shape, or nothing. */
export function ribbonProblems(r: LookRibbon): string[] {
  const out: string[] = [];
  const { segments, length } = ribbonChain(r);
  const min = r.texture ? 1 : 2;
  if (!Number.isInteger(segments) || segments < min || segments > 24) {
    out.push(`${min}..24 segments`);
  }
  if (!(length > 0)) out.push('length must be positive');
  if (r.stiffness !== undefined && !(r.stiffness >= 0 && r.stiffness <= 1)) {
    out.push('stiffness is 0..1');
  }
  if (r.texture) {
    if (r.texture.length === 0) out.push('texture has no rows');
  } else if (!r.colors?.length) {
    out.push('no colours and no texture');
  }
  return out;
}

function gridProblems(
  what: string,
  rows: readonly string[],
  keep: string,
  palette: Record<string, string>,
): string[] {
  const out: string[] = [];
  if (rows.length === 0) out.push(`${what} has no rows`);
  const width = Array.from(rows[0] ?? '').length;
  for (const [y, row] of rows.entries()) {
    const chars = Array.from(row);
    if (chars.length !== width) out.push(`${what} row ${y}: ${chars.length} wide, not ${width}`);
    for (const ch of chars) {
      if (!keep.includes(ch) && !(ch in palette)) {
        out.push(`${what} row ${y}: "${ch}" not in palette`);
        break;
      }
    }
  }
  return out;
}

/** What is wrong with a resolved look's pictures and ribbons, or nothing. */
export function lookProblems(look: ResolvedLook): string[] {
  const out: string[] = [];
  for (const [key, rows] of Object.entries(look.parts)) {
    out.push(...gridProblems(`part ${key}`, rows, '.+', look.palette));
    if (rows.join('').split('+').length > 2) out.push(`part ${key}: more than one pivot "+"`);
  }
  for (const [key, rows] of Object.entries(look.overlays)) {
    out.push(...gridProblems(`overlay ${key}`, rows, '. ', look.palette));
  }
  for (const [name, a] of Object.entries(look.attachments)) {
    for (const [key, rows] of Object.entries(a.sprites)) {
      const what = `attachment ${name} ${key}`;
      out.push(...gridProblems(what, rows, '.+', look.palette));
      if (rows.join('').split('+').length > 2) out.push(`${what}: more than one pivot "+"`);
    }
  }
  for (const [name, r] of Object.entries(look.ribbons)) {
    for (const c of r.colors ?? []) {
      if (!(c in look.palette) && !parseColor(c)) out.push(`ribbon ${name}: colour "${c}"`);
    }
    if (r.texture)
      out.push(...gridProblems(`ribbon ${name} texture`, r.texture, '.+', look.palette));
  }
  return out;
}

/** The pivot `+` of a picture (column, row), or null; the picture without it. */
export function pivotOf(rows: readonly string[]): { x: number; y: number; rows: string[] } | null {
  for (const [y, row] of rows.entries()) {
    const x = Array.from(row).indexOf('+');
    if (x >= 0) return { x, y, rows: rows.map((r) => r.replaceAll('+', '.')) };
  }
  return null;
}

/** The sprite id of a canonical key text (`"17:near:flip"` → 17). */
export function keyId(key: string): number {
  return Number(key.split(':')[0]);
}

/** Whether a family has a near and a far side in look keys (arms and legs). */
export function hasSides(id: number): boolean {
  return isLimb(familyOf(id));
}

/** Whether sprite `id` is a face (drawn instead of the upright head while it blinks). */
export function isFace(id: number): boolean {
  return familyOf(id) === Family.FACE;
}
