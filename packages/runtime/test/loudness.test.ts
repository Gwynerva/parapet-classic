import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  integratedLoudness,
  METER_RATE,
  synthFingerprint,
  tableGain,
  type LoudnessTable,
} from '../src/audio/LoudnessMeter.ts';
import { CONTEST_TRACK } from '../src/audio/MusicDirector.ts';
import { CONTENT_DIR, hasContent } from './helpers/content.ts';

const TABLE_FILE = fileURLToPath(new URL('../../content/audio/loudness.json', import.meta.url));

function sine(seconds: number, amplitude: number, hz = 997): Float32Array {
  const out = new Float32Array(Math.round(seconds * METER_RATE));
  for (let i = 0; i < out.length; i++)
    out[i] = amplitude * Math.sin((2 * Math.PI * hz * i) / METER_RATE);
  return out;
}

describe('integrated loudness', () => {
  it('reads a full-scale 997 Hz tone in one channel as -3 LUFS', () => {
    const silent = new Float32Array(METER_RATE * 3);
    expect(integratedLoudness([sine(3, 1), silent])).toBeCloseTo(-3.01, 1);
  });

  it('drops by 6 dB when the amplitude halves, and ignores silence', () => {
    const loud = integratedLoudness([sine(3, 1), sine(3, 1)]);
    const quiet = integratedLoudness([sine(3, 0.5), sine(3, 0.5)]);
    expect(loud - quiet).toBeCloseTo(6.02, 1);
    const silence = new Float32Array(METER_RATE * 2);
    expect(integratedLoudness([silence, silence])).toBe(-Infinity);
    // Gating: a long silence around a tone leaves its loudness alone.
    const padded = new Float32Array(METER_RATE * 9);
    padded.set(sine(3, 1), METER_RATE * 3);
    // (Only the blocks that straddle the tone's ends pull it down a little.)
    expect(Math.abs(integratedLoudness([padded, padded]) - loud)).toBeLessThan(0.6);
  });
});

describe.skipIf(!hasContent())('loudness table', () => {
  const table = JSON.parse(readFileSync(TABLE_FILE, 'utf8')) as LoudnessTable;

  it('was measured on the current synthesiser (re-measure on dev/loudness.html)', () => {
    expect(table.synth).toBe(synthFingerprint());
  });

  it('covers every bundled track and the contest theme', () => {
    const ids = readdirSync(join(CONTENT_DIR, 'music'))
      .map((f) => /^(\d+)\.mid$/.exec(f)?.[1])
      .filter((id): id is string => id !== undefined);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of [...ids, String(CONTEST_TRACK)]) {
      expect(Number.isFinite(table.tracks[id])).toBe(true);
      expect(tableGain(table, Number(id))).not.toBeNull();
    }
    expect(existsSync(TABLE_FILE)).toBe(true);
  });
});
