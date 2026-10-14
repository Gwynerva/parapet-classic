import { describe, expect, it } from 'vitest';
import {
  cleanReplayName,
  decodeReplay,
  encodeReplay,
  fromBase64Url,
  replayKeys,
  toBase64Url,
  type Replay,
} from '../src/replayCodec.ts';
import { MAX_STEPS } from '../src/replay.ts';
import { replayCompatibility } from '../src/verify.ts';

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

/** Play like a person: a press of one step every so often, one of the usual ones. */
function humanInput(presses: number): Replay['input'] {
  const usual = [1, 1, 2, 20, 24, 1, 36, 40];
  return Array.from({ length: presses * 2 }, (_, i) =>
    i % 2 === 0
      ? { ticks: 8 + ((i * 37) % 45), bits: 0 }
      : { ticks: 1, bits: usual[(i * 7) % usual.length]! },
  );
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

  it('has one spelling: set bits after the last byte are refused', () => {
    expect(fromBase64Url('AA')).toEqual(Uint8Array.of(0));
    expect(fromBase64Url('AB')).toBeNull();
    expect(fromBase64Url('AAB')).toBeNull();
  });
});

describe('replay codec', () => {
  it('round-trips a replay, versions and content as their keys', () => {
    const replay = sample();
    const code = encodeReplay(replay);
    expect(decodeReplay(code)).toEqual({
      ok: true,
      replay: {
        ...replay,
        contentHash: { level: 0, moves: 0, tables: 0 },
        keys: replayKeys(replay),
      },
    });
    // A decoded replay encodes back to the same code.
    const decoded = decodeReplay(code);
    expect(decoded.ok && encodeReplay(decoded.replay)).toBe(code);
  });

  it('round-trips any input: chords, long holds, pauses in a row, the step limit', () => {
    const inputs: Replay['input'][] = [
      [{ ticks: 1, bits: 0 }],
      [{ ticks: MAX_STEPS, bits: 63 }],
      [
        { ticks: 3, bits: 0 },
        { ticks: 2, bits: 0 },
        { ticks: 70000, bits: 5 },
        { ticks: 1, bits: 1 },
        { ticks: 1, bits: 2 },
        { ticks: 129990, bits: 0 },
      ],
      humanInput(300),
    ];
    for (const input of inputs) {
      const decoded = decodeReplay(encodeReplay(sample({ input })));
      expect(decoded.ok && decoded.replay.input).toEqual(input);
    }
  });

  it('keeps links short: half a minute of play under a hundred characters', () => {
    // Thirty presses with their pauses: the sprint of level 1 has twenty-eight.
    expect(encodeReplay(sample({ input: humanInput(30) })).length).toBeLessThan(100);
  });

  it('tells a replay of another build or of other content', () => {
    const replay = sample();
    const decode = (r: Replay): Replay => {
      const d = decodeReplay(encodeReplay(r));
      if (!d.ok) throw new Error(d.error);
      return d.replay;
    };
    expect(replayCompatibility(decode(replay), replay.contentHash)).toBe('ok');
    expect(replayCompatibility(decode(replay), { ...replay.contentHash, moves: 2 })).toBe(
      'content',
    );
    expect(
      replayCompatibility(decode(sample({ simVersion: 'parapet-sim@9' })), replay.contentHash),
    ).toBe('version');
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

  it('has one spelling of a code: no stray bits after the input', () => {
    const bytes = fromBase64Url(encodeReplay(sample({ input: [{ ticks: 1, bits: 1 }] })))!;
    const last = bytes[bytes.length - 1]!;
    // The input ends inside the last byte; its free low bits must stay zero.
    const free = last & -last ? Math.log2(last & -last) : 8;
    expect(free).toBeGreaterThan(0);
    const forged = Uint8Array.from(bytes);
    forged[forged.length - 1] = last | 1;
    expect(decodeReplay(toBase64Url(forged)).ok).toBe(false);
  });
});

describe('cleanReplayName', () => {
  it('drops control characters and caps the length', () => {
    expect(cleanReplayName('  Blaise\u0007  ')).toBe('Blaise');
    expect(Array.from(cleanReplayName('я'.repeat(40))).length).toBe(24);
  });
});
