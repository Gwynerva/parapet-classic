import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  dropLegacyEntries,
  isBetterRecord,
  loadOptions,
  saveOptions,
  type RecordEntry,
} from '../src/storage/profile.ts';

class MemoryStorage {
  private readonly map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  key(i: number): string | null {
    return [...this.map.keys()][i] ?? null;
  }
  getItem(k: string): string | null {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    this.map.set(k, v);
  }
  removeItem(k: string): void {
    this.map.delete(k);
  }
}

function entry(patch: Partial<RecordEntry>): RecordEntry {
  return {
    time: 30000,
    score: 100,
    finished: true,
    timeUp: false,
    input: [{ ticks: 1, bits: 0 }],
    playerName: '',
    character: 0,
    withRival: false,
    simVersion: '',
    date: '',
    ...patch,
  };
}

describe('profile', () => {
  let store: MemoryStorage;

  beforeEach(() => {
    store = new MemoryStorage();
    vi.stubGlobal('localStorage', store);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('drops the claimed identity of the leaderboard era', () => {
    store.setItem('parapet.identity', JSON.stringify({ v: 1, data: { name: 'a', token: 'b' } }));
    store.setItem('parapet.options', JSON.stringify({ v: 1, data: { vibration: false } }));
    dropLegacyEntries();
    expect(store.getItem('parapet.identity')).toBeNull();
    expect(loadOptions().vibration).toBe(false);
  });

  it('remembers the best-ghost switch, on by default', () => {
    expect(loadOptions().bestGhost).toBe(true);
    saveOptions({ bestGhost: false });
    expect(loadOptions().bestGhost).toBe(false);
  });

  it('ranks races by time and score runs by score', () => {
    expect(isBetterRecord('sprint', entry({ time: 29000 }), entry({}))).toBe(true);
    expect(isBetterRecord('sprint', entry({ time: 31000 }), entry({}))).toBe(false);
    expect(isBetterRecord('sprint', entry({ finished: false, time: 1 }), null)).toBe(false);
    expect(isBetterRecord('score', entry({ score: 101 }), entry({}))).toBe(true);
    expect(isBetterRecord('challenge', entry({ score: 50 }), entry({ score: 60 }), 8)).toBe(false);
    expect(isBetterRecord('free', entry({}), null)).toBe(false);
  });
});
