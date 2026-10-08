/**
 * The stage of the Moves screen: one demo played on its little level of grey blocks, in the
 * player's character (a boss in a random outfit, with its effects). The camera follows the
 * runner inside the box; at the end the picture fades out and the demo starts over.
 */
import { STEP } from '@parapet/sim';
import { FixedStepClock } from '@parapet/runtime/app/GameLoop.ts';
import { CharacterRenderer } from '@parapet/runtime/render/CharacterRenderer.ts';
import { drawPlaceholderTiles } from '@parapet/runtime/render/PlaceholderTiles.ts';
import { CharacterFx } from '@parapet/runtime/render/fx/CharacterFx.ts';
import { prefersReducedMotion } from '@parapet/runtime/ui/motion.ts';
import { screenPixels, worldGrid, type CameraPos } from '@parapet/runtime/render/View.ts';
import { DemoRun, type MoveDemoData } from '@parapet/runtime/moves/MoveDemo.ts';
import type { Rect } from '@parapet/runtime/ui/layout.ts';
import type { GameContext } from '../Context.ts';
import { characterFx, pickOutfit } from '../bosses.ts';

/** Fade at the start and the end of every pass, ms. */
const FADE_MS = 250;
/** World units per pixel. */
const UNITS_PER_PX = 32;
/** Where the runner sits across the stage. */
const FOLLOW_X = 0.4;
const FOLLOW_Y = 0.62;
/** Camera smoothing per step (a fraction of the distance to the target). */
const CAMERA_EASE = 0.18;

export class MoveStage {
  private readonly ctx: GameContext;
  private run: DemoRun | null = null;
  private characters: CharacterRenderer | null = null;
  private fx: CharacterFx | null = null;
  private readonly clock = new FixedStepClock();
  private cam: CameraPos = { x: 0, y: 0 };
  private prevCam: CameraPos = { x: 0, y: 0 };
  /** Stage size the camera frames, pixels. */
  private view = { width: 1, height: 1 };
  /** Fade: ms since the pass began, or the countdown after it ended. */
  private age = 0;
  private ending = -1;
  /** Steps of the demo's run-up, played at once on every pass. */
  private from = 0;

  constructor(ctx: GameContext) {
    this.ctx = ctx;
  }

  /** Shows a demo from its start. */
  show(data: MoveDemoData): void {
    // The run-up is played here, not by the demo, so the renderers see its steps: the runner
    // shows up running, not standing.
    this.from = data.from;
    this.run = new DemoRun({ ...data, from: 0 }, this.ctx.content);
    this.restartPass();
  }

  /** One step of the world, the animations and the effects (quiet during the run-up). */
  private stepWorld(silent = false): void {
    const run = this.run!;
    const events = run.step();
    this.characters!.onEvents(events);
    this.characters!.step(run.world.clock, STEP);
    this.fx!.step({ silent, clock: run.world.clock });
  }

  private attach(): void {
    const run = this.run!;
    const runner = run.world.player;
    const character = this.ctx.player.character;
    const characters = this.characters!;
    characters.attach(runner, { character, outfit: pickOutfit(character), seed: 1 });
    const style = characterFx(
      this.ctx.render.skins,
      character,
      characters.get(runner)?.outfit ?? 0,
      (clock) => characters.swapFor(runner, clock),
    );
    if (style) {
      this.fx!.add(
        runner,
        { pose: () => characters.pose(runner, 1), move: () => runner.moveId },
        style,
      );
    }
  }

  private restartPass(): void {
    const run = this.run;
    if (!run) return;
    // A new world (a new runner object) and new renderers, then the run-up at once.
    run.restart();
    const { render } = this.ctx;
    this.characters = new CharacterRenderer(render.scene, render.moves, render.clips, render.skins);
    this.fx = new CharacterFx(render.echo, { reducedMotion: prefersReducedMotion() });
    this.attach();
    while (run.stepCount < this.from) this.stepWorld(true);
    this.clock.reset();
    this.age = 0;
    this.ending = -1;
    this.cam = this.target();
    this.prevCam = { ...this.cam };
  }

  /** The camera's goal: the runner a little left of the middle, the level kept in view. */
  private target(): CameraPos {
    const run = this.run!;
    const p = run.world.player;
    const viewW = this.view.width * UNITS_PER_PX;
    const viewH = this.view.height * UNITS_PER_PX;
    const levelW = run.level.width * 1024;
    const levelH = run.level.height * 1024;
    const x =
      levelW <= viewW
        ? -((viewW - levelW) >> 1)
        : Math.max(0, Math.min(levelW - viewW, p.x - viewW * FOLLOW_X));
    const y =
      levelH <= viewH
        ? -(viewH - levelH)
        : Math.max(0, Math.min(levelH - viewH, p.y - viewH * FOLLOW_Y));
    return { x: Math.round(x), y: Math.round(y) };
  }

  update(dt: number): void {
    const run = this.run;
    if (!run || !this.characters || !this.fx) return;
    this.age += dt;
    if (this.ending >= 0) {
      this.ending -= dt;
      if (this.ending < 0) this.restartPass();
      return;
    }
    this.clock.advance(dt, {
      step: () => {
        if (run.done) return false;
        this.stepWorld();
        this.prevCam = this.cam;
        const goal = this.target();
        this.cam = {
          x: Math.round(this.cam.x + (goal.x - this.cam.x) * CAMERA_EASE),
          y: Math.round(this.cam.y + (goal.y - this.cam.y) * CAMERA_EASE),
        };
        return true;
      },
    });
    if (run.done) this.ending = FADE_MS;
  }

  /** Draws the demo into `stage` (clipped), at an integer zoom. */
  draw(c: CanvasRenderingContext2D, stage: Rect, zoom = 1): void {
    const run = this.run;
    const characters = this.characters;
    if (!run || !characters || !this.fx) return;
    const width = Math.ceil(stage.w / zoom);
    const height = Math.ceil(stage.h / zoom);
    if (width !== this.view.width || height !== this.view.height) {
      this.view = { width, height };
      this.cam = this.target();
      this.prevCam = { ...this.cam };
    }
    const alpha = this.clock.alpha;
    const exact = {
      x: this.prevCam.x + (this.cam.x - this.prevCam.x) * alpha,
      y: this.prevCam.y + (this.cam.y - this.prevCam.y) * alpha,
    };
    c.save();
    c.beginPath();
    c.rect(stage.x, stage.y, stage.w, stage.h);
    c.clip();
    c.translate(stage.x, stage.y);
    c.scale(zoom, zoom);
    // Whole pixels, moved by the rest to a screen pixel: the zoomed stage glides.
    const grid = worldGrid(exact, screenPixels(c));
    const cam = grid.cam;
    c.translate(grid.dx, grid.dy);
    drawPlaceholderTiles(
      c,
      run.level,
      cam.x / UNITS_PER_PX,
      cam.y / UNITS_PER_PX,
      this.view.width,
      this.view.height,
    );
    const now = performance.now();
    this.fx.drawBehind(c, cam, run.world.clock, now, this.view);
    characters.drawAll(c, cam, alpha, run.world.clock, run.world.player);
    this.fx.drawFront(c, cam);
    c.restore();
    // Fade in at the start of a pass, out at its end.
    const fade = this.ending >= 0 ? 1 - this.ending / FADE_MS : Math.max(0, 1 - this.age / FADE_MS);
    if (fade > 0) {
      c.globalAlpha = Math.min(1, fade);
      c.fillStyle = '#1b2129';
      c.fillRect(stage.x, stage.y, stage.w, stage.h);
      c.globalAlpha = 1;
    }
  }
}
