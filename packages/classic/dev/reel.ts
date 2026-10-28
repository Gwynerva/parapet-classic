/**
 * The TAS reel (dev server only, `dev/reel.html`; how to use it: `docs/TAS-REEL.md`): footage for
 * a video about how the bosses' records were found. The boss runs its record (the local TAS run
 * in `packages/tools/tas-out`, never published) through the real level, and hundreds of pale
 * attempts run with it: at the start and at every flag a wave sets off from where the record is
 * (a smaller one every few seconds between flags), each attempt with a press or two moved,
 * dropped, swapped or added, and peels away as it goes wrong (a crash, a fall, a step too late)
 * while the waves before fade out. Every attempt really is one: it is played by the simulation,
 * and only those that do worse than the record are kept.
 *
 * The page is a canvas of a fixed size (4K by default) shown fitted to the window; `F` makes it
 * full screen for a screen recorder, `R` records the canvas itself (MediaRecorder) and the dev
 * server saves the video next to the runs (`packages/tools/tas-out/reel/`, git-ignored). With
 * `render=1` it renders frame by frame instead, at an exact 60 frames a second whatever the
 * machine's load: every frame goes to the browser's video encoder (WebCodecs, the GPU's where
 * there is one) and the dev server muxes the stream into an MP4 with ffmpeg. The same
 * parameters always give the same attempts.
 */
import { createRun, STEP, type World } from '@parapet/sim';
import { GameLoop } from '@parapet/runtime/app/GameLoop.ts';
import { Camera } from '@parapet/runtime/render/Camera.ts';
import { CharacterRenderer, drawPose } from '@parapet/runtime/render/CharacterRenderer.ts';
import { applyScanlines } from '@parapet/runtime/render/Hologram.ts';
import { makeEchoColor } from '@parapet/runtime/render/EchoSkin.ts';
import { CharacterFx } from '@parapet/runtime/render/fx/CharacterFx.ts';
import { defaultLevelArtFrame, themeOfLevel } from '@parapet/runtime/render/LevelRenderer.ts';
import { Particles } from '@parapet/runtime/render/Particles.ts';
import { screenPixels, worldGrid, type CameraPos } from '@parapet/runtime/render/View.ts';
import { BitmapFont, type BitmapFontData } from '@parapet/runtime/text/BitmapFont.ts';
import { outlined } from '@parapet/runtime/ui/draw.ts';
import { isContestMode, parsePresses, type ContestMode } from '../../tools/src/tas/model.ts';
import { bossOfLevel, characterFx, contestCharacter } from '../src/app/bosses.ts';
import { loadContent } from '../src/assets/content.ts';
import display16 from '../../content/fonts/display-16.json';
import display16Png from '../../content/fonts/display-16.png';
import { createRenderers } from '../src/app/renderers.ts';
import { $ } from './dom.ts';
import {
  ATTEMPT_ALPHA,
  type Batch,
  type Content,
  FADE_OUT_MS,
  LAYER_ALPHA,
  type Live,
  type Plan,
  RETIRE_SPREAD_MS,
  WAVE_STEPS,
  bitsAt,
  fadeStart,
  formatClock,
  makePlan,
  opacity,
  rng,
} from './reelPlan.ts';

const LEVELS = 12;
/** The leader stands at the start this long before it runs, and at the end after it. */
const INTRO_MS = 1200;
const OUTRO_MS = 2500;
/** Frames a second of the rendered videos. */
const FPS = 60;
/** Fade from and to black around a level. */
const BLACK_MS = 400;
interface Options {
  levels: number[];
  mode: ContestMode;
  width: number;
  height: number;
  scale: number;
  batch: number;
  hud: boolean;
  record: boolean;
  /** Render frame by frame into a video instead of playing in real time. */
  render: boolean;
  mbps: number;
  /** The stored run played: '' for the optimal one, else a stylish variant's folder. */
  run: string;
  outfit: number;
  plain: boolean;
  /** Stop the record on this step (0: at its finish), for runs that never finish. */
  until: number;
}

function readOptions(): Options {
  const q = new URLSearchParams(location.search);
  const level = q.get('level') ?? 'all';
  const levels =
    level === 'all'
      ? Array.from({ length: LEVELS }, (_, i) => i)
      : level
          .split(',')
          .map(Number)
          .filter((l) => Number.isInteger(l) && l >= 0 && l < LEVELS);
  const mode = q.get('mode') ?? 'sprint';
  const size = /^(\d+)x(\d+)$/.exec(q.get('size') ?? '') ?? [null, '3840', '2160'];
  const width = Number(size[1]);
  const height = Number(size[2]);
  return {
    levels: levels.length > 0 ? levels : [0],
    mode: isContestMode(mode) ? mode : 'sprint',
    width,
    height,
    scale: Number(q.get('scale')) || Math.max(1, Math.floor(height / 360)),
    batch: q.get('n') !== null && Number.isFinite(Number(q.get('n'))) ? Number(q.get('n')) : 80,
    hud: q.get('hud') === '1',
    record: q.get('record') === '1',
    render: q.get('render') === '1',
    mbps: Number(q.get('mbps')) || (q.get('render') === '1' ? 100 : 60),
    run: /^[\w-]+$/.test(q.get('run') ?? '') && q.get('run') !== 'optimal' ? q.get('run')! : '',
    outfit: Number(q.get('outfit')) || 0,
    plain: q.get('plain') === '1',
    until: Number(q.get('until')) || 0,
  };
}

async function main(): Promise<void> {
  const options = readOptions();
  const statusBox = $<HTMLDivElement>('status');
  let statusTimer = 0;
  const status = (text: string, stay = false): void => {
    statusBox.textContent = text;
    statusBox.classList.remove('hidden');
    clearTimeout(statusTimer);
    if (!stay) statusTimer = window.setTimeout(() => statusBox.classList.add('hidden'), 3000);
  };

  const [content, font] = await Promise.all([
    loadContent(),
    BitmapFont.fromData(display16 as BitmapFontData, display16Png),
  ]);
  const { sheet, scene, sine, level: levels, skins, echo, clips, moves } = createRenderers(content);

  const canvas = $<HTMLCanvasElement>('view');
  canvas.width = options.width;
  canvas.height = options.height;
  const c = canvas.getContext('2d')!;
  const view = {
    width: Math.ceil(options.width / options.scale),
    height: Math.ceil(options.height / options.scale),
  };
  const layer = document.createElement('canvas');
  layer.width = view.width;
  layer.height = view.height;
  const lctx = layer.getContext('2d')!;
  lctx.imageSmoothingEnabled = false;

  // ------------------------------------------------------------------ one level
  let levelIndex = 0;
  let plan: Plan | null = null;
  let leader: World | null = null;
  let leaderCursor = { next: 0 };
  let characters = new CharacterRenderer(scene, moves, clips, skins);
  let fx = new CharacterFx(echo);
  let particles = new Particles(sheet, sine);
  let camera = new Camera(view.width, view.height);
  let live: Live[] = [];
  const pool: World[] = [];
  let nextBatch = 0;
  let spawned = 0;
  let character = 0;
  let attemptScene = scene;
  /** Page time of the level (ms), and when the record stopped (-1: running). */
  let pageMs = 0;
  let acc = 0;
  let endedAt = -1;
  /** Reel time: steps played × STEP, going on after the record has finished. */
  let tick = 0;
  let fadeRand = rng(1);
  let paused = false;
  let fullHud = options.hud;
  let busy = false;
  let over = false;

  const worldOf = (levelId: number): (() => World) => {
    const level = content.levels[levelId]!;
    const mission = content.missions.levels[levelId]!;
    return () =>
      createRun({
        mode: options.mode,
        level,
        mission,
        moves: content.moves,
        tables: content.tables,
        rival: null,
      });
  };

  const release = (a: Live): void => {
    characters.detach(a.world.player);
    pool.push(a.world);
  };

  /** Fades out the attempts on screen at least `age` ms old, one after another. */
  const retire = (age = 0): void => {
    for (const a of live) {
      if (a.fadeAt === Infinity && tick - a.born >= age) {
        a.fadeAt = tick + fadeRand() * RETIRE_SPREAD_MS;
      }
    }
  };

  const spawn = (batch: Batch, make: () => World): void => {
    const t = tick;
    // A flag's wave sends the attempts before it away; one between flags, those of the wave
    // before the last.
    retire(batch.flag ? 0 : WAVE_STEPS * STEP * 1.5);
    batch.attempts.forEach((presses, i) => {
      const world = pool.pop() ?? make();
      world.restoreState(batch.state);
      characters.attachBranch(world.player, leader!.player, {
        character,
        outfit: options.outfit,
        echo: true,
        seed: spawned + i + 2,
      });
      live.push({
        world,
        presses,
        cursor: { next: 0 },
        born: t,
        fadeAt: Infinity,
        wrongAt: Infinity,
        ended: false,
      });
    });
    spawned += batch.attempts.length;
  };

  const loadLevel = async (levelId: number): Promise<void> => {
    busy = true;
    status(`level ${levelId}: loading the record…`, true);
    const file = `${options.run ? `${options.run}/` : ''}${levelId}-${options.mode}.json`;
    const res = await fetch(`/@fs/${TAS_OUT}/${file}`);
    if (!res.ok) throw new Error(`no local TAS run ${file} (npm run tas)`);
    const run = (await res.json()) as { presses: string };
    const make = worldOf(levelId);
    const local: Content = { world: make, moves };
    // Let the status show before the attempts are worked out.
    await new Promise((done) => setTimeout(done, 30));
    const started = performance.now();
    plan = makePlan(
      local,
      options.mode,
      levelId,
      parsePresses(run.presses),
      options.batch,
      (t) => status(t, true),
      options.until,
    );
    const total = plan.batches.reduce((n, b) => n + b.attempts.length, 0);
    status(
      `level ${levelId} ${options.mode}: ${formatClock(plan.timeMs)}, ${total} attempts ` +
        `(${Math.round(performance.now() - started)} ms)`,
    );
    for (const a of live) release(a);
    live = [];
    pool.length = 0;
    leader = make();
    leaderCursor = { next: 0 };
    characters = new CharacterRenderer(scene, moves, clips, skins);
    fx = new CharacterFx(echo);
    particles = new Particles(sheet, sine);
    particles.setLevel(leader.level);
    camera = new Camera(view.width, view.height);
    levels.setLevel(levelId, leader.level);
    const boss = bossOfLevel(levelId);
    character = contestCharacter(levelId, options.plain ? 'sprint' : 'flags');
    characters.attach(leader.player, { character, outfit: options.outfit, seed: 1 });
    const player = leader.player;
    const style = characterFx(skins, character, options.outfit, (clock) =>
      characters.swapFor(player, clock),
    );
    if (style) {
      fx.add(player, { pose: () => characters.pose(player, 1), move: () => player.moveId }, style);
    }
    const color = boss?.color ?? makeEchoColor('reel', '#9ec9ff');
    attemptScene = echo.scene(color, true, skins.sceneFor(character, options.outfit));
    camera.reset(leader.player, leader.level);
    nextBatch = 0;
    spawned = 0;
    pageMs = 0;
    acc = 0;
    endedAt = -1;
    tick = 0;
    fadeRand = rng(levelId + 77);
    spawn(plan.batches[nextBatch++]!, make);
    busy = false;
  };

  /** One simulation step of the record and every attempt. */
  const step = (): void => {
    const world = leader!;
    const p = plan!;
    if (endedAt < 0) {
      const going = world.step(bitsAt(world, p.presses, leaderCursor));
      characters.onEvents(world.events);
      particles.onEvents(world.events);
      if (!going || (options.until > 0 && world.stepCount >= options.until)) {
        endedAt = pageMs;
        retire();
      }
    }
    tick += STEP;
    const t = tick;
    for (const a of live) {
      if (a.ended) continue;
      const going = a.world.step(bitsAt(a.world, a.presses, a.cursor));
      characters.onEvents(a.world.events);
      for (const e of a.world.events) {
        const wrong = e.type === 'pit' || (e.type === 'move' && moves.get(e.to).scoreType === 0);
        if (wrong && a.wrongAt === Infinity) a.wrongAt = t;
      }
      if (!going) a.ended = true;
    }
    characters.step(world.clock, STEP);
    fx.step({ clock: t });
    camera.update(world.player, world.level);
    const batch = p.batches[nextBatch];
    if (batch && world.stepCount === batch.from) {
      nextBatch++;
      spawn(batch, worldOf(p.levelId));
    }
    live = live.filter((a) => {
      if (t < fadeStart(a) + FADE_OUT_MS) return true;
      release(a);
      return false;
    });
  };

  const drawAttempts = (cam: CameraPos, alpha: number, clock: number, now: number): void => {
    const t = tick + alpha * STEP;
    lctx.clearRect(0, 0, layer.width, layer.height);
    attemptScene.setViewport(view.width, view.height);
    let drawn = false;
    for (const a of live) {
      const o = opacity(a, t);
      if (o <= 0) continue;
      const pose = characters.pose(a.world.player, alpha);
      if (!pose) continue;
      lctx.globalAlpha = o * ATTEMPT_ALPHA;
      drawPose(lctx, attemptScene, pose, cam, characters.swapFor(a.world.player, clock));
      drawn = true;
    }
    lctx.globalAlpha = 1;
    if (!drawn) return;
    applyScanlines(lctx, layer.width, layer.height, now);
    c.save();
    c.globalAlpha = LAYER_ALPHA;
    c.drawImage(layer, 0, 0);
    c.restore();
  };

  const draw = (): void => {
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#000';
    c.fillRect(0, 0, canvas.width, canvas.height);
    const world = leader;
    const p = plan;
    if (!world || !p) return;
    c.setTransform(options.scale, 0, 0, options.scale, 0, 0);
    c.imageSmoothingEnabled = false;
    const alpha = pageMs < INTRO_MS ? 1 : acc / STEP;
    const exact = { x: camera.renderX(alpha), y: camera.renderY(alpha) };
    const clock = world.clock;
    const now = pageMs;
    levels.drawBackground(c, exact, view, now, themeOfLevel(p.levelId), camera.frameH >> 5);
    const grid = worldGrid(exact, screenPixels(c));
    const cam = grid.cam;
    c.save();
    c.translate(grid.dx, grid.dy);
    levels.drawLevelArt(c, cam, view, defaultLevelArtFrame(p.levelId));
    levels.drawMarkers(c, cam, view, world.level, world.rules, now);
    particles.draw(c, cam, clock, false);
    drawAttempts(cam, alpha, clock, now);
    fx.drawBehind(c, cam, clock, now, view);
    characters.drawAll(c, cam, alpha, clock, world.player);
    fx.drawFront(c, cam);
    particles.draw(c, cam, clock, true);
    c.restore();
    if (fullHud) {
      outlined(c, font, `attempts ${spawned}`, 8, 8, { color: '#ffffff' });
      outlined(c, font, formatClock(clock), view.width - 8, 8, {
        align: 'right',
        color: '#ffffff',
      });
    }
    // From and to black.
    const out = endedAt < 0 ? 0 : (pageMs - endedAt - OUTRO_MS + BLACK_MS) / BLACK_MS;
    const black = Math.max(1 - pageMs / BLACK_MS, Math.min(1, out));
    if (black > 0) {
      c.fillStyle = `rgba(0, 0, 0, ${Math.min(1, black)})`;
      c.fillRect(0, 0, view.width, view.height);
    }
  };

  // ------------------------------------------------------------------ recording
  let recorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  const mime = [
    'video/mp4;codecs=avc1.640033',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm',
  ].find((m) => MediaRecorder.isTypeSupported(m));
  const startRecording = (): void => {
    if (recorder || !mime) return;
    chunks = [];
    recorder = new MediaRecorder(canvas.captureStream(60), {
      mimeType: mime,
      videoBitsPerSecond: options.mbps * 1e6,
    });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.start(1000);
    status(`recording ${mime} at ${options.mbps} Mbit/s`);
  };
  const stopRecording = async (): Promise<void> => {
    const r = recorder;
    if (!r || !plan) return;
    recorder = null;
    await new Promise<void>((done) => {
      r.onstop = () => done();
      r.stop();
    });
    const ext = mime?.startsWith('video/mp4') ? 'mp4' : 'webm';
    const name = `${videoName(plan.levelId)}.${ext}`;
    const blob = new Blob(chunks, { type: mime });
    chunks = [];
    status(`saving ${name} (${(blob.size / 1e6).toFixed(0)} MB)…`, true);
    const res = await fetch(`/dev/save-reel?name=${name}`, { method: 'POST', body: blob });
    status(res.ok ? `saved ${await res.text()}` : `not saved: ${await res.text()}`);
  };

  // ------------------------------------------------------------------ frame-exact rendering
  /** A level's video name: `L01-sprint` (with the stylish variant: `L01-sprint-style-15`). */
  const videoName = (levelId: number): string =>
    `L${String(levelId + 1).padStart(2, '0')}-${options.mode}${options.run ? `-${options.run}` : ''}`;

  /** The first encoder setting the browser takes: H.264 High, else HEVC, the GPU's if any. */
  const encoderSetting = async (): Promise<{ config: VideoEncoderConfig; ext: string } | null> => {
    const base = {
      width: canvas.width,
      height: canvas.height,
      bitrate: options.mbps * 1e6,
      bitrateMode: 'variable' as const,
      framerate: FPS,
      hardwareAcceleration: 'prefer-hardware' as const,
      latencyMode: 'quality' as const,
    };
    // The GPU's H.264, then its HEVC, then the browser's own H.264 (a browser may offer its GPU
    // encoder only up to 1080p; the software one does 4K at some 30 frames a second).
    const tries: { config: VideoEncoderConfig; ext: string }[] = [
      { config: { ...base, codec: 'avc1.640033', avc: { format: 'annexb' } }, ext: 'h264' },
      {
        config: {
          ...base,
          codec: 'hvc1.1.6.L153.B0',
          hevc: { format: 'annexb' },
        } as VideoEncoderConfig,
        ext: 'hevc',
      },
      {
        config: {
          ...base,
          codec: 'avc1.640033',
          hardwareAcceleration: 'no-preference',
          avc: { format: 'annexb' },
        },
        ext: 'h264',
      },
    ];
    for (const t of tries) {
      const support = await VideoEncoder.isConfigSupported(t.config).catch(() => null);
      if (!support?.supported) continue;
      const how = t.config.hardwareAcceleration === 'prefer-hardware' ? 'GPU' : 'browser';
      status(`encoding ${t.config.codec} on the ${how} at ${options.mbps} Mbit/s`, true);
      return t;
    }
    return null;
  };

  /**
   * Renders the level loaded now into `tas-out/reel/<name>.mp4`: a fixed 1/60 s a frame from
   * the fade-in to the end of the fade-out, each frame encoded, the stream sent to the dev
   * server in parts and muxed there. Waits on the encoder, not on timers, so a hidden page
   * renders as fast as a shown one.
   */
  const renderLevel = async (): Promise<void> => {
    const p = plan!;
    const setting = await encoderSetting();
    if (!setting) throw new Error('the browser encodes neither H.264 nor HEVC in this size');
    const name = `${videoName(p.levelId)}.${setting.ext}`;
    let failure: unknown = null;
    let parts: Uint8Array[] = [];
    let bytes = 0;
    let part = 0;
    const encoder = new VideoEncoder({
      output: (chunk) => {
        const data = new Uint8Array(chunk.byteLength);
        chunk.copyTo(data);
        parts.push(data);
        bytes += data.byteLength;
      },
      error: (e) => (failure = e),
    });
    encoder.configure(setting.config);
    const send = async (): Promise<void> => {
      if (parts.length === 0) return;
      const body = new Blob(parts as BlobPart[]);
      parts = [];
      bytes = 0;
      const res = await fetch(`/dev/reel-stream?name=${name}&part=${part++}`, {
        method: 'POST',
        body,
      });
      if (!res.ok) throw new Error(`the dev server took no video: ${await res.text()}`);
    };
    const frameUs = 1e6 / FPS;
    for (let frame = 0; ; frame++) {
      if (failure) throw failure;
      advance(1000 / FPS);
      draw();
      const image = new VideoFrame(canvas, { timestamp: frame * frameUs, duration: frameUs });
      encoder.encode(image, { keyFrame: frame % (FPS * 2) === 0 });
      image.close();
      if (encoder.encodeQueueSize > 4) {
        await new Promise((done) => encoder.addEventListener('dequeue', done, { once: true }));
      }
      if (bytes > 8e6) await send();
      if (frame % FPS === 0) status(`rendering ${name}: ${frame / FPS} s`, true);
      if (endedAt >= 0 && pageMs - endedAt >= OUTRO_MS) break;
    }
    await encoder.flush();
    encoder.close();
    await send();
    status(`muxing ${name}…`, true);
    const res = await fetch(`/dev/reel-finish?name=${name}&fps=${FPS}`, { method: 'POST' });
    status(res.ok ? `saved ${await res.text()}` : `not saved: ${await res.text()}`, true);
    if (!res.ok) throw new Error(`not muxed: ${name}`);
  };

  // ------------------------------------------------------------------ the loop
  const playLevel = async (index: number): Promise<void> => {
    levelIndex = index;
    over = false;
    try {
      await loadLevel(options.levels[index]!);
    } catch (err) {
      // Nothing to play: keys still work (Enter tries again, N goes on).
      busy = false;
      plan = null;
      over = true;
      status(String(err), true);
      return;
    }
    if (options.record) startRecording();
  };
  const nextLevel = async (): Promise<void> => {
    if (recorder) await stopRecording();
    if (levelIndex + 1 < options.levels.length) await playLevel(levelIndex + 1);
    else {
      over = true;
      status('done: Enter plays the level again', true);
    }
  };

  window.addEventListener('keydown', (e) => {
    if (busy) return;
    switch (e.key) {
      case ' ':
        paused = !paused;
        break;
      case 'Enter':
        void playLevel(levelIndex);
        break;
      case 'n':
      case 'N':
        void nextLevel();
        break;
      case 'h':
      case 'H':
        fullHud = !fullHud;
        break;
      case 'r':
      case 'R':
        if (recorder) void stopRecording();
        else startRecording();
        break;
      case 'f':
      case 'F':
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen();
        break;
      default:
        return;
    }
    e.preventDefault();
  });

  /** Moves the reel on by `dt` ms of page time: the wait at the start, then the steps. */
  function advance(dt: number): void {
    pageMs += dt;
    if (pageMs < INTRO_MS) return;
    acc += dt;
    while (acc >= STEP) {
      acc -= STEP;
      step();
    }
  }

  if (options.render) {
    // Every level of the list, one video each, then nothing else.
    for (let i = 0; i < options.levels.length; i++) {
      levelIndex = i;
      await loadLevel(options.levels[i]!);
      await renderLevel();
    }
    status(`rendered ${options.levels.length} videos into packages/tools/tas-out/reel`, true);
    return;
  }

  await playLevel(0);
  let finishing = false;
  new GameLoop((dt) => {
    if (busy || !plan) return;
    if (!paused) advance(dt);
    draw();
    if (!finishing && !over && endedAt >= 0 && pageMs - endedAt >= OUTRO_MS) {
      finishing = true;
      void nextLevel().finally(() => (finishing = false));
    }
  }).start();
}

main().catch((err: unknown) => {
  $('status').textContent = String(err);
  console.error(err);
});
