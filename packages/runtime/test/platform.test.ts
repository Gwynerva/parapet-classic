import { describe, expect, it } from 'vitest';
import { HistoryGuard, LEAVE_WINDOW_MS, type HistoryWindow } from '../src/platform/HistoryGuard.ts';
import { isInstalledApp, isIOS } from '../src/platform/fullscreen.ts';

/** A browser history in memory: entries with state and hash, Back fires `popstate`. */
class FakeWindow implements HistoryWindow {
  entries: { state: unknown; hash: string }[] = [{ state: null, hash: '' }];
  index = 0;
  left = false;
  private listeners: ((e: PopStateEvent) => void)[] = [];
  readonly history = {
    state: null as unknown,
    pushState: (data: unknown): void => {
      this.entries.splice(this.index + 1);
      this.entries.push({ state: data, hash: this.location.hash });
      this.index++;
      this.sync();
    },
  };
  readonly location = { hash: '' };

  private sync(): void {
    this.history.state = this.entries[this.index]!.state;
    this.location.hash = this.entries[this.index]!.hash;
  }

  addEventListener(_: 'popstate', listener: (e: PopStateEvent) => void): void {
    this.listeners.push(listener);
  }

  removeEventListener(_: 'popstate', listener: (e: PopStateEvent) => void): void {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }

  back(): void {
    if (this.index === 0) {
      this.left = true;
      return;
    }
    this.index--;
    this.sync();
    for (const l of this.listeners) l({} as PopStateEvent);
  }

  navigateHash(hash: string): void {
    this.entries.splice(this.index + 1);
    this.entries.push({ state: null, hash });
    this.index++;
    this.sync();
  }
}

describe('HistoryGuard', () => {
  it('turns Back into the game action and stays on the page', () => {
    const win = new FakeWindow();
    let backs = 0;
    const guard = new HistoryGuard(win, () => {
      backs++;
      return 'stay';
    });
    expect(guard.armed).toBe(false);
    guard.arm();
    expect(guard.armed).toBe(true);
    win.back();
    win.back();
    win.back();
    expect(backs).toBe(3);
    expect(win.left).toBe(false);
    expect(win.entries.length).toBe(2);
  });

  it('lets the next Back leave after a warning, then guards again', () => {
    const win = new FakeWindow();
    let now = 0;
    const guard = new HistoryGuard(
      win,
      () => 'leave',
      () => now,
    );
    guard.arm();
    win.back();
    expect(win.left).toBe(false);
    // Within the window the guard does not come back: Back leaves.
    guard.arm();
    win.back();
    expect(win.left).toBe(true);
    win.left = false;
    now += LEAVE_WINDOW_MS;
    guard.arm();
    expect(guard.armed).toBe(true);
  });

  it('leaves challenge links to the game', () => {
    const win = new FakeWindow();
    let backs = 0;
    const guard = new HistoryGuard(win, () => {
      backs++;
      return 'stay';
    });
    guard.arm();
    win.navigateHash('#r=abc');
    win.navigateHash('#r=def');
    win.back();
    expect(backs).toBe(0);
  });
});

describe('installed app', () => {
  const media =
    (modes: string[]) =>
    (q: string): { matches: boolean } => ({
      matches: modes.some((m) => q.includes(m)),
    });

  it('recognises the start URL, standalone modes and iOS home-screen apps', () => {
    expect(isInstalledApp({ search: '?app=1', fullscreenElement: null })).toBe(true);
    expect(
      isInstalledApp({ search: '', matchMedia: media(['standalone']), fullscreenElement: null }),
    ).toBe(true);
    expect(isInstalledApp({ search: '', standalone: true, fullscreenElement: null })).toBe(true);
    expect(isInstalledApp({ search: '', matchMedia: media([]), fullscreenElement: null })).toBe(
      false,
    );
  });

  it('does not count full screen entered from a tab', () => {
    const el = {} as Element;
    expect(
      isInstalledApp({ search: '', matchMedia: media(['fullscreen']), fullscreenElement: el }),
    ).toBe(false);
    expect(
      isInstalledApp({ search: '', matchMedia: media(['fullscreen']), fullscreenElement: null }),
    ).toBe(true);
  });

  it('knows iPhones and iPads', () => {
    expect(isIOS({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' })).toBe(
      true,
    );
    expect(
      isIOS({ userAgent: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel', maxTouchPoints: 5 }),
    ).toBe(true);
    expect(isIOS({ userAgent: 'Mozilla/5.0 (Linux; Android 15)', platform: 'Linux' })).toBe(false);
  });
});
