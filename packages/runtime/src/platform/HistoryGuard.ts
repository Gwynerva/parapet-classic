/**
 * Keeps the phone's Back button (and the browser's) inside the game. After the first tap or
 * key press the guard adds one history entry of its own; Back then lands on the page itself
 * (a `popstate`), which the game turns into its own Back action, and the guard re-adds the
 * entry. When the game decides Back should leave (on the title screen, after a warning), the
 * guard stands aside for a moment so the next Back really leaves the page.
 *
 * Browsers skip history entries added without user interaction, which is why nothing is added
 * before the first gesture.
 */

export type BackDecision = 'stay' | 'leave';

export interface HistoryWindow {
  history: {
    readonly state: unknown;
    pushState(data: unknown, unused: string, url?: string | URL | null): void;
  };
  location: { readonly hash: string };
  addEventListener(type: 'popstate', listener: (event: PopStateEvent) => void): void;
  removeEventListener(type: 'popstate', listener: (event: PopStateEvent) => void): void;
}

/** How long after "press Back again" the guard stays away. */
export const LEAVE_WINDOW_MS = 2500;

const GUARD_STATE = { parapetGuard: 1 } as const;

function isGuard(state: unknown): boolean {
  return (
    typeof state === 'object' &&
    state !== null &&
    (state as { parapetGuard?: unknown }).parapetGuard === 1
  );
}

/** A challenge link (`#<code>`, `#r=<code>`) is a navigation the game handles itself. */
function isChallengeHash(hash: string): boolean {
  return hash.startsWith('#r=') || /^#[A-Za-z0-9_-]{12,}$/.test(hash);
}

export class HistoryGuard {
  private readonly win: HistoryWindow;
  private readonly onBack: () => BackDecision;
  private readonly now: () => number;
  /** No re-arming before this time (the player was told Back leaves). */
  private standAsideUntil = -Infinity;
  private disposed = false;
  private readonly onPopState = (): void => {
    if (this.disposed || isChallengeHash(this.win.location.hash)) return;
    if (this.now() < this.standAsideUntil) return;
    if (this.onBack() === 'leave') {
      this.standAsideUntil = this.now() + LEAVE_WINDOW_MS;
      return;
    }
    this.arm();
  };

  constructor(
    win: HistoryWindow,
    onBack: () => BackDecision,
    now: () => number = () => performance.now(),
  ) {
    this.win = win;
    this.onBack = onBack;
    this.now = now;
    win.addEventListener('popstate', this.onPopState);
  }

  /** Whether Back would land on the guard's entry now. */
  get armed(): boolean {
    return isGuard(this.win.history.state);
  }

  /**
   * Adds the guard's entry unless it is the current one; call from user input (the first
   * gesture and every one after a stand-aside).
   */
  arm(): void {
    if (this.disposed || this.armed || this.now() < this.standAsideUntil) return;
    this.win.history.pushState(GUARD_STATE, '');
  }

  /** Lets the next Back leave the page (the installed app's Exit). */
  standAside(ms = LEAVE_WINDOW_MS): void {
    this.standAsideUntil = this.now() + ms;
  }

  dispose(): void {
    this.disposed = true;
    this.win.removeEventListener('popstate', this.onPopState);
  }
}
