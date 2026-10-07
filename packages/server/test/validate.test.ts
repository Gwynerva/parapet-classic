import { describe, expect, it } from 'vitest';
import {
  MAX_INPUT_RUNS,
  MAX_NAME_LENGTH,
  MAX_STEPS,
  validateSubmission,
  type RunSubmission,
} from '@parapet/protocol';

function base(): RunSubmission {
  return {
    protocolVersion: 2,
    simVersion: 'parapet-sim@0.1.0',
    rulesetId: 'classic',
    contentHash: { level: 1, moves: 2, tables: 3 },
    levelId: 3,
    mode: 'flags',
    withRival: false,
    playerName: 'Alice',
    character: 2,
    input: [
      { ticks: 10, bits: 0 },
      { ticks: 3, bits: 17 },
    ],
    claimed: { finished: true, timeUp: false, time: 12345, score: 678, steps: 13, hash: 42 },
  };
}

/** `base()` with one field replaced, typed loosely so invalid values can be injected. */
function mutate(patch: Record<string, unknown>): unknown {
  return { ...base(), ...patch };
}

function error(value: unknown): string {
  const r = validateSubmission(value);
  expect(r.ok).toBe(false);
  return r.ok ? '' : r.error;
}

describe('validateSubmission', () => {
  it('accepts a well-formed submission and returns a normalised copy', () => {
    const value = { ...base(), playerName: '  Alice  ', extra: 'ignored' };
    const r = validateSubmission(value);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toEqual(base());
    expect(r.value).not.toBe(value);
    expect(r.value.input).not.toBe(value.input);
    expect('extra' in r.value).toBe(false);
  });

  it('rejects non-objects', () => {
    expect(error(null)).toMatch(/object/);
    expect(error('run')).toMatch(/object/);
    expect(error([])).toMatch(/object/);
  });

  it('checks the protocol version', () => {
    expect(error(mutate({ protocolVersion: 1 }))).toMatch(/protocolVersion/);
    expect(error(mutate({ protocolVersion: '2' }))).toMatch(/protocolVersion/);
  });

  it('checks the ruleset id and the content hashes', () => {
    expect(error(mutate({ rulesetId: '' }))).toMatch(/rulesetId/);
    expect(error(mutate({ rulesetId: 'Classic!' }))).toMatch(/rulesetId/);
    expect(error(mutate({ contentHash: null }))).toMatch(/contentHash/);
    expect(error(mutate({ contentHash: { level: 1, moves: -1, tables: 3 } }))).toMatch(
      /contentHash/,
    );
    expect(error(mutate({ contentHash: { level: 1, moves: 2 } }))).toMatch(/contentHash/);
  });

  it('checks simVersion, mode, withRival and character', () => {
    expect(error(mutate({ simVersion: '' }))).toMatch(/simVersion/);
    expect(error(mutate({ simVersion: 7 }))).toMatch(/simVersion/);
    expect(error(mutate({ mode: 'race' }))).toMatch(/mode/);
    expect(error(mutate({ withRival: 'yes' }))).toMatch(/withRival/);
    expect(error(mutate({ character: -1 }))).toMatch(/character/);
    expect(error(mutate({ character: 1.5 }))).toMatch(/character/);
    expect(validateSubmission(mutate({ mode: 'free' })).ok).toBe(true);
  });

  it('checks the level id range', () => {
    expect(error(mutate({ levelId: -1 }))).toMatch(/levelId/);
    expect(error(mutate({ levelId: 12 }))).toMatch(/levelId/);
    expect(error(mutate({ levelId: 1.5 }))).toMatch(/levelId/);
    expect(error(mutate({ levelId: '0' }))).toMatch(/levelId/);
    expect(validateSubmission(mutate({ levelId: 0 })).ok).toBe(true);
    expect(validateSubmission(mutate({ levelId: 11 })).ok).toBe(true);
  });

  it('trims and bounds the player name', () => {
    expect(error(mutate({ playerName: '   ' }))).toMatch(/playerName/);
    expect(error(mutate({ playerName: 'x'.repeat(MAX_NAME_LENGTH + 1) }))).toMatch(/playerName/);
    expect(error(mutate({ playerName: 'a\u0000b' }))).toMatch(/playerName/);
    expect(error(mutate({ playerName: 42 }))).toMatch(/playerName/);
    const r = validateSubmission(mutate({ playerName: ` ${'x'.repeat(MAX_NAME_LENGTH)} ` }));
    expect(r.ok).toBe(true);
  });

  it('checks the input log', () => {
    expect(error(mutate({ input: 'abc' }))).toMatch(/input/);
    expect(error(mutate({ input: [] }))).toMatch(/input/);
    expect(error(mutate({ input: [{ ticks: 0, bits: 0 }] }))).toMatch(/input\[0\]\.ticks/);
    expect(error(mutate({ input: [{ ticks: 2.5, bits: 0 }] }))).toMatch(/input\[0\]\.ticks/);
    expect(error(mutate({ input: [{ ticks: 1, bits: 64 }] }))).toMatch(/input\[0\]\.bits/);
    expect(error(mutate({ input: [{ ticks: 1, bits: -1 }] }))).toMatch(/input\[0\]\.bits/);
    expect(error(mutate({ input: [{ ticks: 1, bits: 0 }, null] }))).toMatch(/input\[1\]/);
    expect(error(mutate({ input: [{ ticks: 1 }] }))).toMatch(/input\[0\]\.bits/);
  });

  it('enforces the size limits', () => {
    const tooMany = Array.from({ length: MAX_INPUT_RUNS + 1 }, () => ({ ticks: 1, bits: 0 }));
    expect(error(mutate({ input: tooMany }))).toMatch(/at most/);
    const tooLong = [
      { ticks: MAX_STEPS, bits: 0 },
      { ticks: 1, bits: 1 },
    ];
    expect(error(mutate({ input: tooLong }))).toMatch(/steps/);
    expect(validateSubmission(mutate({ input: [{ ticks: MAX_STEPS, bits: 0 }] })).ok).toBe(true);
  });

  it('checks the claimed outcome', () => {
    const claim = base().claimed;
    expect(error(mutate({ claimed: null }))).toMatch(/claimed/);
    expect(error(mutate({ claimed: { ...claim, finished: 1 } }))).toMatch(/claimed\.finished/);
    expect(error(mutate({ claimed: { ...claim, timeUp: 'no' } }))).toMatch(/claimed\.timeUp/);
    expect(error(mutate({ claimed: { ...claim, time: -1 } }))).toMatch(/claimed\.time/);
    expect(error(mutate({ claimed: { ...claim, score: 1.5 } }))).toMatch(/claimed\.score/);
    expect(error(mutate({ claimed: { ...claim, steps: MAX_STEPS + 1 } }))).toMatch(
      /claimed\.steps/,
    );
    expect(error(mutate({ claimed: { ...claim, hash: -1 } }))).toMatch(/claimed\.hash/);
    expect(error(mutate({ claimed: { ...claim, hash: 2 ** 32 } }))).toMatch(/claimed\.hash/);
  });
});
