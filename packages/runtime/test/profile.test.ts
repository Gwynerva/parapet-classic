import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearRecords,
  dropLegacyEntries,
  isBetterRecord,
  isContestBeaten,
  listRecords,
  loadContestProgress,
  loadContestRecord,
  loadOptions,
  markContestBeaten,
  saveOptions,
  updateContestRecord,
  type RecordEntry,
  wantsFullscreen,
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

  it('keeps the music volume of older schemas', () => {
    expect(loadOptions().musicLevel).toBe(70);
    store.setItem('parapet.options', JSON.stringify({ v: 1, data: { musicVolume: 4 } }));
    expect(loadOptions().musicLevel).toBe(70);
    store.setItem('parapet.options', JSON.stringify({ v: 1, data: { musicVolume: 8 } }));
    expect(loadOptions().musicLevel).toBe(100);
    store.setItem('parapet.options', JSON.stringify({ v: 1, data: { music: false } }));
    expect(loadOptions().musicLevel).toBe(0);
    saveOptions({ musicLevel: 35 });
    expect(loadOptions().musicLevel).toBe(35);
  });

  it('wants full screen on touch screens unless told otherwise', () => {
    expect(loadOptions().fullscreen).toBe('auto');
    expect(wantsFullscreen(loadOptions(), true)).toBe(true);
    expect(wantsFullscreen(loadOptions(), false)).toBe(false);
    saveOptions({ fullscreen: 'off' });
    expect(wantsFullscreen(loadOptions(), true)).toBe(false);
  });

  it('has no language until the first launch picks one; the old "auto" counts as none', () => {
    expect(loadOptions().locale).toBe('');
    store.setItem('parapet.options', JSON.stringify({ v: 1, data: { locale: 'auto' } }));
    expect(loadOptions().locale).toBe('');
    saveOptions({ locale: 'ru' });
    expect(loadOptions().locale).toBe('ru');
  });

  it('keeps wins over Gwynerva per level and mode', () => {
    expect(isContestBeaten(loadContestProgress(), 3, 'flags')).toBe(false);
    expect(markContestBeaten(3, 'flags')).toBe(true);
    expect(markContestBeaten(3, 'flags')).toBe(false);
    expect(markContestBeaten(11, 'sprint')).toBe(true);
    const progress = loadContestProgress();
    expect(isContestBeaten(progress, 3, 'flags')).toBe(true);
    expect(isContestBeaten(progress, 3, 'sprint')).toBe(false);
    expect(isContestBeaten(progress, 11, 'sprint')).toBe(true);
  });

  it('keeps the best contest run apart from the mission records', () => {
    expect(updateContestRecord(2, 'sprint', entry({ time: 40000 }))).toBe(true);
    expect(updateContestRecord(2, 'sprint', entry({ time: 41000 }))).toBe(false);
    expect(updateContestRecord(2, 'sprint', entry({ time: 39000 }))).toBe(true);
    expect(loadContestRecord(2, 'sprint')?.time).toBe(39000);
    expect(listRecords()).toEqual([]);
    markContestBeaten(2, 'sprint');
    clearRecords();
    expect(loadContestRecord(2, 'sprint')).toBeNull();
    expect(isContestBeaten(loadContestProgress(), 2, 'sprint')).toBe(true);
  });
});
