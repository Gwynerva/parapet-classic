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
 * server saves the video next to the runs (`packages/tools/tas-out/reel/`, git-ignored). The
 * same parameters always give the same attempts.
 */
import { buildSineTable, createRun, MoveTable, STEP, type World, type WorldState } from '@parapet/sim';
import { buildClipTable } from '@parapet/runtime/anim/Animator.ts';
import { GameLoop } from '@parapet/runtime/app/GameLoop.ts';
import { Camera } from '@parapet/runtime/render/Camera.ts';
import { CharacterRenderer, drawPose } from '@parapet/runtime/render/CharacterRenderer.ts';
import { applyScanlines } from '@parapet/runtime/render/EchoRenderer.ts';
import { EchoSheets, makeEchoColor } from '@parapet/runtime/render/EchoSkin.ts';
import { CharacterFx } from '@parapet/runtime/render/fx/CharacterFx.ts';
import {
  defaultLevelArtFrame,
  LevelRenderer,
  themeOfLevel,
} from '@parapet/runtime/render/LevelRenderer.ts';
import { Particles } from '@parapet/runtime/render/Particles.ts';
import { SceneRenderer } from '@parapet/runtime/render/SceneRenderer.ts';
import { SkinLibrary } from '@parapet/runtime/render/SkinLibrary.ts';
import { SpriteSheet } from '@parapet/runtime/render/SpriteSheet.ts';
import { screenPixels, worldGrid, type CameraPos } from '@parapet/runtime/render/View.ts';
import { BitmapFont, type BitmapFontData } from '@parapet/runtime/text/BitmapFont.ts';
import { outlined } from '@parapet/runtime/ui/draw.ts';
import {
  isContestMode,
  keyBits,
  parsePresses,
  type ContestMode,
  type Press,
} from '../../tools/src/tas/model.ts';
import { bossOfLevel, characterFx, contestCharacter, registerBosses } from '../src/app/bosses.ts';
import { loadContent } from '../src/assets/content.ts';
import display16 from '../../content/fonts/display-16.json';
import display16Png from '../../content/fonts/display-16.png';

const LEVELS = 12;
/** The leader stands at the start this long before it runs, and at the end after it. */
const INTRO_MS = 1200;
const OUTRO_MS = 2500;
/** Fade from and to black around a level. */
const BLACK_MS = 400;
/** How long an attempt is followed past the moment the record takes the next flag. */
const LATE_STEPS = 45;
/**
 * Between flags a smaller wave of attempts sets off every this many steps (3 s), so a long
 * stretch never runs out of them; none closer than half that to a flag's wave.
 */
const WAVE_STEPS = 100;
/** An attempt that reaches the next flag no more than this late counts as the record's. */
const SAME_STEPS = 2;
/** How far (units, x plus y) an attempt must stray from the record to be seen. */
const MIN_STRAY = 768;
/** Opacity of an attempt in the hologram layer, and of the layer. */
const ATTEMPT_ALPHA = 0.45;
const LAYER_ALPHA = 0.9;
const FADE_IN_MS = 250;
const FADE_OUT_MS = 700;
/** A batch fades out over this long once the record takes its flag, one attempt after another. */
const RETIRE_SPREAD_MS = 1600;
/** A crashed or fallen attempt lies there this long before it fades. */
const WRONG_LINGER_MS = 1100;

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

interface Options {
  levels: number[];
  mode: ContestMode;
  width: number;
  height: number;
  scale: number;
  batch: number;
  hud: boolean;
  record: boolean;
  mbps: number;
  outfit: number;
  plain: boolean;
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
    batch: Number(q.get('n')) || 80,
    hud: q.get('hud') === '1',
    record: q.get('record') === '1',
    mbps: Number(q.get('mbps')) || 60,
    outfit: Number(q.get('outfit')) || 0,
    plain: q.get('plain') === '1',
  };
}

/** Small seedable PRNG (mulberry32). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Flags or checkpoints taken. */
function progressOf(world: World, mode: ContestMode): number {
  return mode === 'flags' ? 5 - world.rules.flagsLeft : world.rules.nextCheckpoint;
}

/** Plays `presses` from the world's step on: the bits of this step (`next` is the press index). */
function bitsAt(world: World, presses: readonly Press[], cursor: { next: number }): number {
  while (cursor.next < presses.length && presses[cursor.next]!.step < world.stepCount) {
    cursor.next++;
  }
  const p = presses[cursor.next];
  if (!p || p.step !== world.stepCount) return 0;
  cursor.next++;
  return keyBits(p.key, world.player.facingRight);
}

/** A batch of attempts: where they set off (the record's state then) and how they go. */
interface Batch {
  from: number;
  state: WorldState;
  /** A flag's wave (true) or one between flags. */
  flag: boolean;
  /** Where the next batch sets off: the attempts change the record's presses before it. */
  until: number;
  /** The step the record takes its next flag on (or finishes). */
  flagAt: number;
  attempts: Press[][];
}

/** The record and its attempts, worked out before the level plays. */
interface Plan {
  levelId: number;
  presses: Press[];
  timeMs: number;
  batches: Batch[];
}

interface Content {
  world: () => World;
  moves: MoveTable;
}

/** One press or two of the record's, between `from` and `until`, changed. */
function mutate(presses: readonly Press[], from: number, until: number, rand: () => number): Press[] {
  const v = presses.slice();
  const count = rand() < 0.3 ? 2 : 1;
  for (let m = 0; m < count; m++) {
    const inside: number[] = [];
    v.forEach((p, i) => {
      if (p.step >= from && p.step < until) inside.push(i);
    });
    const r = rand();
    const key = (1 + Math.floor(rand() * 4)) as Press['key'];
    if (inside.length === 0 || r < 0.15) {
      v.push({ step: from + Math.floor(rand() * Math.max(1, until - from)), key });
      continue;
    }
    const i = inside[Math.floor(rand() * inside.length)]!;
    const p = v[i]!;
    if (r < 0.55) {
      const d = (1 + Math.floor(rand() * 8)) * (rand() < 0.5 ? -1 : 1);
      v[i] = { step: Math.max(from, p.step + d), key: p.key };
    } else if (r < 0.8) {
      v.splice(i, 1);
    } else {
      v[i] = { step: p.step, key: key === p.key ? (((key % 4) + 1) as Press['key']) : key };
    }
  }
  v.sort((a, b) => a.step - b.step);
  return v.filter((p, i) => i === 0 || p.step !== v[i - 1]!.step);
}

/**
 * Whether an attempt goes wrong where the record does not: it crashes or falls, or takes the
 * next flag late (or not before the next batch), and strays from the record far enough to be
 * seen.
 */
function goesWrong(
  content: Content,
  mode: ContestMode,
  sim: World,
  batch: Omit<Batch, 'attempts'>,
  presses: readonly Press[],
  track: { x: Int32Array; y: Int32Array },
): boolean {
  sim.restoreState(batch.state);
  const start = progressOf(sim, mode);
  const cursor = { next: 0 };
  let stray = 0;
  let wrong = false;
  while (sim.stepCount < batch.until + LATE_STEPS) {
    const going = sim.step(bitsAt(sim, presses, cursor));
    for (const e of sim.events) {
      if (e.type === 'pit') wrong = true;
      if (e.type === 'move' && content.moves.get(e.to).scoreType === 0) wrong = true;
    }
    const s = sim.stepCount;
    if (s < track.x.length) {
      stray = Math.max(stray, Math.abs(sim.player.x - track.x[s]!) + Math.abs(sim.player.y - track.y[s]!));
    }
    const late = s > batch.flagAt + SAME_STEPS;
    if (!going) return (!sim.rules.result?.finished || late) && stray >= MIN_STRAY;
    if (progressOf(sim, mode) > start) return (wrong || late) && stray >= MIN_STRAY;
  }
  return stray >= MIN_STRAY || wrong;
}

/**
 * Plays the record once, cutting it at its flags and between them, and finds the attempts of
 * every batch: `perBatch` at a flag, half as many between.
 */
function makePlan(
  content: Content,
  mode: ContestMode,
  levelId: number,
  presses: Press[],
  perBatch: number,
  status: (text: string) => void,
): Plan {
  const world = content.world();
  const xs = [world.player.x];
  const ys = [world.player.y];
  const cuts: { step: number; state: WorldState; flag: boolean }[] = [
    { step: 0, state: world.saveState(false), flag: true },
  ];
  const cursor = { next: 0 };
  let progress = progressOf(world, mode);
  for (;;) {
    const going = world.step(bitsAt(world, presses, cursor));
    xs.push(world.player.x);
    ys.push(world.player.y);
    if (!going) break;
    const now = progressOf(world, mode);
    if (now !== progress) {
      progress = now;
      // A wave just before a flag's would hardly be seen.
      const last = cuts.at(-1)!;
      if (!last.flag && world.stepCount - last.step < WAVE_STEPS / 2) cuts.pop();
      cuts.push({ step: world.stepCount, state: world.saveState(false), flag: true });
    } else if (world.stepCount - cuts.at(-1)!.step >= WAVE_STEPS) {
      cuts.push({ step: world.stepCount, state: world.saveState(false), flag: false });
    }
    if (world.stepCount > 20000) throw new Error('the record does not finish');
  }
  const end = world.stepCount;
  const track = { x: Int32Array.from(xs), y: Int32Array.from(ys) };
  const sim = content.world();
  const batches: Batch[] = cuts.map((cut, k) => {
    status(`level ${levelId}: attempts for wave ${k + 1} of ${cuts.length}…`);
    const batch = {
      from: cut.step,
      state: cut.state,
      flag: cut.flag,
      until: cuts[k + 1]?.step ?? end,
      flagAt: cuts.find((c, i) => i > k && c.flag)?.step ?? end,
    };
    const rand = rng(levelId * 1000 + k + 1);
    const seen = new Set<string>();
    const attempts: Press[][] = [];
    const wanted = cut.flag ? perBatch : Math.round(perBatch / 2);
    for (let tries = 0; attempts.length < wanted && tries < wanted * 25; tries++) {
      const variant = mutate(presses, batch.from, batch.until, rand);
      const key = variant.map((p) => `${p.step}${p.key}`).join(' ');
      if (seen.has(key)) continue;
      seen.add(key);
      if (goesWrong(content, mode, sim, batch, variant, track)) attempts.push(variant);
    }
    return { ...batch, attempts };
  });
  return { levelId, presses, timeMs: world.rules.result?.time ?? world.clock, batches };
}

/** An attempt on screen. */
interface Live {
  world: World;
  presses: Press[];
  cursor: { next: number };
  born: number;
  fadeAt: number;
  wrongAt: number;
  ended: boolean;
}

/** When an attempt starts to fade out (reel time). */
function fadeStart(a: Live): number {
  return Math.min(a.fadeAt, a.wrongAt + WRONG_LINGER_MS);
}

/** Opacity of an attempt at reel time `t`. */
function opacity(a: Live, t: number): number {
  let o = Math.min(1, Math.max(0, (t - a.born) / FADE_IN_MS));
  const fadeAt = fadeStart(a);
  if (t > fadeAt) o *= Math.max(0, 1 - (t - fadeAt) / FADE_OUT_MS);
  return o;
}

function formatClock(ms: number): string {
  const s = Math.max(0, ms) / 1000;
  const m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(2).padStart(5, '0')}`;
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
  const sheet = new SpriteSheet(content.atlas.image, content.atlas.frames);
  const scene = new SceneRenderer(sheet, content.scenes.values());
  const sine = buildSineTable(10, true);
  const levels = new LevelRenderer(content, sheet, scene, sine);
  const skins = new SkinLibrary(scene);
  registerBosses(skins);
  const echo = new EchoSheets(scene);
  const clips = buildClipTable(content.anims.clips);
  const moves = new MoveTable(content.moves);

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
    const res = await fetch(`/@fs/${TAS_OUT}/${levelId}-${options.mode}.json`);
    if (!res.ok) throw new Error(`no local TAS run ${levelId}-${options.mode} (npm run tas)`);
    const run = (await res.json()) as { presses: string };
    const make = worldOf(levelId);
    const local: Content = { world: make, moves };
    // Let the status show before the attempts are worked out.
    await new Promise((done) => setTimeout(done, 30));
    const started = performance.now();
    plan = makePlan(local, options.mode, levelId, parsePresses(run.presses), options.batch, (t) =>
      status(t, true),
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
      if (!going) {
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
        const wrong =
          e.type === 'pit' || (e.type === 'move' && moves.get(e.to).scoreType === 0);
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
    particles.draw(c, cam, view, clock, false);
    drawAttempts(cam, alpha, clock, now);
    fx.drawBehind(c, cam, clock, now, view);
    characters.drawAll(c, cam, alpha, clock, world.player);
    fx.drawFront(c, cam);
    particles.draw(c, cam, view, clock, true);
    c.restore();
    if (fullHud) {
      outlined(c, font, `attempts ${spawned}`, 8, 8, { color: '#ffffff' });
      outlined(c, font, formatClock(clock), view.width - 8, 8, { align: 'right', color: '#ffffff' });
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
  const mime = ['video/mp4;codecs=avc1.640033', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find(
    (m) => MediaRecorder.isTypeSupported(m),
  );
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
    const name = `L${String(plan.levelId + 1).padStart(2, '0')}-${options.mode}.${ext}`;
    const blob = new Blob(chunks, { type: mime });
    chunks = [];
    status(`saving ${name} (${(blob.size / 1e6).toFixed(0)} MB)…`, true);
    const res = await fetch(`/dev/save-reel?name=${name}`, { method: 'POST', body: blob });
    status(res.ok ? `saved ${await res.text()}` : `not saved: ${await res.text()}`);
  };

  // ------------------------------------------------------------------ the loop
  const playLevel = async (index: number): Promise<void> => {
    levelIndex = index;
    over = false;
    await loadLevel(options.levels[index]!);
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

  await playLevel(0);
  let finishing = false;
  new GameLoop((dt) => {
    if (busy || !plan) return;
    if (!paused) {
      pageMs += dt;
      if (pageMs >= INTRO_MS) {
        acc += dt;
        while (acc >= STEP) {
          acc -= STEP;
          step();
        }
      }
    }
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
