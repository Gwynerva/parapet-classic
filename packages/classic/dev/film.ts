/**
 * The TAS film (dev server only, `dev/film.html`): every contest's record played one after another
 * by its boss, in one video. The run plays in a window on the right with a few pale attempts (the
 * reel's, far fewer); around it, the frame of the video: a band naming the original and the remake,
 * a table of the twelve levels that fills with each record's time as the boss finishes it, a
 * banner of the author's channel on iron posts under lamps (one flickers) with a bench that
 * Petra, in her outfits, vaults now and then, and a bar of the current run's presses.
 *
 * `render=1` renders frame by frame (60 a second) into `tas-out/reel/<name>.mp4` like the reel.
 * Parameters: `runs` (`0f,0s,1f`… or `all`), `size` (`1920x1080`, `3840x2160`), `n` (attempts in a
 * flag's wave), `name`. Pictures come from `tas-out/film/` (git-ignored: the game's art).
 */
import { createRun, STEP, type World } from '@parapet/sim';
import { Camera } from '@parapet/runtime/render/Camera.ts';
import { CharacterRenderer, drawPose } from '@parapet/runtime/render/CharacterRenderer.ts';
import { applyScanlines } from '@parapet/runtime/render/Hologram.ts';
import { makeEchoColor } from '@parapet/runtime/render/EchoSkin.ts';
import { CharacterFx } from '@parapet/runtime/render/fx/CharacterFx.ts';
import { defaultLevelArtFrame, themeOfLevel } from '@parapet/runtime/render/LevelRenderer.ts';
import { Particles } from '@parapet/runtime/render/Particles.ts';
import { screenPixels, worldGrid, type CameraPos } from '@parapet/runtime/render/View.ts';
import {
  BitmapFont,
  type BitmapFontData,
  type TextAlign,
} from '@parapet/runtime/text/BitmapFont.ts';
import { DemoRun, type MoveDemoData } from '@parapet/runtime/moves/MoveDemo.ts';
import { parsePresses, type ContestMode, type Press } from '../../tools/src/tas/model.ts';
import { bossOfLevel, characterFx, contestCharacter } from '../src/app/bosses.ts';
import { loadContent } from '../src/assets/content.ts';
import display16 from '../../content/fonts/display-16.json';
import display16Png from '../../content/fonts/display-16.png';
import display24 from '../../content/fonts/display-24.json';
import display24Png from '../../content/fonts/display-24.png';
import text12 from '../../content/fonts/text-12.json';
import text12Png from '../../content/fonts/text-12.png';
import { createRenderers } from '../src/app/renderers.ts';
import { MOVE_DEMOS } from '../src/assets/demos.ts';
import { $ } from './dom.ts';
import {
  ATTEMPT_ALPHA,
  bitsAt,
  fadeStart,
  FADE_OUT_MS,
  LAYER_ALPHA,
  makePlan,
  opacity,
  progressOf,
  RETIRE_SPREAD_MS,
  rng,
  type Content,
  type Live,
  type Plan,
} from './reelPlan.ts';

const FPS = 60;
/** Design units: the frame is laid out at 1920×1080 and scaled to the canvas. */
const DW = 1920;
const BAND = 128;
const PANEL = 540;
const GAME = { x: 540, y: 128, w: 1380, h: 880 };
const BAR = { x: 540, y: 1008, w: 1380, h: 72 };
/** Game pixels across the window's height (the view is 690×440 game pixels). */
const VIEW_H = 440;
/** A run: the window fades in, the boss stands, runs, stands again, the window fades out. */
const FADE_MS = 450;
const HOLD_IN_MS = 1000;
const HOLD_OUT_MS = 1000;

const LEVEL_NAMES = [
  'Mill Brook',
  'North Hill',
  'Main St.',
  'East End',
  'Juniper Point',
  'Oak Valley',
  'Grass Bay',
  'Sand Cape',
  'Central Park',
  'Bird Bay',
  'West Harbour',
  'Pine Island',
];
const COLORS = {
  hazard: '#c9a63f',
  hazardDark: '#2b2927',
  band: '#1f1d1c',
  paper: '#f2ede4',
  concrete: '#2f2a28',
  concreteLight: '#352f2d',
  rule: '#221e1c',
  ink: '#111111',
  orange: '#e8501a',
  muted: '#9d938e',
  iron: '#3d4146',
  ironLight: '#5c6168',
};
const KEY_COLORS: Record<Press['key'], string> = {
  1: '#7fd4ff',
  2: '#ff8a5c',
  3: '#ffd35c',
  4: '#c79bff',
};

interface RunSpec {
  levelId: number;
  mode: ContestMode;
}

interface Options {
  runs: RunSpec[];
  width: number;
  height: number;
  batch: number;
  render: boolean;
  mbps: number;
  name: string;
  /** The banner's look (1…4). */
  banner: number;
  /** The street at the foot of the wall (1…3). */
  street: number;
  /** Draw one frame this many ms into the first run and stop (for comparing looks). */
  at: number;
}

function readOptions(): Options {
  const q = new URLSearchParams(location.search);
  const runsText = q.get('runs') ?? 'all';
  const runs: RunSpec[] =
    runsText === 'all'
      ? Array.from({ length: 12 }, (_, l) => [
          { levelId: l, mode: 'flags' as const },
          { levelId: l, mode: 'sprint' as const },
        ]).flat()
      : runsText.split(',').map((r) => ({
          levelId: Number(r.slice(0, -1)),
          mode: r.endsWith('s') ? ('sprint' as const) : ('flags' as const),
        }));
  const [width, height] = (q.get('size') ?? '1920x1080').split('x').map(Number) as [number, number];
  return {
    runs,
    width,
    height,
    batch: q.get('n') !== null ? Number(q.get('n')) : 0,
    render: q.get('render') === '1',
    mbps: Number(q.get('mbps')) || 40,
    name: /^[\w-]+$/.test(q.get('name') ?? '') ? q.get('name')! : 'tas-film',
    banner: Number(q.get('banner')) || 1,
    street: Number(q.get('street')) || 1,
    at: Number(q.get('at')) || 0,
  };
}

const fmt = (ms: number): string => {
  const s = Math.max(0, ms) / 1000;
  const m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(2).padStart(5, '0')}`;
};

async function image(file: string): Promise<ImageBitmap> {
  const res = await fetch(`/@fs/${TAS_OUT}/film/${file}`);
  if (!res.ok) throw new Error(`missing tas-out/film/${file}`);
  return createImageBitmap(await res.blob());
}

async function main(): Promise<void> {
  const options = readOptions();
  const statusBox = $<HTMLDivElement>('status');
  const status = (text: string): void => {
    statusBox.textContent = text;
  };
  const [content, fontD16, fontD24, fontT12] = await Promise.all([
    loadContent(),
    BitmapFont.fromData(display16 as BitmapFontData, display16Png),
    BitmapFont.fromData(display24 as BitmapFontData, display24Png),
    BitmapFont.fromData(text12 as BitmapFontData, text12Png),
  ]);
  const [logo, blaze, icon, parapet, avatar] = await Promise.all([
    image('playman-logo.png'),
    image('blaze.png'),
    image('parapet-icon.png'),
    image('parapet-logo.png'),
    image('avatar-card.png'),
  ]);
  const { sheet, scene, sine, level: levels, skins, echo, clips, moves } = createRenderers(content);

  const canvas = $<HTMLCanvasElement>('view');
  canvas.width = options.width;
  canvas.height = options.height;
  const c = canvas.getContext('2d')!;
  const k = options.width / DW;
  const scale = (GAME.h * k) / VIEW_H;
  const view = { width: Math.ceil((GAME.w * k) / scale), height: VIEW_H };
  const layer = document.createElement('canvas');
  layer.width = view.width;
  layer.height = view.height;
  const lctx = layer.getContext('2d')!;
  lctx.imageSmoothingEnabled = false;

  /** Pixel text in design units: `size` design px per font px (a whole number at 1080p and 4K). */
  const text = (
    font: BitmapFont,
    s: string,
    x: number,
    y: number,
    size: number,
    color: string,
    align: TextAlign = 'left',
    alpha = 1,
  ): void => {
    c.save();
    c.globalAlpha = alpha;
    c.imageSmoothingEnabled = false;
    c.setTransform(k * size, 0, 0, k * size, 0, 0);
    font.draw(c, s, x / size, y / size, { color, align, tabular: true });
    c.restore();
  };
  const rect = (x: number, y: number, w: number, h: number, color: string, alpha = 1): void => {
    c.save();
    c.globalAlpha = alpha;
    c.setTransform(k, 0, 0, k, 0, 0);
    c.fillStyle = color;
    c.fillRect(x, y, w, h);
    c.restore();
  };

  // ------------------------------------------------------------------ the runs
  const times: (number | null)[][] = LEVEL_NAMES.map(() => [null, null]);
  let runIndex = 0;
  let plan: Plan | null = null;
  let leader: World | null = null;
  let leaderCursor = { next: 0 };
  let characters = new CharacterRenderer(scene, moves, clips, skins);
  let fx = new CharacterFx(echo);
  let particles = new Particles(sheet, sine);
  let camera = new Camera(view.width, view.height);
  let live: Live[] = [];
  let nextBatch = 0;
  let spawned = 0;
  let character = 0;
  let outfit = 0;
  let attemptScene = scene;
  /** Run time (ms since the run's fade-in began), the leftover for steps, and when it finished. */
  let runMs = 0;
  let acc = 0;
  let endedAt = -1;
  let tick = 0;
  let totalSteps = 1;
  let fadeRand = rng(1);

  const spec = (): RunSpec => options.runs[runIndex]!;
  const worldOf = (levelId: number, mode: ContestMode): (() => World) => {
    const level = content.levels[levelId]!;
    const mission = content.missions.levels[levelId]!;
    return () =>
      createRun({
        mode,
        level,
        mission,
        moves: content.moves,
        tables: content.tables,
        rival: null,
      });
  };
  const release = (a: Live): void => characters.detach(a.world.player);
  const retire = (age = 0): void => {
    for (const a of live) {
      if (a.fadeAt === Infinity && tick - a.born >= age)
        a.fadeAt = tick + fadeRand() * RETIRE_SPREAD_MS;
    }
  };
  const spawn = (batch: Plan['batches'][number], make: () => World): void => {
    if (batch.flag) retire();
    const t = tick;
    batch.attempts.forEach((presses, i) => {
      const world = make();
      world.restoreState(batch.state);
      characters.attachBranch(world.player, leader!.player, {
        character,
        outfit,
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

  const loadRun = async (): Promise<void> => {
    const { levelId, mode } = spec();
    status(`run ${runIndex + 1}/${options.runs.length}: level ${levelId + 1} ${mode}`);
    const res = await fetch(`/@fs/${TAS_OUT}/${levelId}-${mode}.json`);
    if (!res.ok) throw new Error(`no local TAS run ${levelId}-${mode}.json`);
    const run = (await res.json()) as { presses: string };
    const make = worldOf(levelId, mode);
    const local: Content = { world: make, moves };
    plan = makePlan(local, mode, levelId, parsePresses(run.presses), options.batch, () => {});
    // The record's length, for the bar.
    const probe = make();
    const cursor = { next: 0 };
    while (probe.step(bitsAt(probe, plan.presses, cursor)));
    totalSteps = probe.stepCount;
    for (const a of live) release(a);
    live = [];
    leader = make();
    leaderCursor = { next: 0 };
    characters = new CharacterRenderer(scene, moves, clips, skins);
    fx = new CharacterFx(echo);
    particles = new Particles(sheet, sine);
    particles.setLevel(leader.level);
    camera = new Camera(view.width, view.height);
    levels.setLevel(levelId, leader.level);
    const boss = bossOfLevel(levelId);
    character = contestCharacter(levelId, 'flags');
    outfit = mode === 'flags' ? 0 : 1;
    characters.attach(leader.player, { character, outfit, seed: 1 });
    const player = leader.player;
    const style = characterFx(skins, character, outfit, (clock) =>
      characters.swapFor(player, clock),
    );
    if (style)
      fx.add(player, { pose: () => characters.pose(player, 1), move: () => player.moveId }, style);
    const color = boss?.color ?? makeEchoColor('film', '#9ec9ff');
    attemptScene = echo.scene(color, true, skins.sceneFor(character, outfit));
    camera.reset(leader.player, leader.level);
    nextBatch = 0;
    spawned = 0;
    runMs = 0;
    acc = 0;
    endedAt = -1;
    tick = 0;
    fadeRand = rng(levelId * 2 + (mode === 'sprint' ? 1 : 0) + 77);
    spawn(plan.batches[nextBatch++]!, make);
  };

  const step = (): void => {
    const world = leader!;
    const p = plan!;
    if (endedAt < 0) {
      const going = world.step(bitsAt(world, p.presses, leaderCursor));
      characters.onEvents(world.events);
      particles.onEvents(world.events);
      if (!going) {
        endedAt = runMs;
        const r = world.rules.result;
        times[p.levelId]![spec().mode === 'flags' ? 0 : 1] = r?.time ?? world.clock;
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
      spawn(batch, worldOf(p.levelId, spec().mode));
    }
    live = live.filter((a) => {
      if (t < fadeStart(a) + FADE_OUT_MS) return true;
      release(a);
      return false;
    });
  };

  /** The run's clock: it starts after the fade-in and the hold. */
  const RUN_START = FADE_MS + HOLD_IN_MS;
  const advanceRun = (dt: number): void => {
    runMs += dt;
    if (runMs < RUN_START) return;
    acc += dt;
    while (acc >= STEP) {
      acc -= STEP;
      step();
    }
  };
  const runOver = (): boolean => endedAt >= 0 && runMs - endedAt >= HOLD_OUT_MS + FADE_MS;

  // ------------------------------------------------------------------ the game window
  const drawGame = (): void => {
    const world = leader;
    const p = plan;
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.beginPath();
    c.rect(GAME.x * k, GAME.y * k, GAME.w * k, GAME.h * k);
    c.clip();
    c.fillStyle = '#000';
    c.fillRect(GAME.x * k, GAME.y * k, GAME.w * k, GAME.h * k);
    if (world && p) {
      scene.setViewport(view.width, view.height);
      c.setTransform(scale, 0, 0, scale, GAME.x * k, GAME.y * k);
      c.imageSmoothingEnabled = false;
      const alpha = runMs < RUN_START ? 1 : acc / STEP;
      const exact = { x: camera.renderX(alpha), y: camera.renderY(alpha) };
      const clock = world.clock;
      levels.drawBackground(c, exact, view, runMs, themeOfLevel(p.levelId), camera.frameH >> 5);
      const grid = worldGrid(exact, screenPixels(c));
      const cam = grid.cam;
      c.save();
      c.translate(grid.dx, grid.dy);
      levels.drawLevelArt(c, cam, view, defaultLevelArtFrame(p.levelId));
      levels.drawMarkers(c, cam, view, world.level, world.rules, runMs);
      particles.draw(c, cam, clock, false);
      drawAttempts(cam, alpha, clock);
      fx.drawBehind(c, cam, clock, runMs, view);
      characters.drawAll(c, cam, alpha, clock, world.player);
      fx.drawFront(c, cam);
      particles.draw(c, cam, clock, true);
      c.restore();
      // The window fades from black, and back to black after the hold at the end.
      const fadeIn = 1 - Math.min(1, runMs / FADE_MS);
      const fadeOut =
        endedAt < 0 ? 0 : Math.min(1, Math.max(0, (runMs - endedAt - HOLD_OUT_MS) / FADE_MS));
      const black = Math.max(fadeIn, fadeOut);
      if (black > 0) {
        c.fillStyle = `rgba(0, 0, 0, ${black})`;
        c.fillRect(0, 0, view.width, view.height);
      }
    }
    c.restore();
  };
  const drawAttempts = (cam: CameraPos, alpha: number, clock: number): void => {
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
    applyScanlines(lctx, layer.width, layer.height, runMs);
    c.save();
    c.globalAlpha = LAYER_ALPHA;
    c.drawImage(layer, 0, 0);
    c.restore();
  };

  // ------------------------------------------------------------------ the band
  const hazard = (y: number, h: number): void => {
    c.save();
    c.setTransform(k, 0, 0, k, 0, 0);
    c.beginPath();
    c.rect(0, y, DW, h);
    c.clip();
    c.fillStyle = COLORS.hazardDark;
    c.fillRect(0, y, DW, h);
    c.fillStyle = COLORS.hazard;
    for (let x = -h * 2; x < DW + h * 2; x += 44) {
      c.beginPath();
      c.moveTo(x, y + h);
      c.lineTo(x + 22, y + h);
      c.lineTo(x + 22 + h, y);
      c.lineTo(x + h, y);
      c.closePath();
      c.fill();
    }
    c.restore();
  };
  const picture = (
    img: ImageBitmap,
    x: number,
    y: number,
    h: number,
    smooth = true,
    flip = false,
  ): number => {
    const w = (img.width / img.height) * h;
    c.save();
    c.setTransform(k, 0, 0, k, 0, 0);
    c.imageSmoothingEnabled = smooth;
    c.imageSmoothingQuality = 'high';
    if (flip) {
      c.translate(x + w, y);
      c.scale(-1, 1);
      c.drawImage(img, 0, 0, w, h);
    } else c.drawImage(img, x, y, w, h);
    c.restore();
    return w;
  };
  const drawBand = (): void => {
    rect(0, 0, DW, BAND, COLORS.band);
    hazard(0, 12);
    hazard(BAND - 12, 12);
    // Between the stripes (y 12…116): the year, the game, the remake.
    text(fontD24, '2007', 34, 34, 2, COLORS.paper);
    text(fontT12, 'ORIGINAL', 36, 84, 2, COLORS.hazard);
    const lw = picture(logo, 188, 22, 84);
    picture(blaze, 188 + lw + 6, 16, 96, true, false);
    text(fontD24, '2026', DW - 34, 34, 2, COLORS.paper, 'right');
    text(fontT12, 'REMAKE', DW - 36, 84, 2, COLORS.orange, 'right');
    const pw = (parapet.width / parapet.height) * 64;
    const px = DW - 200 - pw;
    picture(parapet, px, 32, 64);
    picture(icon, px - 86, 28, 72);
  };

  // ------------------------------------------------------------------ the panel: a rooftop over a wall
  // The left panel is a building: on its roof (under the sky and the skyline) the banner on posts
  // under lamps and an air conditioner Petra vaults; below the roof's ledge its wall carries the
  // table of the levels.
  const ROOF = 420;
  const LEDGE = 12;
  const GROUND = ROOF;
  const BOARD = { x: 76, y: 232, w: 388, h: 106 };
  const POLES = [124, 416];
  const LAMPS = [160, 270, 380];
  const BENCH_X = 236;
  interface PanelLook {
    sky: [string, string];
    sun: { x: number; y: number; r: number; color: string } | null;
    stars: boolean;
    clouds: boolean;
    fog: string | null;
    far: string;
    near: string;
    farWindows: string | null;
    nearWindows: string | null;
    roof: string;
    ledge: string;
    wall: 'brick' | 'concrete' | 'stone' | 'glass';
    wallColor: string;
    frame: string;
    face: string;
    name: string;
    handle: string;
    date: string;
    night: number;
    bulbs: boolean;
    lampsOn: boolean;
  }
  const LOOKS: Record<number, PanelLook> = {
    1: {
      sky: ['#2a1a3d', '#f28c4e'],
      sun: { x: 48, y: 214, r: 28, color: '#ffcf6a' },
      stars: false,
      clouds: false,
      fog: null,
      far: '#6b3c56',
      near: '#30203a',
      farWindows: null,
      nearWindows: '#ffcf70',
      roof: '#2a2226',
      ledge: '#b07a5e',
      wall: 'stone',
      wallColor: '#6a4334',
      frame: '#c9a63f',
      face: '#16213a',
      name: '#ffffff',
      handle: '#ffffff',
      date: '#ffd35c',
      night: 0.22,
      bulbs: false,
      lampsOn: true,
    },
    2: {
      sky: ['#060a1a', '#1f2c56'],
      sun: { x: 500, y: 170, r: 14, color: '#e9edf5' },
      stars: true,
      clouds: false,
      fog: null,
      far: '#18233f',
      near: '#0c1226',
      farWindows: '#3d5a8a',
      nearWindows: '#ffd36b',
      roof: '#15171d',
      ledge: '#4a505c',
      wall: 'concrete',
      wallColor: '#33363d',
      frame: '#e8501a',
      face: '#f7f3ea',
      name: '#111111',
      handle: '#111111',
      date: '#e8501a',
      night: 0.42,
      bulbs: true,
      lampsOn: true,
    },
    3: {
      sky: ['#6fb0e6', '#d9eef9'],
      sun: null,
      stars: false,
      clouds: true,
      fog: null,
      far: '#b3c6d4',
      near: '#8297aa',
      farWindows: '#c9d8e3',
      nearWindows: '#a9bccb',
      roof: '#4f5257',
      ledge: '#9aa0a6',
      wall: 'stone',
      wallColor: '#4a4441',
      frame: '#111111',
      face: '#ffd23a',
      name: '#111111',
      handle: '#111111',
      date: '#a8321a',
      night: 0,
      bulbs: false,
      lampsOn: false,
    },
    4: {
      sky: ['#2d4354', '#a7b8bb'],
      sun: null,
      stars: false,
      clouds: false,
      fog: 'rgba(200,214,216,0.35)',
      far: '#71868f',
      near: '#3a4f5e',
      farWindows: null,
      nearWindows: '#ffe08a',
      roof: '#2a3038',
      ledge: '#7d8890',
      wall: 'glass',
      wallColor: '#28323b',
      frame: '#f2ede4',
      face: '#1d2329',
      name: '#ffffff',
      handle: '#ffffff',
      date: '#ffd35c',
      night: 0.26,
      bulbs: false,
      lampsOn: true,
    },
  };
  const look = LOOKS[options.banner] ?? LOOKS[1]!;
  /** A fixed skyline: far and near towers, with antennas and windows (the same every frame). */
  const cityRand = rng(4242);
  const skyline = (n: number, minH: number, maxH: number) =>
    Array.from({ length: n }, (_, i) => ({
      x: Math.floor((i * PANEL) / n + cityRand() * 20 - 14),
      w: 30 + Math.floor(cityRand() * 34),
      h: minH + Math.floor(cityRand() * (maxH - minH)),
      antenna: cityRand() < 0.35,
      step: cityRand() < 0.4,
      lit: Array.from({ length: 40 }, () => cityRand() < 0.32),
    }));
  const farTowers = skyline(13, 130, 240);
  const nearTowers = skyline(10, 50, 140);
  const stars = Array.from({ length: 40 }, () => ({
    x: cityRand() * PANEL,
    y: BAND + cityRand() * 150,
    b: cityRand(),
  }));
  const clouds = Array.from({ length: 4 }, (_, i) => ({
    x: i * 150 + cityRand() * 60,
    y: BAND + 20 + cityRand() * 70,
    w: 70 + cityRand() * 60,
  }));

  /** The flickering lamp: brightness at page time `ms`. */
  const lampOn = (i: number, ms: number): number => {
    if (!look.lampsOn) return 0;
    if (i !== 2) return 1;
    const t = ms % 7300;
    if (t < 5600) return 1;
    const f = Math.floor((t - 5600) / 70);
    return [0, 1, 0, 0, 1, 0, 1, 1, 0, 0, 0, 1][f % 12] ?? 1;
  };

  const towersAt = (
    towers: typeof farTowers,
    base: number,
    color: string,
    windows: string | null,
  ): void => {
    for (const t of towers) {
      const top = base - t.h;
      c.fillStyle = color;
      c.fillRect(t.x, top, t.w, t.h);
      if (t.step) c.fillRect(t.x + 6, top - 14, t.w - 12, 14);
      if (t.antenna) c.fillRect(t.x + Math.floor(t.w / 2) - 1, top - (t.step ? 34 : 22), 2, 22);
      if (!windows) continue;
      c.fillStyle = windows;
      let n = 0;
      for (let wy = top + 8; wy < base - 4; wy += 11) {
        for (let wx = t.x + 5; wx < t.x + t.w - 5; wx += 9) {
          if (t.lit[n++ % t.lit.length]) c.fillRect(wx, wy, 4, 5);
        }
      }
    }
  };

  const drawRoofScene = (ms: number): void => {
    c.save();
    c.setTransform(k, 0, 0, k, 0, 0);
    c.beginPath();
    c.rect(0, BAND, PANEL, ROOF - BAND + LEDGE);
    c.clip();
    const sky = c.createLinearGradient(0, BAND, 0, ROOF);
    sky.addColorStop(0, look.sky[0]);
    sky.addColorStop(1, look.sky[1]);
    c.fillStyle = sky;
    c.fillRect(0, BAND, PANEL, ROOF - BAND);
    if (look.stars) {
      for (const s of stars) {
        c.fillStyle = `rgba(255,255,255,${0.35 + 0.5 * s.b})`;
        c.fillRect(Math.floor(s.x), Math.floor(s.y), 2, 2);
      }
    }
    if (look.sun) {
      c.fillStyle = look.sun.color;
      c.beginPath();
      c.arc(look.sun.x, look.sun.y, look.sun.r, 0, Math.PI * 2);
      c.fill();
    }
    if (look.clouds) {
      c.fillStyle = 'rgba(255,255,255,0.85)';
      for (const cl of clouds) {
        c.fillRect(cl.x, cl.y, cl.w, 10);
        c.fillRect(cl.x + 12, cl.y - 8, cl.w * 0.5, 10);
      }
    }
    towersAt(farTowers, ROOF, look.far, look.farWindows);
    if (look.fog) {
      c.fillStyle = look.fog;
      c.fillRect(0, ROOF - 140, PANEL, 140);
    }
    towersAt(nearTowers, ROOF - 10, look.near, look.nearWindows);
    // The roof itself.
    c.fillStyle = look.roof;
    c.fillRect(0, ROOF - 10, PANEL, 10);
    c.restore();
    // Posts, the lamps' rail and the board.
    for (const x of POLES) groundShadow(x + 10, 26, ms);
    groundShadow(BENCH_X + 32, 46, ms);
    if (jumper) {
      const p = jumper.run.world.player;
      groundShadow(BENCH_X + (p.x - 12 * 1024) / 32, 20, ms);
    }
    for (const x of POLES) {
      rect(x - 6, BOARD.y + BOARD.h, 12, ROOF - BOARD.y - BOARD.h, COLORS.iron);
      rect(x - 6, BOARD.y + BOARD.h, 4, ROOF - BOARD.y - BOARD.h, COLORS.ironLight);
      rect(x - 12, ROOF - 6, 24, 6, COLORS.iron);
    }
    rect(BOARD.x + 10, BOARD.y - 40, BOARD.w - 20, 6, COLORS.iron);
    for (const x of LAMPS) rect(x - 3, BOARD.y - 34, 6, 14, COLORS.iron);
    rect(BOARD.x - 6, BOARD.y - 6, BOARD.w + 12, BOARD.h + 12, look.frame);
    rect(BOARD.x, BOARD.y, BOARD.w, BOARD.h, look.face);
    rect(BOARD.x, BOARD.y + BOARD.h - 6, BOARD.w, 6, 'rgba(0,0,0,0.12)');
    if (look.bulbs) {
      for (let x = BOARD.x + 4; x < BOARD.x + BOARD.w; x += 18) {
        rect(x, BOARD.y - 4, 4, 4, '#ffe9a8');
        rect(x, BOARD.y + BOARD.h, 4, 4, '#ffe9a8');
      }
    }
    picture(avatar, BOARD.x + 12, BOARD.y + 12, 82);
    text(fontD16, 'Petra Radko', BOARD.x + 106, BOARD.y + 10, 2, look.name);
    c.save();
    c.setTransform(k, 0, 0, k, 0, 0);
    const yx = BOARD.x + 108;
    const yy = BOARD.y + 50;
    c.fillStyle = '#ff0000';
    c.beginPath();
    c.roundRect(yx, yy, 30, 21, 6);
    c.fill();
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.moveTo(yx + 12, yy + 6);
    c.lineTo(yx + 21, yy + 10.5);
    c.lineTo(yx + 12, yy + 15);
    c.closePath();
    c.fill();
    c.restore();
    // The handle, smaller than the name and bolded by a second pass a pixel to the right.
    const hw = spaced('@Gwynerva', BOARD.x + 154, BOARD.y + 49, 3, look.handle);
    githubMark(BOARD.x + 154 + hw + 10, BOARD.y + 50, 22, look.handle);
    text(fontT12, 'TAS · OCTOBER 28, 2026', BOARD.x + 108, BOARD.y + 80, 2, look.date);
    drawAirCon(ms);
    drawJumper(ms);
    drawLight(ms);
    LAMPS.forEach((x, i) => {
      const on = lampOn(i, ms);
      rect(x - 14, BOARD.y - 22, 28, 10, COLORS.ironLight);
      rect(x - 14, BOARD.y - 22, 28, 2, '#7a8088');
      rect(x - 10, BOARD.y - 12, 20, 4, on ? '#fff4c8' : '#4a443c');
    });
  };

  /** An air conditioner on the roof, its fan turning. */
  const drawAirCon = (ms: number): void => {
    const x = BENCH_X - 2;
    const w = 68;
    const h = 34;
    const y = ROOF - h;
    rect(x, y, w, h, '#8d9399');
    rect(x, y, w, 3, '#b3b9bf');
    rect(x + w - 3, y, 3, h, '#6b7177');
    rect(x + 4, y + h, 6, 2, '#3a3d40');
    rect(x + w - 10, y + h, 6, 2, '#3a3d40');
    for (let gy = y + 8; gy < y + h - 4; gy += 4) rect(x + 40, gy, 22, 2, '#6b7177');
    const cx = x + 20;
    const cy = y + 18;
    c.save();
    c.setTransform(k, 0, 0, k, 0, 0);
    c.fillStyle = '#3a3f44';
    c.beginPath();
    c.arc(cx, cy, 13, 0, Math.PI * 2);
    c.fill();
    c.translate(cx, cy);
    c.rotate((ms / 1000) * Math.PI * 4);
    c.fillStyle = '#c3c8cd';
    for (let b = 0; b < 4; b++) {
      c.rotate(Math.PI / 2);
      c.beginPath();
      c.ellipse(6, 0, 6, 2.6, 0.35, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = '#1e2124';
    c.beginPath();
    c.arc(0, 0, 2.5, 0, Math.PI * 2);
    c.fill();
    c.restore();
    rect(cx - 13, cy - 1, 26, 2, 'rgba(30,33,36,0.5)');
    rect(cx - 1, cy - 13, 2, 26, 'rgba(30,33,36,0.5)');
  };

  /** Darkness over the roof with each lit lamp's cone cut out of it, then a warm glow. */
  const light = document.createElement('canvas');
  const drawLight = (ms: number): void => {
    if (look.night <= 0) return;
    const w = Math.ceil(PANEL * k);
    const h = Math.ceil((ROOF + LEDGE - BAND) * k);
    if (light.width !== w || light.height !== h) {
      light.width = w;
      light.height = h;
    }
    const l = light.getContext('2d')!;
    l.setTransform(1, 0, 0, 1, 0, 0);
    l.clearRect(0, 0, w, h);
    l.setTransform(k, 0, 0, k, 0, -BAND * k);
    l.globalCompositeOperation = 'source-over';
    l.fillStyle = `rgba(4,4,12,${look.night})`;
    l.fillRect(0, BOARD.y - 46, PANEL, ROOF + LEDGE - (BOARD.y - 46));
    l.globalCompositeOperation = 'destination-out';
    LAMPS.forEach((x, i) => {
      if (!lampOn(i, ms)) return;
      const top = BOARD.y - 8;
      const g = l.createRadialGradient(x, top, 4, x, top + 40, 260);
      g.addColorStop(0, 'rgba(0,0,0,0.95)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      l.fillStyle = g;
      l.beginPath();
      l.moveTo(x - 9, top);
      l.lineTo(x + 9, top);
      l.lineTo(x + 96, ROOF + 4);
      l.lineTo(x - 96, ROOF + 4);
      l.closePath();
      l.fill();
    });
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(light, 0, Math.round(BAND * k));
    c.restore();
    c.save();
    c.setTransform(k, 0, 0, k, 0, 0);
    c.globalCompositeOperation = 'lighter';
    LAMPS.forEach((x, i) => {
      if (!lampOn(i, ms)) return;
      const top = BOARD.y - 8;
      const g = c.createRadialGradient(x, top, 2, x, top + 30, 160);
      g.addColorStop(0, 'rgba(255,214,140,0.26)');
      g.addColorStop(1, 'rgba(255,214,140,0)');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(x - 9, top);
      c.lineTo(x + 9, top);
      c.lineTo(x + 80, ROOF);
      c.lineTo(x - 80, ROOF);
      c.closePath();
      c.fill();
    });
    c.restore();
  };

  /** A soft shadow on the roof under something at x (width w), weaker for each dark lamp. */
  const groundShadow = (x: number, w: number, ms: number): void => {
    const lit = look.lampsOn ? LAMPS.reduce((n, _x, i) => n + lampOn(i, ms), 0) : 2;
    c.save();
    c.setTransform(k, 0, 0, k, 0, 0);
    const g = c.createRadialGradient(x, GROUND + 1, 1, x, GROUND + 1, w);
    g.addColorStop(0, `rgba(0,0,0,${0.18 + 0.12 * lit})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.scale(1, 0.22);
    c.beginPath();
    c.arc(x, (GROUND + 1) / 0.22, w, 0, Math.PI * 2);
    c.fill();
    c.restore();
  };

  // ------------------------------------------------------------------ the table on the wall
  const ROW_Y = ROOF + LEDGE + 38;
  const ROW_H = 38;
  const COL = { num: 22, name: 70, flags: 258, sprint: 362, pips: 466 };
  const drawWall = (): void => {
    const top = ROOF;
    rect(0, top, PANEL, 1080 - top, look.wallColor);
    c.save();
    c.setTransform(k, 0, 0, k, 0, 0);
    c.beginPath();
    c.rect(0, top + LEDGE, PANEL, 1080 - top - LEDGE);
    c.clip();
    if (look.wall === 'brick') {
      c.fillStyle = 'rgba(0,0,0,0.22)';
      for (let y = top + LEDGE, row = 0; y < 1080; y += 9, row++) {
        c.fillRect(0, y, PANEL, 1);
        for (let x = row % 2 ? 0 : 13; x < PANEL; x += 26) c.fillRect(x, y, 1, 9);
      }
    } else if (look.wall === 'concrete') {
      c.fillStyle = 'rgba(0,0,0,0.2)';
      for (let x = 0; x < PANEL; x += 135) c.fillRect(x, top, 2, 1080 - top);
      for (let i = 0; i <= 12; i += 3) c.fillRect(0, ROW_Y + i * ROW_H, PANEL, 2);
    } else if (look.wall === 'stone') {
      c.fillStyle = 'rgba(255,255,255,0.05)';
      for (let y = top + LEDGE, row = 0; y < 1080; y += 23, row++) {
        for (let x = row % 2 ? -30 : 0; x < PANEL; x += 60) c.fillRect(x + 1, y + 1, 58, 21);
      }
    } else {
      // Dark glass: a curtain wall's mullions and a sheen.
      c.fillStyle = 'rgba(255,255,255,0.06)';
      for (let x = 0; x < PANEL; x += 54) c.fillRect(x, top, 2, 1080 - top);
      const g = c.createLinearGradient(0, top, PANEL, 1080);
      g.addColorStop(0, 'rgba(255,255,255,0.08)');
      g.addColorStop(0.5, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, top, PANEL, 1080 - top);
    }
    c.restore();
    // The ledge under the roof, and its shadow on the wall.
    rect(0, top, PANEL, LEDGE, look.ledge);
    rect(0, top, PANEL, 2, 'rgba(255,255,255,0.25)');
    rect(0, top + LEDGE, PANEL, 6, 'rgba(0,0,0,0.3)');
  };
  const drawTable = (): void => {
    drawWall();
    // Rows: a darker band behind each, edges in line with the rows.
    for (let i = 0; i < 12; i++) {
      rect(
        0,
        ROW_Y + i * ROW_H,
        PANEL,
        ROW_H,
        i % 2 === 0 ? 'rgba(0,0,0,0.34)' : 'rgba(0,0,0,0.24)',
      );
      rect(0, ROW_Y + i * ROW_H, PANEL, 2, 'rgba(0,0,0,0.4)');
    }
    rect(0, ROW_Y + 12 * ROW_H, PANEL, 2, 'rgba(0,0,0,0.4)');
    const hy = ROW_Y - 26;
    text(fontT12, 'LEVEL', COL.name, hy, 2, COLORS.muted);
    text(fontT12, 'FLAGS', COL.flags + 46, hy, 2, COLORS.muted, 'center');
    text(fontT12, 'SPRINT', COL.sprint + 46, hy, 2, COLORS.muted, 'center');
    const cur = spec();
    const world = leader;
    for (let i = 0; i < 12; i++) {
      const y = ROW_Y + i * ROW_H;
      const isCur = i === cur.levelId;
      const done = times[i]![0] !== null || times[i]![1] !== null || isCur;
      const alpha = done ? 1 : 0.3;
      if (isCur) {
        c.save();
        c.setTransform(k, 0, 0, k, 0, 0);
        const g = c.createLinearGradient(0, 0, PANEL, 0);
        g.addColorStop(0, 'rgba(201,166,63,0.3)');
        g.addColorStop(1, 'rgba(201,166,63,0)');
        c.fillStyle = g;
        c.fillRect(0, y + 2, PANEL, ROW_H - 2);
        c.restore();
      }
      text(
        fontD16,
        String(i + 1).padStart(2, '0'),
        COL.num + 18,
        y + 3,
        2,
        COLORS.hazard,
        'center',
        alpha,
      );
      text(
        fontT12,
        LEVEL_NAMES[i]!,
        COL.name,
        y + 7,
        2,
        isCur ? COLORS.hazard : COLORS.paper,
        'left',
        alpha,
      );
      for (const m of [0, 1] as const) {
        const x = m === 0 ? COL.flags : COL.sprint;
        const tme = times[i]![m];
        const running = isCur && (cur.mode === 'flags' ? 0 : 1) === m && tme === null;
        if (tme !== null || running) {
          const value = tme ?? (world && runMs >= RUN_START ? world.clock : 0);
          c.save();
          c.setTransform(k, 0, 0, k, 0, 0);
          c.translate(x + 46, y + ROW_H / 2);
          c.rotate(-0.017);
          c.fillStyle = COLORS.ink;
          c.fillRect(-46 + 3, -12 + 3, 92, 24);
          c.fillStyle = running ? COLORS.hazard : COLORS.paper;
          c.fillRect(-46, -12, 92, 24);
          c.restore();
          text(fontT12, fmt(value), x + 46, y + 7, 2, COLORS.ink, 'center');
        } else {
          text(fontT12, '-:--.--', x + 46, y + 7, 2, COLORS.paper, 'center', alpha * 0.9);
        }
      }
      let lit = 0;
      if (times[i]![1] !== null) lit = 5;
      else if (isCur && world) lit = Math.min(5, progressOf(world, cur.mode));
      for (let n = 0; n < 5; n++) {
        rect(
          COL.pips + n * 11,
          y + 9,
          7,
          20,
          n < lit ? COLORS.hazard : 'rgba(255,255,255,0.14)',
          alpha,
        );
      }
    }
    const ty = ROW_Y + 12 * ROW_H + 10;
    let total = 0;
    for (const t of times) for (const v of t) total += v ?? 0;
    if (world && endedAt < 0 && runMs >= RUN_START) total += world.clock;
    text(fontT12, 'TOTAL', COL.name, ty, 2, COLORS.paper);
    text(fontD16, fmt(total), PANEL - 22, ty - 4, 2, COLORS.hazard, 'right');
    drawStreet(pageMs);
  };
  const drawBanner = (ms: number): void => drawRoofScene(ms);

  /** Small bold text with `gap` design px between letters; returns its width. */
  function spaced(str: string, x: number, y: number, gap: number, color: string): number {
    let at = x;
    for (const ch of str) {
      text(fontT12, ch, at, y, 2, color);
      text(fontT12, ch, at + 2, y, 2, color);
      at += fontT12.measure(ch) * 2 + 2 + gap;
    }
    return at - x - gap;
  }

  /** GitHub's mark (the Octocat in a circle, its 16-unit path) at (x, y), `size` across. */
  const GITHUB = new Path2D(
    'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z',
  );
  function githubMark(x: number, y: number, size: number, color: string): void {
    c.save();
    c.setTransform(k * (size / 16), 0, 0, k * (size / 16), x * k, y * k);
    c.fillStyle = color;
    c.fill(GITHUB);
    c.restore();
  }

  // ------------------------------------------------------------------ the street at the foot
  const STREET_GROUND = 1066;
  const sprite = (name: string): Promise<ImageBitmap> => image(name);
  const streetSprites = await Promise.all(
    [
      's278.png',
      's300.png',
      's304.png',
      's283.png',
      's296.png',
      's297.png',
      's298.png',
      's68.png',
      's69.png',
      's301.png',
    ].map(sprite),
  );
  const sp = (i: number): ImageBitmap => streetSprites[i]!;
  const cop = sp(0);
  const bush = sp(1);
  const bin = sp(2);
  const lampHead = sp(3);
  const pigeon = sp(4);
  const pigeonFly = sp(5);
  const pigeonFly2 = sp(6);
  const tagSpike = sp(7);
  const tagTrix = sp(8);
  const bollard = sp(9);
  /** A game sprite standing on the pavement: its bottom centre at x, `px` design px a pixel. */
  const stand = (img: ImageBitmap, x: number, px = 1, y = STREET_GROUND, flip = false): void => {
    const w = img.width * px;
    const h = img.height * px;
    c.save();
    c.setTransform(k, 0, 0, k, 0, 0);
    c.imageSmoothingEnabled = false;
    if (flip) {
      c.translate(x + w / 2, y - h);
      c.scale(-1, 1);
      c.drawImage(img, 0, 0, w, h);
    } else c.drawImage(img, Math.round(x - w / 2), Math.round(y - h), w, h);
    c.restore();
  };
  /** A repeatable 0…1 noise for event `n` of stream `salt`. */
  const noise = (n: number, salt: number): number => {
    const v = Math.sin(n * 12.9898 + salt * 78.233) * 43758.5453;
    return v - Math.floor(v);
  };
  /** Start times of a rare, irregular event: gaps between `min` and `max` ms. */
  const schedule = (salt: number, first: number, min: number, max: number): number[] => {
    const times: number[] = [];
    for (let t = first, n = 0; t < 40 * 60_000; n++) {
      times.push(t);
      t += min + noise(n, salt) * (max - min);
    }
    return times;
  };
  /** The latest event at or before `ms`: its index and how long ago it started. */
  const lastOf = (times: number[], ms: number): { n: number; age: number } => {
    let n = -1;
    while (n + 1 < times.length && times[n + 1]! <= ms) n++;
    return { n, age: n < 0 ? Infinity : ms - times[n]! };
  };
  const COP_PEEKS = schedule(1, 7000, 13_000, 31_000);
  const PIGEON_FLIGHTS = schedule(2, 12_000, 17_000, 43_000);
  /** The policeman behind the bush: up, a look round of 1.2…3 s, down again. */
  const copRise = (ms: number): number => {
    const { n, age } = lastOf(COP_PEEKS, ms);
    const stay = 1200 + noise(n, 3) * 1800;
    if (age < 400) return age / 400;
    if (age < 400 + stay) return 1;
    if (age < 800 + stay) return 1 - (age - 400 - stay) / 400;
    return 0;
  };
  const copBehindBush = (x: number, ms: number, px: number): void => {
    // The cop stands behind the bush, hidden; he rises to peek over it.
    const rise = copRise(ms);
    const hidden = Math.round(34 * px);
    c.save();
    c.beginPath();
    c.setTransform(k, 0, 0, k, 0, 0);
    c.rect(0, 0, PANEL, STREET_GROUND);
    c.clip();
    stand(cop, x, px, STREET_GROUND + hidden - Math.round(rise * 30 * px), ms % 2400 < 1200);
    c.restore();
    stand(bush, x, px);
  };
  /** A park bench: green slats on a cast-iron frame, `x` its left end. */
  const drawParkBench = (x: number): void => {
    const g = STREET_GROUND;
    const iron = '#2b2e33';
    const slat = '#3f7a4a';
    const slatLight = '#5b9a63';
    rect(x + 4, g - 40, 6, 40, iron);
    rect(x + 80, g - 40, 6, 40, iron);
    rect(x + 2, g - 20, 86, 3, iron);
    for (const y of [g - 40, g - 33]) {
      rect(x, y, 90, 5, slat);
      rect(x, y, 90, 1, slatLight);
    }
    rect(x - 4, g - 22, 98, 6, slat);
    rect(x - 4, g - 22, 98, 1, slatLight);
    rect(x, g - 16, 4, 16, iron);
    rect(x + 86, g - 16, 4, 16, iron);
  };
  /** The flying pigeon: from the pavement up to the total's clock, every 8 s. */
  const PIGEON_FROM = { x: 240, y: STREET_GROUND - 2 };
  const PIGEON_TO = { x: 470, y: 948 };
  const drawStreet = (ms: number): void => {
    // The pavement and its curb, a warm wash from the sunset low on the wall.
    rect(0, STREET_GROUND, PANEL, 1080 - STREET_GROUND, '#2a2120');
    rect(0, STREET_GROUND - 3, PANEL, 3, '#8a6250');
    c.save();
    c.setTransform(k, 0, 0, k, 0, 0);
    const g = c.createLinearGradient(0, STREET_GROUND - 80, 0, STREET_GROUND);
    g.addColorStop(0, 'rgba(255,150,90,0)');
    g.addColorStop(1, 'rgba(255,150,90,0.14)');
    c.fillStyle = g;
    c.fillRect(0, STREET_GROUND - 80, PANEL, 80);
    c.restore();
    // Graffiti on the wall behind.
    c.save();
    c.globalAlpha = 0.72;
    stand(tagSpike, 186, 1, STREET_GROUND - 44);
    stand(tagTrix, 330, 1, STREET_GROUND - 30);
    c.restore();
    // A lamp at the curb, the bench under it, the bin, the policeman behind a bush, a bollard.
    rect(33, STREET_GROUND - 92, 4, 92, '#3d4146');
    rect(33, STREET_GROUND - 92, 1, 92, '#5c6168');
    stand(lampHead, 35, 1.5, STREET_GROUND - 90);
    drawParkBench(92);
    stand(bin, 298, 1.5);
    copBehindBush(400, ms, 1.5);
    stand(bollard, 500, 2);
    // Pigeons: one pecking on the pavement, one flying up towards the total's clock.
    const peck = noise(Math.floor(ms / 300), 4) < 0.3;
    stand(pigeon, 208, 2.5, STREET_GROUND + (peck ? 2 : 0));
    // The other flies off now and then and comes back some seconds later.
    const flight = lastOf(PIGEON_FLIGHTS, ms);
    const t = flight.age / 2600;
    const back = 2600 + 4000 + noise(flight.n, 5) * 5000;
    if (t < 1) {
      const e = t * t * (3 - 2 * t);
      const x = PIGEON_FROM.x + (PIGEON_TO.x - PIGEON_FROM.x) * e;
      const y = PIGEON_FROM.y + (PIGEON_TO.y - PIGEON_FROM.y) * e - Math.sin(t * Math.PI) * 24;
      const flap = Math.floor(ms / 110) % 2 === 0 ? pigeonFly : pigeonFly2;
      c.save();
      c.globalAlpha = Math.min(1, (1 - t) * 6);
      stand(flap, x, 2.5, y);
      c.restore();
    } else if (flight.age >= back) {
      c.save();
      c.globalAlpha = Math.min(1, (flight.age - back) / 400);
      stand(pigeon, PIGEON_FROM.x, 2.5, PIGEON_FROM.y + 2, true);
      c.restore();
    }
  };

  // Petra vaulting the bench: the Moves screen's demos, in her outfits, fading in and out.
  const DEMOS = ['monkeyVault', 'tigerJump', 'monkeyFlip', 'spiderJump']
    .map((m) => MOVE_DEMOS.find((d) => d.move === m))
    .filter((d): d is MoveDemoData => !!d);
  const jumpChars = new CharacterRenderer(scene, moves, clips, skins);
  let jumper: { run: DemoRun; born: number; acc: number } | null = null;
  let jumperCount = 0;
  let nextJump = 5000;
  const startJumper = (ms: number): void => {
    const data = DEMOS[jumperCount % DEMOS.length]!;
    const run = new DemoRun(data, { moves: content.moves, tables: content.tables });
    jumpChars.attach(run.world.player, {
      character: contestCharacter(0, 'flags'),
      outfit: jumperCount % 8,
      seed: jumperCount + 5,
    });
    jumper = { run, born: ms, acc: 0 };
    jumperCount++;
  };
  const advanceJumper = (ms: number, dt: number): void => {
    if (!jumper && ms >= nextJump) startJumper(ms);
    if (!jumper) return;
    jumper.acc += dt;
    while (jumper.acc >= STEP) {
      jumper.acc -= STEP;
      const events = jumper.run.step();
      jumpChars.onEvents(events);
      jumpChars.step(jumper.run.world.clock, STEP);
    }
    if (jumper.run.done) {
      jumpChars.detach(jumper.run.world.player);
      jumper = null;
      nextJump = ms + 9000 + noise(jumperCount, 6) * 16_000;
    }
  };
  const drawJumper = (ms: number): void => {
    if (!jumper) return;
    const run = jumper.run;
    const age = ms - jumper.born;
    const left = (run.data.steps - run.stepCount) * STEP;
    const alpha = Math.min(1, age / 400, left / 500);
    if (alpha <= 0) return;
    const PX = 1; // design px per game px
    c.save();
    c.setTransform(k * PX, 0, 0, k * PX, 0, 0);
    c.beginPath();
    c.rect(0, BAND, PANEL / PX, (1080 - BAND) / PX);
    c.clip();
    c.globalAlpha = alpha;
    c.imageSmoothingEnabled = false;
    scene.setViewport(PANEL / PX, 1080 / PX);
    const cam: CameraPos = { x: 12 * 1024 - (BENCH_X / PX) * 32, y: 6 * 1024 - (GROUND / PX) * 32 };
    jumpChars.drawAll(c, cam, jumper.acc / STEP, run.world.clock);
    c.restore();
  };

  // ------------------------------------------------------------------ the presses bar
  const drawBar = (): void => {
    rect(BAR.x, BAR.y, BAR.w, BAR.h, '#1d1b1a');
    const p = plan;
    const world = leader;
    if (!p || !world) return;
    const x0 = BAR.x + 30;
    const w = BAR.w - 60;
    const xs = (s: number): number => x0 + (s / totalSteps) * w;
    const fade =
      Math.min(1, runMs / FADE_MS) *
      (endedAt < 0 ? 1 : 1 - Math.min(1, Math.max(0, (runMs - endedAt - HOLD_OUT_MS) / FADE_MS)));
    const now = world.stepCount;
    rect(x0, BAR.y + 46, w, 6, '#3b3634', fade);
    rect(x0, BAR.y + 46, xs(now) - x0, 6, COLORS.hazard, fade);
    c.save();
    c.setTransform(k, 0, 0, k, 0, 0);
    c.lineWidth = 3;
    c.lineCap = 'square';
    for (const pr of p.presses) {
      const x = xs(pr.step);
      const y = BAR.y + 24;
      c.globalAlpha = fade * (pr.step <= now ? 1 : 0.32);
      c.strokeStyle = KEY_COLORS[pr.key];
      c.beginPath();
      if (pr.key === 1) {
        c.moveTo(x - 7, y + 4);
        c.lineTo(x, y - 4);
        c.lineTo(x + 7, y + 4);
      } else if (pr.key === 2) {
        c.moveTo(x - 7, y - 4);
        c.lineTo(x, y + 4);
        c.lineTo(x + 7, y - 4);
      } else if (pr.key === 4) {
        c.moveTo(x + 4, y - 7);
        c.lineTo(x - 4, y);
        c.lineTo(x + 4, y + 7);
      } else {
        c.moveTo(x - 4, y - 7);
        c.lineTo(x + 4, y);
        c.lineTo(x - 4, y + 7);
      }
      c.stroke();
    }
    c.restore();
    rect(xs(now) - 2, BAR.y + 38, 4, 22, '#ffffff', fade);
  };

  // ------------------------------------------------------------------ frame
  let pageMs = 0;
  const draw = (): void => {
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#000';
    c.fillRect(0, 0, canvas.width, canvas.height);
    drawGame();
    drawTable();
    drawBanner(pageMs);
    drawBar();
    drawBand();
  };
  const advance = (dt: number): void => {
    pageMs += dt;
    advanceRun(dt);
    advanceJumper(pageMs, dt);
  };

  // ------------------------------------------------------------------ rendering
  if (options.at > 0) {
    await loadRun();
    for (let t = 0; t < options.at; t += 1000 / FPS) advance(1000 / FPS);
    draw();
    status('');
    statusBox.style.display = 'none';
    return;
  }
  if (!options.render) {
    await loadRun();
    let last = performance.now();
    const loop = async (): Promise<void> => {
      const now = performance.now();
      advance(Math.min(100, now - last));
      last = now;
      if (runOver() && runIndex + 1 < options.runs.length) {
        runIndex++;
        await loadRun();
      }
      draw();
      requestAnimationFrame(() => void loop());
    };
    void loop();
    return;
  }
  const base = {
    width: canvas.width,
    height: canvas.height,
    bitrate: options.mbps * 1e6,
    bitrateMode: 'variable' as const,
    framerate: FPS,
    latencyMode: 'quality' as const,
  };
  const tries: VideoEncoderConfig[] = [
    {
      ...base,
      codec: 'avc1.640033',
      hardwareAcceleration: 'prefer-hardware',
      avc: { format: 'annexb' },
    },
    {
      ...base,
      codec: 'avc1.640033',
      hardwareAcceleration: 'no-preference',
      avc: { format: 'annexb' },
    },
  ];
  let config: VideoEncoderConfig | null = null;
  for (const t of tries) {
    const support = await VideoEncoder.isConfigSupported(t).catch(() => null);
    if (support?.supported) {
      config = t;
      break;
    }
  }
  if (!config) throw new Error('no H.264 encoder in this size');
  const name = `${options.name}.h264`;
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
  encoder.configure(config);
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
  let frame = 0;
  for (runIndex = 0; runIndex < options.runs.length; runIndex++) {
    await loadRun();
    for (;;) {
      if (failure) throw failure;
      advance(1000 / FPS);
      draw();
      const img = new VideoFrame(canvas, { timestamp: frame * frameUs, duration: frameUs });
      encoder.encode(img, { keyFrame: frame % (FPS * 2) === 0 });
      img.close();
      frame++;
      if (encoder.encodeQueueSize > 4)
        await new Promise((done) => encoder.addEventListener('dequeue', done, { once: true }));
      if (bytes > 8e6) await send();
      if (frame % FPS === 0)
        status(`rendering ${name}: run ${runIndex + 1}/${options.runs.length}, ${frame / FPS} s`);
      if (runOver()) break;
    }
  }
  await encoder.flush();
  encoder.close();
  await send();
  status(`muxing ${name}…`);
  const res = await fetch(`/dev/reel-finish?name=${name}&fps=${FPS}`, { method: 'POST' });
  status(
    res.ok
      ? `rendered ${options.runs.length} runs into packages/tools/tas-out/reel`
      : `not saved: ${await res.text()}`,
  );
}

main().catch((err: unknown) => {
  $('status').textContent = String(err);
  console.error(err);
});
