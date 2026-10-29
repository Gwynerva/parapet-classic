/**
 * The dev server's helpers (never in a build): `dev/` served at `/dev/`, the extracted sprites
 * at `/dev/sprites/<id>.png`, and the endpoints the development pages save through: an edited
 * look, the promo pictures, the TAS reel's videos and the music's measured loudness.
 */
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { dirname, extname, join } from 'node:path';
import type { Connect, Plugin } from 'vite';
import {
  ART_FILES,
  BOSSES,
  DEV_PAGES,
  LIVE_LOUDNESS_FILE,
  LOUDNESS_FILE,
  PLAYMAN,
  REEL_DIR,
} from './paths.ts';

/** A request the handler cannot take: answered with `status` and the message. */
class Refused extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type PostHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  query: URLSearchParams,
) => Promise<string>;

/**
 * A POST endpoint: the handler's text is the answer; a `Refused` answers with its status, any
 * other error with 500. Other methods pass on.
 */
function post(path: string, handler: PostHandler): [string, Connect.NextHandleFunction] {
  return [
    path,
    (req, res, next) => {
      if (req.method !== 'POST') return next();
      const query = new URL(req.url ?? '/', 'http://dev').searchParams;
      handler(req, res, query).then(
        (text) => res.end(text),
        (err: unknown) => {
          res.statusCode = err instanceof Refused ? err.status : 500;
          res.end(err instanceof Error ? err.message : String(err));
        },
      );
    },
  ];
}

/** Reads a request's body as text. */
function bodyOf(req: IncomingMessage): Promise<string> {
  return new Promise((done, fail) => {
    let body = '';
    req.on('data', (chunk: Buffer) => (body += chunk.toString('utf8')));
    req.on('end', () => done(body));
    req.on('error', fail);
  });
}

/** Writes a request's body into `file` (`a` appends); resolves with the file's path. */
async function writeBody(
  req: IncomingMessage,
  file: string,
  flags: 'w' | 'a' = 'w',
): Promise<string> {
  await mkdir(dirname(file), { recursive: true });
  return new Promise((done, fail) => {
    const out = createWriteStream(file, { flags });
    out.on('finish', () => done(file));
    out.on('error', fail);
    req.pipe(out);
  });
}

/** JSON as the repository keeps it: through Prettier, objects expanded. */
async function prettyJson(file: string, data: unknown): Promise<string> {
  const prettier = await import('prettier');
  const options = (await prettier.resolveConfig(file)) ?? {};
  return prettier.format(JSON.stringify(data, null, 2), { ...options, filepath: file });
}

/** The file of a look by its id, or null. */
async function lookFile(id: string): Promise<string | null> {
  for (const boss of await readdir(BOSSES, { withFileTypes: true })) {
    if (!boss.isDirectory()) continue;
    const file = join(BOSSES, boss.name, 'looks', `${id}.json`);
    try {
      await readFile(file);
      return file;
    } catch {
      // Not this boss's.
    }
  }
  return null;
}

/** Muxes an encoded H.264 or HEVC stream into an MP4 beside it with ffmpeg, then removes it. */
function muxVideo(stream: string, fps: number): Promise<string> {
  const video = stream.replace(/\.(?:h264|hevc)$/, '.mp4');
  const format = stream.endsWith('.hevc') ? 'hevc' : 'h264';
  const args = ['-y', '-v', 'error', '-f', format, '-i', stream, '-c', 'copy'];
  // Every frame on its own 1/fps tick: an encoder may write timing of its own into the stream
  // (the browser's software H.264 does, and the video then lasted under a second).
  args.push('-bsf:v', `setts=ts=N/${fps}/TB:duration=1/${fps}/TB`);
  args.push('-video_track_timescale', String(fps * 1000));
  if (format === 'hevc') args.push('-tag:v', 'hvc1');
  args.push('-movflags', '+faststart', video);
  return new Promise((done, fail) => {
    const ffmpeg = spawn(process.env.FFMPEG ?? 'ffmpeg', args);
    let errors = '';
    ffmpeg.stderr.on('data', (chunk: Buffer) => (errors += chunk.toString('utf8')));
    ffmpeg.on('error', fail);
    ffmpeg.on('close', (code) => {
      if (code !== 0) fail(new Error(`ffmpeg ${code}: ${errors}`));
      else rm(stream).then(() => done(video), fail);
    });
  });
}

const ID = /^[a-z][a-z0-9-]*$/;
const REEL_VIDEO = /^[\w.-]+\.(?:mp4|webm)$/;
const REEL_STREAM = /^[\w.-]+\.(?:h264|hevc)$/;

const ENDPOINTS = [
  // The looks page saves an edited outfit (dev/looks.html): an existing look only.
  post('/dev/save-look', async (req) => {
    const { id, data } = JSON.parse(await bodyOf(req)) as { id?: unknown; data?: { id?: unknown } };
    if (typeof id !== 'string' || !ID.test(id) || data?.id !== id)
      throw new Refused(400, 'not a look');
    const file = await lookFile(id);
    if (!file) throw new Refused(404, `no look ${id}`);
    await writeFile(file, await prettyJson(file, data));
    return 'saved';
  }),
  // The promo art page saves its pictures (dev/art.html): known names only.
  post('/dev/save-art', async (req) => {
    const { name, png } = JSON.parse(await bodyOf(req)) as { name?: string; png?: string };
    const file = name ? ART_FILES[name] : undefined;
    const data = /^data:image\/png;base64,(.+)$/.exec(png ?? '')?.[1];
    if (!file || !data) throw new Refused(400, 'not a picture of the page');
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, Buffer.from(data, 'base64'));
    return 'saved';
  }),
  // The TAS reel saves its recordings (dev/reel.html) next to the runs: git-ignored.
  post('/dev/save-reel', async (req, _res, q) => {
    const name = q.get('name') ?? '';
    if (!REEL_VIDEO.test(name)) throw new Refused(400, 'not a video name');
    return writeBody(req, join(REEL_DIR, name));
  }),
  // Its frame-exact renders (`render=1`): the encoded stream comes in parts, then ffmpeg muxes
  // it into an MP4 beside the recordings.
  post('/dev/reel-stream', async (req, _res, q) => {
    const name = q.get('name') ?? '';
    const part = Number(q.get('part'));
    if (!REEL_STREAM.test(name) || !Number.isInteger(part) || part < 0) {
      throw new Refused(400, 'not a video stream');
    }
    return writeBody(req, join(REEL_DIR, name), part === 0 ? 'w' : 'a');
  }),
  post('/dev/reel-finish', async (_req, _res, q) => {
    const name = q.get('name') ?? '';
    if (!REEL_STREAM.test(name)) throw new Refused(400, 'not a video stream');
    return muxVideo(join(REEL_DIR, name), Number(q.get('fps')) || 60);
  }),
  // The loudness pages save their tables: the original's tracks (dev/loudness.html) and our
  // scores (dev/live.html).
  post('/dev/loudness', (req) => saveLoudness(req, LOUDNESS_FILE)),
  post('/dev/live-loudness', (req) => saveLoudness(req, LIVE_LOUDNESS_FILE)),
];

/** Writes the loudness table in the request's body to `file`, after a look at its shape. */
async function saveLoudness(req: IncomingMessage, file: string): Promise<string> {
  const table = JSON.parse(await bodyOf(req)) as {
    synth?: unknown;
    target?: unknown;
    tracks?: unknown;
  };
  if (
    typeof table.synth !== 'string' ||
    typeof table.target !== 'number' ||
    typeof table.tracks !== 'object'
  ) {
    throw new Refused(400, 'not a loudness table');
  }
  const data = { synth: table.synth, target: table.target, tracks: table.tracks };
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, await prettyJson(file, data));
  return 'saved';
}

const DEV_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
};

export function devEndpointsPlugin(): Plugin {
  return {
    name: 'parapet-dev-helpers',
    apply: 'serve',
    configureServer(server) {
      for (const [path, handle] of ENDPOINTS) server.middlewares.use(path, handle);
      server.middlewares.use('/dev', (req, res, next) => {
        const path = new URL(req.url ?? '/', 'http://dev').pathname;
        const match = /^\/(?:(sprites)\/)?([\w-]+\.(?:html|json|png))$/.exec(path);
        if (!match) return next();
        const file = match[1] ? join(PLAYMAN, 'sprites', match[2]!) : join(DEV_PAGES, match[2]!);
        readFile(file).then(
          (body) => {
            res.setHeader('Content-Type', DEV_TYPES[extname(file)]!);
            res.end(body);
          },
          () => next(),
        );
      });
    },
  };
}
