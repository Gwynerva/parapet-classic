/**
 * The character screen's preview: the highlighted character running through a little piece of
 * its world. Behind it the sky and parallax strips of its level, then the things of its world
 * (`bosses/<boss>/stage.json`) scrolling past at their own speeds, a strip of ground, a tint of
 * light and ambient particles; on the character its effects (particles, afterimages, cloth)
 * as in a run. A boss with several outfits changes into the next every few seconds. A character
 * not open yet runs as a silhouette, without effects, in its world all the same.
 */
import type { SceneRenderer, SpriteSwap } from '@parapet/runtime/render/SceneRenderer.ts';
import { drawPose, type CharacterPose } from '@parapet/runtime/render/CharacterRenderer.ts';
import type { EchoColor } from '@parapet/runtime/render/EchoSkin.ts';
import { CharacterFx } from '@parapet/runtime/render/fx/CharacterFx.ts';
import { StageRenderer } from '@parapet/runtime/render/Stage.ts';
import { themeOfLevel } from '@parapet/runtime/render/LevelRenderer.ts';
import { prefersReducedMotion } from '@parapet/runtime/ui/motion.ts';
import type { Rect } from '@parapet/runtime/ui/layout.ts';
import type { GameContext } from '../Context.ts';
import { bossOfCharacter, characterFx } from '../bosses.ts';
import { rivalLevels } from '../characters.ts';

/** The run demo of the Moves menu (demo 0), played in place. */
const RUN_DEMO = 0;
const FRAME_MS = 110;
const STEP_MS = 30;
/** How fast the world goes by, in pixels per second (about a good run). */
const RUN_PX = 120;
/** A boss changes outfit this often. */
const OUTFIT_MS = 4200;
/** World units per pixel. */
const UNITS = 32;
const GROUND_COLOR = '#3a3f4b';
const GROUND_EDGE = '#5b6270';

export type StageMode = 'open' | 'locked' | 'workshop';

interface Shown {
  character: number;
  mode: StageMode;
  silhouette: EchoColor | null;
  outfit: number;
  stage: StageRenderer | null;
  theme: number;
}

export class CharacterStage {
  private readonly ctx: GameContext;
  private readonly reduced = prefersReducedMotion();
  private fx: CharacterFx;
  private shown: Shown | null = null;
  private clock = 0;
  private acc = 0;
  /** The runner's position in the stage's world, in units. */
  private x = 0;
  private readonly stages = new Map<string, StageRenderer>();
  private readonly subject = {};
  private ambientRand = 1;

  constructor(ctx: GameContext) {
    this.ctx = ctx;
    this.fx = new CharacterFx(ctx.render.echo, { reducedMotion: this.reduced });
  }

  /** Shows `character`; its silhouette in `silhouette` unless it is open. */
  show(character: number, mode: StageMode, silhouette: EchoColor | null): void {
    const s = this.shown;
    if (s && s.character === character && s.mode === mode) return;
    const boss = bossOfCharacter(character)?.boss ?? null;
    let level = 0;
    if (boss) level = boss.stage?.level ?? boss.levelId;
    else if (character > 1) level = rivalLevels(this.ctx.content, character)[0] ?? 0;
    let stage: StageRenderer | null = null;
    if (boss?.stage) {
      const accent = boss.data.color;
      stage = this.stages.get(boss.id) ?? new StageRenderer(boss.stage, accent);
      this.stages.set(boss.id, stage);
    }
    this.shown = { character, mode, silhouette, outfit: 0, stage, theme: themeOfLevel(level) };
    this.fx.clear();
    this.attach();
  }

  private outfits(): number {
    const s = this.shown;
    return s ? Math.max(1, this.ctx.render.skins.outfitCount(s.character)) : 1;
  }

  private attach(): void {
    const s = this.shown;
    this.fx.remove(this.subject);
    if (!s || s.mode !== 'open') return;
    const skins = this.ctx.render.skins;
    const style = characterFx(skins, s.character, s.outfit, () =>
      skins.swapFor(s.character, -1, s.outfit),
    );
    if (!style) return;
    this.fx.add(this.subject, { pose: () => this.pose(), move: () => 2 }, style);
  }

  private frameAt(k: number): number {
    const { content, render } = this.ctx;
    const demo = content.anims.demos[RUN_DEMO];
    if (!demo) return 0;
    const count = Math.max(1, demo.frameCount);
    const i = (((Math.floor(this.clock / FRAME_MS) - k) % count) + count) % count;
    return render.clips[demo.clipOffset + 1 + i] ?? 0;
  }

  private pose(): CharacterPose {
    const still = this.shown?.mode !== 'open' || this.reduced;
    if (still) {
      const demo = this.ctx.content.anims.demos[RUN_DEMO];
      const idle = this.ctx.render.clips[(demo?.clipOffset ?? 0) + 1] ?? 0;
      return { x: this.x, y: 0, a: idle, b: idle, t: 0, flipX: false, anchored: false };
    }
    return {
      x: this.x,
      y: 0,
      a: this.frameAt(1),
      b: this.frameAt(0),
      t: Math.floor(((this.clock % FRAME_MS) / FRAME_MS) * 65536),
      flipX: false,
      anchored: false,
    };
  }

  update(dt: number): void {
    const s = this.shown;
    if (!s) return;
    const moving = !this.reduced;
    this.clock += dt;
    if (moving) this.x += (RUN_PX * UNITS * dt) / 1000;
    // Outfits take turns.
    const n = this.outfits();
    const outfit = n > 1 ? Math.floor(this.clock / OUTFIT_MS) % n : 0;
    if (outfit !== s.outfit) {
      s.outfit = outfit;
      this.attach();
    }
    this.acc += dt;
    while (this.acc >= STEP_MS) {
      this.acc -= STEP_MS;
      this.fx.step({ clock: this.clock });
      this.ambient();
    }
  }

  /** The place's own particles, around the visible part of the world. */
  private ambient(): void {
    const stage = this.shown?.stage;
    const names = stage?.file.ambient;
    if (!stage || !names?.length || this.reduced) return;
    const rand = (): number => {
      let s = this.ambientRand;
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      this.ambientRand = s;
      return ((s >>> 0) % 100000) / 100000;
    };
    // Spread over a screen's width around the runner, ahead of it more than behind.
    const x = this.x + (rand() * 360 - 100) * UNITS;
    this.fx.idleAt(stage.fx, names, x, 0, true, rand);
  }

  /** The current outfit (for the name of the look). */
  get outfit(): number {
    return this.shown?.outfit ?? 0;
  }

  draw(c: CanvasRenderingContext2D, d: Rect, zoom: number): void {
    const s = this.shown;
    if (!s) return;
    const { render } = this.ctx;
    const view = { width: Math.ceil(d.w / zoom), height: Math.ceil(d.h / zoom) };
    const feetX = Math.round(view.width * 0.42);
    const feetY = view.height - 10;
    const scroll = this.x / UNITS;
    c.save();
    c.beginPath();
    c.rect(d.x, d.y, d.w, d.h);
    c.clip();
    c.translate(d.x, d.y);
    c.scale(zoom, zoom);
    c.imageSmoothingEnabled = false;
    // The place's own sky, else its level's.
    if (s.stage?.hasSky) s.stage.drawSky(c, 0, view.width, feetY, this.clock);
    else render.level.drawBackground(c, { x: Math.round(this.x), y: 0 }, view, this.clock, s.theme);
    if (s.stage) {
      s.stage.draw(c, 0, view.width, feetY, scroll, false, 0, this.clock);
    } else {
      c.fillStyle = GROUND_COLOR;
      c.fillRect(0, feetY, view.width, view.height - feetY);
      c.fillStyle = GROUND_EDGE;
      c.fillRect(0, feetY, view.width, 1);
    }
    const cam = { x: Math.round(this.x - feetX * UNITS), y: -feetY * UNITS };
    const now = performance.now();
    this.fx.drawBehind(c, cam, this.clock, now, view);
    const { scene, swap } = this.look(s);
    const pose = this.pose();
    // Scenes are shared (the tiles draw with them too): the stage's culling box only for now.
    const savedW = scene.viewWidth;
    const savedH = scene.viewHeight;
    scene.setViewport(view.width, view.height);
    drawPose(c, scene, pose, cam, swap);
    scene.setViewport(savedW, savedH);
    this.fx.drawFront(c, cam);
    if (s.stage) s.stage.draw(c, 0, view.width, feetY, scroll, true, 0, this.clock);
    c.restore();
    if (s.silhouette) {
      this.ctx.fonts.title.draw(c, '?', d.x + feetX * zoom, d.y + 8, {
        align: 'center',
        color: s.silhouette.light,
      });
    }
  }

  private look(s: Shown): { scene: SceneRenderer; swap: SpriteSwap } {
    const { render } = this.ctx;
    const skins = render.skins;
    const swap = skins.swapFor(s.character, -1, s.outfit);
    const source = skins.sceneFor(s.character, s.outfit);
    if (s.silhouette) {
      const base = s.mode === 'workshop' ? render.scene : source;
      return { scene: render.echo.scene(s.silhouette, false, base), swap };
    }
    return { scene: source, swap };
  }
}
