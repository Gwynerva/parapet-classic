/**
 * Moving pictures of the experiments. A scene can draw itself at any moment `t`, counted in
 * simulation steps (fractions glide between two steps); a clip plays a scene by a script of
 * segments (at the original's speed, slowed down, held still), and the timeline turns the
 * script into the moments of its frames at a frame rate. The GIFs, the MP4s and the Lab's
 * canvases all play scenes this way.
 */
import { STEP } from '@parapet/sim';
import { TIME_SCALE_NUM, TIME_SCALE_SHIFT } from '@parapet/runtime/app/GameLoop.ts';
import { Frame } from './frame.ts';
import { RGB } from './palette.ts';

export interface Scene {
  /** Size in logical pixels. */
  width: number;
  height: number;
  /** The moments it covers, in steps. */
  from: number;
  to: number;
  draw(frame: Frame, t: number): void;
}

/**
 * Scenes played together in a grid of `cols` columns, `gap` pixels apart (small multiples: the
 * same moment of every one). Each column is as wide as its widest scene, each row as tall as
 * its tallest.
 */
export function gridScene(scenes: readonly Scene[], cols: number, gap = 8): Scene {
  const rows = Math.ceil(scenes.length / cols);
  const colW = Array.from({ length: cols }, (_, c) =>
    Math.max(0, ...scenes.filter((_, i) => i % cols === c).map((s) => s.width)),
  );
  const rowH = Array.from({ length: rows }, (_, r) =>
    Math.max(0, ...scenes.slice(r * cols, r * cols + cols).map((s) => s.height)),
  );
  const offset = (sizes: number[], n: number): number =>
    sizes.slice(0, n).reduce((a, b) => a + b + gap, 0);
  const cells = scenes.map((s) => new Frame(s.width, s.height));
  return {
    width: offset(colW, cols) - gap,
    height: offset(rowH, rows) - gap,
    from: Math.min(...scenes.map((s) => s.from)),
    to: Math.max(...scenes.map((s) => s.to)),
    draw(frame: Frame, t: number) {
      frame.clear(RGB.line);
      scenes.forEach((s, i) => {
        const cell = cells[i]!;
        s.draw(cell, t);
        frame.blit(
          cell.img,
          0,
          0,
          s.width,
          s.height,
          offset(colW, i % cols),
          offset(rowH, Math.floor(i / cols)),
        );
      });
    },
  };
}

/** A stretch of a clip: the scene played from `from` to `to` (steps), or held at `at`. */
export type Segment = { from: number; to: number; speed?: number } | { at: number; holdMs: number };

export interface ClipSpec {
  /** File name stem (`kicks` → kicks.gif, kicks.mp4). */
  name: string;
  /** What the clip shows, for the page (`alt` text). */
  alt: string;
  scene: Scene;
  script: readonly Segment[];
  /** Magnification of the GIF (the MP4 is twice that). */
  gifScale?: number;
}

/**
 * Real milliseconds a step lasts in the original: a step is 30 units of game time, and game
 * time runs at 900/1024 of real time (`FixedStepClock`), so about 34.13 ms.
 */
export const STEP_MS = (STEP * (1 << TIME_SCALE_SHIFT)) / TIME_SCALE_NUM;

/** The moment of every frame of a script at `fps` frames per second. */
export function frameTimes(script: readonly Segment[], fps: number): number[] {
  const out: number[] = [];
  const frameMs = 1000 / fps;
  for (const seg of script) {
    if ('holdMs' in seg) {
      const n = Math.max(1, Math.round(seg.holdMs / frameMs));
      for (let i = 0; i < n; i++) out.push(seg.at);
      continue;
    }
    const speed = seg.speed ?? 1;
    const stepsPerFrame = (frameMs / STEP_MS) * speed;
    const n = Math.max(1, Math.round((seg.to - seg.from) / stepsPerFrame));
    for (let i = 0; i < n; i++) out.push(seg.from + ((seg.to - seg.from) * i) / n);
  }
  return out;
}

/** How long a script plays, in ms. */
export function scriptMs(script: readonly Segment[]): number {
  let ms = 0;
  for (const seg of script) {
    ms += 'holdMs' in seg ? seg.holdMs : ((seg.to - seg.from) * STEP_MS) / (seg.speed ?? 1);
  }
  return ms;
}
