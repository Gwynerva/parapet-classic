/**
 * A race with a ghost, inside a run: the recorded run plays in a world of its own next to the
 * player's (`RunSession.ghostWorld`), drawn as a hologram in a colour of its runner's name. Its
 * name rides over its head, a flag marks where its run ended, a sign at the screen's edge shows
 * where it is with the gap, and the gap at every checkpoint flashes under the timer.
 */
import type { World, WorldEvent } from '@parapet/sim';
import type { GhostSetup, RunSession } from '@parapet/runtime/app/RunSession.ts';
import type { CharacterRenderer } from '@parapet/runtime/render/CharacterRenderer.ts';
import type { EchoRenderer } from '@parapet/runtime/render/EchoRenderer.ts';
import { echoColor, type EchoColor } from '@parapet/runtime/render/EchoSkin.ts';
import { toScreen, type CameraPos } from '@parapet/runtime/render/View.ts';
import type { Rect } from '@parapet/runtime/ui/layout.ts';
import type { BitmapFont } from '@parapet/runtime/text/BitmapFont.ts';
import { formatResult, type GameContext } from '../../Context.ts';
import {
  drawEdgeSign,
  drawMarkerLabel,
  drawNameTag,
  formatGap,
  type EdgePicture,
} from '../../ui/GhostOverlay.ts';
import { headSign } from './signs.ts';

export class GhostRace {
  readonly color: EchoColor;
  /** "Your best", or the challenger's name. */
  readonly label: string;
  private readonly ctx: GameContext;
  private readonly ghost: GhostSetup;
  private sign: EdgePicture | null = null;

  constructor(ctx: GameContext, ghost: GhostSetup) {
    this.ctx = ctx;
    this.ghost = ghost;
    this.color = echoColor(ghost.replay.playerName);
    this.label =
      ghost.kind === 'best'
        ? ctx.i18n.t('ghost.best')
        : ghost.replay.playerName || ctx.i18n.t('player.name');
  }

  /** The ghost's runner joins a new session's renderers (the run started over). */
  attach(
    session: RunSession,
    characters: CharacterRenderer,
    echo: EchoRenderer,
    onStep: (events: readonly WorldEvent[], world: World) => void,
  ): void {
    const ghostWorld = session.ghostWorld;
    if (!ghostWorld) return;
    const runner = ghostWorld.player;
    const character = this.ghost.replay.character;
    const { render } = this.ctx;
    characters.attach(runner, { character, echo: true, seed: session.world.runners.length + 1 });
    const source = render.skins.sceneFor(character);
    echo.add(runner, {
      color: this.color,
      textured: true,
      source,
      swap: (clock) => characters.swapFor(runner, clock),
    });
    this.sign = headSign(
      this.ctx,
      render.echo.scene(this.color, true, source),
      render.skins.swapFor(character),
    );
    session.onGhostStep(onStep);
  }

  /** What the ghost achieved, as the mode is ranked (time or score). */
  get result(): string {
    const { replay, outcome } = this.ghost;
    return formatResult(replay.mode, replay.levelId, outcome);
  }

  /** The second briefing page: whom the player races and what to beat. */
  briefing(): string {
    const value = this.result;
    return this.ghost.kind === 'best'
      ? this.ctx.i18n.t('ghost.briefing.best', { value })
      : this.ctx.i18n.t('ghost.briefing.challenger', { name: this.label, value });
  }

  /**
   * The current gap in ms (positive: the player is behind): the difference at the last
   * checkpoint both reached, or, once the ghost has reached the next one, at least the time
   * since it did. Null before the first checkpoint.
   */
  gap(session: RunSession): number | null {
    const mine = session.splits;
    const theirs = this.ghost.outcome.splits;
    const k = mine.length;
    const clock = session.world.clock;
    const next = theirs[k];
    if (next !== undefined && next < clock) return clock - next;
    const last = theirs[k - 1];
    if (k > 0 && last !== undefined) return mine[k - 1]! - last;
    return null;
  }

  /** The ghost's name over its head and the label of its finish flag. */
  drawLabels(
    c: CanvasRenderingContext2D,
    session: RunSession,
    echo: EchoRenderer,
    cam: CameraPos,
    alpha: number,
  ): void {
    const ghostWorld = session.ghostWorld;
    if (!ghostWorld) return;
    const small = this.ctx.fonts.small;
    const pos = echo.screenPosition(ghostWorld.player, cam, alpha);
    if (pos) drawNameTag(c, small, this.label, this.color, pos.x, pos.y, pos.anchored);
    for (const marker of echo.markers) {
      if (marker.runner !== ghostWorld.player) continue;
      const label = `${this.label} ${this.result}`;
      drawMarkerLabel(
        c,
        small,
        label,
        this.color,
        toScreen(marker.x, cam.x),
        toScreen(marker.y, cam.y),
      );
    }
  }

  /** The sign towards the ghost while it is off screen, with the gap. */
  drawSign(
    c: CanvasRenderingContext2D,
    area: Rect,
    session: RunSession,
    echo: EchoRenderer,
    cam: CameraPos,
    alpha: number,
    font: BitmapFont,
  ): void {
    const ghostWorld = session.ghostWorld;
    if (!ghostWorld || !this.sign) return;
    const pos = echo.screenPosition(ghostWorld.player, cam, alpha);
    if (!pos) return;
    const gap = this.gap(session);
    const label = gap === null ? null : { font, text: formatGap(gap), color: this.color.light };
    drawEdgeSign(c, area, pos.x, pos.y - 30, this.sign, label);
  }
}
