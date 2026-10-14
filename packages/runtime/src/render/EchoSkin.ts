/**
 * The "echo" skin of ghosts: the character atlas recoloured into a glowing hologram. Two
 * variants:
 *
 * - textured: every pixel's brightness picks one of three tones of a neon ramp (shadow, body,
 *   highlight), so faces, hair and clothes stay readable in one colour;
 * - flat: every pixel takes the body tone, which leaves a featureless silhouette (a boss
 *   still in the workshop; the original drew its story rivals so).
 *
 * In both, the outer edge of every sprite becomes a bright one-pixel rim. The colour of a
 * player's echo comes from their name, so the same name glows the same everywhere.
 */
import { fnv1a } from '@parapet/sim';
import type { AtlasFrame } from '../content/types.ts';
import type { SceneRenderer } from './SceneRenderer.ts';
import { SpriteSheet } from './SpriteSheet.ts';
import { readPixels, rgbaToCanvas } from './canvas.ts';
import { cssColor, mixRgb, rgbOf, type Rgb } from './color.ts';

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

const BLACK: Rgb = [0, 0, 0];
const WHITE: Rgb = [255, 255, 255];

/** An echo colour ramp built around one saturated tone (`id` names it in caches). */
export function makeEchoColor(id: string, hex: string): EchoColor {
  const body = rgbOf(hex);
  const rim = mixRgb(body, WHITE, 0.8);
  return {
    id,
    css: hex,
    light: cssColor(rim),
    ramp: { shadow: mixRgb(body, BLACK, 0.55), body, highlight: mixRgb(body, WHITE, 0.5), rim },
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

/** The grey the original drew its rivals in (the debug view still has it); never handed out. */
export const ECHO_GREY: EchoColor = {
  id: 'grey',
  css: '#a7b0ba',
  light: '#eef2f6',
  ramp: {
    shadow: rgbOf('#5d6670'),
    body: rgbOf('#a7b0ba'),
    highlight: rgbOf('#d3d9df'),
    rim: rgbOf('#eef2f6'),
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
  /** The pixels of every sheet recoloured so far, read once for all its colours. */
  private readonly pixels = new Map<SpriteSheet, ImageData | null>();

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
    let src = this.pixels.get(sheet);
    if (src === undefined) {
      src = readPixels(sheet.image as CanvasImageSource & { width: number; height: number });
      this.pixels.set(sheet, src);
    }
    if (!src) return sheet;
    const data = recolorEcho(src.data, src.width, src.height, color.ramp, textured, sheet.frames);
    const canvas = rgbaToCanvas(src.width, src.height, data);
    return canvas ? new SpriteSheet(canvas, sheet.frames, fallback) : sheet;
  }
}
