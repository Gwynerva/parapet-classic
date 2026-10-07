/**
 * Render debug page: runs level 0 as a free run and draws it with the rendering core on a
 * 640×360 canvas (scaled ×2 by CSS). Arrow keys are turned into the original press bits.
 */
import { buildSineTable, createRun, Input, STEP, type World } from '@parapet/sim';
import { loadContent, type GameContent } from './assets/content.ts';
import { buildClipTable } from '@parapet/runtime/anim/Animator.ts';
import { FixedStepClock, GameLoop } from '@parapet/runtime/app/GameLoop.ts';
import { Camera } from '@parapet/runtime/render/Camera.ts';
import { CharacterRenderer } from '@parapet/runtime/render/CharacterRenderer.ts';
import {
  defaultLevelArtFrame,
  LevelRenderer,
  MarkerBounce,
  themeOfLevel,
} from '@parapet/runtime/render/LevelRenderer.ts';
import { Particles } from '@parapet/runtime/render/Particles.ts';
import { SceneRenderer } from '@parapet/runtime/render/SceneRenderer.ts';
import { SpriteSheet } from '@parapet/runtime/render/SpriteSheet.ts';
import type { ViewSize } from '@parapet/runtime/render/View.ts';

const LEVEL_ID = 0;
const VIEW: ViewSize = { width: 640, height: 360 };

interface Session {
  world: World;
  camera: Camera;
  characters: CharacterRenderer;
  particles: Particles;
  bounce: MarkerBounce;
  clock: FixedStepClock;
}

function startSession(
  content: GameContent,
  scene: SceneRenderer,
  sheet: SpriteSheet,
  levelRenderer: LevelRenderer,
  character: number,
  ghost: boolean,
): Session {
  const level = content.levels[LEVEL_ID];
  const mission = content.missions.levels[LEVEL_ID];
  if (!level || !mission) throw new Error(`level ${LEVEL_ID} is missing from the content`);
  const world = createRun({
    mode: 'free',
    level,
    mission,
    moves: content.moves,
    tables: content.tables,
  });
  const camera = new Camera(VIEW.width, VIEW.height);
  camera.reset(world.player, world.level);
  const characters = new CharacterRenderer(scene, world.moves, buildClipTable(content.anims.clips));
  characters.attach(world.player, { character, ghost });
  const particles = new Particles(sheet, world.sine);
  particles.setLevel(world.level);
  levelRenderer.setLevel(LEVEL_ID, world.level);
  return {
    world,
    camera,
    characters,
    particles,
    bounce: new MarkerBounce(),
    clock: new FixedStepClock(),
  };
}

async function main(): Promise<void> {
  const canvas = document.getElementById('view') as HTMLCanvasElement | null;
  const status = document.getElementById('status');
  if (!canvas) throw new Error('canvas #view not found');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');
  ctx.imageSmoothingEnabled = false;

  const content = await loadContent();
  const sheet = new SpriteSheet(content.atlas.image, content.atlas.frames);
  const scene = new SceneRenderer(sheet, content.scenes.values());
  scene.setViewport(VIEW.width, VIEW.height);
  const levelRenderer = new LevelRenderer(content, sheet, scene, buildSine());
  const theme = themeOfLevel(LEVEL_ID);
  const artFrame = defaultLevelArtFrame(LEVEL_ID);

  let character = 0;
  let ghost = false;
  let session = startSession(content, scene, sheet, levelRenderer, character, ghost);
  let pending = 0;
  let showTiles = false;
  let paused = false;
  let stepOnce = false;
  let fps = 0;
  let frames = 0;
  let fpsTime = performance.now();

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const facing = session.world.player.facingRight;
    switch (e.key) {
      case 'ArrowUp':
        pending |= Input.UP;
        break;
      case 'ArrowDown':
        pending |= Input.DOWN;
        break;
      case 'ArrowRight':
        pending |= Input.RIGHT | (facing ? Input.FORWARD : Input.BACK);
        break;
      case 'ArrowLeft':
        pending |= Input.LEFT | (facing ? Input.BACK : Input.FORWARD);
        break;
      case 't':
      case 'T':
        showTiles = !showTiles;
        break;
      case 'p':
      case 'P':
        paused = !paused;
        break;
      case 'n':
      case 'N':
        stepOnce = true;
        break;
      case 'r':
      case 'R':
        session = startSession(content, scene, sheet, levelRenderer, character, ghost);
        pending = 0;
        break;
      case 'c':
      case 'C': {
        character = (character + 1) % 10;
        const v = session.characters.get(session.world.player);
        if (v) v.character = character;
        break;
      }
      case 'g':
      case 'G': {
        ghost = !ghost;
        const v = session.characters.get(session.world.player);
        if (v) v.ghost = ghost;
        break;
      }
      default:
        return;
    }
    e.preventDefault();
  });

  const stepper = {
    step(): boolean {
      const { world, characters, particles, camera, bounce } = session;
      const bits = pending;
      pending = 0;
      const alive = world.step(bits);
      characters.onEvents(world.events);
      particles.onEvents(world.events);
      for (const ev of world.events) {
        if (ev.type === 'checkpoint' || ev.type === 'flag') bounce.trigger(ev.index);
      }
      characters.step(world.clock, STEP);
      particles.update(STEP, world.player);
      bounce.advance(STEP);
      camera.update(world.player, world.level);
      return alive;
    },
  };

  const render = (alpha: number): void => {
    const { world, camera, characters, particles, bounce } = session;
    const now = performance.now();
    const cam = { x: camera.renderX(alpha), y: camera.renderY(alpha) };
    ctx.imageSmoothingEnabled = false;
    levelRenderer.drawBackground(ctx, cam, VIEW, now, theme);
    levelRenderer.drawLevelArt(ctx, cam, VIEW, artFrame);
    levelRenderer.drawMarkers(ctx, cam, VIEW, world.level, world.rules, now, bounce);
    particles.draw(ctx, cam, VIEW, world.clock, false);
    if (showTiles) levelRenderer.drawDebugTiles(ctx, cam, VIEW, world.level);
    characters.drawAll(ctx, cam, alpha, world.clock, world.player);
    particles.draw(ctx, cam, VIEW, world.clock, true);

    const p = world.player;
    const v = characters.get(p);
    const anim = v?.animator;
    const lines = [
      `move ${p.moveId}  timer ${p.moveTimer}  clock ${world.clock}  step ${world.stepCount}  fps ${fps}`,
      `x ${p.x} y ${p.y}  vx ${p.vx} vy ${p.vy}  facing ${p.facingRight ? 'R' : 'L'}  hands ${p.handsAnchored ? 'Y' : 'N'}`,
      `cam ${camera.x},${camera.y}  tgt ${camera.targetX},${camera.targetY}`,
      anim
        ? `clip ${anim.clipStart - 1} mode ${anim.mode} frame ${anim.frame}/${anim.clipLength} prev ${anim.prevFrame} tween ${anim.tween} face ${anim.faceSprite(world.clock)}`
        : '',
      `skin ${character}${ghost ? ' ghost' : ''}  ${paused ? 'PAUSED' : ''}`,
    ];
    ctx.font = '11px monospace';
    ctx.textBaseline = 'top';
    lines.forEach((text, i) => {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(4, 4 + i * 13, ctx.measureText(text).width + 6, 13);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(text, 7, 5 + i * 13);
    });
  };

  const loop = new GameLoop((dt) => {
    frames++;
    const now = performance.now();
    if (now - fpsTime >= 1000) {
      fps = frames;
      frames = 0;
      fpsTime = now;
    }
    if (!paused) {
      session.clock.advance(dt, stepper);
    } else if (stepOnce) {
      stepOnce = false;
      stepper.step();
      session.clock.reset();
    }
    render(session.clock.alpha);
  });
  loop.start();
  if (status)
    status.textContent = `level ${LEVEL_ID} free run - theme ${theme}, art frame ${artFrame}`;
}

/** The parallax water and the flag bounce use the game's cosine table (`short_arr_a(10, true)`). */
function buildSine(): Int16Array {
  return buildSineTable(10, true);
}

main().catch((err: unknown) => {
  const status = document.getElementById('status');
  if (status) status.textContent = String(err);
  console.error(err);
});
