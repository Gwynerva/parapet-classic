/**
 * The showcase page (dev server only, `dev/showcase.html`): a boss's outfit with its effect,
 * running through its little world as on the character screen, or doing one of the Moves menu's
 * demos (a flip, a vault, a wall run…) so that the flourishes it throws on tricks show. "Every
 * flourish" makes every emitter with a chance fire every time (and the rare ones on a clock during
 * tricks come on every trick): to look at them, not as the game plays them.
 *
 * For pictures the page can be driven step by step: with `#manual=1` its clock stands still and
 * `window.showcase` sets it up, moves it on and draws it, drawing every step on a clock of its own
 * (particles and cloth move as they are drawn): a browser driven by a script (Playwright) takes
 * the same picture every time.
 */
import { STEP } from '@parapet/sim';
import { GameLoop } from '@parapet/runtime/app/GameLoop.ts';
import {
  CharacterRenderer,
  drawPose,
  type CharacterPose,
} from '@parapet/runtime/render/CharacterRenderer.ts';
import { makeEchoColor } from '@parapet/runtime/render/EchoSkin.ts';
import { CharacterFx, type FxStyle } from '@parapet/runtime/render/fx/CharacterFx.ts';
import type { FxFile } from '@parapet/runtime/render/fx/FxData.ts';
import { compileFx } from '@parapet/runtime/render/fx/FxSheet.ts';
import type { ResolvedLook } from '@parapet/runtime/render/Look.ts';
import { canvasPainter, drawPlaceholderTiles } from '@parapet/runtime/render/PlaceholderTiles.ts';
import { SceneRenderer } from '@parapet/runtime/render/SceneRenderer.ts';
import { StageRenderer } from '@parapet/runtime/render/Stage.ts';
import { DemoRun } from '@parapet/runtime/moves/MoveDemo.ts';
import { MOVE_KEYS } from '@parapet/runtime/moves/moveKeys.ts';
import { allBosses, contestCharacter, effectOf, type Boss } from '../src/app/bosses.ts';
import { loadContent } from '../src/assets/content.ts';
import { forced } from './flourishes.ts';
import { UNITS_PER_PX } from '@parapet/runtime/render/View.ts';
import { createRenderers } from '../src/app/renderers.ts';
import { $ } from './dom.ts';
import { MOVE_DEMOS } from '../src/assets/demos.ts';

const VIEW = { width: 256, height: 144 };
/** The run in the world: where the feet are, how fast the world goes by, a keyframe's time. */
const FEET_X = Math.round(VIEW.width * 0.42);
const FEET_Y = VIEW.height - 12;
const RUN_PX = 120;
const FRAME_MS = 110;
/** Where the runner sits in a demo, across and down the view. */
const FOLLOW_X = 0.4;
const FOLLOW_Y = 0.62;
const SKY = '#9fb3c8';
const GROUND = '#3a3f4b';
const GROUND_EDGE = '#5b6270';

interface Options {
  look: string;
  /** `world`, or a move of the Moves menu. */
  scene: string;
  fx: boolean;
  force: boolean;
  seed: number;
}

async function main(): Promise<void> {
  const content = await loadContent();
  const { scene, echo, skins, clips, moves } = createRenderers(content);
  const runDemo = content.anims.demos[0];
  const forcedFx = new Map<Boss, FxFile>();
  const stages = new Map<Boss, StageRenderer>();

  const bossOfLook = new Map<string, { boss: Boss; outfit: number; look: ResolvedLook }>();
  const lookSelect = $<HTMLSelectElement>('look');
  for (const boss of allBosses()) {
    const group = document.createElement('optgroup');
    group.label = `${boss.levelId + 1}. ${boss.id}`;
    boss.looks.forEach((look, outfit) => {
      bossOfLook.set(look.id, { boss, outfit, look });
      group.append(new Option(look.id, look.id));
    });
    lookSelect.append(group);
  }
  const sceneSelect = $<HTMLSelectElement>('scene');
  sceneSelect.append(new Option('world', 'world'));
  for (const key of MOVE_KEYS) sceneSelect.append(new Option(key, key));
  const zoomSelect = $<HTMLSelectElement>('zoom');
  // Up to 15: the 256 × 144 view then fills a 4K frame (3840 × 2160) for footage.
  for (const z of [1, 2, 3, 4, 5, 6, 8, 10, 12, 15]) {
    zoomSelect.append(new Option(`${z}×`, String(z)));
  }
  const fxBox = $<HTMLInputElement>('fx');
  const forceBox = $<HTMLInputElement>('force');

  const hash = new URLSearchParams(location.hash.slice(1));
  const manual = hash.get('manual') === '1';
  let options: Options = {
    look: bossOfLook.has(hash.get('look') ?? '') ? hash.get('look')! : lookSelect.value,
    scene: hash.get('scene') ?? 'world',
    fx: hash.get('fx') !== '0',
    force: hash.get('force') === '1',
    seed: Number(hash.get('seed') ?? 1) || 1,
  };
  zoomSelect.value = hash.get('zoom') ?? '3';

  const canvas = $<HTMLCanvasElement>('view');
  const c = canvas.getContext('2d')!;

  // ------------------------------------------------------------------ the shown runner
  let character = 0;
  let outfit = 0;
  let boss: Boss | null = null;
  let look: ResolvedLook | null = null;
  let stage: StageRenderer | null = null;
  let fx = new CharacterFx(echo);
  let characters: CharacterRenderer | null = null;
  let demo: DemoRun | null = null;
  let clock = 0;
  let x = 0;
  let cam = { x: 0, y: 0 };
  let ambientRand = 1;
  /** The page's own clock in manual mode: particles and cloth move by it, in step with the game. */
  let virtualNow = 0;

  const style = (swap: FxStyle['swap'], source: SceneRenderer): FxStyle | null => {
    if (!boss || !look) return null;
    let file = options.fx ? boss.fx : null;
    if (file && options.force) {
      let f = forcedFx.get(boss);
      if (!f) {
        f = forced(file);
        forcedFx.set(boss, f);
      }
      file = f;
    }
    const compiled = file ? compileFx(file, look.accent) : null;
    const lookOf = look;
    return {
      fx: compiled,
      variants: compiled ? effectOf(boss, lookOf) : [],
      color: makeEchoColor(lookOf.id, lookOf.accent),
      source,
      swap,
      ribbons: Object.values(lookOf.ribbons),
      ribbonColor: (token) => lookOf.palette[token] ?? token,
      seed: options.seed,
    };
  };

  const runFrame = (k: number): number => {
    const count = Math.max(1, runDemo?.frameCount ?? 1);
    const i = (((Math.floor(clock / FRAME_MS) - k) % count) + count) % count;
    return clips[(runDemo?.clipOffset ?? 0) + 1 + i] ?? 0;
  };
  const runPose = (): CharacterPose => ({
    x,
    y: 0,
    a: runFrame(1),
    b: runFrame(0),
    t: Math.floor(((clock % FRAME_MS) / FRAME_MS) * 65536),
    flipX: false,
    anchored: false,
  });

  /** The camera of a demo: the runner a little left of the middle, the level in view. */
  const demoTarget = (run: DemoRun): { x: number; y: number } => {
    const p = run.world.player;
    const viewW = VIEW.width * UNITS_PER_PX;
    const viewH = VIEW.height * UNITS_PER_PX;
    const levelW = run.level.width * 1024;
    const levelH = run.level.height * 1024;
    const cx =
      levelW <= viewW
        ? -((viewW - levelW) >> 1)
        : Math.max(0, Math.min(levelW - viewW, p.x - viewW * FOLLOW_X));
    const cy =
      levelH <= viewH
        ? -(viewH - levelH)
        : Math.max(0, Math.min(levelH - viewH, p.y - viewH * FOLLOW_Y));
    return { x: Math.round(cx), y: Math.round(cy) };
  };

  const stepDemo = (silent: boolean): void => {
    const run = demo!;
    const events = run.step();
    characters!.onEvents(events);
    characters!.step(run.world.clock, STEP);
    fx.step({ silent, clock: run.world.clock });
    clock = run.world.clock;
  };

  const setup = (next: Options): void => {
    options = next;
    const found = bossOfLook.get(options.look);
    if (!found) return;
    boss = found.boss;
    look = found.look;
    outfit = found.outfit;
    character = contestCharacter(boss.levelId, 'flags');
    stage = null;
    if (boss.stage) {
      stage = stages.get(boss) ?? new StageRenderer(boss.stage, boss.data.color);
      stages.set(boss, stage);
    }
    fx = new CharacterFx(echo);
    clock = 0;
    x = 0;
    ambientRand = options.seed * 7919;
    const data = MOVE_DEMOS.find((d) => d.move === options.scene);
    if (data) {
      // The run-up is played here, quietly, so the renderers see its steps.
      demo = new DemoRun({ ...data, from: 0 }, content);
      characters = new CharacterRenderer(scene, moves, clips, skins);
      const runner = demo.world.player;
      const chars = characters;
      chars.attach(runner, { character, outfit, seed: options.seed });
      const st = style((clk) => chars.swapFor(runner, clk), skins.sceneFor(character, outfit));
      if (st) fx.add(runner, { pose: () => chars.pose(runner, 1), move: () => runner.moveId }, st);
      while (demo.stepCount < data.from) stepDemo(true);
      cam = demoTarget(demo);
    } else {
      demo = null;
      characters = null;
      const st = style(
        () => skins.swapFor(character, -1, outfit),
        skins.sceneFor(character, outfit),
      );
      if (st) fx.add({}, { pose: runPose, move: () => 2 }, st);
    }
    lookSelect.value = options.look;
    sceneSelect.value = data ? options.scene : 'world';
    fxBox.checked = options.fx;
    forceBox.checked = options.force;
    const h = new URLSearchParams({
      look: options.look,
      scene: sceneSelect.value,
      zoom: zoomSelect.value,
      fx: options.fx ? '1' : '0',
      force: options.force ? '1' : '0',
    });
    if (manual) h.set('manual', '1');
    history.replaceState(null, '', `#${h.toString()}`);
    $('status').textContent = `${boss.id} / ${look.id} (${effectOf(boss, look).join(', ')})`;
  };

  /** Moves the shown scene on by `ms` of game time, in simulation steps. */
  const advance = (ms: number): void => {
    for (let t = 0; t < ms; t += STEP) {
      if (demo) {
        if (demo.done) {
          setup(options);
          continue;
        }
        stepDemo(false);
        const goal = demoTarget(demo);
        cam = {
          x: Math.round(cam.x + (goal.x - cam.x) * 0.18),
          y: Math.round(cam.y + (goal.y - cam.y) * 0.18),
        };
      } else {
        clock += STEP;
        x += (RUN_PX * UNITS_PER_PX * STEP) / 1000;
        fx.step({ clock });
        const names = stage?.file.ambient;
        if (stage && names?.length) {
          const rand = (): number => {
            let s = ambientRand;
            s ^= s << 13;
            s ^= s >>> 17;
            s ^= s << 5;
            ambientRand = s;
            return ((s >>> 0) % 100000) / 100000;
          };
          fx.idleAt(stage.fx, names, x + (rand() * 360 - 100) * UNITS_PER_PX, 0, true, rand);
        }
      }
      // Particles and cloth move when drawn, by the time since the last picture.
      if (manual) {
        virtualNow += STEP;
        draw();
      }
    }
  };

  const draw = (): void => {
    const zoom = Number(zoomSelect.value) || 3;
    if (canvas.width !== VIEW.width * zoom) canvas.width = VIEW.width * zoom;
    if (canvas.height !== VIEW.height * zoom) canvas.height = VIEW.height * zoom;
    c.setTransform(zoom, 0, 0, zoom, 0, 0);
    c.imageSmoothingEnabled = false;
    const now = manual ? virtualNow : performance.now();
    if (demo && characters) {
      if (stage?.hasSky) stage.drawSky(c, 0, VIEW.width, VIEW.height, clock);
      else {
        c.fillStyle = SKY;
        c.fillRect(0, 0, VIEW.width, VIEW.height);
      }
      drawPlaceholderTiles(
        canvasPainter(c),
        demo.level,
        cam.x / UNITS_PER_PX,
        cam.y / UNITS_PER_PX,
        VIEW.width,
        VIEW.height,
      );
      fx.drawBehind(c, cam, clock, now, VIEW);
      scene.setViewport(VIEW.width, VIEW.height);
      characters.drawAll(c, cam, 1, clock, demo.world.player);
      fx.drawFront(c, cam);
      return;
    }
    const scroll = 100_000 + x / UNITS_PER_PX;
    if (stage?.hasSky) stage.drawSky(c, 0, VIEW.width, FEET_Y, clock);
    else {
      c.fillStyle = SKY;
      c.fillRect(0, 0, VIEW.width, VIEW.height);
    }
    if (stage) stage.draw(c, 0, VIEW.width, FEET_Y, scroll, false, 0, clock);
    else {
      c.fillStyle = GROUND;
      c.fillRect(0, FEET_Y, VIEW.width, VIEW.height - FEET_Y);
      c.fillStyle = GROUND_EDGE;
      c.fillRect(0, FEET_Y, VIEW.width, 1);
    }
    const view = { x: Math.round(x - FEET_X * UNITS_PER_PX), y: -FEET_Y * UNITS_PER_PX };
    fx.drawBehind(c, view, clock, now, VIEW);
    const source = skins.sceneFor(character, outfit);
    source.setViewport(VIEW.width, VIEW.height);
    drawPose(c, source, runPose(), view, skins.swapFor(character, -1, outfit));
    fx.drawFront(c, view);
    if (stage) stage.draw(c, 0, VIEW.width, FEET_Y, scroll, true, 0, clock);
  };

  const pick = (): void =>
    setup({
      ...options,
      look: lookSelect.value,
      scene: sceneSelect.value,
      fx: fxBox.checked,
      force: forceBox.checked,
    });
  for (const el of [lookSelect, sceneSelect, zoomSelect, fxBox, forceBox])
    el.addEventListener('change', pick);
  setup(options);
  draw();

  (window as unknown as { showcase: unknown }).showcase = {
    set: (next: Partial<Options> & { zoom?: number }): void => {
      if (next.zoom) zoomSelect.value = String(next.zoom);
      setup({ ...options, ...next });
    },
    advance,
    draw,
    info: () => ({
      clock,
      step: demo?.stepCount ?? Math.round(clock / STEP),
      done: demo?.done ?? false,
      move: demo?.world.player.moveId ?? 2,
    }),
    looks: [...bossOfLook.entries()].map(([id, v]) => ({ id, boss: v.boss.id })),
  };
  if (manual) return;
  let acc = 0;
  new GameLoop((dt) => {
    acc += dt;
    const steps = Math.floor(acc / STEP);
    acc -= steps * STEP;
    advance(steps * STEP);
    draw();
  }).start();
}

main().catch((err: unknown) => {
  $('status').textContent = String(err);
  console.error(err);
});
