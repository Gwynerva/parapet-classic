/**
 * The findings' animations: a clip's frames drawn by the Lab and fed to ffmpeg as raw RGBA,
 * magnified without smoothing, into a GIF (its own palette, no dithering: the pixel art stays
 * crisp) and an MP4 (H.264 for every browser and chat). ffmpeg comes from `FFMPEG` or the PATH.
 */
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { Frame } from '@parapet/lab/frame.ts';
import { frameTimes, type ClipSpec } from '@parapet/lab/scene.ts';

const FFMPEG = process.env.FFMPEG ?? 'ffmpeg';
export const GIF_FPS = 25;
export const MP4_FPS = 60;

/** The ffmpeg in use, its first line ("ffmpeg version 9.0.2-full_build…"), or null. */
export function ffmpegVersion(): string | null {
  const r = spawnSync(FFMPEG, ['-version'], { encoding: 'utf8' });
  return r.status === 0 ? (r.stdout.split('\n')[0] ?? '').trim() : null;
}

/** Draws every frame of `clip` at `fps` and hands it to `sink`. */
export async function renderFrames(
  clip: ClipSpec,
  fps: number,
  sink: (rgba: Uint8Array) => Promise<void> | void,
): Promise<number> {
  const times = frameTimes(clip.script, fps);
  const frame = new Frame(clip.scene.width, clip.scene.height);
  for (const t of times) {
    clip.scene.draw(frame, t);
    await sink(frame.img.data as Uint8Array);
  }
  return times.length;
}

/** A fingerprint of a clip's look: SHA-256 over every 10th GIF frame (tests compare it). */
export function frameHash(clip: ClipSpec): string {
  const hash = createHash('sha256');
  const times = frameTimes(clip.script, GIF_FPS);
  const frame = new Frame(clip.scene.width, clip.scene.height);
  hash.update(`${clip.scene.width}x${clip.scene.height}:${times.length}`);
  for (let i = 0; i < times.length; i += 10) {
    clip.scene.draw(frame, times[i]!);
    hash.update(frame.img.data);
  }
  return hash.digest('hex').slice(0, 16);
}

function run(
  args: string[],
  feed: (write: (chunk: Uint8Array) => Promise<void>) => Promise<void>,
): Promise<void> {
  return new Promise((done, fail) => {
    const ff = spawn(FFMPEG, args, { stdio: ['pipe', 'ignore', 'pipe'] });
    let errors = '';
    ff.stderr.on('data', (chunk: Buffer) => (errors += chunk.toString('utf8')));
    ff.on('error', fail);
    ff.on('close', (code) =>
      code === 0 ? done() : fail(new Error(`ffmpeg ${code}: ${errors.slice(-2000)}`)),
    );
    const write = (chunk: Uint8Array): Promise<void> =>
      new Promise((ok) => {
        if (ff.stdin.write(chunk)) ok();
        else ff.stdin.once('drain', () => ok());
      });
    feed(write).then(
      () => ff.stdin.end(),
      (err: unknown) => {
        ff.kill();
        fail(err);
      },
    );
  });
}

function input(clip: ClipSpec, fps: number): string[] {
  const { width, height } = clip.scene;
  return [
    '-y',
    '-v',
    'error',
    '-f',
    'rawvideo',
    '-pix_fmt',
    'rgba',
    '-s',
    `${width}x${height}`,
    '-framerate',
    String(fps),
    '-i',
    '-',
  ];
}

/** The clip as a looping GIF, `scale` times its logical size. */
export function encodeGif(clip: ClipSpec, out: string, scale = clip.gifScale ?? 2): Promise<void> {
  const filter =
    `scale=iw*${scale}:ih*${scale}:flags=neighbor,split[a][b];` +
    `[a]palettegen=max_colors=256:stats_mode=full:reserve_transparent=0[p];` +
    `[b][p]paletteuse=dither=none:diff_mode=rectangle`;
  return run([...input(clip, GIF_FPS), '-vf', filter, '-loop', '0', out], async (write) => {
    await renderFrames(clip, GIF_FPS, write);
  });
}

/** The clip as an H.264 MP4, twice the GIF's magnification. */
export function encodeMp4(
  clip: ClipSpec,
  out: string,
  scale = (clip.gifScale ?? 2) * 2,
): Promise<void> {
  const args = [
    ...input(clip, MP4_FPS),
    '-vf',
    `scale=iw*${scale}:ih*${scale}:flags=neighbor`,
    '-c:v',
    'libx264',
    '-preset',
    'veryslow',
    '-tune',
    'animation',
    '-crf',
    '20',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    out,
  ];
  return run(args, async (write) => {
    await renderFrames(clip, MP4_FPS, write);
  });
}
