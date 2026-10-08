/**
 * Effects of a character, as data (`content/bosses/<boss>/fx.json`): themed particles that
 * scatter behind the runner as it moves (bats, butterflies, sand, shell casings…), afterimages
 * of its poses, and ribbons of cloth or smoke. One system draws every character; only the data
 * and the little sprites differ.
 *
 * Distances are pixels, speeds pixels per second, times milliseconds, angles degrees with 0
 * pointing behind the runner, 90 up, 180 ahead and -90 down.
 */
import { parseColor, ribbonProblems, type LookRibbon } from '../Look.ts';

/** A number, or a range a value is picked from uniformly. */
export type Range = number | readonly [number, number];

/** Movements effects react to (`Motion.ts`). */
export const FX_TRIGGERS = [
  'any',
  'idle',
  'run',
  'fast',
  'air',
  'jump',
  'land',
  'flip',
  'wall',
  'roll',
  'slide',
  'ladder',
  'pole',
  'vault',
  'dash',
  'hang',
  'turn',
  'fail',
] as const;
export type FxTrigger = (typeof FX_TRIGGERS)[number];

/** Points of the body particles leave from. */
export const FX_ANCHORS = [
  'feet',
  'hips',
  'chest',
  'back',
  'neck',
  'head',
  'hand.near',
  'hand.far',
  'hands',
  'foot.near',
  'foot.far',
  'body',
] as const;
export type FxAnchor = (typeof FX_ANCHORS)[number];

export interface FxEmitter {
  /** Emit continuously while one of these is going on. */
  while?: FxTrigger[];
  /** Emit a burst when one of these starts. */
  enter?: FxTrigger[];
  /** Also burst on entering these moves (raw ids). */
  moves?: number[];
  /** Continuous: one particle every this many pixels travelled… */
  every?: number;
  /** …and/or this many per second. */
  perSecond?: number;
  /** Particles per burst (enter, moves, presence). */
  burst?: Range;
  /** Chance (0..1) that a burst or a continuous particle happens at all. */
  chance?: number;
  /** Continuous emission only above this speed. */
  minSpeed?: number;
  anchor?: FxAnchor;
  /** Pixels from the anchor; +x behind the runner, +y down. */
  offset?: readonly [number, number];
  /** Random spread around the start point, ± pixels. */
  jitter?: readonly [number, number];
  /** Start speed and direction. */
  speed?: Range;
  angle?: Range;
  /** Share of the runner's own velocity the particle keeps (0 stays in place, 1 moves along). */
  inherit?: number;
  /** Pixels per second² downwards (negative floats up). */
  gravity?: number;
  /** Fraction of velocity lost per second. */
  drag?: number;
  life: Range;
  fadeIn?: number;
  fadeOut?: number;
  /** Size multiplier at birth and at death (whole numbers keep pixels square). */
  scale?: Range;
  scaleEnd?: number;
  /** Quarter turns per second (pixel art turns in right angles). */
  tumble?: Range;
  /** Side to side wobble: amplitude in pixels and frequency in Hz. */
  flutter?: { amp: number; freq: number };
  /** Mirror the sprite to the runner's facing (a bat flying the runner's way). */
  face?: boolean;
  /** Animated sprite: names in `sprites`, played at `fps`, one picked at random with `random`. */
  sprite?: { frames: string[]; fps?: number; loop?: boolean; random?: boolean };
  /** Square pixels instead of a sprite: sparks, embers, glitch pixels. */
  rect?: { size: Range; colors: string[] };
  blend?: 'normal' | 'add';
  layer?: 'behind' | 'front';
  /** At most this many alive from this emitter. */
  max?: number;
  /** Multiplier of the amount with reduced motion (default 0: off). */
  reduced?: number;
}

export interface FxAfterimage {
  /** `echo`: hologram afterimages two, four, six steps back; `rush`: a streak of six. */
  preset?: 'echo' | 'rush';
  /** `trail`: past poses while running; `snapshot`: a pose taken when a trigger starts. */
  mode?: 'trail' | 'snapshot';
  steps?: { back: number; alpha: number }[];
  /** Silhouettes keep the sprites' shading (`textured`) or are flat. */
  textured?: boolean;
  scanlines?: boolean;
  /** `accent`, `rainbow` (one hue per afterimage, turning) or colours. */
  colors?: 'accent' | 'rainbow' | string[];
  /** Trail: when it shows. */
  while?: 'running' | 'fast' | 'always';
  /** Snapshot: what takes one. */
  enter?: FxTrigger[];
  /** Snapshot: how long it lasts and how it drifts (px/s). */
  life?: number;
  drift?: readonly [number, number];
  /** Snapshot: opacity at its start. */
  alpha?: number;
}

export interface FxVariant {
  emitters?: string[];
  afterimage?: FxAfterimage;
  ribbons?: string[];
}

export interface FxFile {
  /** Pixel characters → `#rrggbb[aa]`, or `accent`, `accent.light`, `accent.dark`. */
  palette?: Record<string, string>;
  /** Little pictures, rows of palette characters (`.` transparent). */
  sprites?: Record<string, string[]>;
  emitters?: Record<string, FxEmitter>;
  ribbons?: Record<string, LookRibbon>;
  /** The flavours of the effect (one per contest won). */
  variants: Record<string, FxVariant>;
  /** The boss in a contest: around it while it waits, when it vanishes and appears. */
  presence?: { idle?: string[]; vanish?: string[]; appear?: string[] };
}

const ACCENT_TOKENS = ['accent', 'accent.light', 'accent.dark'];

function rangeOk(r: Range | undefined): boolean {
  if (r === undefined) return true;
  if (typeof r === 'number') return Number.isFinite(r);
  return r.length === 2 && Number.isFinite(r[0]) && Number.isFinite(r[1]) && r[0] <= r[1];
}

/** What is wrong with an effects file, or nothing. */
export function fxProblems(fx: FxFile): string[] {
  const out: string[] = [];
  const palette = fx.palette ?? {};
  for (const [ch, c] of Object.entries(palette)) {
    if (Array.from(ch).length !== 1 || ch === '.')
      out.push(`palette "${ch}": one character, not "."`);
    if (!ACCENT_TOKENS.includes(c) && !parseColor(c)) out.push(`palette "${ch}": ${c}`);
  }
  for (const [name, rows] of Object.entries(fx.sprites ?? {})) {
    const w = Array.from(rows[0] ?? '').length;
    if (rows.length === 0 || w === 0) out.push(`sprite ${name} is empty`);
    for (const [y, row] of rows.entries()) {
      const chars = Array.from(row);
      if (chars.length !== w) out.push(`sprite ${name} row ${y}: ${chars.length} wide, not ${w}`);
      for (const ch of chars) {
        if (ch !== '.' && !(ch in palette)) {
          out.push(`sprite ${name} row ${y}: "${ch}" not in palette`);
          break;
        }
      }
    }
  }
  const colour = (c: string): boolean =>
    c in palette || ACCENT_TOKENS.includes(c) || parseColor(c) !== null;
  for (const [name, e] of Object.entries(fx.emitters ?? {})) {
    const where = `emitter ${name}`;
    for (const t of [...(e.while ?? []), ...(e.enter ?? [])]) {
      if (!FX_TRIGGERS.includes(t)) out.push(`${where}: trigger "${t}"`);
    }
    if (e.anchor && !FX_ANCHORS.includes(e.anchor)) out.push(`${where}: anchor "${e.anchor}"`);
    if (!e.sprite && !e.rect) out.push(`${where}: needs a sprite or a rect`);
    for (const f of e.sprite?.frames ?? []) {
      if (!(f in (fx.sprites ?? {}))) out.push(`${where}: sprite "${f}" does not exist`);
    }
    for (const c of e.rect?.colors ?? []) if (!colour(c)) out.push(`${where}: colour "${c}"`);
    for (const [k, r] of Object.entries({
      burst: e.burst,
      speed: e.speed,
      angle: e.angle,
      life: e.life,
      scale: e.scale,
      tumble: e.tumble,
      size: e.rect?.size,
    })) {
      if (!rangeOk(r)) out.push(`${where}: ${k} is not a number or a [min, max] range`);
    }
    if (e.life === undefined) out.push(`${where}: no life`);
  }
  for (const [name, r] of Object.entries(fx.ribbons ?? {})) {
    out.push(...ribbonProblems(r).map((s) => `ribbon ${name}: ${s}`));
    for (const c of r.colors ?? []) if (!colour(c)) out.push(`ribbon ${name}: colour "${c}"`);
  }
  const names = (
    kind: 'emitters' | 'ribbons',
    list: readonly string[] | undefined,
    where: string,
  ): void => {
    for (const n of list ?? []) {
      if (!(n in (fx[kind] ?? {})))
        out.push(`${where}: ${kind.slice(0, -1)} "${n}" does not exist`);
    }
  };
  for (const [name, v] of Object.entries(fx.variants)) {
    names('emitters', v.emitters, `variant ${name}`);
    names('ribbons', v.ribbons, `variant ${name}`);
    const a = v.afterimage;
    if (a && Array.isArray(a.colors)) {
      for (const c of a.colors) if (!colour(c)) out.push(`variant ${name}: colour "${c}"`);
    }
  }
  names('emitters', fx.presence?.idle, 'presence idle');
  names('emitters', fx.presence?.vanish, 'presence vanish');
  names('emitters', fx.presence?.appear, 'presence appear');
  return out;
}
