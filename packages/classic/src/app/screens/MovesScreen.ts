/**
 * The Moves menu (`al()` / `an()`, d.java lines 5967-6060), laid out like the character
 * select: the chosen move played in the box on top, on a little level of grey blocks with a
 * run-up before the move and some running after it, its name, counter and description in the
 * same box, and all twenty moves as tiles below. The original showed the bare animation clip
 * in an empty box; the demos are ours (packages/content/moves/demos.json).
 */
import type { GameContext } from '../Context.ts';
import type { Screen, UiKey, UiPointer, UiWheel } from '@parapet/runtime/app/Screen.ts';
import { contains } from '@parapet/runtime/ui/layout.ts';
import { ShowcaseBox } from '@parapet/runtime/ui/ShowcaseBox.ts';
import { TileGrid } from '@parapet/runtime/ui/TileGrid.ts';
import { MOVE_KEYS } from '@parapet/runtime/moves/moveKeys.ts';
import type { MoveDemoData } from '@parapet/runtime/moves/MoveDemo.ts';
import { makeEchoColor } from '@parapet/runtime/render/EchoSkin.ts';
import { CHARACTER_OBJECT } from '@parapet/runtime/render/SceneRenderer.ts';
import { ANCHOR_TOP_LEFT } from '@parapet/runtime/render/SpriteSheet.ts';
import demosJson from '@content/moves/demos.json';
import { ScreenFrame } from '../ui/ScreenFrame.ts';
import { MoveStage } from '../ui/MoveStage.ts';
import { showcaseLayout } from '../layouts.ts';

export { MOVE_KEYS };

const DEMOS = (demosJson as unknown as { demos: MoveDemoData[] }).demos;
const TILE = 34;
const TILE_GAP = 4;
/** Silhouettes on the tiles: the pose that stands for each move. */
const ICON_COLOR = makeEchoColor('move-icon', '#8b98a8');
const ICON_SELECTED = makeEchoColor('move-icon-selected', '#f4f7fa');

export class MovesScreen implements Screen {
  readonly chrome = { fullscreenButton: true };
  private readonly ctx: GameContext;
  private readonly frame: ScreenFrame;
  private readonly box: ShowcaseBox;
  private readonly grid = new TileGrid(TILE, TILE_GAP);
  private readonly stage: MoveStage;
  /** The tile pictures, drawn once: plain and highlighted. */
  private readonly icons = new Map<string, HTMLCanvasElement>();

  constructor(ctx: GameContext) {
    this.ctx = ctx;
    this.frame = new ScreenFrame(ctx);
    this.box = new ShowcaseBox(ctx.fonts);
    this.stage = new MoveStage(ctx);
    this.grid.setGroups([{ count: MOVE_KEYS.length }]);
    this.grid.onSelect = () => this.showMove();
    this.grid.onActivate = () => this.grid.select(this.grid.index + 1);
    this.onResize();
    this.showMove();
  }

  private showMove(): void {
    const key = MOVE_KEYS[this.grid.index] ?? 'run';
    const demo = DEMOS.find((d) => d.move === key);
    if (demo) this.stage.show(demo);
    this.refreshText();
  }

  private refreshText(): void {
    const { i18n } = this.ctx;
    const key = MOVE_KEYS[this.grid.index] ?? 'run';
    this.box.setContent(
      i18n.t(`moves.${key}`),
      i18n.t('moves.counter', { n: this.grid.index + 1, total: MOVE_KEYS.length }),
      i18n.t(`moves.${key}.desc`),
    );
  }

  enter(): void {
    this.refreshText();
  }

  onResize(): void {
    const { fonts } = this.ctx;
    this.frame.layout();
    const layout = showcaseLayout(this.frame.body, {
      // The levels are nine tiles tall: a stage of 120 px shows the move and its surroundings.
      boxMin: ShowcaseBox.heightFor(fonts, 110, 2),
      boxMax: ShowcaseBox.heightFor(fonts, 300, 4),
      gridRow: TILE + TILE_GAP,
      gridHeight: (w) => {
        const cols = Math.max(1, Math.min(10, Math.floor((w + TILE_GAP) / (TILE + TILE_GAP))));
        return Math.ceil(MOVE_KEYS.length / cols) * (TILE + TILE_GAP) - TILE_GAP;
      },
    });
    this.box.layout(layout.box, layout.box.h >= ShowcaseBox.heightFor(fonts, 200, 4) ? 4 : 3);
    this.grid.layout(layout.grid, 10);
    this.refreshText();
  }

  update(dt: number): void {
    this.box.update(dt);
    this.stage.update(dt);
  }

  private step(delta: number): void {
    this.grid.select(this.grid.index + delta);
  }

  onKey(key: UiKey): void {
    if (key.action === 'back') {
      this.ctx.screens.pop();
      return;
    }
    // The box's description scrolls with up/down only when the grid has one row.
    this.grid.onKey(key);
  }

  onPointer(p: UiPointer): void {
    if (this.frame.onPointer(p)) return;
    if (
      this.box.onPointer(p, {
        previous: () => this.step(-1),
        next: () => this.step(1),
        choose: () => this.step(1),
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

  render(c: CanvasRenderingContext2D): void {
    this.frame.draw(c, this.ctx.i18n.t('menu.moves'));
    this.box.drawFrame(c);
    // Whole-pixel zoom when the box is tall enough for the level twice over.
    const zoom = this.box.stage.h >= 2 * 9 * 32 ? 2 : 1;
    this.stage.draw(c, this.box.stage, zoom);
    this.box.drawOverlay(c);
    this.grid.drawFrames(c);
    this.grid.forEachVisible((i, r, s) => {
      const icon = this.icon(i, s.selected || s.pressed);
      if (icon) c.drawImage(icon, r.x + 1, r.y + 1);
    });
    this.grid.drawScrollMarkers(c, this.ctx.fonts.small);
  }

  /**
   * The tile picture of move `index`: a silhouette of the middle keyframe of its original
   * clip, shrunk to the tile with smoothing (a pictogram, not pixel art).
   */
  private icon(index: number, selected: boolean): HTMLCanvasElement | null {
    const cacheKey = `${index}:${selected ? 1 : 0}`;
    const cached = this.icons.get(cacheKey);
    if (cached) return cached;
    const { content, render } = this.ctx;
    const demo = content.anims.demos[index];
    if (!demo) return null;
    const frame = render.clips[demo.clipOffset + 1 + (demo.frameCount >> 1)] ?? 0;
    const [minX = 0, minY = 0, maxX = 64, maxY = 64] = content.anims.keyframeBounds[frame] ?? [];
    const w = Math.max(1, maxX - minX);
    const h = Math.max(1, maxY - minY);
    const full = document.createElement('canvas');
    full.width = w;
    full.height = h;
    const fc = full.getContext('2d')!;
    fc.imageSmoothingEnabled = false;
    render.echo
      .scene(selected ? ICON_SELECTED : ICON_COLOR, false)
      .drawObject(
        fc,
        CHARACTER_OBJECT,
        frame,
        frame,
        0,
        -minX,
        -minY,
        false,
        undefined,
        ANCHOR_TOP_LEFT,
      );
    const size = TILE - 2;
    const icon = document.createElement('canvas');
    icon.width = size;
    icon.height = size;
    const ic = icon.getContext('2d')!;
    const scale = Math.min(1, (size - 4) / Math.max(w, h));
    ic.imageSmoothingEnabled = true;
    ic.imageSmoothingQuality = 'high';
    ic.drawImage(full, (size - w * scale) / 2, (size - h * scale) / 2, w * scale, h * scale);
    this.icons.set(cacheKey, icon);
    return icon;
  }
}
