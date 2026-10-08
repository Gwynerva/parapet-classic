/**
 * The "echo" skin of ghosts and rivals: the character atlas recoloured into a glowing
 * hologram. Two variants:
 *
 * - textured: every pixel's brightness picks one of three tones of a neon ramp (shadow, body,
 *   highlight), so faces, hair and clothes stay readable in one colour;
 * - flat: every pixel takes the body tone, which leaves a featureless silhouette (the rivals
 *   of the original's story, who are not anyone the player knows).
 *
 * In both, the outer edge of every sprite becomes a bright one-pixel rim. The colour of a
 * player's echo comes from their name, so the same name glows the same everywhere.
 */
import { fnv1a } from '@parapet/sim';
import type { AtlasFrame } from '../content/types.ts';
import type { SceneRenderer } from './SceneRenderer.ts';
import { SpriteSheet } from './SpriteSheet.ts';
import { readPixels } from './SkinLibrary.ts';

export type Rgb = readonly [number, number, number];

export interface EchoRamp {
  shadow: Rgb;
  body: Rgb;
  highlight: Rgb;
  rim: Rgb;
}

export interface EchoColor {
  id: string;
  /** CSS colour of the body tone (labels, arrows, sparks). */
  css: string;
  /** CSS colour of the rim tone. */
  light: string;
  ramp: EchoRamp;
}

function hexRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function css(c: Rgb): string {
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}

const BLACK: Rgb = [0, 0, 0];
const WHITE: Rgb = [255, 255, 255];

/** An echo colour ramp built around one saturated tone (`id` names it in caches). */
export function makeEchoColor(id: string, hex: string): EchoColor {
  const body = hexRgb(hex);
  const rim = mix(body, WHITE, 0.8);
  return {
    id,
    css: hex,
    light: css(rim),
    ramp: { shadow: mix(body, BLACK, 0.55), body, highlight: mix(body, WHITE, 0.5), rim },
  };
}

/** Twelve saturated hues around the colour wheel, bright enough for every level's sky. */
export const ECHO_PALETTE: readonly EchoColor[] = [
  makeEchoColor('coral', '#ff4d4d'),
  makeEchoColor('orange', '#ff8a1f'),
  makeEchoColor('gold', '#ffd21f'),
  makeEchoColor('lime', '#b8ff2e'),
  makeEchoColor('green', '#3dff6e'),
  makeEchoColor('aqua', '#2effc8'),
  makeEchoColor('cyan', '#2ee6ff'),
  makeEchoColor('azure', '#3d9eff'),
  makeEchoColor('periwinkle', '#8a7dff'),
  makeEchoColor('violet', '#c45cff'),
  makeEchoColor('magenta', '#ff4fe1'),
  makeEchoColor('pink', '#ff4f8f'),
];

/** Grey of the original's rivals; never handed out to a name. */
export const ECHO_GREY: EchoColor = {
  id: 'grey',
  css: '#a7b0ba',
  light: '#eef2f6',
  ramp: {
    shadow: hexRgb('#5d6670'),
    body: hexRgb('#a7b0ba'),
    highlight: hexRgb('#d3d9df'),
    rim: hexRgb('#eef2f6'),
  },
};

/** The form of a name that picks its colour: case, spacing and Unicode forms do not matter. */
export function echoNameKey(name: string): string {
  return name.normalize('NFKC').trim().toLowerCase();
}

/** The echo colour of a runner's name; deterministic, the same on every device. */
export function echoColor(name: string): EchoColor {
  return ECHO_PALETTE[fnv1a(echoNameKey(name)) % ECHO_PALETTE.length]!;
}

/** Brightness (0..255) below which a textured pixel takes the shadow tone, and the body tone. */
const SHADOW_BELOW = 80;
const BODY_BELOW = 160;
/** Alpha below which a pixel counts as transparent. */
const OPAQUE = 128;

/**
 * Recolours RGBA pixels (`width` × `height`) into an echo. Only the pixels inside `frames`
 * are processed (each frame is a separate sprite: a neighbour outside the frame counts as
 * transparent, so sprites packed edge to edge still get their rims); without frames the whole
 * image is one sprite. Pixels outside every frame come out transparent.
 */
export function recolorEcho(
  src: Uint8ClampedArray,
  width: number,
  height: number,
  ramp: EchoRamp,
  textured: boolean,
  frames?: readonly (AtlasFrame | undefined)[],
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(src.length);
  const regions = frames ?? [{ x: 0, y: 0, w: width, h: height }];
  for (const f of regions) {
    if (!f) continue;
    const x0 = Math.max(0, f.x);
    const y0 = Math.max(0, f.y);
    const x1 = Math.min(width, f.x + f.w);
    const y1 = Math.min(height, f.y + f.h);
    const opaque = (x: number, y: number): boolean =>
      x >= x0 && x < x1 && y >= y0 && y < y1 && src[(y * width + x) * 4 + 3]! >= OPAQUE;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * width + x) * 4;
        if (src[i + 3]! < OPAQUE) continue;
        let tone: Rgb;
        if (!opaque(x - 1, y) || !opaque(x + 1, y) || !opaque(x, y - 1) || !opaque(x, y + 1)) {
          tone = ramp.rim;
        } else if (!textured) {
          tone = ramp.body;
        } else {
          const lum = (src[i]! * 299 + src[i + 1]! * 587 + src[i + 2]! * 114) / 1000;
          tone = lum < SHADOW_BELOW ? ramp.shadow : lum < BODY_BELOW ? ramp.body : ramp.highlight;
        }
        out[i] = tone[0];
        out[i + 1] = tone[1];
        out[i + 2] = tone[2];
        out[i + 3] = 255;
      }
    }
  }
  return out;
}

/**
 * Recoloured copies of atlases, one per (sheet, colour, variant), made on demand. A look's
 * sheet is a small layer over the base atlas: only the layer is recoloured, its fallback is the
 * recoloured base atlas shared by every look, so the echo of a runner in a look keeps the
 * look's shapes and costs little.
 */
export class EchoSheets {
  private readonly base: SceneRenderer;
  private readonly scenes = new Map<SceneRenderer, Map<string, SceneRenderer>>();
  private readonly sheets = new Map<SpriteSheet, Map<string, SpriteSheet>>();

  constructor(base: SceneRenderer) {
    this.base = base;
  }

  scene(color: EchoColor, textured: boolean, source: SceneRenderer = this.base): SceneRenderer {
    const key = `${color.id}:${textured ? 't' : 'f'}`;
    let byKey = this.scenes.get(source);
    if (!byKey) {
      byKey = new Map();
      this.scenes.set(source, byKey);
    }
    let scene = byKey.get(key);
    if (!scene) {
      const sheet = this.sheetFor(color, textured, source.sheet);
      scene = sheet === source.sheet ? source : source.withSheet(sheet);
      byKey.set(key, scene);
    }
    return scene;
  }

  /** `sheet` recoloured (and its fallbacks); the sheet itself without a canvas. */
  sheetFor(color: EchoColor, textured: boolean, sheet: SpriteSheet): SpriteSheet {
    const key = `${color.id}:${textured ? 't' : 'f'}`;
    let byKey = this.sheets.get(sheet);
    if (!byKey) {
      byKey = new Map();
      this.sheets.set(sheet, byKey);
    }
    let out = byKey.get(key);
    if (!out) {
      out = this.build(color, textured, sheet);
      byKey.set(key, out);
    }
    return out;
  }

  private build(color: EchoColor, textured: boolean, sheet: SpriteSheet): SpriteSheet {
    const fallback = sheet.fallback ? this.sheetFor(color, textured, sheet.fallback) : null;
    const image = sheet.image as CanvasImageSource & { width: number; height: number };
    const src = readPixels(image);
    if (!src) return sheet;
    const data = recolorEcho(src.data, src.width, src.height, color.ramp, textured, sheet.frames);
    const canvas = document.createElement('canvas');
    canvas.width = src.width;
    canvas.height = src.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return sheet;
    const out = ctx.createImageData(src.width, src.height);
    out.data.set(data);
    ctx.putImageData(out, 0, 0);
    return new SpriteSheet(canvas, sheet.frames, fallback);
  }
}
