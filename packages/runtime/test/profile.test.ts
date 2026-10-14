import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearRecords,
  completeMission,
  isBetterRecord,
  isContestBeaten,
  isLevelComplete,
  isLevelUnlocked,
  loadContestProgress,
  loadContestRecord,
  loadOptions,
  loadProgress,
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
    simVersion: 'parapet-sim@test',
    date: '2026-10-14T00:00:00.000Z',
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

  it('keeps the music level, 40 % by default', () => {
    expect(loadOptions().musicLevel).toBe(40);
    saveOptions({ musicLevel: 70 });
    expect(loadOptions().musicLevel).toBe(70);
    store.setItem('parapet.options', JSON.stringify({ v: 1, data: { musicLevel: 140 } }));
    expect(loadOptions().musicLevel).toBe(100);
  });

  it('ignores entries of another schema and records without their version', () => {
    store.setItem('parapet.options', JSON.stringify({ v: 2, data: { vibration: false } }));
    expect(loadOptions().vibration).toBe(true);
    saveOptions({ vibration: false });
    expect(loadOptions().vibration).toBe(false);
    const { simVersion: _, ...old } = entry({});
    store.setItem('parapet.record.contest.1.flags', JSON.stringify({ v: 1, data: old }));
    expect(loadContestRecord(1, 'flags')).toBeNull();
  });

  it('wants full screen on touch screens unless told otherwise', () => {
    expect(loadOptions().fullscreen).toBe('auto');
    expect(wantsFullscreen(loadOptions(), true)).toBe(true);
    expect(wantsFullscreen(loadOptions(), false)).toBe(false);
    saveOptions({ fullscreen: 'off' });
    expect(wantsFullscreen(loadOptions(), true)).toBe(false);
  });

  it('has no language until the first launch picks one', () => {
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
    markContestBeaten(2, 'sprint');
    clearRecords();
    expect(loadContestRecord(2, 'sprint')).toBeNull();
    expect(isContestBeaten(loadContestProgress(), 2, 'sprint')).toBe(true);
  });

  it('opens a level once every mission of the one before is done, in any order', () => {
    const levels = [{ missionCount: 3 }, { missionCount: 2 }, { missionCount: 2 }];
    const open = (id: number): boolean => isLevelUnlocked(loadProgress(), levels, id);
    expect([open(0), open(1), open(2)]).toEqual([true, false, false]);
    completeMission(0, 2);
    completeMission(0, 0);
    expect(open(1)).toBe(false);
    expect(completeMission(0, 1).firstTime).toBe(true);
    expect(isLevelComplete(loadProgress(), levels, 0)).toBe(true);
    expect([open(1), open(2)]).toEqual([true, false]);
    // A mission done on a level not open yet (a race from a link) does not open it.
    completeMission(2, 1);
    expect(open(2)).toBe(false);
    expect(isLevelComplete(loadProgress(), levels, 1)).toBe(false);
  });
});
