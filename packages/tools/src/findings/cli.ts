// Entry point: `npm run findings -- [<page>…] [--no-video] [--check]` (see USAGE).
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Finding } from '@parapet/lab/finding.ts';
import { Frame } from '@parapet/lab/frame.ts';
import { frameTimes, type ClipSpec } from '@parapet/lab/scene.ts';
import type { RgbaImage } from '@parapet/runtime/render/Raster.ts';
import { encodePng } from '../png.ts';
import { loadLab } from './content.ts';
import { encodeGif, encodeMp4, ffmpegVersion, frameHash, GIF_FPS } from './encode.ts';
import { galleryBlock } from './gallery.ts';
import { save, updateIndex, updateReadme, type Media } from './markdown.ts';
import { ALL_FINDINGS, FINDINGS_DIR, MANIFEST, readManifest, type PageEntry } from './pages.ts';

const USAGE = `usage: npm run findings -- [<page>…] [--no-video] [--check]

Measures every finding about the original on the real simulation and data, checks that each
still shows what its page says, and writes its charts (SVG) and animations (GIF and MP4) into
reference/findings/<page>/, with the measured numbers in its README and in manifest.json.

  <page>       a page's number or folder (3, 03-one-press-two-kicks); default: all
  --no-video   charts and numbers only (no ffmpeg needed)
  --check      write nothing: exit 1 when anything is out of date or a check fails

An animation is encoded again only when its frames change (a fingerprint of them is kept in
the manifest), so another ffmpeg build does not churn the binaries.`;

function selected(args: readonly string[]): Finding[] {
  const wanted = args.filter((a) => !a.startsWith('--'));
  if (wanted.length === 0) return [...ALL_FINDINGS];
  return wanted.map((w) => {
    const f = ALL_FINDINGS.find((x) => x.slug === w || Number(x.slug.slice(0, 2)) === Number(w));
    if (!f) throw new Error(`no finding ${w}`);
    return f;
  });
}

/** `image` as a PNG, `scale` times its size (nearest neighbour). */
function png(image: RgbaImage, scale: number): Uint8Array {
  const w = image.width * scale;
  const h = image.height * scale;
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = (((y / scale) | 0) * image.width + ((x / scale) | 0)) * 4;
      out.set(image.data.subarray(s, s + 4), (y * w + x) * 4);
    }
  }
  return encodePng(w, h, out);
}

/** A still of an animation for the gallery: its frame a little past the middle. */
function cover(clip: ClipSpec): Uint8Array {
  const times = frameTimes(clip.script, GIF_FPS);
  const frame = new Frame(clip.scene.width, clip.scene.height);
  clip.scene.draw(frame, times[Math.floor(times.length * 0.55)]!);
  return png(frame.img, clip.gifScale ?? 2);
}

/** Writes `bytes` to `path` unless it holds them already; returns whether it did (or would). */
function refresh(path: string, bytes: Uint8Array | string, check: boolean): boolean {
  const data = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes;
  const current = existsSync(path) ? new Uint8Array(readFileSync(path)) : null;
  if (current && Buffer.compare(current, data) === 0) return false;
  if (check) console.log(`${path} is out of date`);
  else writeFileSync(path, data);
  return true;
}

function size(path: string): number {
  return existsSync(path) ? statSync(path).size : 0;
}

async function main(argv: readonly string[]): Promise<number> {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(USAGE);
    return 0;
  }
  const check = argv.includes('--check');
  const video = !argv.includes('--no-video') && !check;
  const ffmpeg = video ? ffmpegVersion() : null;
  if (video && !ffmpeg) {
    console.error('ffmpeg not found (set FFMPEG or add it to PATH), or use --no-video');
    return 1;
  }
  const lab = loadLab();
  const manifest = readManifest();
  let failed = 0;
  let stale = 0;
  for (const f of selected(argv)) {
    const dir = join(FINDINGS_DIR, f.slug);
    const facts = f.facts(lab);
    const problems = f.checks(facts);
    if (problems.length > 0) {
      failed++;
      console.error(`${f.slug}: no longer shows what its page says:\n  ${problems.join('\n  ')}`);
      continue;
    }
    const before = manifest.pages[f.slug];
    const entry: PageEntry = {
      title: f.title,
      claim: f.claim,
      facts,
      charts: [],
      pictures: [],
      clips: {},
    };
    if (!check) mkdirSync(dir, { recursive: true });
    const charts = f.charts(lab, facts);
    const clips = f.clips(lab, facts);
    const pictures = f.pictures?.(lab, facts) ?? [];
    for (const chart of charts) {
      entry.charts.push(chart.name);
      if (refresh(join(dir, `${chart.name}.svg`), chart.svg, check)) stale++;
    }
    for (const pic of pictures) {
      entry.pictures.push(pic.name);
      if (refresh(join(dir, `${pic.name}.png`), png(pic.image, pic.scale ?? 2), check)) stale++;
    }
    if (clips[0] && refresh(join(dir, 'cover.png'), cover(clips[0]), check)) stale++;
    for (const clip of clips) {
      const hash = frameHash(clip);
      const gif = join(dir, `${clip.name}.gif`);
      const mp4 = join(dir, `${clip.name}.mp4`);
      const known = before?.clips[clip.name];
      const fresh = known?.hash === hash && size(gif) > 0 && size(mp4) > 0;
      if (!fresh) {
        stale++;
        if (check || !video) {
          console.log(`${f.slug}/${clip.name}: animation out of date`);
        } else {
          process.stdout.write(`${f.slug}/${clip.name}: encoding… `);
          await encodeGif(clip, gif);
          await encodeMp4(clip, mp4);
          console.log(
            `gif ${(size(gif) / 1e3).toFixed(0)} KB, mp4 ${(size(mp4) / 1e3).toFixed(0)} KB`,
          );
        }
      }
      entry.clips[clip.name] = {
        width: clip.scene.width,
        height: clip.scene.height,
        frames: frameTimes(clip.script, GIF_FPS).length,
        hash: fresh || video ? hash : (known?.hash ?? ''),
        gifBytes: size(gif),
        mp4Bytes: size(mp4),
      };
    }
    if (JSON.stringify(before) !== JSON.stringify(entry)) {
      stale++;
      if (check) console.log(`${f.slug}: manifest out of date`);
    }
    manifest.pages[f.slug] = entry;
    const media: Media[] = [
      ...clips.map((c) => ({ name: c.name, alt: c.alt, kind: 'clip' as const })),
      ...charts.map((c) => ({ name: c.name, alt: c.alt, kind: 'chart' as const })),
      ...pictures.map((p) => ({ name: p.name, alt: p.alt, kind: 'picture' as const })),
    ];
    if (!(await updateReadme(dir, f.title, f.claim, media, f.measured(facts), check))) stale++;
    console.log(`${f.slug}: ok`);
  }
  if (ffmpeg) manifest.ffmpeg = ffmpeg;
  if (!check) {
    const before = existsSync(MANIFEST) ? readFileSync(MANIFEST, 'utf8') : null;
    await save(MANIFEST, before, JSON.stringify(manifest), false);
  }
  const gallery = galleryBlock(
    ALL_FINDINGS.map((f) => ({ slug: f.slug, page: manifest.pages[f.slug] })),
  );
  if (!(await updateIndex(join(FINDINGS_DIR, 'README.md'), gallery, check))) stale++;
  if (failed > 0) return 1;
  return check && stale > 0 ? 1 : 0;
}

main(process.argv.slice(2)).then(
  (code) => (process.exitCode = code),
  (err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  },
);
