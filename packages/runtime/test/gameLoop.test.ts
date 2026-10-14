import { describe, expect, it } from 'vitest';
import { FixedStepClock, FrameUnits, originalFrameUnits } from '../src/app/GameLoop.ts';

/** Steps a clock runs in `seconds` of frames at `fps`. */
function stepsAt(fps: number, seconds: number): number {
  const clock = new FixedStepClock();
  let steps = 0;
  for (let i = 0; i < fps * seconds; i++) steps += clock.advance(1000 / fps, { step: () => true });
  return steps;
}

describe('the frame clock', () => {
  it('keeps the original’s own pace at any frame rate', () => {
    // 10 s of game time at 900/1024 of real time, a step every 30 units.
    const own = Math.floor((10000 * 900) / 1024 / 30);
    for (const fps of [20, 30, 60, 75, 120, 144, 165, 240, 360]) {
      expect(stepsAt(fps, 10), `${fps} fps`).toBe(own);
    }
  });

  it('still plays a slow device in slow motion: at most 150 units a frame', () => {
    const units = new FrameUnits();
    expect(units.take(250)).toBe(150);
    expect(units.fraction).toBe(0);
    expect(stepsAt(4, 10)).toBe(200);
  });

  it('carries the fraction the original cut', () => {
    const units = new FrameUnits();
    const frames = Array.from({ length: 60 }, () => units.take(1000 / 60));
    expect(frames.reduce((a, b) => a + b, 0)).toBe(Math.floor((1000 * 900) / 1024));
    expect(new Set(frames)).toEqual(new Set([14, 15]));
  });

  it('knows what the original made of a frame', () => {
    expect(originalFrameUnits(1000 / 60)).toBe(14);
    expect(originalFrameUnits(250)).toBe(150);
    expect(originalFrameUnits(1)).toBe(0);
  });
});
