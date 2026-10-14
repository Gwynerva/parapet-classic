/**
 * Where the visit counter takes its counts (`VITE_GOATCOUNTER`, see `analytics.ts`): a
 * goatcounter.com code, or the address of a GoatCounter of our own. Pure, so the build reads it
 * too (the counter's host joins the pictures the page may load).
 */

/** `https://<code>.goatcounter.com` for a code, else an `https://` address's origin; '' for none. */
export function counterOrigin(setting: string): string {
  const v = setting.trim();
  if (/^[a-z0-9-]+$/.test(v)) return `https://${v}.goatcounter.com`;
  try {
    const url = new URL(v);
    return url.protocol === 'https:' ? url.origin : '';
  } catch {
    return '';
  }
}
