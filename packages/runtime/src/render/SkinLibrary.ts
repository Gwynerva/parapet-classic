/**
 * The characters the runtime can draw: the original's ten (body-part swaps on the base atlas,
 * `skinSwap`) and characters wearing looks (`Look.ts`). A character may have several outfits
 * (looks), one of which is picked for each run by whoever starts it. Each look becomes a small
 * layer of its own pictures over the base atlas, built the first time it is drawn. A character
 * a client does not know (a replay from a newer version) is drawn as Blaise.
 */
import { skinSwap } from './CharacterRenderer.ts';
import type { ResolvedLook } from './Look.ts';
import { buildLookLayer, lookSwap, type LookLayer } from './LookSheet.ts';
import type { SceneRenderer, SpriteSwap } from './SceneRenderer.ts';
import { SpriteSheet } from './SpriteSheet.ts';

/** Characters 0..9 are the original's (`skins.json`). */
export const ORIGINAL_CHARACTERS = 10;

/** What `CharacterRenderer` needs to draw a character. */
export interface CharacterSkins {
  /** The scene renderer whose atlas holds the character's sprites in `outfit`. */
  sceneFor(character: number, outfit?: number): SceneRenderer;
  /** The body-part swap of a character this frame (`face`: the face sprite, or -1). */
  swapFor(character: number, face?: number, outfit?: number): SpriteSwap;
}

/** Reads the RGBA pixels of an image through a canvas (null without a 2D context). */
export function readPixels(
  image: CanvasImageSource & { width: number; height: number },
): ImageData | null {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(image, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/** A built look: its layer and the renderer drawing from it. */
interface Built {
  layer: LookLayer | null;
  scene: SceneRenderer;
  swaps: Map<number, SpriteSwap>;
}

export class SkinLibrary implements CharacterSkins {
  readonly base: SceneRenderer;
  private readonly outfits = new Map<number, readonly ResolvedLook[]>();
  private readonly built = new Map<string, Built>();
  private pixels: ImageData | null = null;

  constructor(base: SceneRenderer) {
    this.base = base;
  }

  /** Makes `character` (≥ 10) wear one of `looks`. Several characters may share looks. */
  setOutfits(character: number, looks: readonly ResolvedLook[]): void {
    if (character < ORIGINAL_CHARACTERS) throw new Error(`character ${character} is an original`);
    if (looks.length === 0) this.outfits.delete(character);
    else this.outfits.set(character, looks);
  }

  /** How many outfits a character has (0 for the originals and unknown characters). */
  outfitCount(character: number): number {
    return this.outfits.get(character)?.length ?? 0;
  }

  lookOf(character: number, outfit = 0): ResolvedLook | undefined {
    const looks = this.outfits.get(character);
    if (!looks) return undefined;
    return looks[((outfit % looks.length) + looks.length) % looks.length];
  }

  has(character: number): boolean {
    return (character >= 0 && character < ORIGINAL_CHARACTERS) || this.outfits.has(character);
  }

  swapBase(character: number): number {
    if (character >= 0 && character < ORIGINAL_CHARACTERS) return character;
    return this.lookOf(character)?.base ?? 0;
  }

  swapFor(character: number, face = -1, outfit = 0): SpriteSwap {
    const look = this.lookOf(character, outfit);
    if (!look) return skinSwap(this.swapBase(character), face);
    const built = this.build(look);
    let swap = built.swaps.get(face);
    if (!swap) {
      swap = built.layer ? lookSwap(built.layer, face) : skinSwap(look.base, face);
      built.swaps.set(face, swap);
    }
    return swap;
  }

  sceneFor(character: number, outfit = 0): SceneRenderer {
    const look = this.lookOf(character, outfit);
    return look ? this.build(look).scene : this.base;
  }

  /** The layer of a look, built if needed (null without a canvas). */
  layerOf(look: ResolvedLook): LookLayer | null {
    return this.build(look).layer;
  }

  private build(look: ResolvedLook): Built {
    let built = this.built.get(look.id);
    if (built) return built;
    built = { layer: null, scene: this.base, swaps: new Map() };
    this.built.set(look.id, built);
    const image = this.base.sheet.image as CanvasImageSource & { width: number; height: number };
    this.pixels ??= readPixels(image);
    const src = this.pixels;
    if (!src) return built;
    const layer = buildLookLayer(
      {
        image: { width: src.width, height: src.height, data: src.data },
        frames: this.base.sheet.frames,
      },
      look,
    );
    for (const p of layer.problems) console.warn(`look ${look.id}: ${p}`);
    const canvas = document.createElement('canvas');
    canvas.width = layer.width;
    canvas.height = layer.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return built;
    const data = ctx.createImageData(layer.width, layer.height);
    data.data.set(layer.data);
    ctx.putImageData(data, 0, 0);
    built.layer = layer;
    built.scene = this.base.withSheet(new SpriteSheet(canvas, layer.frames, this.base.sheet));
    return built;
  }
}
