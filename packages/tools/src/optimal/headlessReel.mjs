// Renders a reel page in a headless Chrome (a background tab of a visible browser gets its
// timers throttled and renders many times slower). Waits for the video the dev server writes,
// then closes Chrome. Usage: node headlessReel.mjs <url> <expected .mp4 path> [timeoutSec=1800]
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [url, out, timeout = '1800'] = process.argv.slice(2);
const chrome = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => p && existsSync(p));
if (!chrome) throw new Error('no Chrome or Edge found');
const profile = mkdtempSync(join(tmpdir(), 'reel-chrome-'));
const before = existsSync(out) ? statSync(out).mtimeMs : 0;
const proc = spawn(
  chrome,
  [
    '--headless=new',
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--window-size=1280,720',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--autoplay-policy=no-user-gesture-required',
    url,
  ],
  { stdio: 'ignore' },
);
const started = Date.now();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastSize = -1;
for (;;) {
  await sleep(3000);
  if (existsSync(out) && statSync(out).mtimeMs > before) {
    // Wait until ffmpeg has finished writing it.
    const size = statSync(out).size;
    if (size === lastSize) break;
    lastSize = size;
    continue;
  }
  if (Date.now() - started > Number(timeout) * 1000) {
    proc.kill();
    throw new Error(`no ${out} after ${timeout} s`);
  }
}
proc.kill();
await sleep(1000);
rmSync(profile, { recursive: true, force: true });
console.log(
  `${out}: ${(statSync(out).size / 1e6).toFixed(1)} MB in ${Math.round((Date.now() - started) / 1000)} s`,
);
