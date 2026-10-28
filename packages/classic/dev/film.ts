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
    batch: q.get('n') !== null ? Number(q.get('n')) : 6,
    render: q.get('render') === '1',
    mbps: Number(q.get('mbps')) || 40,
    name: /^[\w-]+$/.test(q.get('name') ?? '') ? q.get('name')! : 'tas-film',
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
    image('avatar.png'),
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
  let splits: number[] = [];
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
    // The record's splits (flags or checkpoints, and the finish) for the bar.
    const probe = make();
    const cursor = { next: 0 };
    let progress = 0;
    splits = [];
    for (;;) {
      const going = probe.step(bitsAt(probe, plan.presses, cursor));
      const now = progressOf(probe, mode);
      if (now !== progress) {
        progress = now;
        splits.push(probe.stepCount);
      }
      if (!going) break;
    }
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

  // ------------------------------------------------------------------ the table
  const ROW_Y = 176;
  const ROW_H = 50;
  const COL = { num: 22, name: 70, flags: 258, sprint: 362, pips: 466 };
  const drawTable = (): void => {
    rect(0, BAND, PANEL, 1080 - BAND, COLORS.concrete);
    // Row bands line up with the rows.
    for (let i = 0; i < 12; i++) {
      if (i % 2 === 0) rect(0, ROW_Y + i * ROW_H, PANEL, ROW_H, COLORS.concreteLight);
      rect(0, ROW_Y + i * ROW_H, PANEL, 2, COLORS.rule);
    }
    rect(0, ROW_Y + 12 * ROW_H, PANEL, 2, COLORS.rule);
    text(fontT12, 'LEVEL', COL.name, 146, 2, COLORS.muted);
    text(fontT12, 'FLAGS', COL.flags + 46, 146, 2, COLORS.muted, 'center');
    text(fontT12, 'SPRINT', COL.sprint + 46, 146, 2, COLORS.muted, 'center');
    const cur = spec();
    const world = leader;
    for (let i = 0; i < 12; i++) {
      const y = ROW_Y + i * ROW_H;
      const isCur = i === cur.levelId;
      const done = times[i]![0] !== null || times[i]![1] !== null || isCur;
      const alpha = done ? 1 : 0.28;
      if (isCur) {
        c.save();
        c.setTransform(k, 0, 0, k, 0, 0);
        const g = c.createLinearGradient(0, 0, PANEL, 0);
        g.addColorStop(0, 'rgba(201,166,63,0.22)');
        g.addColorStop(1, 'rgba(201,166,63,0)');
        c.fillStyle = g;
        c.fillRect(0, y + 2, PANEL, ROW_H - 2);
        c.restore();
      }
      text(
        fontD16,
        String(i + 1).padStart(2, '0'),
        COL.num + 18,
        y + 9,
        2,
        COLORS.hazard,
        'center',
        alpha,
      );
      text(
        fontT12,
        LEVEL_NAMES[i]!,
        COL.name,
        y + 13,
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
          c.fillRect(-46 + 3, -15 + 3, 92, 30);
          c.fillStyle = running ? COLORS.hazard : COLORS.paper;
          c.fillRect(-46, -15, 92, 30);
          c.restore();
          text(fontT12, fmt(value), x + 46, y + 13, 2, COLORS.ink, 'center');
        } else {
          text(fontT12, '-:--.--', x + 46, y + 13, 2, COLORS.paper, 'center', alpha * 0.9);
        }
      }
      // Progress: five marks, the flags or checkpoints of the run on now, all lit once done.
      let lit = 0;
      if (times[i]![1] !== null) lit = 5;
      else if (isCur && world) lit = Math.min(5, progressOf(world, cur.mode));
      for (let n = 0; n < 5; n++) {
        rect(COL.pips + n * 11, y + 15, 7, 20, n < lit ? COLORS.hazard : '#4c4441', alpha);
      }
    }
    // The total so far.
    const ty = ROW_Y + 12 * ROW_H + 14;
    let total = 0;
    for (const t of times) for (const v of t) total += v ?? 0;
    text(fontT12, 'TOTAL', COL.name, ty, 2, COLORS.paper);
    text(fontD16, fmt(total), PANEL - 22, ty - 4, 2, COLORS.hazard, 'right');
  };

  // ------------------------------------------------------------------ the banner, lamps, bench
  const GROUND = 1068;
  const BOARD = { x: 56, y: 872, w: 428, h: 118 };
  const POLES = [104, 424];
  const LAMPS = [148, 270, 392];
  /** The flickering lamp: brightness at page time `ms`. */
  const lampOn = (i: number, ms: number): number => {
    if (i !== 2) return 1;
    const t = ms % 7300;
    if (t < 5600) return 1;
    const f = Math.floor((t - 5600) / 70);
    return [0, 1, 0, 0, 1, 0, 1, 1, 0, 0, 0, 1][f % 12] ?? 1;
  };
  const drawBanner = (ms: number): void => {
    rect(0, GROUND, PANEL, 1080 - GROUND, '#1a1716');
    for (const x of POLES) {
      rect(x - 6, BOARD.y + BOARD.h, 12, GROUND - BOARD.y - BOARD.h, COLORS.iron);
      rect(x - 6, BOARD.y + BOARD.h, 4, GROUND - BOARD.y - BOARD.h, COLORS.ironLight);
      rect(x - 12, GROUND - 6, 24, 6, COLORS.iron);
    }
    // Lamp arms on a rail above the board, and their light on it.
    rect(BOARD.x + 10, BOARD.y - 40, BOARD.w - 20, 6, COLORS.iron);
    LAMPS.forEach((x, i) => {
      const on = lampOn(i, ms);
      rect(x - 3, BOARD.y - 34, 6, 14, COLORS.iron);
      rect(x - 14, BOARD.y - 22, 28, 10, COLORS.ironLight);
      rect(x - 10, BOARD.y - 12, 20, 4, on ? '#fff4c8' : '#5a5246');
    });
    // The board: an iron frame, a paper face lit by the lamps.
    rect(BOARD.x - 6, BOARD.y - 6, BOARD.w + 12, BOARD.h + 12, COLORS.iron);
    rect(BOARD.x, BOARD.y, BOARD.w, BOARD.h, '#e4ddd0');
    LAMPS.forEach((x, i) => {
      const on = lampOn(i, ms);
      if (on) {
        c.save();
        c.setTransform(k, 0, 0, k, 0, 0);
        const g = c.createRadialGradient(x, BOARD.y - 8, 2, x, BOARD.y + 40, 90);
        g.addColorStop(0, 'rgba(255,248,220,0.75)');
        g.addColorStop(1, 'rgba(255,248,220,0)');
        c.fillStyle = g;
        c.beginPath();
        c.moveTo(x - 10, BOARD.y - 8);
        c.lineTo(x + 10, BOARD.y - 8);
        c.lineTo(x + 70, BOARD.y + BOARD.h);
        c.lineTo(x - 70, BOARD.y + BOARD.h);
        c.closePath();
        c.fill();
        c.restore();
      }
    });
    const dim = 1 - (1 - lampOn(2, ms)) * 0.22;
    if (dim < 1) rect(BOARD.x + BOARD.w * 0.62, BOARD.y, BOARD.w * 0.38, BOARD.h, '#000', 1 - dim);
    c.save();
    c.setTransform(k, 0, 0, k, 0, 0);
    c.beginPath();
    c.arc(BOARD.x + 54, BOARD.y + 59, 42, 0, Math.PI * 2);
    c.fillStyle = COLORS.ink;
    c.fill();
    c.restore();
    picture(avatar, BOARD.x + 14, BOARD.y + 19, 80);
    text(fontD16, 'Petra Radko', BOARD.x + 110, BOARD.y + 14, 2, COLORS.ink);
    // The YouTube mark: a red rounded box with a white play triangle.
    c.save();
    c.setTransform(k, 0, 0, k, 0, 0);
    const yx = BOARD.x + 112;
    const yy = BOARD.y + 54;
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
    text(fontT12, '@Gwynerva', BOARD.x + 150, BOARD.y + 54, 2, COLORS.ink);
    text(fontT12, 'TAS · OCTOBER 28, 2026', BOARD.x + 112, BOARD.y + 86, 2, COLORS.orange);
    drawBench();
    drawJumper(ms);
  };
  const BENCH_X = 236;
  const drawBench = (): void => {
    rect(BENCH_X - 6, GROUND - 22, 76, 6, '#7a5a3a');
    rect(BENCH_X - 6, GROUND - 22, 76, 2, '#9b7650');
    rect(BENCH_X - 6, GROUND - 34, 76, 5, '#7a5a3a');
    rect(BENCH_X, GROUND - 16, 6, 16, COLORS.iron);
    rect(BENCH_X + 58, GROUND - 16, 6, 16, COLORS.iron);
  };

  // Petra vaulting the bench: the Moves screen's demos, in her outfits, fading in and out.
  const DEMOS = ['monkeyVault', 'tigerJump', 'monkeyFlip', 'spiderJump']
    .map((m) => MOVE_DEMOS.find((d) => d.move === m))
    .filter((d): d is MoveDemoData => !!d);
  const jumpChars = new CharacterRenderer(scene, moves, clips, skins);
  let jumper: { run: DemoRun; born: number; acc: number } | null = null;
  let jumperCount = 0;
  let nextJump = 2500;
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
      nextJump = ms + 3500;
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
    for (const s of splits) rect(xs(s) - 1, BAR.y + 42, 2, 14, COLORS.muted, fade);
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
