/**
 * Character select (`ar()`, d.java line 6370), laid out like the Moves menu: the highlighted
 * character runs through a little piece of its world in the box on top (`CharacterStage`), with
 * its name, counter and description in the same box, and every character sits in a grid of
 * small tiles below. The original's ten come first, then the twelve bosses in level order. Blaise
 * and Playman are open from the start, each rival once the levels they race on are complete
 * (`characters.ts`), each boss once either of its records is beaten; it wears its effect once
 * the Flag hunt one is (the tile then shows a spark). A character not open yet shows as a dark
 * silhouette, a boss still in the workshop as a silhouette in its colour; they can be looked at
 * but not chosen.
 */
import { LEVEL_COUNT } from '@parapet/sim';
import { CharacterStage } from '../ui/CharacterStage.ts';
import { Theme, type GameContext } from '../Context.ts';
import type { Screen, UiKey, UiPointer, UiWheel } from '@parapet/runtime/app/Screen.ts';
import { makeEchoColor, type EchoColor } from '@parapet/runtime/render/EchoSkin.ts';
import { CHARACTER_OBJECT, type SceneRenderer } from '@parapet/runtime/render/SceneRenderer.ts';
import {
  isContestBeaten,
  loadContestProgress,
  loadProgress,
  savePlayer,
  type ContestProgress,
  type Progress,
} from '@parapet/runtime/storage/profile.ts';
import { isCharacterOpen, rivalLevels } from '../characters.ts';
import { demoZoom, ShowcaseBox } from '@parapet/runtime/ui/ShowcaseBox.ts';
import { TileGrid } from '@parapet/runtime/ui/TileGrid.ts';
import { contains } from '@parapet/runtime/ui/layout.ts';
import {
  bossCharacterFor,
  bossOfCharacter,
  bossOfLevel,
  contestCharacter,
  effectNameKey,
  isDrawn,
  WORKSHOP_COLOR,
} from '../bosses.ts';
import { HEAD_SPRITE } from '@parapet/runtime/anim/Animator.ts';
import { LevelSelectScreen } from './LevelSelectScreen.ts';
import { ScreenFrame } from '../ui/ScreenFrame.ts';
import { showcaseLayout } from '../layouts.ts';

/** The run demo of the Moves menu (demo 0): its first frame shows the tiles' heads. */
const RUN_DEMO = 0;
const TILE = 30;
const TILE_GAP = 4;
/** Silhouette of a character not won yet. */
const LOCKED_COLOR: EchoColor = makeEchoColor('locked', '#5b6270');

interface Entry {
  /** For a boss, the version the player has (plain until it has its effect). */
  character: number;
  /** For the bosses: the level whose records unlock it. */
  levelId?: number;
}

export interface CharacterSelectOptions {
  /** Character highlighted first (default: the player's). */
  select?: number;
  /** Confirm returns to the screen below instead of going on to the levels. */
  back?: boolean;
}

export class CharacterSelectScreen implements Screen {
  readonly chrome = { fullscreenButton: true };
  private readonly ctx: GameContext;
  private readonly opts: CharacterSelectOptions;
  private readonly frame: ScreenFrame;
  private readonly box: ShowcaseBox;
  private readonly grid = new TileGrid(TILE, TILE_GAP);
  private readonly entries: Entry[] = [];
  private progress: ContestProgress = { beaten: { flags: 0, sprint: 0 } };
  private missions: Progress = { completed: [], prizeSeen: false };
  private readonly stage: CharacterStage;
  private shownOutfit = -1;

  constructor(ctx: GameContext, opts: CharacterSelectOptions = {}) {
    this.ctx = ctx;
    this.opts = opts;
    this.frame = new ScreenFrame(ctx);
    this.box = new ShowcaseBox(ctx.fonts);
    this.stage = new CharacterStage(ctx);
    for (const skin of ctx.skins) this.entries.push({ character: skin.character });
    for (let levelId = 0; levelId < LEVEL_COUNT; levelId++) {
      this.entries.push({ character: contestCharacter(levelId, 'sprint'), levelId });
    }
    this.refreshCharacters();
    // The original's characters, then the bosses on rows of their own.
    this.grid.setGroups([
      { count: ctx.skins.length },
      { count: this.entries.length - ctx.skins.length },
    ]);
    const wanted = opts.select ?? ctx.player.character;
    const wantedLevel = bossOfCharacter(wanted)?.levelId;
    this.grid.index = Math.max(
      0,
      this.entries.findIndex(
        (e) => e.character === wanted || (e.levelId !== undefined && e.levelId === wantedLevel),
      ),
    );
    this.grid.onSelect = (i) => this.select(i);
    this.grid.onActivate = () => this.confirm();
    this.onResize();
  }

  enter(): void {
    this.refreshCharacters();
    this.refreshText();
  }

  /** The bosses' entries follow the player's wins: plain, then with the effect. */
  private refreshCharacters(): void {
    this.progress = loadContestProgress();
    this.missions = loadProgress();
    for (const e of this.entries) {
      if (e.levelId === undefined) continue;
      e.character =
        bossCharacterFor(e.levelId, this.progress) ?? contestCharacter(e.levelId, 'sprint');
    }
  }

  onResize(): void {
    const { fonts } = this.ctx;
    this.frame.layout();
    const layout = showcaseLayout(this.frame.body, {
      boxMin: ShowcaseBox.heightFor(fonts, 90, 2),
      // Tall screens give the demo room instead of leaving it empty.
      boxMax: ShowcaseBox.heightFor(fonts, 220, 3),
      gridRow: TILE + TILE_GAP,
      gridHeight: (w) => {
        const probe = new TileGrid(TILE, TILE_GAP);
        probe.setGroups([
          { count: this.ctx.skins.length },
          { count: this.entries.length - this.ctx.skins.length },
        ]);
        probe.layout({ x: 0, y: 0, w, h: 10000 }, 12);
        return probe.rows * (TILE + TILE_GAP) - TILE_GAP;
      },
    });
    this.box.layout(layout.box, layout.box.h >= ShowcaseBox.heightFor(fonts, 120, 3) ? 3 : 2);
    this.grid.layout(layout.grid, 12);
    this.refreshText();
  }

  private status(e: Entry): 'open' | 'locked' | 'workshop' {
    if (e.levelId === undefined) {
      // A rival opens once the levels they race on are complete.
      return isCharacterOpen(this.ctx.content, this.missions, e.character) ? 'open' : 'locked';
    }
    if (!isDrawn(bossOfLevel(e.levelId))) return 'workshop';
    return bossCharacterFor(e.levelId, this.progress) !== null ? 'open' : 'locked';
  }

  private get entry(): Entry {
    return this.entries[this.grid.index]!;
  }

  /** The grid's selection changed: an open character becomes the player's at once. */
  private select(index: number): void {
    const entry = this.entries[index]!;
    this.refreshText();
    if (this.status(entry) !== 'open') return;
    this.ctx.player.character = entry.character;
    savePlayer(this.ctx.player);
  }

  private step(delta: number): void {
    this.grid.select(this.grid.index + delta);
  }

  private confirm(): void {
    const entry = this.entry;
    if (this.status(entry) !== 'open') return;
    // The highlighted character may not be the stored one yet (opened on a record just beaten).
    this.ctx.player.character = entry.character;
    savePlayer(this.ctx.player);
    if (this.opts.back) this.ctx.screens.pop();
    else this.ctx.screens.push(new LevelSelectScreen(this.ctx));
  }

  /** Name, counter and description of the highlighted entry. */
  private refreshText(): void {
    const { i18n, skins } = this.ctx;
    const entry = this.entry;
    let name: string;
    let desc: string;
    const levelId = entry.levelId;
    if (levelId === undefined) {
      const skin = skins.find((s) => s.character === entry.character);
      name = skin?.name ?? '';
      if (entry.character === 0) desc = i18n.t('player.blaise.desc');
      else if (entry.character === 1) desc = i18n.t('player.playman.desc');
      else {
        const levels = rivalLevels(this.ctx.content, entry.character);
        const names = levels.map((id) => i18n.t(`level.names.${id}`)).join(', ');
        desc = i18n.t('player.rival.desc', { name, n: levels.length, levels: names });
        if (this.status(entry) !== 'open') {
          desc += ' ' + i18n.t('player.locked', { n: levels.length, levels: names });
        }
      }
    } else {
      const found = bossOfCharacter(entry.character);
      const boss = found?.boss;
      const id = boss?.id ?? '';
      const outfits = boss?.looks ?? [];
      const look = outfits[this.stage.outfit % Math.max(1, outfits.length)];
      name = id ? i18n.t(`boss.${id}.name`) : '';
      if (look && outfits.length > 1) name += ` · ${i18n.t(`boss.${id}.look.${look.id}`)}`;
      const level = i18n.t(`level.names.${levelId}`);
      const status = this.status(entry);
      const beaten =
        isContestBeaten(this.progress, levelId, 'flags') ||
        isContestBeaten(this.progress, levelId, 'sprint');
      const parts: string[] = [];
      if (status === 'open') {
        // The effect is named only once it is won: until then it is a surprise.
        if (found?.effects && boss) {
          parts.push(i18n.t('contest.fx', { fx: i18n.t(effectNameKey(boss, look)) }));
        }
        if (outfits.length > 1) parts.push(i18n.t('contest.outfits', { n: outfits.length }));
      } else if (status === 'workshop') {
        parts.push(i18n.t(beaten ? 'contest.soon' : 'contest.workshop'));
      } else {
        parts.push(i18n.t('contest.lockedCharacter', { level }));
      }
      desc = parts.length > 0 ? `${parts.join('. ')}. ` : '';
      if (id) desc += i18n.t(`boss.${id}.desc`);
    }
    const counter = i18n.t('moves.counter', {
      n: this.grid.index + 1,
      total: this.entries.length,
    });
    const open = this.status(entry) === 'open';
    this.box.setContent(name, counter, desc, open ? Theme.accent : Theme.muted);
  }

  update(dt: number): void {
    this.box.update(dt);
    const entry = this.entry;
    const status = this.status(entry);
    const silhouette =
      status === 'locked' ? LOCKED_COLOR : status === 'workshop' ? this.bossColor(entry) : null;
    this.stage.show(entry.character, status, silhouette);
    this.stage.update(dt);
    // The name says which outfit is on.
    if (this.stage.outfit !== this.shownOutfit) {
      this.shownOutfit = this.stage.outfit;
      this.refreshText();
    }
  }

  /** The colour a boss character is marked with (its workshop silhouette too). */
  private bossColor(e: Entry): EchoColor {
    return bossOfCharacter(e.character)?.boss.color ?? WORKSHOP_COLOR;
  }

  onKey(key: UiKey): void {
    if (key.action === 'back') {
      this.ctx.screens.pop();
      return;
    }
    this.grid.onKey(key);
  }

  onPointer(p: UiPointer): void {
    if (this.frame.onPointer(p)) return;
    if (
      this.box.onPointer(p, {
        previous: () => this.step(-1),
        next: () => this.step(1),
        choose: () => this.confirm(),
      })
    ) {
      return;
    }
    this.grid.onPointer(p);
  }

  onWheel(w: UiWheel): void {
    if (contains(this.box.rect, w.x, w.y)) this.box.onWheel(w);
    else this.grid.onWheel(w);
  }

  /** The atlas and colour an entry is drawn with: its look, or a silhouette while closed. */
  private looks(e: Entry): { scene: SceneRenderer; silhouette: EchoColor | null } {
    const { render } = this.ctx;
    const source = render.skins.sceneFor(e.character);
    switch (this.status(e)) {
      case 'locked':
        return { scene: render.echo.scene(LOCKED_COLOR, false, source), silhouette: LOCKED_COLOR };
      case 'workshop': {
        const color = this.bossColor(e);
        return { scene: render.echo.scene(color, false), silhouette: color };
      }
      default:
        return { scene: source, silhouette: null };
    }
  }

  render(c: CanvasRenderingContext2D): void {
    this.frame.draw(c, this.ctx.i18n.t('player.character'));
    this.box.drawFrame(c);
    this.drawStage(c);
    this.box.drawOverlay(c);
    this.drawGrid(c);
  }

  private drawStage(c: CanvasRenderingContext2D): void {
    const d = this.box.stage;
    // A big stage shows the runner twice as large (whole pixels stay crisp).
    this.stage.draw(c, d, demoZoom(d.h));
  }

  /**
   * Where to put the feet of a keyframe so its head lands on (x, y): the head sprite's point in
   * the keyframe (it is drawn centred there), measured from the pivot.
   */
  private headAt(frame: number, x: number, y: number): { x: number; y: number } {
    const obj = this.ctx.render.scene.getObject(CHARACTER_OBJECT);
    if (obj) {
      for (const p of obj.primitives) {
        const id = (p.value[frame] ?? -1) >> 3;
        if (id >= HEAD_SPRITE && id < HEAD_SPRITE + 5) {
          return { x: x + obj.pivotX - (p.x[frame] ?? 0), y: y + obj.pivotY - (p.y[frame] ?? 0) };
        }
      }
    }
    return { x, y: y + 60 };
  }

  private drawGrid(c: CanvasRenderingContext2D): void {
    const { render } = this.ctx;
    const idle = render.clips[(this.ctx.content.anims.demos[RUN_DEMO]?.clipOffset ?? 0) + 1] ?? 0;
    this.grid.drawFrames(c);
    this.grid.forEachVisible((i, r) => {
      const e = this.entries[i]!;
      // Head and shoulders: the head a little above the middle of the tile.
      const { scene } = this.looks(e);
      const feet = this.headAt(idle, r.x + (r.w >> 1), r.y + (r.h >> 1) - 2);
      c.save();
      c.beginPath();
      c.rect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
      c.clip();
      scene.drawFrame(
        c,
        CHARACTER_OBJECT,
        idle,
        feet.x,
        feet.y,
        undefined,
        false,
        render.skins.swapFor(e.character),
      );
      c.restore();
      if (e.levelId !== undefined && this.status(e) === 'open') {
        if (bossOfCharacter(e.character)?.effects) {
          // Its effect is won: a spark in the boss's colour.
          c.fillStyle = this.bossColor(e).css;
          c.fillRect(r.x + r.w - 6, r.y + 2, 1, 5);
          c.fillRect(r.x + r.w - 8, r.y + 4, 5, 1);
        }
      }
    });
    this.grid.drawScrollMarkers(c, this.ctx.fonts.small);
  }
}
