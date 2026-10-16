// Paints canvases into PNG files with a headless Chrome (or Edge) over the DevTools protocol,
// using Node's own fetch and WebSocket (no packages). Transparent where nothing is painted.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CANDIDATES = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Evaluates `source` (drawing functions) in a page that has loaded `fontsCss`, then for each
 * job paints a `w` x `h` canvas with `call` (an expression using `ctx`) and saves it to `out`.
 */
export async function renderCanvases({ source, fontsCss, jobs }) {
  const chrome = CANDIDATES.find((p) => existsSync(p));
  if (!chrome) throw new Error('no Chrome or Edge found: set CHROME to its executable');
  const profile = mkdtempSync(join(tmpdir(), 'parapet-emulator-chrome-'));
  const port = 9400 + Math.floor(Math.random() * 400);
  const proc = spawn(
    chrome,
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      'about:blank',
    ],
    { stdio: 'ignore' },
  );
  try {
    let version;
    for (let i = 0; i < 100 && !version; i++) {
      try {
        version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
      } catch {
        await sleep(100);
      }
    }
    if (!version) throw new Error('Chrome did not start');
    const target = await (
      await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })
    ).json();
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      ws.onopen = res;
      ws.onerror = rej;
    });
    let id = 0;
    const pending = new Map();
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      const p = pending.get(m.id);
      if (!p) return;
      pending.delete(m.id);
      m.error ? p.rej(new Error(m.error.message)) : p.res(m.result);
    };
    const send = (method, params = {}) =>
      new Promise((res, rej) => {
        const i = ++id;
        pending.set(i, { res, rej });
        ws.send(JSON.stringify({ id: i, method, params }));
      });
    const evaluate = async (expression) => {
      const r = await send('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
      });
      if (r.exceptionDetails)
        throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
      return r.result.value;
    };
    await send('Page.enable');
    const { frameTree } = await send('Page.getFrameTree');
    const link = fontsCss ? `<link rel="stylesheet" href="${fontsCss}">` : '';
    await send('Page.setDocumentContent', {
      frameId: frameTree.frame.id,
      html: `<!doctype html><html><head>${link}</head><body></body></html>`,
    });
    await evaluate(`(async () => {
      for (let i = 0; i < 50 && !document.styleSheets.length; i++) await new Promise((r) => setTimeout(r, 100));
      const probes = ['600 18px "Exo 2"', '500 13px "Exo 2"'];
      await Promise.race([Promise.all(probes.map((f) => document.fonts.load(f))), new Promise((r) => setTimeout(r, 4000))]);
      return true;
    })()`);
    await evaluate(`${source}\nwindow.__draw = { drawPhone, drawGlass, drawPressed }; true`);
    for (const job of jobs) {
      const url = await evaluate(`(() => {
        const { drawPhone, drawGlass, drawPressed } = window.__draw;
        const cv = document.createElement('canvas');
        cv.width = ${Math.ceil(job.w)}; cv.height = ${Math.ceil(job.h)};
        const ctx = cv.getContext('2d');
        ${job.call};
        return cv.toDataURL('image/png');
      })()`);
      writeFileSync(job.out, Buffer.from(url.split(',')[1], 'base64'));
    }
    ws.close();
  } finally {
    proc.kill();
    await sleep(300);
    try {
      rmSync(profile, { recursive: true, force: true });
    } catch {}
  }
}
