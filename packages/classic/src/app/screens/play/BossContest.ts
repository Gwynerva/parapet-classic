/**
 * A contest with a level's boss, inside a run: the boss stands next to the start and has its
 * say in the briefing, vanishes when the run starts and appears again when its time is up,
 * where the player's run will end (`BossPresence`, `bossSpots.ts`); a hologram of it loops what
 * it did around the player's next flag (`BossGlimpse`); the HUD counts its flags as its split
 * times pass, and a sign at the screen's edge shows where it waits.
 */
import {
  isSplitEvent,
  tileCentre,
  type Level,
  type RunMode,
  type World,
  type WorldEvent,
} from '@parapet/sim';
import type { ContestSetup } from '@parapet/runtime/app/RunSession.ts';
import type { GlimpseTrack } from '@parapet/runtime/content/glimpses.ts';
import { compileFx } from '@parapet/runtime/render/fx/FxSheet.ts';
import { toScreen, type CameraPos, type ViewSize } from '@parapet/runtime/render/View.ts';
import type { Rect } from '@parapet/runtime/ui/layout.ts';
import { prefersReducedMotion } from '@parapet/runtime/ui/motion.ts';
import { isContestBeaten, loadContestProgress } from '@parapet/runtime/storage/profile.ts';
import type { BitmapFont } from '@parapet/runtime/text/BitmapFont.ts';
import { formatTime, type GameContext } from '../../Context.ts';
import {
  bossCharacterFor,
  bossName,
  bossOfCharacter,
  bossOfLevel,
  characterColor,
  contestGlimpses,
  contestOfCharacter,
  isDrawn,
  pickOutfit,
  WORKSHOP_COLOR,
} from '../../bosses.ts';
import { BossGlimpse } from '../../ui/BossGlimpse.ts';
import { BossPresence } from '../../ui/BossPresence.ts';
import {
  glimpseCells,
  levelGrid,
  nearestFlag,
  standingSpot,
  waitingSpot,
  type PresenceSpot,
} from '../../ui/bossSpots.ts';
import { drawEdgeSign, drawNameTag, type EdgePicture } from '../../ui/GhostOverlay.ts';
import type { HudOptions } from '../../ui/Hud.ts';
import { COACH_IDLE_KEYFRAME, COACH_TALK_CLIP } from '../../ui/sprites.ts';
import { headSign } from './signs.ts';

/** How long "the boss has finished" stays under the HUD, in ms. */
const FINISHED_BANNER_MS = 3500;

export class BossContest {
  readonly presence: BossPresence;
  private readonly ctx: GameContext;
  private readonly contest: ContestSetup;
  private readonly mode: RunMode;
  private readonly levelId: number;
  /** What the boss did around each flag (by index), and its hologram. */
  private readonly tracks: readonly (GlimpseTrack | null)[] | null;
  private readonly glimpse: BossGlimpse | null;
  /** In a flag hunt, where the boss waits when each flag is the player's next. */
  private flagSpots: PresenceSpot[] = [];
  /** The flag the glimpse shows, or -1. */
  private hintFlag = -1;
  /** Until when (real time) the "boss has finished" line stays under the HUD. */
  private bannerUntil = 0;
  /** The boss's head on its sign at the screen's edge. */
  private readonly sign: EdgePicture;

  constructor(
    ctx: GameContext,
    contest: ContestSetup,
    mode: RunMode,
    levelId: number,
    world: World,
  ) {
    this.ctx = ctx;
    this.contest = contest;
    this.mode = mode;
    this.levelId = levelId;
    const found = contestOfCharacter(contest.character);
    this.tracks = found ? contestGlimpses(found.levelId, found.kind) : null;
    const outfit = pickOutfit(contest.character);
    const { render } = ctx;
    const boss = bossOfLevel(levelId);
    const look = isDrawn(boss) ? render.skins.lookOf(contest.character, outfit) : undefined;
    const scene = look
      ? render.skins.sceneFor(contest.character, outfit)
      : render.echo.scene(WORKSHOP_COLOR, false);
    const swap = render.skins.swapFor(contest.character, -1, outfit);
    this.sign = headSign(ctx, scene, swap);
    const color = look
      ? characterColor(contest.character, outfit)
      : (boss?.color ?? WORKSHOP_COLOR);
    const { start, end } = this.spots(world);
    this.presence = new BossPresence({
      scene,
      swap,
      color,
      start,
      end,
      clips: render.clips,
      idleKeyframe: COACH_IDLE_KEYFRAME,
      talkClipOffset: COACH_TALK_CLIP,
      fx: look && boss?.fx ? compileFx(boss.fx, look.accent) : null,
      echo: render.echo,
      reducedMotion: prefersReducedMotion(),
    });
    // The glimpse: the boss's outfit of the run as a hologram in its colour.
    this.glimpse = this.tracks
      ? new BossGlimpse(
          {
            scene: look
              ? render.echo.scene(color, true, render.skins.sceneFor(contest.character, outfit))
              : render.echo.scene(color, false),
            swap,
            color,
          },
          prefersReducedMotion(),
        )
      : null;
  }

  /**
   * Where the boss stands: next to the start, facing it, and where it waits once its time is
   * up (next to the goal in a sprint; by each flag in a flag hunt, `flagSpots`), clear of its
   * glimpses.
   */
  private spots(world: World): { start: PresenceSpot; end: PresenceSpot } {
    const level: Level = world.level;
    const grid = levelGrid(level, this.ctx.content.tables);
    const startX = level.spawnX();
    // The boss stands behind the runner, to watch it set off.
    const start = standingSpot(
      grid,
      startX >> 10,
      (level.spawnY() >> 10) - 1,
      !world.player.facingRight,
      startX,
    );
    const tracks = this.tracks ?? [];
    const avoid = (list: readonly (GlimpseTrack | null)[]) => ({
      clip: glimpseCells(list.flatMap((t) => t?.poses ?? [])),
      after: glimpseCells(list.flatMap((t) => t?.poses.slice(t.at) ?? [])),
    });
    const finish = level.finish;
    if (this.mode === 'sprint' && finish) {
      const last = level.checkpoints[level.checkpoints.length - 1];
      const fromRight = last ? last.x > finish.x : false;
      // At the goal, on the far side from where the runner comes in, facing it.
      const end = waitingSpot(grid, {
        cx: finish.x,
        cy: finish.y,
        faceX: last ? tileCentre(last.x) : startX,
        preferRight: !fromRight,
        ...avoid(tracks),
      });
      return { start, end };
    }
    // By each flag, facing it, on the side away from where its glimpse goes.
    this.flagSpots = level.checkpoints.map((cp, i) => {
      const track = tracks[i] ?? null;
      const flagX = tileCentre(cp.x);
      const endX = track?.poses[track.poses.length - 1]?.x ?? flagX;
      return waitingSpot(grid, {
        cx: cp.x,
        cy: cp.y,
        faceX: flagX,
        preferRight: endX < flagX,
        ...avoid([track]),
      });
    });
    return { start, end: start };
  }

  get name(): string {
    return bossName(this.ctx.i18n, bossOfLevel(this.levelId));
  }

  /**
   * The player's next flag: the next checkpoint in a sprint, the nearest flag still up in a
   * flag hunt; -1 once there is none.
   */
  private nextFlag(world: World): number {
    const { rules, level, player } = world;
    if (this.mode === 'sprint') {
      return rules.nextCheckpoint < level.checkpoints.length ? rules.nextCheckpoint : -1;
    }
    return nearestFlag(level.checkpoints, rules.remainingMask, player.x, player.y);
  }

  /** The glimpse moves to the player's next flag (between loops, and when a flag is taken). */
  private retargetGlimpse(world: World): void {
    const flag = this.nextFlag(world);
    if (flag === this.hintFlag) return;
    this.hintFlag = flag;
    this.glimpse?.show(flag >= 0 ? (this.tracks?.[flag] ?? null) : null);
  }

  /** Where the boss waits now: the goal, or by the player's next flag (the last one taken). */
  private waitSpot(world: World): PresenceSpot | undefined {
    if (this.mode === 'sprint') return undefined;
    const flag = this.nextFlag(world);
    return this.flagSpots[flag >= 0 ? flag : world.rules.lastCollected];
  }

  /** The run starts: the boss goes, its glimpse waits by the first flag. */
  start(world: World): void {
    this.presence.vanish(performance.now());
    this.retargetGlimpse(world);
  }

  /** One step of the run: the glimpse follows the flags, the boss comes when its time is up. */
  step(world: World, events: readonly WorldEvent[]): void {
    this.presence.step();
    const now = performance.now();
    const took = events.some(isSplitEvent);
    if (this.glimpse?.step() || took) this.retargetGlimpse(world);
    if (this.presence.state === 'away' && world.clock >= this.contest.timeMs) {
      this.presence.appear(now, this.waitSpot(world));
      this.bannerUntil = now + FINISHED_BANNER_MS;
    } else if (took && this.presence.state === 'end') {
      // On to the flag the player is to take next: the last one is where the run ends.
      const spot = this.waitSpot(world);
      if (spot) this.presence.moveTo(spot, now);
    }
  }

  /** The run ended. Faster than the boss: it arrives all the same, to see who beat it. */
  finish(world: World): void {
    this.glimpse?.show(null);
    const spot = this.waitSpot(world);
    if (this.presence.state === 'away') this.presence.appear(performance.now(), spot);
    else if (spot) this.presence.moveTo(spot, performance.now());
  }

  /**
   * The boss's words before the run: the challenge, then the prize (none once won; a hint when
   * the player already has the boss and this win would give it more).
   */
  briefing(): string[] {
    const { i18n } = this.ctx;
    const found = bossOfCharacter(this.contest.character);
    if (!found) return [];
    const time = formatTime(this.contest.timeMs);
    const challenge = i18n.t(`boss.${found.boss.id}.briefing.${this.mode}`, { time });
    if (!isDrawn(found.boss)) return [challenge, i18n.t('contest.briefing.workshop')];
    const progress = loadContestProgress();
    if (isContestBeaten(progress, found.levelId, found.kind)) return [challenge];
    const owned = bossCharacterFor(found.levelId, progress) !== null;
    return [challenge, i18n.t(owned ? 'contest.briefing.more' : 'contest.briefing.reward')];
  }

  /** Under the HUD: the boss's flags so far, then that it has finished. */
  hudLine(world: World, finished: boolean, now: number): HudOptions['contest'] {
    const { i18n } = this.ctx;
    const clock = world.clock;
    const color = this.presence.color.light;
    const boss = this.name;
    const time = formatTime(this.contest.timeMs);
    if (clock >= this.contest.timeMs) {
      const text =
        now < this.bannerUntil || finished
          ? i18n.t('contest.finished', { boss, time })
          : i18n.t('contest.result', { boss, value: time });
      return { text, color };
    }
    const n = this.contest.splitsMs.filter((t) => t <= clock).length;
    return { text: i18n.t('contest.hud', { boss, n, total: this.contest.splitsMs.length }), color };
  }

  /** The boss and its glimpse, behind the runners. */
  draw(
    c: CanvasRenderingContext2D,
    cam: CameraPos,
    alpha: number,
    now: number,
    view: ViewSize,
  ): void {
    this.presence.draw(c, cam, now, view);
    this.glimpse?.draw(c, cam, alpha, now, view);
  }

  /** The boss's name over its head while it stands somewhere (with its time once it waits). */
  drawLabel(c: CanvasRenderingContext2D, cam: CameraPos): void {
    const spot = this.presence.spot;
    if (!spot) return;
    const label =
      this.presence.state === 'end' ? `${this.name} ${formatTime(this.contest.timeMs)}` : this.name;
    drawNameTag(
      c,
      this.ctx.fonts.small,
      label,
      this.presence.color,
      toScreen(spot.x, cam.x),
      toScreen(spot.y, cam.y),
      false,
    );
  }

  /** The sign towards the boss waiting off screen, with its time. */
  drawSign(c: CanvasRenderingContext2D, area: Rect, cam: CameraPos, font: BitmapFont): void {
    if (this.presence.state !== 'end') return;
    const spot = this.presence.end;
    drawEdgeSign(c, area, toScreen(spot.x, cam.x), toScreen(spot.y, cam.y) - 30, this.sign, {
      font,
      text: formatTime(this.contest.timeMs),
      color: this.presence.color.light,
    });
  }
}
