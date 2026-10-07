import { describe, expect, it } from 'vitest';
import {
  cleanReplayName,
  decodeReplay,
  encodeReplay,
  fromBase64Url,
  toBase64Url,
  type Replay,
} from '../src/replayCodec.ts';
import { MAX_STEPS } from '../src/replay.ts';

function sample(patch: Partial<Replay> = {}): Replay {
  return {
    simVersion: 'parapet-sim@0.2.0',
    rulesetId: 'classic',
    contentHash: { level: 0xdeadbeef, moves: 1, tables: 0xffffffff },
    levelId: 3,
    mode: 'sprint',
    withRival: true,
    character: 7,
    playerName: 'Вася_99',
    input: [
      { ticks: 6, bits: 24 },
      { ticks: 1, bits: 1 },
      { ticks: 40, bits: 0 },
      { ticks: 1, bits: 63 },
      { ticks: 199000, bits: 0 },
    ],
    ...patch,
  };
}

function varint(value: number): number[] {
  const out: number[] = [];
  let n = value;
  while (n >= 0x80) {
    out.push((n % 0x80) | 0x80);
    n = Math.floor(n / 0x80);
  }
  out.push(n);
  return out;
}

describe('base64url', () => {
  it('round-trips every length', () => {
    for (let n = 0; n < 20; n++) {
      const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 37 + 11) & 0xff);
      expect(fromBase64Url(toBase64Url(bytes))).toEqual(bytes);
    }
  });

  it('rejects foreign characters and impossible lengths', () => {
    expect(fromBase64Url('abc=')).toBeNull();
    expect(fromBase64Url('ab+c')).toBeNull();
    expect(fromBase64Url('abcde')).toBeNull();
    expect(fromBase64Url('ж')).toBeNull();
  });
});

describe('replay codec', () => {
  it('round-trips a replay', () => {
    const replay = sample();
    expect(decodeReplay(encodeReplay(replay))).toEqual({ ok: true, replay });
  });

  it('keeps a typical run short enough for a link', () => {
    const input = Array.from({ length: 400 }, (_, i) =>
      i % 2 === 0 ? { ticks: 1, bits: 1 + (i % 5) } : { ticks: 3 + (i % 17), bits: 0 },
    );
    expect(encodeReplay(sample({ input })).length).toBeLessThan(1200);
  });

  it('refuses to encode replays it could not decode', () => {
    expect(() => encodeReplay(sample({ mode: 'free' }))).toThrow();
    expect(() => encodeReplay(sample({ mode: 'flags', withRival: true }))).toThrow();
    expect(() => encodeReplay(sample({ input: [] }))).toThrow();
    expect(() => encodeReplay(sample({ input: [{ ticks: MAX_STEPS + 1, bits: 0 }] }))).toThrow();
    expect(() => encodeReplay(sample({ levelId: 12 }))).toThrow();
    expect(() => encodeReplay(sample({ playerName: 'a\nb' }))).toThrow();
  });

  it('never throws on garbage', () => {
    const code = encodeReplay(sample());
    const inputs = ['', 'A', 'AA', '!!!!', code.replace(/[A-Z]/g, 'z'), 'B' + code.slice(1)];
    for (let i = 0; i < code.length; i++) {
      const c = code[i] === 'A' ? 'B' : 'A';
      inputs.push(code.slice(0, i) + c + code.slice(i + 1));
      inputs.push(code.slice(0, i));
    }
    for (const text of inputs) {
      const result = decodeReplay(text);
      if (!result.ok) expect(typeof result.error).toBe('string');
    }
    expect(decodeReplay('').ok).toBe(false);
    expect(decodeReplay(code.slice(0, code.length - 3)).ok).toBe(false);
    expect(decodeReplay(code + 'AAAA').ok).toBe(false);
  });

  it('rejects input covering more than the step limit', () => {
    const bytes = fromBase64Url(encodeReplay(sample({ input: [{ ticks: 5, bits: 0 }] })))!;
    // Replace the run count and the single run (2 bytes) with one run of MAX_STEPS + 1 ticks.
    const forged = Uint8Array.from([
      ...bytes.subarray(0, bytes.length - 3),
      1,
      ...varint((MAX_STEPS + 1) * 64),
    ]);
    expect(decodeReplay(toBase64Url(forged)).ok).toBe(false);
  });
});

describe('cleanReplayName', () => {
  it('drops control characters and caps the length', () => {
    expect(cleanReplayName('  Blaise\u0007  ')).toBe('Blaise');
    expect(Array.from(cleanReplayName('я'.repeat(40))).length).toBe(24);
  });
});
