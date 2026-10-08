/**
 * Full screen and the installed app. The Fullscreen API only works from a user gesture and is
 * missing on iPhones (only the home-screen app runs without browser bars there). An installed
 * app (started from the home screen or the app list) already has the whole screen and offers
 * nothing of this.
 */

type FullscreenDocument = Document & {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type FullscreenElement = Element & {
  webkitRequestFullscreen?: (options?: FullscreenOptions) => Promise<void> | void;
};

/** Called with the new state and whether the player left full screen by the browser's means. */
export type FullscreenListener = (active: boolean, byUser: boolean) => void;

export class Fullscreen {
  private readonly doc: FullscreenDocument;
  private readonly listeners = new Set<FullscreenListener>();
  /** We asked to leave (the change that follows is ours, not the player's). */
  private leaving = false;
  /** When we last asked to enter (a toggle right after an automatic enter is ignored). */
  private requestedAt = -Infinity;

  constructor(doc: Document = document) {
    this.doc = doc as FullscreenDocument;
    const onChange = (): void => {
      const active = this.active;
      const byUser = !active && !this.leaving;
      this.leaving = false;
      for (const listener of this.listeners) listener(active, byUser);
    };
    this.doc.addEventListener('fullscreenchange', onChange);
    this.doc.addEventListener('webkitfullscreenchange', onChange);
  }

  get supported(): boolean {
    return Boolean(this.doc.fullscreenEnabled ?? this.doc.webkitFullscreenEnabled);
  }

  get active(): boolean {
    return Boolean(this.doc.fullscreenElement ?? this.doc.webkitFullscreenElement);
  }

  onChange(listener: FullscreenListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Enters full screen; call from a user gesture. Resolves to whether it worked. */
  async request(now = performance.now()): Promise<boolean> {
    if (!this.supported || this.active) return this.active;
    this.requestedAt = now;
    // The whole page, not the canvas: the name field (an HTML input) must stay visible.
    const el = this.doc.documentElement as FullscreenElement;
    try {
      if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
      else await el.webkitRequestFullscreen?.();
      return this.active;
    } catch {
      return false;
    }
  }

  async exit(): Promise<void> {
    if (!this.active) return;
    this.leaving = true;
    try {
      if (this.doc.exitFullscreen) await this.doc.exitFullscreen();
      else await this.doc.webkitExitFullscreen?.();
    } catch {
      this.leaving = false;
    }
  }

  /** Switches; a toggle right after an automatic enter (the same tap) does nothing. */
  toggle(now = performance.now()): void {
    if (now - this.requestedAt < 400) return;
    if (this.active) void this.exit();
    else void this.request(now);
  }
}

export interface DisplayEnvironment {
  search: string;
  matchMedia?: (query: string) => { matches: boolean };
  fullscreenElement: Element | null;
  standalone?: boolean;
}

/** Marker in the manifest's `start_url`: the page was opened as the installed app. */
export const APP_MARKER = 'app';

/**
 * Whether the game runs as the installed app (from the home screen or the app list): it has
 * the whole window and can be closed by script. Full screen entered from a tab does not count.
 */
export function isInstalledApp(env: DisplayEnvironment = browserDisplay()): boolean {
  if (new URLSearchParams(env.search).get(APP_MARKER) === '1') return true;
  if (env.standalone) return true;
  const mode = (query: string): boolean => env.matchMedia?.(query).matches ?? false;
  if (mode('(display-mode: standalone)') || mode('(display-mode: minimal-ui)')) return true;
  return mode('(display-mode: fullscreen)') && env.fullscreenElement === null;
}

function browserDisplay(): DisplayEnvironment {
  return {
    search: location.search,
    matchMedia: typeof window.matchMedia === 'function' ? (q) => window.matchMedia(q) : undefined,
    fullscreenElement: document.fullscreenElement,
    standalone: (navigator as { standalone?: boolean }).standalone,
  };
}

/** iPhones and iPads (iPadOS reports a Mac with a touch screen). */
export function isIOS(
  nav: { userAgent: string; platform?: string; maxTouchPoints?: number } = navigator,
): boolean {
  if (/iPhone|iPad|iPod/.test(nav.userAgent)) return true;
  return nav.platform === 'MacIntel' && (nav.maxTouchPoints ?? 0) > 1;
}
