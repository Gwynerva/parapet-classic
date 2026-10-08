/**
 * Render debug page: runs level 0 as a free run and draws it with the rendering core on a
 * 640×360 canvas (scaled ×2 by CSS). Arrow keys are turned into the original press bits.
 * C cycles the characters (the original's ten, then the drawn bosses, each with the effect of
 * its Flag hunt and of its Sprint), O the outfits of a boss, G the way the runner is drawn
 * (itself, a player's echo, a rival's echo), V a sheet of poses of the current character,
 * magnified (the first frame of every move demo and the run cycle), for drawing looks.
 */
import { buildSineTable, createRun, Input, STEP, type World } from '@parapet/sim';
import { loadContent, type GameContent } from './assets/content.ts';
import { buildClipTable } from '@parapet/runtime/anim/Animator.ts';
import { FixedStepClock, GameLoop } from '@parapet/runtime/app/GameLoop.ts';
import { Camera } from '@parapet/runtime/render/Camera.ts';
import { CharacterRenderer, skinSwap } from '@parapet/runtime/render/CharacterRenderer.ts';
import { EchoRenderer } from '@parapet/runtime/render/EchoRenderer.ts';
import { ECHO_GREY, EchoSheets, echoColor } from '@parapet/runtime/render/EchoSkin.ts';
import {
  defaultLevelArtFrame,
  LevelRenderer,
  MarkerBounce,
  themeOfLevel,
} from '@parapet/runtime/render/LevelRenderer.ts';
import { Particles } from '@parapet/runtime/render/Particles.ts';
import { CHARACTER_OBJECT, SceneRenderer } from '@parapet/runtime/render/SceneRenderer.ts';
import { SpriteSheet } from '@parapet/runtime/render/SpriteSheet.ts';
import { SkinLibrary } from '@parapet/runtime/render/SkinLibrary.ts';
import { CharacterFx } from '@parapet/runtime/render/fx/CharacterFx.ts';
import {
  allBosses,
  characterFx,
  CONTEST_KINDS,
  contestCharacter,
  isDrawn,
  registerBosses,
} from './app/bosses.ts';
import type { ViewSize } from '@parapet/runtime/render/View.ts';

const LEVEL_ID = 0;
const VIEW: ViewSize = { width: 640, height: 360 };
/** How the runner is drawn: as itself, as a player's echo, as the grey echo of a rival. */
const LOOKS = ['normal', 'echo', 'rival echo'] as const;

interface Session {
  world: World;
  camera: Camera;
  characters: CharacterRenderer;
  echo: EchoRenderer;
  fx: CharacterFx;
  particles: Particles;
  bounce: MarkerBounce;
  clock: FixedStepClock;
}

function startSession(
  content: GameContent,
  scene: SceneRenderer,
  sheet: SpriteSheet,
  levelRenderer: LevelRenderer,
  echoSheets: EchoSheets,
  skins: SkinLibrary,
  character: number,
  look: number,
  outfit: number,
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
  const characters = new CharacterRenderer(
    scene,
    world.moves,
    buildClipTable(content.anims.clips),
    skins,
  );
  characters.attach(world.player, { character, outfit, echo: look > 0 });
  const echo = new EchoRenderer(characters, echoSheets);
  const fx = new CharacterFx(echoSheets);
  const player = world.player;
  if (look > 0) {
    echo.add(player, {
      color: look === 1 ? echoColor('Parapet') : ECHO_GREY,
      textured: look === 1,
      source: look === 1 ? skins.sceneFor(character, outfit) : scene,
      swap: look === 1 ? (clock) => characters.swapFor(player, clock) : () => skinSwap(1),
    });
    echo.reveal(performance.now());
  } else {
    const style = characterFx(skins, character, outfit, (clock) =>
      characters.swapFor(player, clock),
    );
    if (style) {
      fx.add(player, { pose: () => characters.pose(player, 1), move: () => player.moveId }, style);
    }
  }
  const particles = new Particles(sheet, world.sine);
  particles.setLevel(world.level);
  levelRenderer.setLevel(LEVEL_ID, world.level);
  return {
    world,
    camera,
    characters,
    echo,
    fx,
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
  const echoSheets = new EchoSheets(scene);
  const skins = new SkinLibrary(scene);
  registerBosses(skins);
  // The original's ten, then every drawn boss (once per contest: its two effects).
  const characterIds = Array.from({ length: 10 }, (_, i) => i);
  for (const boss of allBosses()) {
    if (!isDrawn(boss)) continue;
    for (const kind of CONTEST_KINDS) characterIds.push(contestCharacter(boss.levelId, kind));
  }
  const theme = themeOfLevel(LEVEL_ID);
  const artFrame = defaultLevelArtFrame(LEVEL_ID);

  let character = 0;
  let look = 0;
  let outfit = 0;
  const restart = (): Session =>
    startSession(content, scene, sheet, levelRenderer, echoSheets, skins, character, look, outfit);
  let session = restart();
  let pending = 0;
  let showTiles = false;
  let showPoses = false;
  const poseCanvas = document.createElement('canvas');
  poseCanvas.width = VIEW.width / 2;
  poseCanvas.height = VIEW.height / 2;
  /** Keyframes of the pose sheet: every demo's first frame, then the run cycle. */
  const clipTable = buildClipTable(content.anims.clips);
  const poseFrames = [
    ...content.anims.demos.map((d) => clipTable[d.clipOffset + 1] ?? 0),
    ...Array.from({ length: 10 }, (_, i) => {
      const run = content.anims.demos[0];
      return run ? (clipTable[run.clipOffset + 1 + (i % run.frameCount)] ?? 0) : 0;
    }),
  ];
  const drawPoses = (): void => {
    const pctx = poseCanvas.getContext('2d');
    if (!pctx) return;
    pctx.imageSmoothingEnabled = false;
    pctx.fillStyle = '#9fb3c8';
    pctx.fillRect(0, 0, poseCanvas.width, poseCanvas.height);
    const poseScene = skins.sceneFor(character, outfit);
    const swap = skins.swapFor(character, -1, outfit);
    const cols = 10;
    const cellW = poseCanvas.width / cols;
    const cellH = poseCanvas.height / 3;
    poseFrames.forEach((frame, i) => {
      const x = (i % cols) * cellW + cellW / 2;
      const y = Math.floor(i / cols) * cellH + cellH - 8;
      poseScene.drawFrame(pctx, CHARACTER_OBJECT, frame, x, y, undefined, false, swap);
    });
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(poseCanvas, 0, 0, VIEW.width, VIEW.height);
  };
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
        session = restart();
        pending = 0;
        break;
      case 'c':
      case 'C': {
        const at = characterIds.indexOf(character);
        character = characterIds[(at + 1) % characterIds.length] ?? 0;
        outfit = 0;
        session = restart();
        pending = 0;
        break;
      }
      case 'o':
      case 'O':
        outfit = (outfit + 1) % Math.max(1, skins.outfitCount(character));
        session = restart();
        pending = 0;
        break;
      case 'v':
      case 'V':
        showPoses = !showPoses;
        break;
      case 'g':
      case 'G':
        look = (look + 1) % LOOKS.length;
        session = restart();
        pending = 0;
        break;
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
      session.echo.step();
      session.fx.step({ clock: world.clock });
      particles.update(STEP, world.player);
      bounce.advance(STEP);
      camera.update(world.player, world.level);
      return alive;
    },
  };

  const render = (alpha: number): void => {
    const { world, camera, characters, echo, particles, bounce } = session;
    const now = performance.now();
    const cam = { x: camera.renderX(alpha), y: camera.renderY(alpha) };
    ctx.imageSmoothingEnabled = false;
    if (showPoses) {
      drawPoses();
      return;
    }
    levelRenderer.drawBackground(ctx, cam, VIEW, now, theme);
    levelRenderer.drawLevelArt(ctx, cam, VIEW, artFrame);
    levelRenderer.drawMarkers(ctx, cam, VIEW, world.level, world.rules, now, bounce);
    particles.draw(ctx, cam, VIEW, world.clock, false);
    if (showTiles) levelRenderer.drawDebugTiles(ctx, cam, VIEW, world.level);
    echo.draw(ctx, cam, alpha, world.clock, now, VIEW);
    session.fx.drawBehind(ctx, cam, world.clock, now, VIEW);
    characters.drawAll(ctx, cam, alpha, world.clock, world.player);
    session.fx.drawFront(ctx, cam);
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
      `skin ${character}  outfit ${skins.lookOf(character, outfit)?.id ?? '-'}  look ${LOOKS[look]}  ${paused ? 'PAUSED' : ''}`,
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
