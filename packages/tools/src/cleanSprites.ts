/**
 * Clean-up of the menu icons of the original (sprites 141-150: the mission icons). They are
 * scanned sketches with a thick dark outline full of anti-aliasing speckles and a dozen
 * intermediate greys, which read as smudges on anything but the original's light cards.
 * The clean-up keeps the drawing and snaps every pixel to four tones (outline, shadow,
 * paper, ink colour), then removes single-pixel speckles inside the outline. Deterministic,
 * applied at extraction time, documented in packages/content/README.md.
 */

export const MENU_ICON_IDS: readonly number[] = [141, 142, 143, 144, 145, 146, 147, 148, 149, 150];

/** The four tones of a cleaned icon (RGB). */
export const ICON_TONES = {
  outline: [0x2a, 0x18, 0x15],
  shadow: [0x9a, 0x8c, 0x86],
  paper: [0xff, 0xff, 0xff],
  ink: [0xff, 0x41, 0x0e],
  inkShadow: [0xb8, 0x2c, 0x00],
} as const;

type Tone = keyof typeof ICON_TONES | 'none';

function classify(r: number, g: number, b: number, a: number): Tone {
  if (a < 128) return 'none';
  const luma = (r * 299 + g * 587 + b * 114) / 1000;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max === 0 ? 0 : (max - min) / max;
  if (saturation > 0.35 && max > 60) return luma > 110 ? 'ink' : 'inkShadow';
  if (luma < 90) return 'outline';
  if (luma < 170) return 'shadow';
  return 'paper';
}

/**
 * Snap `rgba` (straight alpha, row-major) to the icon tones in place and absorb single
 * speckles: a pixel whose tone differs from at least six of its eight neighbours takes the
 * majority tone (so light anti-aliasing dots inside the outline become outline).
 */
export function cleanMenuIcon(rgba: Uint8Array, width: number, height: number): void {
  const tones: Tone[] = new Array<Tone>(width * height);
  for (let i = 0; i < width * height; i++) {
    tones[i] = classify(rgba[i * 4]!, rgba[i * 4 + 1]!, rgba[i * 4 + 2]!, rgba[i * 4 + 3]!);
  }
  const smoothed = tones.slice();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (tones[i] === 'none') continue;
      const counts = new Map<Tone, number>();
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          const tone =
            nx < 0 || ny < 0 || nx >= width || ny >= height ? 'none' : tones[ny * width + nx]!;
          counts.set(tone, (counts.get(tone) ?? 0) + 1);
        }
      }
      let best: Tone = tones[i]!;
      let bestCount = 0;
      for (const [tone, n] of counts) {
        if (n > bestCount) {
          best = tone;
          bestCount = n;
        }
      }
      if (best !== tones[i] && best !== 'none' && bestCount >= 6) smoothed[i] = best;
    }
  }
  for (let i = 0; i < width * height; i++) {
    const tone = smoothed[i]!;
    if (tone === 'none') {
      rgba[i * 4 + 3] = 0;
      continue;
    }
    const [r, g, b] = ICON_TONES[tone];
    rgba[i * 4] = r;
    rgba[i * 4 + 1] = g;
    rgba[i * 4 + 2] = b;
    rgba[i * 4 + 3] = 255;
  }
}
