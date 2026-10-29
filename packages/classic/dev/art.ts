/**
 * The promotional pictures (dev server only, `dev/art.html`), drawn with the game's renderers:
 * pieces of the levels laid over one another like cards, a boss running on each with its
 * effect, the logo on a narrow pennant at the left. A boss runs into its shot, or does a trick
 * of the Moves menu with every flourish of its effect (a shot, a singularity, a hologram chain);
 * a card shows a piece of a level or the boss's own world. The README's banner, its Play button
 * and a collage of tricks without the logo go to `docs/`, the link previews (Open Graph) to
 * `packages/classic/public/og-*.png`; Save sends them to the dev server (`build/devEndpoints.ts`, POST
 * /dev/save-art). `?scout=1` draws every place a shot can stand on (the start and the flags of
 * every mission) and the keyframes.
 */
import { Level, STEP, type LevelData } from '@parapet/sim';
import {
  CharacterRenderer,
  drawPose,
  type CharacterPose,
} from '@parapet/runtime/render/CharacterRenderer.ts';
import { applyScanlines } from '@parapet/runtime/render/Hologram.ts';
import { makeEchoColor } from '@parapet/runtime/render/EchoSkin.ts';
import { CharacterFx, type FxStyle } from '@parapet/runtime/render/fx/CharacterFx.ts';
import type { FxFile } from '@parapet/runtime/render/fx/FxData.ts';
import { compileFx } from '@parapet/runtime/render/fx/FxSheet.ts';
import { defaultLevelArtFrame, themeOfLevel } from '@parapet/runtime/render/LevelRenderer.ts';
import type { ResolvedLook } from '@parapet/runtime/render/Look.ts';
import { SceneRenderer } from '@parapet/runtime/render/SceneRenderer.ts';
import { StageRenderer } from '@parapet/runtime/render/Stage.ts';
import { DemoRun } from '@parapet/runtime/moves/MoveDemo.ts';
import { Theme } from '@parapet/runtime/ui/theme.ts';
import {
  allBosses,
  characterFx,
  contestCharacter,
  effectOf,
  type Boss,
} from '../src/app/bosses.ts';
import { loadContent } from '../src/assets/content.ts';
import { loadFonts } from '../src/assets/fonts.ts';
import { forced } from './flourishes.ts';
import { UNITS_PER_PX } from '@parapet/runtime/render/View.ts';
import { createRenderers } from '../src/app/renderers.ts';
import { $ } from './dom.ts';
import { MOVE_DEMOS } from '../src/assets/demos.ts';

const TILE = 1024;
const FRAME_MS = 110;
const RUN_PX = 130;
/** How long a runner runs into its shot, so its effect and cloth trail behind it. */
const LEAD_MS = 1500;
/** The icon's colours (`packages/tools/src/icons.ts`) and the row its parapet starts on. */
const ICON_ORANGE = [255, 176, 0];
const ICON_ORANGE_DARK = [184, 116, 0];
const ICON_LINE = [58, 70, 84];
const PARAPET_ROW = 21;
/** Tiles with a floor on top (`PIT_FLOOR_TILES` of the level). */
const FLOOR_TILES = new Set([1, 3, 5, 6, 7, 8]);

/** A boss on a level or in its world: where (a mission's start or flag), in which outfit and pose. */
interface Shot {
  level: number;
  /** Mission section of the level (its start and flags). */
  mission: number;
  /** -1: the start, else the flag. */
  at: number;
  /** The boss running there; empty: just the place (the card under the pennant). */
  boss: string;
  outfit: number;
  /** Keyframe of the final pose; -1: running. */
  frame: number;
  /** Feet in the card, as fractions of its box. */
  feet: [number, number];
  /** Shift from the place, in px (x along the run, y up). */
  shift?: [number, number];
  /** Running left. */
  left?: boolean;
  /** Drawn this many times bigger (a scene to read in a small preview). */
  zoom?: number;
  /** A rival racing alongside as an echo, the game's hologram of a recorded run. */
  rival?: Rival;
  /** A trick instead of the run (`frame` unused). */
  trick?: Trick;
  /** The boss's own world (its stage, as on the character screen) instead of the level. */
  world?: boolean;
  /** How far the world has scrolled by, in px (which part of it shows). */
  scroll?: number;
}

/**
 * A demo of the Moves menu (`content/moves/demos.json`) played by the boss with every flourish
 * of its effect, shown `ms` after its move starts; the demo's ground at the place's floor and the
 * boss at `feet` across (the demo's blocks and walls are not drawn).
 */
interface Trick {
  move: string;
  ms: number;
  seed?: number;
  /** The demo's ground: where it starts (default), or the floor under the boss when shown. */
  ground?: 'start' | 'under';
}

/**
 * The echo a runner races: a boss as the game's hologram of a recorded run, doing a trick
 * `ahead` px in front of the runner, with afterimages along the trick's own path.
 */
interface Rival {
  boss: string;
  outfit: number;
  trick: Trick;
  ahead: number;
  /** Up from the runner's floor, in px. */
  rise?: number;
  /** The afterimages: how many ms before the pose shown each one is. */
  trail: readonly number[];
}

/** The rival's hologram colour (the game's cyan echo) and the dark rim around its pose. */
const RIVAL_COLOR = makeEchoColor('cyan', '#2ee6ff');
const RIVAL_RIM = '#04141c';

/** The README's banner: the place under the pennant, then the cards left to right. */
const BANNER_SHOTS: Shot[] = [
  { level: 10, mission: 1, at: 3, boss: '', outfit: 0, frame: -1, feet: [0.5, 0.84] },
  {
    level: 2,
    mission: 0,
    at: -1,
    boss: 'grove',
    outfit: 0,
    frame: -1,
    feet: [0.5, 0.84],
    trick: { move: 'monkeyVault', ms: 2010 },
  },
  {
    level: 3,
    mission: 0,
    at: -1,
    boss: 'vera',
    outfit: 0,
    frame: -1,
    feet: [0.5, 0.84],
    trick: { move: 'backFlip', ms: 1740 },
  },
  {
    level: 4,
    mission: 0,
    at: -1,
    boss: 'b2',
    outfit: 0,
    frame: -1,
    feet: [0.5, 0.84],
    trick: { move: 'backFlip', ms: 1410 },
  },
  {
    level: 8,
    mission: 0,
    at: -1,
    boss: 'five',
    outfit: 0,
    frame: -1,
    feet: [0.5, 0.84],
    trick: { move: 'monkeyVault', ms: 2070 },
  },
  {
    level: 10,
    mission: 1,
    at: -1,
    boss: 'shahzada',
    outfit: 0,
    frame: -1,
    feet: [0.5, 0.84],
    trick: { move: 'frontFlip', ms: 1380 },
  },
];
/**
 * The challenge links' preview: a runner mid-trick with its effect, and just ahead of it the
 * echo it races, the hologram of a rival's run caught in its own trick, drawn big enough to
 * read in a chat's small preview.
 */
const RACE_SHOTS: Shot[] = [
  { level: 10, mission: 1, at: 3, boss: '', outfit: 0, frame: -1, feet: [0.5, 0.84] },
  {
    level: 9,
    mission: 0,
    at: 1,
    boss: 'vera',
    outfit: 0,
    frame: -1,
    feet: [0.22, 0.84],
    zoom: 2,
    trick: { move: 'monkeyVault', ms: 2010 },
    rival: {
      boss: 'petra',
      outfit: 0,
      trick: { move: 'jump', ms: 1500 },
      ahead: 58,
      rise: 6,
      trail: [240, 120],
    },
  },
];
const RACE_TAGLINE = 'Race my ghost! Can you beat my time?';
/** The link preview: the place under the pennant, then the cards. */
const OG_SHOTS: Shot[] = [
  { level: 10, mission: 1, at: 3, boss: '', outfit: 0, frame: -1, feet: [0.5, 0.84] },
  {
    level: 0,
    mission: 1,
    at: 1,
    boss: 'petra',
    outfit: 5,
    frame: -1,
    feet: [0.36, 0.84],
    trick: { move: 'monkeyFlip', ms: 1350 },
  },
  {
    level: 6,
    mission: 1,
    at: 1,
    boss: 'widow',
    outfit: 0,
    frame: -1,
    feet: [0.35, 0.84],
    trick: { move: 'monkeyVault', ms: 2310 },
  },
  {
    level: 11,
    mission: 1,
    at: -1,
    boss: 'azure',
    outfit: 0,
    frame: -1,
    feet: [0.55, 0.84],
    trick: { move: 'frontFlip', ms: 1290 },
  },
];

/** The collage without the logo: every boss in its own world at the height of a trick. */
const COLLAGE_ROWS: Shot[][] = [
  [
    {
      level: 0,
      mission: 0,
      at: -1,
      boss: 'petra',
      outfit: 5,
      frame: -1,
      feet: [0.45, 0.92],
      world: true,
      trick: { move: 'monkeyFlip', ms: 1350 },
    },
    {
      level: 1,
      mission: 0,
      at: -1,
      boss: 'rewind',
      outfit: 0,
      frame: -1,
      feet: [0.45, 0.92],
      world: true,
      trick: { move: 'backFlip', ms: 1380 },
    },
    {
      level: 2,
      mission: 0,
      at: -1,
      boss: 'grove',
      outfit: 0,
      frame: -1,
      feet: [0.45, 0.92],
      world: true,
      trick: { move: 'monkeyVault', ms: 2010 },
    },
    {
      level: 3,
      mission: 0,
      at: -1,
      boss: 'vera',
      outfit: 0,
      frame: -1,
      feet: [0.45, 0.92],
      world: true,
      trick: { move: 'backFlip', ms: 1740 },
    },
  ],
  [
    {
      level: 4,
      mission: 0,
      at: -1,
      boss: 'b2',
      outfit: 0,
      frame: -1,
      feet: [0.5, 0.92],
      world: true,
      trick: { move: 'backFlip', ms: 1410 },
    },
    {
      level: 5,
      mission: 0,
      at: -1,
      boss: 'sir-nobody',
      outfit: 0,
      frame: -1,
      feet: [0.45, 0.92],
      world: true,
      trick: { move: 'monkeyVault', ms: 1980 },
    },
    {
      level: 6,
      mission: 0,
      at: -1,
      boss: 'widow',
      outfit: 0,
      frame: -1,
      feet: [0.3, 0.92],
      world: true,
      trick: { move: 'monkeyVault', ms: 2310 },
    },
    {
      level: 7,
      mission: 0,
      at: -1,
      boss: 'rush-b',
      outfit: 0,
      frame: -1,
      feet: [0.45, 0.92],
      world: true,
      trick: { move: 'tigerJump', ms: 1110 },
    },
  ],
  [
    {
      level: 8,
      mission: 0,
      at: -1,
      boss: 'five',
      outfit: 0,
      frame: -1,
      feet: [0.5, 0.92],
      world: true,
      trick: { move: 'monkeyVault', ms: 2070 },
    },
    {
      level: 9,
      mission: 0,
      at: -1,
      boss: 'flittermouse',
      outfit: 0,
      frame: -1,
      feet: [0.45, 0.92],
      world: true,
      trick: { move: 'monkeyFlip', ms: 1350 },
    },
    {
      level: 10,
      mission: 0,
      at: -1,
      boss: 'shahzada',
      outfit: 0,
      frame: -1,
      feet: [0.45, 0.92],
      world: true,
      trick: { move: 'frontFlip', ms: 1380 },
    },
    {
      level: 11,
      mission: 0,
      at: -1,
      boss: 'azure',
      outfit: 0,
      frame: -1,
      feet: [0.55, 0.92],
      world: true,
      trick: { move: 'frontFlip', ms: 1290 },
    },
  ],
];

async function main(): Promise<void> {
  const [content, fonts] = await Promise.all([loadContent(), loadFonts()]);
  const { small, display, title } = fonts;
  const image = (src: string): Promise<HTMLImageElement> =>
    new Promise((done, fail) => {
      const img = new Image();
      img.onload = () => done(img);
      img.onerror = fail;
      img.src = src;
    });
  // The app icon, and the race's (its runner with its echo) for the challenge links' preview.
  const [icon, raceIcon] = await Promise.all([
    image('/icons/favicon-32.png'),
    image('/icons/race-32.png'),
  ]);
  const { scene, level: levels, skins, echo, clips, moves } = createRenderers(content);
  const run = content.anims.demos[0]!;
  const bosses = new Map(allBosses().map((b) => [b.id, b]));
  const stages = new Map<Boss, StageRenderer>();
  const stageOf = (boss: Boss): StageRenderer | null => {
    if (!boss.stage) return null;
    let stage = stages.get(boss);
    if (!stage) {
      stage = new StageRenderer(boss.stage, boss.data.color);
      stages.set(boss, stage);
    }
    return stage;
  };
  const forcedFx = new Map<Boss, FxFile>();
  /** A boss's effect with every flourish coming (`flourishes.ts`). */
  const trickStyle = (
    boss: Boss,
    look: ResolvedLook,
    swap: FxStyle['swap'],
    source: SceneRenderer,
    seed: number,
  ): FxStyle | null => {
    if (!boss.fx) return null;
    let file = forcedFx.get(boss);
    if (!file) {
      file = forced(boss.fx);
      forcedFx.set(boss, file);
    }
    return {
      fx: compileFx(file, look.accent),
      variants: effectOf(boss, look),
      color: makeEchoColor(look.id, look.accent),
      source,
      swap,
      ribbons: Object.values(look.ribbons),
      ribbonColor: (token) => look.palette[token] ?? token,
      seed,
    };
  };

  const levelOf = new Map<string, Level>();
  const level = (id: number, mission: number): Level => {
    const key = `${id}/${mission}`;
    let l = levelOf.get(key);
    if (!l) {
      l = new Level(content.levels[id] as LevelData, mission);
      levelOf.set(key, l);
    }
    return l;
  };
  /** Where a shot stands, in world units (feet): on the first floor under its place (a world's
   * ground is at 0). */
  const placeOf = (s: Shot): { x: number; y: number } => {
    if (s.world) {
      const [dx, dy] = s.shift ?? [0, 0];
      return { x: dx * UNITS_PER_PX, y: -dy * UNITS_PER_PX };
    }
    const l = level(s.level, s.mission);
    const p = s.at < 0 ? l.start : (l.checkpoints[s.at] ?? l.start);
    let floor = p.y + 1;
    while (floor < l.height && !FLOOR_TILES.has(l.collisionTileAt(p.x, floor))) floor++;
    const [dx, dy] = s.shift ?? [0, 0];
    return { x: p.x * TILE + TILE / 2 + dx * UNITS_PER_PX, y: floor * TILE - dy * UNITS_PER_PX };
  };
  const runFrame = (clock: number, k: number): number => {
    const count = Math.max(1, run.frameCount);
    const i = (((Math.floor(clock / FRAME_MS) - k) % count) + count) % count;
    return clips[run.clipOffset + 1 + i] ?? 0;
  };

  /** Draws a level around a shot, or the boss's world, into the box (w × h) at the origin. */
  const drawPlace = (c: CanvasRenderingContext2D, s: Shot, w: number, h: number): void => {
    if (s.world) {
      drawWorld(c, s, w, h, false);
      return;
    }
    const l = level(s.level, s.mission);
    levels.setLevel(s.level, l);
    const p = placeOf(s);
    const cam = {
      x: Math.round(p.x - s.feet[0] * w * UNITS_PER_PX),
      y: Math.round(p.y - s.feet[1] * h * UNITS_PER_PX),
    };
    const view = { width: w, height: h };
    levels.drawBackground(c, cam, view, 0, themeOfLevel(s.level));
    levels.drawLevelArt(c, cam, view, defaultLevelArtFrame(s.level));
  };

  /**
   * A boss's world as on the character screen: its sky (else its level's), its layers and
   * ground (`front`: the layers in front of the boss), the ground at the place's floor.
   */
  const drawWorld = (
    c: CanvasRenderingContext2D,
    s: Shot,
    w: number,
    h: number,
    front: boolean,
  ): void => {
    const boss = bosses.get(s.boss);
    const stage = boss ? stageOf(boss) : null;
    if (!boss || !stage) return;
    const groundY = Math.round(s.feet[1] * h + (s.shift?.[1] ?? 0));
    const scroll = s.scroll ?? 0;
    if (front) {
      stage.draw(c, 0, w, groundY, scroll, true);
      return;
    }
    if (stage.hasSky) stage.drawSky(c, 0, w, groundY, 0);
    else {
      const theme = themeOfLevel(stage.file.level ?? boss.levelId);
      levels.drawBackground(
        c,
        { x: Math.round(scroll * UNITS_PER_PX), y: 0 },
        { width: w, height: h },
        0,
        theme,
      );
    }
    stage.draw(c, 0, w, groundY, scroll, false);
  };

  /**
   * A boss doing a trick: the Moves menu's demo played with every flourish of its effect,
   * drawn step by step (particles and cloth move as they are drawn), the demo's ground on the
   * place's floor.
   */
  const drawTrick = (
    c: CanvasRenderingContext2D,
    s: Shot,
    trick: Trick,
    w: number,
    h: number,
  ): void => {
    const boss = bosses.get(s.boss);
    const data = MOVE_DEMOS.find((d) => d.move === trick.move);
    const look = boss?.looks[s.outfit];
    if (!boss || !data || !look) return;
    const seed = trick.seed ?? 1;
    const character = contestCharacter(boss.levelId, 'flags');
    const run = new DemoRun({ ...data, from: 0 }, content);
    const chars = new CharacterRenderer(scene, moves, clips, skins);
    const runner = run.world.player;
    chars.attach(runner, { character, outfit: s.outfit, seed });
    const fx = new CharacterFx(echo);
    const style = trickStyle(
      boss,
      look,
      (clk) => chars.swapFor(runner, clk),
      skins.sceneFor(character, s.outfit),
      seed,
    );
    if (style)
      fx.add(runner, { pose: () => chars.pose(runner, 1), move: () => runner.moveId }, style);
    let ground = runner.y;
    const step = (silent: boolean): void => {
      chars.onEvents(run.step());
      chars.step(run.world.clock, STEP);
      fx.step({ silent, clock: run.world.clock });
    };
    while (run.stepCount < data.from) step(true);
    const view = { width: w, height: h };
    const cam = (): { x: number; y: number } => ({
      x: Math.round(runner.x - s.feet[0] * w * UNITS_PER_PX),
      y: Math.round(ground - (s.feet[1] * h + (s.shift?.[1] ?? 0)) * UNITS_PER_PX),
    });
    const draw = (to: CanvasRenderingContext2D): void => {
      const at = cam();
      const clock = run.world.clock;
      fx.drawBehind(to, at, clock, clock, view);
      scene.setViewport(w, h);
      chars.drawAll(to, at, 1, clock, runner);
      fx.drawFront(to, at);
    };
    const scratch = document.createElement('canvas').getContext('2d')!;
    // The floor under the boss as the demo goes on, if that is the ground asked for.
    const floor = (): void => {
      if (trick.ground !== 'under') return;
      const { fill, width, height } = run.level;
      const col = Math.floor(runner.x / TILE);
      for (let row = Math.max(0, Math.floor((runner.y - 1) / TILE)); row < height; row++) {
        if (fill[row * width + col]) {
          ground = row * TILE;
          return;
        }
      }
    };
    for (let t = STEP; t < trick.ms && !run.done; t += STEP) {
      step(false);
      floor();
      draw(scratch);
    }
    step(false);
    floor();
    draw(c);
  };

  /** A boss running into its shot (its effect and cloth trailing), then in its final pose. */
  const drawRunner = (c: CanvasRenderingContext2D, s: Shot, w: number, h: number): void => {
    if (s.trick) {
      drawTrick(c, s, s.trick, w, h);
      return;
    }
    const boss = bosses.get(s.boss);
    if (!boss) return;
    const character = contestCharacter(boss.levelId, 'flags');
    const swap = skins.swapFor(character, -1, s.outfit);
    const look = skins.sceneFor(character, s.outfit);
    const style = characterFx(skins, character, s.outfit, () => swap, 7);
    const fx = new CharacterFx(echo);
    const p = placeOf(s);
    const dir = s.left ? -1 : 1;
    const cam = {
      x: Math.round(p.x - s.feet[0] * w * UNITS_PER_PX),
      y: Math.round(p.y - s.feet[1] * h * UNITS_PER_PX),
    };
    const view = { width: w, height: h };
    let clock = 0;
    const pose = (): CharacterPose => {
      const left = LEAD_MS - clock;
      const hold = s.frame >= 0 && left < 160;
      return {
        x: p.x - (dir * RUN_PX * UNITS_PER_PX * Math.max(0, left)) / 1000,
        y: p.y,
        a: hold ? s.frame : runFrame(clock, 1),
        b: hold ? s.frame : runFrame(clock, 0),
        t: hold ? 0 : Math.floor(((clock % FRAME_MS) / FRAME_MS) * 65536),
        flipX: s.left ?? false,
        anchored: false,
      };
    };
    if (style) fx.add(s, { pose, move: () => 2 }, style);
    const scratch = document.createElement('canvas').getContext('2d')!;
    for (; clock < LEAD_MS; clock += STEP) {
      fx.step({ clock });
      fx.drawBehind(scratch, cam, clock, clock, view);
      fx.drawFront(scratch, cam);
    }
    fx.step({ clock });
    fx.drawBehind(c, cam, clock, clock, view);
    look.setViewport(w, h);
    drawPose(c, look, pose(), cam, swap);
    fx.drawFront(c, cam);
  };

  /**
   * The poses of a boss doing a trick of the Moves menu, `times` ms into it (counted from the
   * end of the demo's run-up, as `drawTrick` counts), with the demo's ground.
   */
  const trickPoses = (
    boss: Boss,
    outfit: number,
    move: string,
    times: readonly number[],
  ): { poses: CharacterPose[]; ground: number } => {
    const data = MOVE_DEMOS.find((d) => d.move === move);
    if (!data) throw new Error(`no demo of ${move}`);
    const run = new DemoRun({ ...data, from: 0 }, content);
    const chars = new CharacterRenderer(scene, moves, clips, skins);
    const runner = run.world.player;
    chars.attach(runner, { character: contestCharacter(boss.levelId, 'flags'), outfit, seed: 1 });
    const ground = runner.y;
    const step = (): void => {
      chars.onEvents(run.step());
      chars.step(run.world.clock, STEP);
    };
    while (run.stepCount < data.from) step();
    const found = new Map<number, CharacterPose>();
    const last = Math.max(...times);
    for (let t = STEP; !run.done; t += STEP) {
      step();
      const pose = chars.pose(runner, 1);
      for (const want of times) if (pose && !found.has(want) && t >= want) found.set(want, pose);
      if (t >= last) break;
    }
    return { poses: times.map((t) => found.get(t)!).filter(Boolean), ground };
  };

  /**
   * The rival as the game draws a ghost, its look recoloured into a hologram, caught in a trick:
   * fainter afterimages along the path it took there, all in a layer that gets scanlines and is
   * laid over slightly transparent.
   */
  const drawRival = (
    c: CanvasRenderingContext2D,
    s: Shot,
    rival: Rival,
    w: number,
    h: number,
  ): void => {
    const boss = bosses.get(rival.boss);
    if (!boss) return;
    const character = contestCharacter(boss.levelId, 'flags');
    const scene = echo.scene(RIVAL_COLOR, true, skins.sceneFor(character, rival.outfit));
    const swap = skins.swapFor(character, -1, rival.outfit);
    const p = placeOf(s);
    const cam = {
      x: Math.round(p.x - s.feet[0] * w * UNITS_PER_PX),
      y: Math.round(p.y - s.feet[1] * h * UNITS_PER_PX),
    };
    const times = [...rival.trail.map((back) => rival.trick.ms - back), rival.trick.ms];
    const { poses, ground } = trickPoses(boss, rival.outfit, rival.trick.move, times);
    const shown = poses.at(-1);
    if (!shown) return;
    // The pose shown `ahead` of the runner and `rise` up from its floor; the trail moves with it.
    const dx = p.x + rival.ahead * UNITS_PER_PX - shown.x;
    const dy = p.y - (rival.rise ?? 0) * UNITS_PER_PX - ground;
    const canvas = (): [HTMLCanvasElement, CanvasRenderingContext2D] => {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const c = canvas.getContext('2d')!;
      c.imageSmoothingEnabled = false;
      return [canvas, c];
    };
    const [layer, lc] = canvas();
    scene.setViewport(w, h);
    const at = (pose: CharacterPose): CharacterPose => ({
      ...pose,
      x: pose.x + dx,
      y: pose.y + dy,
    });
    poses.slice(0, -1).forEach((pose, i) => {
      lc.globalAlpha = 0.12 + (0.26 * (i + 1)) / poses.length;
      drawPose(lc, scene, at(pose), cam, swap);
    });
    lc.globalAlpha = 1;
    // The pose shown gets a dark rim, so it reads against the trail and a busy skyline.
    const [figure, fc] = canvas();
    drawPose(fc, scene, at(shown), cam, swap);
    const [rim, rc] = canvas();
    rc.drawImage(figure, 0, 0);
    rc.globalCompositeOperation = 'source-in';
    rc.fillStyle = RIVAL_RIM;
    rc.fillRect(0, 0, w, h);
    for (const [ox, oy] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ] as const)
      lc.drawImage(rim, ox, oy);
    lc.drawImage(figure, 0, 0);
    applyScanlines(lc, w, h, 0);
    c.save();
    c.globalAlpha = 0.9;
    c.drawImage(layer, 0, 0);
    c.restore();
  };

  /** A card: a level with its boss, clipped to a parallelogram leaning right, pixel-stepped. */
  const card = (
    c: CanvasRenderingContext2D,
    s: Shot,
    x0: number,
    x1: number,
    top: number,
    bottom: number,
    lean: number,
  ): void => {
    const h = bottom - top;
    const edge = (y: number): number => Math.round((lean * (h - y)) / h);
    const w = x1 - x0 + lean;
    // Shadow on what lies under its left edge.
    c.fillStyle = 'rgba(0, 0, 0, 0.45)';
    for (let y = 0; y < h; y++) c.fillRect(x0 + edge(y) - 4, top + y, 4, 1);
    c.save();
    c.beginPath();
    for (let y = 0; y < h; y++) c.rect(x0 + edge(y), top + y, x1 - x0, 1);
    c.clip();
    c.translate(x0, top);
    const zoom = s.zoom ?? 1;
    c.scale(zoom, zoom);
    const vw = Math.ceil(w / zoom);
    const vh = Math.ceil(h / zoom);
    drawPlace(c, s, vw, vh);
    if (s.rival) drawRival(c, s, s.rival, vw, vh);
    drawRunner(c, s, vw, vh);
    if (s.world) drawWorld(c, s, vw, vh, true);
    c.restore();
    // A dark rim and a light one along its left edge and top.
    for (let y = 0; y < h; y++) {
      c.fillStyle = '#07090c';
      c.fillRect(x0 + edge(y) - 1, top + y, 1, 1);
      c.fillStyle = 'rgba(232, 238, 244, 0.35)';
      c.fillRect(x0 + edge(y), top + y, 1, 1);
    }
    c.fillStyle = '#07090c';
    c.fillRect(x0 + edge(0) - 1, top - 1, x1 - x0 + 1, 1);
    c.fillStyle = 'rgba(232, 238, 244, 0.25)';
    c.fillRect(x0 + edge(0), top, x1 - x0, 1);
  };

  /** The logo on a narrow pennant hanging from the top, a notch cut in its foot. */
  const pennant = (
    c: CanvasRenderingContext2D,
    x: number,
    w: number,
    h: number,
    tagline: string | null,
    logo: HTMLImageElement = icon,
    taglineColor: string = Theme.muted,
  ): void => {
    const notch = 10;
    // Shadow, then the cloth row by row (the notch at the foot).
    for (let y = 0; y < h; y++) {
      const cut = y >= h - notch ? Math.min(w >> 1, (y - (h - notch)) * 2 + 1) : 0;
      c.fillStyle = 'rgba(0, 0, 0, 0.5)';
      c.fillRect(x + 4, y + 3, w, 1);
      const half = w >> 1;
      c.fillStyle = Theme.panel;
      c.fillRect(x, y, half - (cut >> 1), 1);
      c.fillRect(x + half + (cut >> 1) + (w & 1), y, w - half - (cut >> 1) - (w & 1), 1);
      c.fillStyle = Theme.panelBorder;
      c.fillRect(x, y, 1, 1);
      c.fillRect(x + w - 1, y, 1, 1);
    }
    c.fillStyle = Theme.accent;
    c.fillRect(x, 0, w, 3);
    c.fillStyle = Theme.accentDark;
    c.fillRect(x, 3, w, 1);
    const cx = x + (w >> 1);
    const iconSize = 64;
    const iconY = tagline ? 14 : 12;
    c.drawImage(logo, cx - iconSize / 2, iconY, iconSize, iconSize);
    const titleY = iconY + iconSize + 4;
    title.draw(c, 'PARAPET', cx + 1, titleY, { align: 'center', color: Theme.accent });
    display.draw(c, 'CLASSIC', cx, titleY + title.lineHeight - 3, {
      align: 'center',
      color: Theme.text,
    });
    if (!tagline) return;
    const y = titleY + title.lineHeight + display.lineHeight + 2;
    c.fillStyle = Theme.accentDark;
    c.fillRect(cx - 16, y, 32, 1);
    small.draw(c, small.wrap(tagline, w - 14).join('\n'), cx, y + 6, {
      align: 'center',
      color: taglineColor,
    });
  };

  /**
   * The first shot's place behind the pennant, then the cards across the rest of `width`, each
   * laid over the one before it at its own height, like a fanned hand.
   */
  const collage = (
    c: CanvasRenderingContext2D,
    width: number,
    height: number,
    shots: Shot[],
    pennantW: number,
    tagline: string | null,
    logo: HTMLImageElement = icon,
    taglineColor: string = Theme.muted,
  ): void => {
    c.fillStyle = '#07090c';
    c.fillRect(0, 0, width, height);
    const lean = 16;
    const pennantX = 12;
    const [under, ...cards] = shots;
    if (under) card(c, under, -lean - 4, pennantX + pennantW + 20, 0, height, lean);
    const from = pennantX + pennantW - 6;
    const span = (width - from) / Math.max(1, cards.length);
    cards.forEach((s, i) => {
      const x0 = Math.round(from + i * span);
      const x1 = i === cards.length - 1 ? width + 2 : Math.round(from + (i + 1) * span + 8);
      card(c, s, x0, x1, 0, height, lean);
    });
    pennant(c, pennantX, pennantW, height - 4, tagline, logo, taglineColor);
  };

  /** Rows of cards across the whole picture, fanned like the banner's, without the pennant. */
  const mosaic = (
    c: CanvasRenderingContext2D,
    width: number,
    height: number,
    rows: Shot[][],
  ): void => {
    c.fillStyle = '#07090c';
    c.fillRect(0, 0, width, height);
    rows.forEach((cards, r) => {
      const top = Math.round((r * height) / rows.length);
      const bottom = Math.round(((r + 1) * height) / rows.length);
      const lean = Math.round((bottom - top) / 10);
      const span = (width + lean) / cards.length;
      cards.forEach((s, i) => {
        const x0 = Math.round(-lean + i * span);
        const x1 = i === cards.length - 1 ? width + 2 : Math.round(-lean + (i + 1) * span + 8);
        card(c, s, x0, x1, top, bottom, lean);
      });
    });
  };

  // For scripts trying shots out: a card alone, `w × h` px drawn `scale` times bigger.
  (window as unknown as { art: unknown }).art = {
    card: (s: Shot, w: number, h: number, scale = 3): string => {
      const canvas = document.createElement('canvas');
      canvas.width = w * scale;
      canvas.height = h * scale;
      const c = canvas.getContext('2d')!;
      c.setTransform(scale, 0, 0, scale, 0, 0);
      c.imageSmoothingEnabled = false;
      card(c, s, 0, w, 0, h, 0);
      return canvas.toDataURL('image/png');
    },
    /** The challenge links' preview with other shots (the first goes under the pennant). */
    race: (shots: Shot[], scale = 3): string => {
      const canvas = document.createElement('canvas');
      canvas.width = 400 * scale;
      canvas.height = 210 * scale;
      const c = canvas.getContext('2d')!;
      c.setTransform(scale, 0, 0, scale, 0, 0);
      c.imageSmoothingEnabled = false;
      collage(c, 400, 210, shots, 146, RACE_TAGLINE, raceIcon, Theme.text);
      return canvas.toDataURL('image/png');
    },
  };

  /**
   * The runner of the icon above its parapet: its pixels (the two oranges) and its speed lines
   * (the dark blue-grey left of it, rows above the parapet), read from the favicon.
   */
  const runnerArt = ((): { x: number; y: number; line: boolean }[] => {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ic = canvas.getContext('2d', { willReadFrequently: true })!;
    ic.drawImage(icon, 0, 0);
    const px = ic.getImageData(0, 0, 32, 32).data;
    const out: { x: number; y: number; line: boolean }[] = [];
    for (let y = 0; y < PARAPET_ROW; y++) {
      for (let x = 0; x < 32; x++) {
        const i = (y * 32 + x) * 4;
        const near = (rgb: readonly number[]): boolean =>
          Math.abs(px[i]! - rgb[0]!) +
            Math.abs(px[i + 1]! - rgb[1]!) +
            Math.abs(px[i + 2]! - rgb[2]!) <
          24;
        if (near(ICON_ORANGE) || near(ICON_ORANGE_DARK)) out.push({ x, y, line: false });
        else if (near(ICON_LINE)) out.push({ x, y, line: true });
      }
    }
    return out;
  })();

  /** The Play button: an accent block with a dark rim, the icon's runner and the words. */
  const button = (c: CanvasRenderingContext2D, w: number, h: number): void => {
    c.clearRect(0, 0, w, h);
    c.fillStyle = Theme.accentDark;
    c.fillRect(1, 2, w - 2, h - 2);
    c.fillStyle = Theme.accent;
    c.fillRect(1, 0, w - 2, h - 3);
    c.fillStyle = '#ffd36a';
    c.fillRect(2, 1, w - 4, 1);
    c.fillStyle = '#07090c';
    c.fillRect(0, 1, 1, h - 2);
    c.fillRect(w - 1, 1, 1, h - 2);
    c.fillRect(1, h - 1, w - 2, 1);
    const label = 'PLAY NOW';
    const tw = display.measure(label);
    const minX = Math.min(...runnerArt.map((p) => p.x));
    const maxX = Math.max(...runnerArt.map((p) => p.x));
    const minY = Math.min(...runnerArt.map((p) => p.y));
    const maxY = Math.max(...runnerArt.map((p) => p.y));
    const artW = maxX - minX + 1;
    const gap = 6;
    const x = Math.round((w - (artW + gap + tw)) / 2);
    const mid = Math.floor((h - 3) / 2);
    // The runner black, its speed lines a faint black.
    const top = mid - ((maxY - minY + 1) >> 1);
    for (const p of runnerArt) {
      c.fillStyle = p.line ? 'rgba(16, 20, 24, 0.35)' : Theme.background;
      c.fillRect(x + p.x - minX, top + p.y - minY, 1, 1);
    }
    display.draw(c, label, x + artW + gap, mid - (display.lineHeight >> 1) + 1, {
      color: Theme.background,
    });
  };

  const out = $('out');
  const pictures: { name: string; canvas: HTMLCanvasElement }[] = [];
  /** A picture drawn at `w × h` logical pixels, saved `scale` times bigger. */
  // `?only=og-race`: one picture alone, for trying a shot out.
  const only = new URLSearchParams(location.search).get('only');
  const picture = (
    name: string,
    caption: string,
    w: number,
    h: number,
    scale: number,
    draw: (c: CanvasRenderingContext2D) => void,
  ): void => {
    if (only && only !== name) return;
    const canvas = document.createElement('canvas');
    canvas.width = w * scale;
    canvas.height = h * scale;
    const c = canvas.getContext('2d')!;
    c.setTransform(scale, 0, 0, scale, 0, 0);
    c.imageSmoothingEnabled = false;
    draw(c);
    const head = document.createElement('h2');
    head.textContent = `${caption}: ${canvas.width}×${canvas.height}`;
    out.append(head, canvas);
    pictures.push({ name, canvas });
  };

  if (new URLSearchParams(location.search).get('scout') === '1') {
    scout();
    return;
  }

  picture('banner', 'README banner (docs/banner.png)', 480, 160, 3, (c) =>
    collage(c, 480, 160, BANNER_SHOTS, 132, null),
  );
  picture('og-image', 'Link preview (public/og-image.png)', 400, 210, 3, (c) =>
    collage(c, 400, 210, OG_SHOTS, 146, 'The 2007 mobile parkour classic, remade for the browser'),
  );
  picture('og-race', 'Challenge link preview (public/og-race.png)', 400, 210, 3, (c) =>
    collage(c, 400, 210, RACE_SHOTS, 146, RACE_TAGLINE, raceIcon, Theme.text),
  );
  picture('play-now', 'Play button (docs/play-now.png)', 148, 30, 2, (c) => button(c, 148, 30));
  picture('collage', 'Collage of tricks, no logo (docs/collage.png)', 480, 270, 4, (c) =>
    mosaic(c, 480, 270, COLLAGE_ROWS),
  );

  $('save').addEventListener('click', () => {
    const status = $('status');
    Promise.all(
      pictures.map(({ name, canvas }) =>
        fetch('/dev/save-art', {
          method: 'POST',
          body: JSON.stringify({ name, png: canvas.toDataURL('image/png') }),
        }).then(async (res) => {
          if (!res.ok) throw new Error(`${name}: ${await res.text()}`);
        }),
      ),
    ).then(
      () => (status.textContent = 'saved'),
      (err: unknown) => (status.textContent = String(err)),
    );
  });

  /** Every place a shot can stand on, and the keyframes of the demos. */
  function scout(): void {
    const W = 140;
    const H = 90;
    for (let id = 0; id < content.levels.length; id++) {
      const data = content.levels[id] as LevelData | undefined;
      if (!data) continue;
      for (const [key, section] of Object.entries(data.missions)) {
        if (!section) continue;
        const mission = Number(key);
        const spots = [-1, ...section.checkpoints.map((_, i) => i)];
        picture('', `level ${id} mission ${mission}`, W * spots.length, H, 1, (c) => {
          spots.forEach((at, i) => {
            const s: Shot = {
              level: id,
              mission,
              at,
              boss: 'petra',
              outfit: 0,
              frame: -1,
              feet: [0.5, 0.75],
            };
            c.save();
            c.beginPath();
            c.rect(i * W, 0, W - 2, H);
            c.clip();
            c.translate(i * W, 0);
            drawPlace(c, s, W, H);
            c.fillStyle = '#ff2fa6';
            c.fillRect(W / 2 - 1, H * 0.75 - 30, 3, 30);
            small.draw(c, at < 0 ? 'start' : `flag ${at}`, 3, 3, { color: '#ffffff' });
            c.restore();
          });
        });
      }
    }
    const frames = [
      ...content.anims.demos.map((d) => clips[d.clipOffset + 1] ?? 0),
      ...Array.from({ length: run.frameCount }, (_, i) => clips[run.clipOffset + 1 + i] ?? 0),
    ];
    picture('', 'keyframes', frames.length * 50, 80, 2, (c) => {
      c.fillStyle = '#9fb3c8';
      c.fillRect(0, 0, frames.length * 50, 80);
      scene.setViewport(frames.length * 50, 80);
      frames.forEach((f, i) => {
        drawPose(
          c,
          scene,
          {
            x: (i * 50 + 25) * UNITS_PER_PX,
            y: 66 * UNITS_PER_PX,
            a: f,
            b: f,
            t: 0,
            flipX: false,
            anchored: false,
          },
          { x: 0, y: 0 },
          (id) => id,
        );
        small.draw(c, String(f), i * 50 + 25, 68, { align: 'center', color: '#101418' });
      });
    });
  }
}

main().catch((err: unknown) => {
  document.getElementById('status')!.textContent = String(err);
  console.error(err);
});
