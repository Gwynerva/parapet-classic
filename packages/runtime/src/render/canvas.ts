/**
 * Small canvas helpers shared by the renderers: reading an image's pixels, turning RGBA bytes
 * into a canvas, and the offscreen layer a see-through or hologram runner is drawn on first.
 */

type SizedImage = CanvasImageSource & { width: number; height: number };

/** Reads the RGBA pixels of an image through a canvas (null without a 2D context). */
export function readPixels(image: SizedImage): ImageData | null {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(image, 0, 0);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/** A canvas holding `data` (RGBA, `width` × `height`); null without a 2D context. */
export function rgbaToCanvas(
  width: number,
  height: number,
  data: Uint8Array | Uint8ClampedArray,
): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const image = ctx.createImageData(canvas.width, canvas.height);
  image.data.set(data.subarray(0, image.data.length));
  ctx.putImageData(image, 0, 0);
  return canvas;
}

/**
 * An offscreen layer of `width` × `height` without smoothing: `layer` itself when there is
 * one (resized if needed), else a new canvas. Null outside a browser.
 */
export function offscreenLayer(
  layer: HTMLCanvasElement | null,
  width: number,
  height: number,
): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const canvas = layer ?? document.createElement('canvas');
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.imageSmoothingEnabled = false;
  return canvas;
}
