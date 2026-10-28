/**
 * Writes the data blob the native simulation (packages/tools/native/sim.c) loads: one level in
 * one contest mode, as the TS `Engine` sees it. Everything is little-endian int32:
 *
 *   magic 'PARC' (0x50415243), version 1, STATE_INTS
 *   missionType, flagCount, hasFinish, finishX, finishY
 *   width, height, tiles[width*height] (checkpoints stamped, birds removed), killRows[width]
 *   tables F, A, B, G, C, D, E, H: each as length, values
 *   sine[512]
 *   moveCount, then per move: duration, next, impulseType, paramB, paramC, paramD, flags,
 *     snapType, parent, transitionCount, then per transition: target, conditionCount, conditions
 *   live[moveCount] (liveBuffer masks)
 *   startRow[STATE_INTS]
 *   magic again
 *
 * Usage: node packages/tools/src/optimal/exportNative.ts <level> <flags|sprint> <out.bin>
 */
import { writeFileSync } from 'node:fs';
import { Engine, liveBuffer, STATE_INTS } from './engine.ts';
import { levelContent } from '../tas/content.ts';
import type { ContestMode } from '../tas/model.ts';

const MAGIC = 0x50415243;
const VERSION = 1;

/** The blob for `levelId` in `mode`. */
export function nativeBlob(levelId: number, mode: ContestMode): Int32Array {
  const content = levelContent(levelId);
  const engine = new Engine(content, mode);
  const world = engine.world;
  const level = world.level;
  const tables = world.tables;
  const out: number[] = [];
  const push = (...v: number[]): void => {
    for (const x of v) out.push(x | 0);
  };
  push(MAGIC, VERSION, STATE_INTS);
  // A fresh engine has not loaded any row yet: its flag count is the run's.
  push(engine.rules.missionType, engine.rules.flagsLeft);
  const finish = level.finish;
  push(finish ? 1 : 0, finish?.x ?? 0, finish?.y ?? 0);
  push(level.width, level.height);
  for (const t of level.tiles) push(t);
  for (const k of level.killRows) push(k);
  for (const name of ['F', 'A', 'B', 'G', 'C', 'D', 'E', 'H'] as const) {
    const t = tables[name];
    push(t.length, ...t);
  }
  if (world.sine.length !== 512) throw new Error('sine table must have 512 entries');
  for (const s of world.sine) push(s);
  const states = content.moves.states;
  push(states.length);
  states.forEach((m, i) => {
    if (m.id !== i) throw new Error(`move ${i} has id ${m.id}`);
    push(m.duration, m.next, m.impulseType, m.paramB, m.paramC, m.paramD, m.flags);
    push(m.snapType, m.parent, m.transitions.length);
    for (const t of m.transitions) push(t.target, t.conditions.length, ...t.conditions);
  });
  for (const v of liveBuffer(content.moves)) push(v);
  const start = new Int32Array(STATE_INTS);
  engine.start(start);
  push(...start);
  push(MAGIC);
  return Int32Array.from(out);
}

/** Writes the blob for `levelId` in `mode` to `path`. */
export function writeNativeBlob(levelId: number, mode: ContestMode, path: string): void {
  const blob = nativeBlob(levelId, mode);
  writeFileSync(path, new Uint8Array(blob.buffer, blob.byteOffset, blob.byteLength));
}

if (import.meta.main) {
  const [level, mode, path] = process.argv.slice(2);
  if (level === undefined || (mode !== 'flags' && mode !== 'sprint') || !path) {
    console.error('usage: node exportNative.ts <level> <flags|sprint> <out.bin>');
    process.exit(2);
  }
  writeNativeBlob(Number(level), mode, path);
  console.log(`wrote ${path}`);
}
