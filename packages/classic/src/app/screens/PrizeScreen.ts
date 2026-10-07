/**
 * The Prize ending (state 11, d.java line 5485): Playman and Blaise on the rooftops of Pine
 * Island, the birds taking off, fireworks, the camera rising into the sky, then the
 * congratulations and the credits. Confirm leaves.
 */
import { Level } from '@parapet/sim';
import { Theme, type GameContext } from '../Context.ts';
import type { Screen, UiKey, UiPointer } from '@parapet/runtime/app/Screen.ts';
import { Camera } from '@parapet/runtime/render/Camera.ts';
import { CharacterRenderer } from '@parapet/runtime/render/CharacterRenderer.ts';
import { Particles } from '@parapet/runtime/render/Particles.ts';
import { themeOfLevel } from '@parapet/runtime/render/LevelRenderer.ts';
import type { ViewSize } from '@parapet/runtime/render/View.ts';
import { smoothstep } from '@parapet/runtime/render/CameraTour.ts';
import { IDLE_CLIP_OFFSET } from '@parapet/runtime/anim/Animator.ts';
import { outlined, panel } from '@parapet/runtime/ui/draw.ts';
import { centered, inset, safeRect } from '@parapet/runtime/ui/layout.ts';
import { markPrizeSeen } from '@parapet/runtime/storage/profile.ts';
import { hash } from '@parapet/runtime/render/Particles.ts';
import { COACH_TALK_CLIP } from '../ui/sprites.ts';
import { TitleScreen } from './TitleScreen.ts';

const PRIZE_LEVEL = 11;
/** Cells of the pair (`x(11)`): Playman at (53, 4), Blaise at (51, 4). */
const PLAYMAN_CELL = { x: 53, y: 4 };
const BLAISE_CELL = { x: 51, y: 4 };
const RISE_UNITS = 8192;
const SKY_FLASH_MS = 512;

export class PrizeScreen implements Screen {
  private readonly ctx: GameContext;
  private readonly level: Level;
  private readonly camera: Camera;
  private readonly characters: CharacterRenderer;
  private readonly particles: Particles;
  private readonly view: ViewSize = { width: 240, height: 320 };
  private elapsed = 0;
  private birdsScared = 0;
  private nextVolley = 14000;
  private baseY = 0;
  private readonly theme = themeOfLevel(PRIZE_LEVEL);

  constructor(ctx: GameContext) {
    this.ctx = ctx;
    const data = ctx.content.levels[PRIZE_LEVEL];
    if (!data) throw new Error('level 11 is missing');
    this.level = new Level(data, 0);
    this.camera = new Camera(this.view.width, this.view.height);
    this.characters = new CharacterRenderer(ctx.render.scene, ctx.render.moves, ctx.render.clips);
    const idle = ctx.render.clips[IDLE_CLIP_OFFSET + 1] ?? 0;
    this.characters.attachNpc('playman', {
      x: (PLAYMAN_CELL.x << 10) + 512,
      y: (PLAYMAN_CELL.y << 10) + 1024,
      character: 1,
      facingRight: false,
      idleKeyframe: idle,
    });
    const blaise = this.characters.attachNpc('blaise', {
      x: (BLAISE_CELL.x << 10) + 512,
      y: (BLAISE_CELL.y << 10) + 1024,
      character: 0,
      idleKeyframe: idle,
      talkClipOffset: COACH_TALK_CLIP,
    });
    blaise.talking = true;
    this.particles = new Particles(ctx.render.sheet, ctx.render.sine);
    this.particles.setLevel(this.level);
    ctx.render.level.setLevel(PRIZE_LEVEL, this.level);
    this.onResize();
    markPrizeSeen();
    ctx.music.prize();
  }

  onResize(): void {
    const { viewport, render } = this.ctx;
    this.view.width = viewport.width;
    this.view.height = viewport.height;
    this.camera.setViewport(viewport.width, viewport.height);
    render.scene.setViewport(viewport.width, viewport.height);
    // The pair stands near the bottom of the screen; the camera later rises by 8 tiles.
    this.baseY = (PLAYMAN_CELL.y << 10) + 1024 - this.camera.viewH + 2048;
    this.place();
  }

  private place(): void {
    const t = smoothstep((this.elapsed - 6000) / 3000);
    const x = ((PLAYMAN_CELL.x + BLAISE_CELL.x) << 9) + 512 - (this.camera.viewW >> 1);
    this.camera.moveTo(x, this.baseY - Math.round(RISE_UNITS * t), this.level);
  }

  update(dt: number): void {
    const before = this.elapsed;
    this.elapsed += dt;
    // 4-6 s: the birds fly off one by one.
    if (this.elapsed > 4000 && this.birdsScared < this.level.birds.length) {
      const due = Math.floor(((this.elapsed - 4000) / 2000) * this.level.birds.length) + 1;
      if (due > this.birdsScared) {
        this.particles.scareBirds(due - this.birdsScared);
        this.birdsScared = due;
      }
    }
    if (before <= 6000 && this.elapsed > 6000) this.volley(4);
    if (this.elapsed >= this.nextVolley) {
      this.volley(4 + (hash(Math.floor(this.elapsed)) % 4));
      this.nextVolley += 5000;
    }
    this.particles.update(dt);
    this.place();
  }

  private volley(count: number): void {
    const centreX = this.camera.x + (this.camera.viewW >> 1);
    const groundY = (PLAYMAN_CELL.y << 10) + 1024;
    for (let i = 0; i < count; i++) {
      const dx =
        (hash(i * 7919 + Math.floor(this.elapsed)) % (this.camera.viewW >> 1)) -
        (this.camera.viewW >> 2);
      this.particles.spawnFirework(centreX + dx, groundY);
    }
  }

  onKey(key: UiKey): void {
    if (key.action === 'confirm' || key.action === 'back') this.leave();
  }

  onPointer(p: UiPointer): void {
    if (p.type === 'down') this.leave();
  }

  private leave(): void {
    this.ctx.screens.clear(new TitleScreen(this.ctx));
  }

  render(c: CanvasRenderingContext2D): void {
    const { render, viewport, fonts, i18n } = this.ctx;
    const cam = { x: this.camera.renderX(1), y: this.camera.renderY(1) };
    const now = performance.now();
    c.imageSmoothingEnabled = false;
    render.level.drawBackground(c, cam, this.view, now, this.theme);
    const sinceBurst =
      this.particles.lastBurstAt >= 0 ? this.elapsed - this.particles.lastBurstAt : -1;
    if (sinceBurst >= 0 && sinceBurst < SKY_FLASH_MS) {
      c.save();
      c.globalAlpha = 0.35 * (1 - sinceBurst / SKY_FLASH_MS);
      c.fillStyle = this.particles.lastBurstColour;
      c.fillRect(0, 0, viewport.width, viewport.height);
      c.restore();
    }
    render.level.drawLevelArt(c, cam, this.view, 0);
    this.particles.draw(c, cam, this.view, this.elapsed, false);
    this.characters.drawNpcs(c, cam, now);
    this.particles.draw(c, cam, this.view, this.elapsed, true);
    const safe = inset(safeRect(viewport), 8, 0);
    if (this.elapsed >= 14000) {
      outlined(c, fonts.title, i18n.t('prize.title'), safe.x + (safe.w >> 1), safe.y + 24, {
        align: 'center',
        color: Theme.accent,
      });
    }
    if (this.elapsed >= 19000) {
      const text = i18n.t('prize.text');
      const w = Math.min(360, safe.w);
      const lines = fonts.small.wrap(text, w - 16);
      const h = lines.length * fonts.small.lineHeight + 16;
      const box = centered({ x: safe.x, y: safe.y + 60, w: safe.w, h: safe.h - 60 }, w, h);
      panel(c, box.x, box.y, box.w, box.h);
      fonts.small.draw(c, lines.join('\n'), box.x + 8, box.y + 8, { color: Theme.text });
    }
  }
}
