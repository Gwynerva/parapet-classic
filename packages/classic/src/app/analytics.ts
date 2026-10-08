/**
 * Anonymous counts for the author, when the build is set up for them (`VITE_GOATCOUNTER`: the
 * site's code at goatcounter.com, see `packages/classic/README.md`): a visit, and a few moments
 * of play, each at most once per visit: the first run, a level's mission won for the first time,
 * a boss beaten, the Prize, a race from a challenge link.
 *
 * GoatCounter keeps no cookies and nothing that tells one person from another; the count is a
 * 1×1 picture asked for by this code, no script from elsewhere. Nothing is counted on the dev
 * server, in a local copy, or when the browser asks not to be tracked (Do Not Track, Global
 * Privacy Control). A replay link's code (`#r=…`) never leaves: only the page's path does.
 */

const SITE = (import.meta.env.VITE_GOATCOUNTER ?? '').trim();
const sent = new Set<string>();

/** Whether counts go out from this page. */
function counting(): boolean {
  if (!/^[a-z0-9-]+$/.test(SITE) || import.meta.env.DEV) return false;
  if (location.protocol !== 'https:') return false;
  const host = location.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.localhost')) return false;
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.doNotTrack !== '1' && nav.globalPrivacyControl !== true;
}

function send(params: Record<string, string>): void {
  const query = new URLSearchParams({ ...params, rnd: Math.random().toString(36).slice(2) });
  const img = new Image();
  img.src = `https://${SITE}.goatcounter.com/count?${query.toString()}`;
}

/** Counts the visit (once). */
export function countVisit(): void {
  if (!counting() || sent.has('visit')) return;
  sent.add('visit');
  send({
    p: location.pathname,
    t: document.title,
    r: document.referrer,
    s: [screen.width, screen.height, window.devicePixelRatio || 1].join(','),
  });
}

/** Counts a moment of play (`play`, `boss/vera/flags`…), once per visit. */
export function countEvent(name: string): void {
  if (!counting() || sent.has(name)) return;
  sent.add(name);
  send({ p: name, t: name, e: 'true' });
}
