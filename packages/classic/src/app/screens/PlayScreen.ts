/**
 * The game itself: a mission from its briefing to its results. The phases follow the
 * original's screen states (reference/notes/08-flow-and-menus.md §1): tutorial pages with the
 * coach (warm-ups), the briefing box, the Sprint flyover, "get ready", play with the in-play
 * hints of the warm-ups, then the warm-up's closing message or the results screen.
 *
 * In a contest the level's boss stands next to the start, introduces itself in the briefing,
 * vanishes when the run starts and appears again when its time is up, where the player's run
 * will end (`BossPresence`, `bossSpots.ts`); a hologram of it loops what it did around the
 * player's next flag (`BossGlimpse`), and the HUD counts its flags as its split times pass. A runner playing a boss character wears one of its
 * outfits, picked at random for the run, and leaves its effects (`CharacterFx`).
 */
import {
  evaluateMission,
  isSplitEvent,
  missionSlot,
  MissionType,
  MoveId,
  rankingSort,
  STEP,
  type Level,
  type MissionTarget,
  type World,
  type WorldEvent,
} from '@parapet/sim';
import { formatTime, Theme, type GameContext } from '../Context.ts';
import { RunSession, type RunSetup } from '@parapet/runtime/app/RunSession.ts';
import { MissionFlow } from '@parapet/runtime/app/MissionFlow.ts';
import type { Screen, UiKey, UiPointer } from '@parapet/runtime/app/Screen.ts';
import { Hud, type HudOptions } from '../ui/Hud.ts';
import { Camera } from '@parapet/runtime/render/Camera.ts';
import { screenPixels, worldGrid } from '@parapet/runtime/render/View.ts';
import { countEvent } from '../analytics.ts';
import { CameraTour } from '@parapet/runtime/render/CameraTour.ts';
import { CharacterRenderer, type NpcVisual } from '@parapet/runtime/render/CharacterRenderer.ts';
import { EchoRenderer } from '@parapet/runtime/render/EchoRenderer.ts';
import { CharacterFx } from '@parapet/runtime/render/fx/CharacterFx.ts';
import { compileFx } from '@parapet/runtime/render/fx/FxSheet.ts';
import { echoColor, makeEchoColor, type EchoColor } from '@parapet/runtime/render/EchoSkin.ts';
import {
  defaultLevelArtFrame,
  MarkerBounce,
  themeOfLevel,
} from '@parapet/runtime/render/LevelRenderer.ts';
import { Particles } from '@parapet/runtime/render/Particles.ts';
import type { CameraPos, ViewSize } from '@parapet/runtime/render/View.ts';
import { toScreen } from '@parapet/runtime/render/View.ts';
import { vibrate } from '@parapet/runtime/input/InputManager.ts';
import { MessageBox, type MessageBoxOptions } from '@parapet/runtime/ui/MessageBox.ts';
import { outlined } from '@parapet/runtime/ui/draw.ts';
import { prefersReducedMotion } from '@parapet/runtime/ui/motion.ts';
import { safeRect } from '@parapet/runtime/ui/layout.ts';
import {
  MAX_FRAME_UNITS,
  TIME_SCALE_NUM,
  TIME_SCALE_SHIFT,
} from '@parapet/runtime/app/GameLoop.ts';
import {
  completeMission,
  isContestBeaten,
  loadContestProgress,
  loadProgress,
} from '@parapet/runtime/storage/profile.ts';
import { COACH_IDLE_KEYFRAME, COACH_TALK_CLIP } from '../ui/sprites.ts';
import { drawEdgeArrow, drawMarkerLabel, drawNameTag, formatGap } from '../ui/GhostOverlay.ts';
import {
  bossCharacterFor,
  bossOfCharacter,
  bossOfLevel,
  characterColor,
  characterFx,
  contestGlimpses,
  contestOfCharacter,
  isDrawn,
  pickOutfit,
  WORKSHOP_COLOR,
} from '../bosses.ts';
import { BossGlimpse } from '../ui/BossGlimpse.ts';
import { BossPresence, HEAD_HEIGHT } from '../ui/BossPresence.ts';
import {
  glimpseCells,
  levelGrid,
  nearestFlag,
  standingSpot,
  waitingSpot,
  type PresenceSpot,
} from '../ui/bossSpots.ts';
import type { GlimpseTrack } from '@parapet/runtime/content/glimpses.ts';
import {
  LevelCompleteScreen,
  levelCompletion,
  type LevelCompletion,
} from './LevelCompleteScreen.ts';
import { PauseScreen } from './PauseScreen.ts';
import { ResultsScreen } from './ResultsScreen.ts';

/** Time the "get ready" banner is shown before the first step, in ms. */
const READY_MS = 1200;
/** Vibration on a failed trick, like the original's `vibrate(160)`. */
const FAIL_VIBRATION_MS = 160;
/** Delay between the move that triggers a warm-up hint and its box (line 9569). */
const HINT_DELAY_MS = 1000;
/** Levels whose challenge pulses the level art and switches to the "way back" frames. */
const PULSING_CHALLENGE_LEVELS = new Set([2, 3, 5, 6]);
/** Hint keys (`bN` bits of the original). */
const HINT_WALL = 2;
const HINT_LANDING = 4;
/** How long the gap to the ghost stays under the timer after a checkpoint, in ms. */
const SPLIT_SHOW_MS = 2500;
/**
 * The rival of a sprint runs as itself (the original drew a grey silhouette instead); when the
 * player runs in the rival's own skin, the rival is see-through so the two never mix up.
 */
const RIVAL_MIRROR_OPACITY = 0.55;
/** The edge arrow towards the rival. */
const RIVAL_ARROW_COLOR = makeEchoColor('rival', '#ff6a4d');
/** The edge arrow towards the finish of a score run (see-through, it only shows the way). */
const FINISH_ARROW_COLOR = makeEchoColor('finish', '#ffd23f');
const FINISH_ARROW_OPACITY = 0.5;

export class PlayScreen implements Screen {
  private readonly ctx: GameContext;
  readonly setup: RunSetup;
  session!: RunSession;
  private camera!: Camera;
  private characters!: CharacterRenderer;
  private echo!: EchoRenderer;
  private fx!: CharacterFx;
  /** The outfit the player wears this run (a boss character's, picked at random). */
  private outfit = 0;
  /** The boss in a contest, null otherwise. */
  private presence: BossPresence | null = null;
  /** The boss's glimpse, what it did around each flag (by index), and the flag shown, or -1. */
  private glimpse: BossGlimpse | null = null;
  private glimpseTracks: readonly (GlimpseTrack | null)[] | null = null;
  private hintFlag = -1;
  /** In a flag hunt, where the boss waits when each flag is the player's next. */
  private flagSpots: PresenceSpot[] = [];
  /** The boss's outfit for the run (the presence and the glimpse wear it). */
  private bossOutfit = 0;
  /** Until when (real time) the "boss has finished" line stays under the HUD. */
  private contestBannerUntil = 0;
  private particles!: Particles;
  private bounce!: MarkerBounce;
  private readonly hud: Hud;
  private readonly theme: number;
  readonly flow: MissionFlow;
  private tour: CameraTour | null = null;
  private coach: NpcVisual | null = null;
  /** The sprint rival's name, on the arrow towards it. */
  private rivalName: string | null = null;
  private artFrames: [number, number];
  private readonly pulsing: boolean;
  private resultsShown = false;
  private phaseEntered = false;
  private openBoxes = 0;
  /**
   * The character talking in the open box (feet in world units, place across the screen) and
   * that box: the camera keeps the speaker in sight above it (`aimAtSpeaker`).
   */
  private speaker: { x: number; y: number; fx: number } | null = null;
  private speakerBox: MessageBox | null = null;
  /** The screen changed size: the next aim goes straight there. */
  private snapAim = false;
  private pendingHint: { text: string; at: number } | null = null;
  /** Gap to the ghost at the player's last checkpoint, shown under the timer for a moment. */
  private splitFlash: { text: string; ahead: boolean; until: number } | null = null;
  private readonly ghostColor: EchoColor | null;
  private readonly ghostLabel: string;
  private readonly view: ViewSize = { width: 240, height: 320 };
  private readonly missionIndex: number;
  /** The run was started over with the restart button: straight to "get ready". */
  private quickStart = false;

  constructor(ctx: GameContext, setup: RunSetup) {
    this.ctx = ctx;
    this.setup = setup;
    if (!setup.script) countEvent('play');
    this.hud = new Hud(ctx.fonts, ctx.i18n);
    this.theme = themeOfLevel(setup.levelId);
    const mission = ctx.content.missions.levels[setup.levelId];
    if (!mission) throw new Error(`level ${setup.levelId} is missing`);
    this.missionIndex = missionSlot(mission, setup.mode);
    const warmUp = setup.mode === 'warmup1' || setup.mode === 'warmup2';
    this.pulsing =
      warmUp || (setup.mode === 'challenge' && PULSING_CHALLENGE_LEVELS.has(setup.levelId));
    this.artFrames = [0, 1];
    const ghost = setup.ghost;
    this.ghostColor = ghost ? echoColor(ghost.replay.playerName) : null;
    this.ghostLabel = !ghost
      ? ''
      : ghost.kind === 'best'
        ? ctx.i18n.t('ghost.best')
        : ghost.replay.playerName || ctx.i18n.t('player.name');
    this.flow = new MissionFlow({
      tutorialPages: warmUp && !setup.script ? 3 : 0,
      briefing: !warmUp && setup.mode !== 'free' && !setup.script,
      flyover: setup.mode === 'sprint' && !setup.script,
      readyMs: READY_MS,
    });
    this.restart();
  }

  get level(): Level {
    return this.session.world.level;
  }

  /**
   * Start the run from scratch (also used by the pause and results screens). `quick` (the
   * restart button, R) goes straight to "get ready": no pages, briefing or flyover again, and
   * the music plays on.
   */
  restart(opts: { quick?: boolean } = {}): void {
    const { content, render } = this.ctx;
    const level = content.levels[this.setup.levelId];
    const mission = content.missions.levels[this.setup.levelId];
    if (!level || !mission) throw new Error(`level ${this.setup.levelId} is missing`);
    this.session = new RunSession(this.setup, {
      level,
      mission,
      moves: content.moves,
      tables: content.tables,
      rival: content.rivals.get(this.setup.levelId) ?? null,
    });
    const world = this.session.world;
    this.camera = new Camera(this.view.width, this.view.height);
    this.characters = new CharacterRenderer(render.scene, render.moves, render.clips, render.skins);
    this.echo = new EchoRenderer(this.characters, render.echo);
    this.fx = new CharacterFx(render.echo, { reducedMotion: prefersReducedMotion() });
    this.outfit = pickOutfit(this.setup.character);
    world.runners.forEach((runner, i) => {
      const isPlayer = runner === world.player;
      const character = isPlayer ? this.setup.character : mission.rivalCharacter;
      this.characters.attach(runner, {
        character,
        outfit: isPlayer ? this.outfit : 0,
        faded: !isPlayer && character === this.setup.character ? RIVAL_MIRROR_OPACITY : 1,
        seed: i + 1,
      });
    });
    this.rivalName =
      this.ctx.skins.find((s) => s.character === mission.rivalCharacter)?.name ?? null;
    this.addFx(world.player, this.setup.character);
    const ghostWorld = this.session.ghostWorld;
    if (ghostWorld && this.setup.ghost && this.ghostColor) {
      const runner = ghostWorld.player;
      this.characters.attach(runner, {
        character: this.setup.ghost.replay.character,
        echo: true,
        seed: world.runners.length + 1,
      });
      this.echo.add(runner, {
        color: this.ghostColor,
        textured: true,
        source: render.skins.sceneFor(this.setup.ghost.replay.character),
        swap: (clock) => this.characters.swapFor(runner, clock),
      });
      this.session.onGhostStep((events, w) => this.onGhostStep(events, w));
    }
    this.splitFlash = null;
    this.coach = null;
    const npc = world.level.npc;
    const warmUp = world.rules.missionType >= MissionType.WARM_UP_1;
    if (npc && warmUp) {
      // The coach stands mid-cell on the floor, always facing right (`ak()`, line 5911).
      this.coach = this.characters.attachNpc('coach', {
        x: (npc.x << 10) + 512,
        y: (npc.y << 10) + 1024,
        character: mission.rivalCharacter,
        idleKeyframe: COACH_IDLE_KEYFRAME,
        talkClipOffset: COACH_TALK_CLIP,
      });
    }
    const contestOf = this.setup.contest ? contestOfCharacter(this.setup.contest.character) : null;
    this.glimpseTracks = contestOf ? contestGlimpses(contestOf.levelId, contestOf.kind) : null;
    this.presence = this.setup.contest ? this.createPresence(world.level) : null;
    this.glimpse = this.presence ? this.createGlimpse(this.presence) : null;
    this.hintFlag = -1;
    this.contestBannerUntil = 0;
    this.particles = new Particles(render.sheet, render.sine);
    this.particles.setLevel(world.level);
    this.bounce = new MarkerBounce();
    this.artFrames = [0, 1];
    render.level.setLevel(this.setup.levelId, world.level);
    this.onResize();
    this.camera.reset(world.player, world.level);
    this.session.onStep((events) => this.onStep(events as Parameters<typeof this.onStep>[0]));
    this.resultsShown = false;
    this.pendingHint = null;
    this.openBoxes = 0;
    this.quickStart = opts.quick ?? false;
    this.flow.reset(this.quickStart);
    this.ctx.input.clear();
    // The first phase may push a box above this screen, so it waits until this screen is on
    // the stack (`enter`); a restart from the pause or results screen happens on top already.
    this.phaseEntered = false;
    if (this.ctx.screens.top === this) this.beginPhase();
  }

  /** The effects of a boss character, for a runner playing one. */
  private addFx(runner: World['player'], character: number): void {
    const style = characterFx(
      this.ctx.render.skins,
      character,
      this.characters.get(runner)?.outfit ?? 0,
      (clock) => this.characters.swapFor(runner, clock),
    );
    if (!style) return;
    this.fx.add(
      runner,
      { pose: () => this.characters.pose(runner, 1), move: () => runner.moveId },
      style,
    );
  }

  /**
   * The boss of a contest: next to the start, facing it, and where it waits once its time is
   * up (next to the goal in a sprint; by each flag in a flag hunt, `flagSpots`), clear of its
   * glimpses. In one of its outfits, or as a silhouette while it is still in the workshop.
   */
  private createPresence(level: Level): BossPresence {
    const { render, content } = this.ctx;
    const contest = this.setup.contest!;
    const grid = levelGrid(level, content.tables);
    const startX = level.spawnX();
    const startCx = startX >> 10;
    const startCy = (level.spawnY() >> 10) - 1;
    const facingRight = this.session.world.player.facingRight;
    // The boss stands behind the runner, to watch it set off.
    const start = standingSpot(grid, startCx, startCy, !facingRight, startX);
    const tracks = this.glimpseTracks ?? [];
    const avoid = (list: readonly (GlimpseTrack | null)[]) => ({
      clip: glimpseCells(list.flatMap((t) => t?.poses ?? [])),
      after: glimpseCells(list.flatMap((t) => t?.poses.slice(t.at) ?? [])),
    });
    let end = start;
    this.flagSpots = [];
    const finish = level.finish;
    if (this.setup.mode === 'sprint' && finish) {
      const last = level.checkpoints[level.checkpoints.length - 1];
      const fromRight = last ? last.x > finish.x : false;
      // At the goal, on the far side from where the runner comes in, facing it.
      end = waitingSpot(grid, {
        cx: finish.x,
        cy: finish.y,
        faceX: last ? (last.x << 10) + 512 : startX,
        preferRight: !fromRight,
        ...avoid(tracks),
      });
    } else {
      // By each flag, facing it, on the side away from where its glimpse goes.
      this.flagSpots = level.checkpoints.map((cp, i) => {
        const track = tracks[i] ?? null;
        const flagX = (cp.x << 10) + 512;
        const endX = track?.poses[track.poses.length - 1]?.x ?? flagX;
        return waitingSpot(grid, {
          cx: cp.x,
          cy: cp.y,
          faceX: flagX,
          preferRight: endX < flagX,
          ...avoid([track]),
        });
      });
    }
    const boss = bossOfLevel(this.setup.levelId);
    const drawn = isDrawn(boss);
    this.bossOutfit = pickOutfit(contest.character);
    const outfit = this.bossOutfit;
    const look = drawn ? render.skins.lookOf(contest.character, outfit) : undefined;
    const scene = look
      ? render.skins.sceneFor(contest.character, outfit)
      : render.echo.scene(WORKSHOP_COLOR, false);
    return new BossPresence({
      scene,
      swap: render.skins.swapFor(contest.character, -1, outfit),
      color: look ? characterColor(contest.character, outfit) : (boss?.color ?? WORKSHOP_COLOR),
      start,
      end,
      clips: render.clips,
      idleKeyframe: COACH_IDLE_KEYFRAME,
      talkClipOffset: COACH_TALK_CLIP,
      fx: look && boss?.fx ? compileFx(boss.fx, look.accent) : null,
      echo: render.echo,
      reducedMotion: prefersReducedMotion(),
    });
  }

  /** The boss's glimpse: its outfit of the run as a hologram in its colour. */
  private createGlimpse(presence: BossPresence): BossGlimpse | null {
    if (!this.glimpseTracks) return null;
    const { render } = this.ctx;
    const character = this.setup.contest!.character;
    const outfit = this.bossOutfit;
    const look = isDrawn(bossOfLevel(this.setup.levelId))
      ? render.skins.lookOf(character, outfit)
      : undefined;
    const color = presence.color;
    const scene = look
      ? render.echo.scene(color, true, render.skins.sceneFor(character, outfit))
      : render.echo.scene(color, false);
    return new BossGlimpse(
      { scene, swap: render.skins.swapFor(character, -1, outfit), color },
      prefersReducedMotion(),
    );
  }

  /**
   * The player's next flag: the next checkpoint in a sprint, the nearest flag still up in a
   * flag hunt; -1 once there is none.
   */
  private nextFlag(): number {
    const { rules, level, player } = this.session.world;
    if (this.setup.mode === 'sprint') {
      return rules.nextCheckpoint < level.checkpoints.length ? rules.nextCheckpoint : -1;
    }
    return nearestFlag(level.checkpoints, rules.remainingMask, player.x, player.y);
  }

  /** The glimpse moves to the player's next flag (between loops, and when a flag is taken). */
  private retargetGlimpse(): void {
    const flag = this.nextFlag();
    if (flag === this.hintFlag) return;
    this.hintFlag = flag;
    this.glimpse?.show(flag >= 0 ? (this.glimpseTracks?.[flag] ?? null) : null);
  }

  /** Where the boss waits now: the goal, or by the player's next flag (the last one taken). */
  private bossSpot(): PresenceSpot | undefined {
    if (this.setup.mode === 'sprint') return undefined;
    const flag = this.nextFlag();
    return this.flagSpots[flag >= 0 ? flag : this.session.world.rules.lastCollected];
  }

  private beginPhase(): void {
    this.phaseEntered = true;
    this.enterPhase();
  }

  private onStep(events: readonly import('@parapet/sim').WorldEvent[]): void {
    const world = this.session.world;
    this.characters.onEvents(events);
    this.particles.onEvents(events);
    for (const ev of events) {
      if (ev.type === 'checkpoint' || ev.type === 'flag') {
        this.bounce.trigger(ev.index);
        // The tutorial arrows switch to the way back once the flag is taken (level 5 never does).
        if (this.pulsing && ev.index === 0 && this.setup.levelId !== 5) this.artFrames = [2, 3];
      }
      if ((ev.type === 'fail' || ev.type === 'pit') && ev.runner === world.player) {
        vibrate(FAIL_VIBRATION_MS);
      }
      if (ev.type === 'move' && ev.runner === world.player) this.checkHint(ev.to);
      if (isSplitEvent(ev)) this.onPlayerSplit();
    }
    this.characters.step(world.clock, STEP);
    this.echo.step();
    this.fx.step({ clock: world.clock });
    this.presence?.step();
    const contest = this.setup.contest;
    if (contest && this.presence) {
      const now = performance.now();
      const took = events.some(isSplitEvent);
      if (this.glimpse?.step() || took) this.retargetGlimpse();
      if (this.presence.state === 'away' && world.clock >= contest.timeMs) {
        this.presence.appear(now, this.bossSpot());
        this.contestBannerUntil = now + 3500;
      } else if (took && this.presence.state === 'end') {
        // On to the flag the player is to take next: the last one is where the run ends.
        const spot = this.bossSpot();
        if (spot) this.presence.moveTo(spot, now);
      }
    }
    const ghostWorld = this.session.ghostWorld;
    if (ghostWorld && this.session.ghostDone) this.echo.dissolve(ghostWorld.player);
    this.particles.update(STEP, world.player);
    this.bounce.advance(STEP);
    this.camera.update(world.player, world.level);
  }

  /** The ghost's own step: its animations, and its farewell when its run ends. */
  private onGhostStep(events: readonly WorldEvent[], ghostWorld: World): void {
    this.characters.onEvents(events);
    if (ghostWorld.finished) this.echo.dissolve(ghostWorld.player);
  }

  /** The player reached a checkpoint or flag: compare with the ghost's time at the same one. */
  private onPlayerSplit(): void {
    const splits = this.setup.ghost?.outcome.splits ?? this.setup.contest?.splitsMs;
    if (!splits) return;
    const k = this.session.splits.length - 1;
    const theirs = splits[k];
    const mine = this.session.splits[k];
    if (theirs === undefined || mine === undefined) return;
    this.splitFlash = {
      text: formatGap(mine - theirs, 2),
      ahead: mine <= theirs,
      until: performance.now() + SPLIT_SHOW_MS,
    };
  }

  /**
   * The current gap to the ghost in ms (positive: the player is behind): the difference at
   * the last checkpoint both reached, or, once the ghost has reached the next one, at least
   * the time since it did. Null before the first checkpoint.
   */
  private ghostGap(): number | null {
    const ghost = this.setup.ghost;
    if (!ghost) return null;
    const mine = this.session.splits;
    const theirs = ghost.outcome.splits;
    const k = mine.length;
    const clock = this.session.world.clock;
    const next = theirs[k];
    if (next !== undefined && next < clock) return clock - next;
    const last = theirs[k - 1];
    if (k > 0 && last !== undefined) return mine[k - 1]! - last;
    return null;
  }

  /** What the ghost achieved, as the mode is ranked (time or score). */
  ghostResultText(): string {
    const ghost = this.setup.ghost;
    if (!ghost) return '';
    const { outcome } = ghost;
    return rankingSort(this.setup.mode, this.setup.levelId) === 'score'
      ? String(outcome.score)
      : formatTime(outcome.time);
  }

  /** Warm-up hints: a slow wall bounce, or a stumble / crash, each once per attempt. */
  private checkHint(moveId: number): void {
    if (this.session.world.rules.missionType < MissionType.WARM_UP_1 || this.pendingHint) return;
    const { i18n } = this.ctx;
    if (moveId === MoveId.WALL_BOUNCE && this.flow.claimHint(HINT_WALL)) {
      this.pendingHint = {
        text: i18n.t('hints.wallTurn'),
        at: this.session.world.clock + HINT_DELAY_MS,
      };
    } else if (
      (moveId === MoveId.CRASH_RECOVER || moveId === MoveId.STUMBLE) &&
      this.flow.claimHint(HINT_LANDING)
    ) {
      this.pendingHint = {
        text: i18n.t('hints.landing'),
        at: this.session.world.clock + HINT_DELAY_MS,
      };
    }
  }

  // -------------------------------------------------------------------------------------------
  // Phases
  // -------------------------------------------------------------------------------------------

  private enterPhase(): void {
    const { i18n } = this.ctx;
    const world = this.session.world;
    const level = world.level;
    switch (this.flow.phase) {
      case 'tutorial': {
        const page = this.flow.tutorialPage;
        const set = this.setup.mode === 'warmup2' ? 2 : 1;
        const flag = level.checkpoints[0];
        if (page === 1 && flag) {
          // The second page is shown over the flag, after a two-second pan (line 5221).
          this.camera.aimAtPoint((flag.x << 10) + 512, (flag.y << 10) + 512, 0.5, 0.5, level);
        } else {
          this.aimAtCoach();
        }
        this.pushBox({
          pages: [i18n.t(`tutorial.${set}.${page}`)],
          delayMs: page === 1 ? 2000 : 0,
          tail: page !== 1,
          onClose: () => this.advancePhase(),
        });
        return;
      }
      case 'briefing': {
        if (this.presence) {
          // The boss in the middle, above the box.
          const spot = this.presence.start;
          this.speaker = { x: spot.x, y: spot.y, fx: 0.5 };
          this.aimAtSpeaker();
          this.pushBox({
            pages: this.contestBriefing(),
            title: this.bossName(),
            tail: true,
            placement: 'auto',
            onClose: () => this.advancePhase(),
          });
          return;
        }
        if (this.setup.mode === 'sprint' && level.npc) {
          // The camera shows the rival's start cell during a sprint briefing.
          this.aimAtCell(level.npc.x, level.npc.y);
        }
        const ghostLine = this.ghostBriefing();
        this.pushBox({
          pages: ghostLine ? [this.briefingText(), ghostLine] : [this.briefingText()],
          tail: false,
          onClose: () => this.advancePhase(),
        });
        return;
      }
      case 'flyover': {
        const points = [
          ...level.checkpoints.map((cp) => ({ x: (cp.x << 10) + 512, y: (cp.y << 10) + 512 })),
          ...(level.finish
            ? [{ x: (level.finish.x << 10) + 512, y: (level.finish.y << 10) + 512 }]
            : []),
          { x: level.spawnX(), y: level.spawnY() - 512 },
        ];
        this.tour = new CameraTour(points, {
          viewW: this.camera.viewW,
          viewH: this.camera.viewH,
          levelW: level.width << 10,
          levelH: level.height << 10,
          frameH: this.camera.frameH,
        });
        this.tour.start(this.camera.x, this.camera.y);
        return;
      }
      case 'ready':
        this.tour = null;
        this.camera.reset(world.player, level);
        this.ctx.input.clear();
        this.echo.reveal(performance.now());
        return;
      case 'play':
        this.ctx.input.clear();
        this.echo.reveal(performance.now());
        this.presence?.vanish(performance.now());
        this.retargetGlimpse();
        // `a(true)` at the start of play: the menu track in the warm-ups, else the theme's.
        if (world.rules.missionType >= MissionType.WARM_UP_1) this.ctx.music.warmUp();
        else if (this.setup.contest) this.ctx.music.contest();
        else if (!this.quickStart) this.ctx.music.game(this.theme);
        return;
      default:
        return;
    }
  }

  private advancePhase(): void {
    this.flow.advance();
    this.enterPhase();
  }

  private briefingText(): string {
    const { i18n, content } = this.ctx;
    const mission = content.missions.levels[this.setup.levelId]!;
    const target = this.target();
    switch (this.setup.mode) {
      case 'sprint':
        return i18n.t('briefing.sprint');
      case 'flags':
        return i18n.t('briefing.flags');
      case 'score':
        return i18n.t('briefing.score', { target: target?.value ?? 0 });
      case 'challenge': {
        const challenge = mission.challenge;
        if (challenge && challenge.scoreTarget > 0) {
          return i18n.t('briefing.challenge.score', {
            target: challenge.scoreTarget,
            seconds: Math.round(challenge.timeLimit / 1000),
          });
        }
        return i18n.t(`briefing.challenge.${this.setup.levelId}`);
      }
      default:
        return '';
    }
  }

  /** The name of the level's boss. */
  private bossName(): string {
    const boss = bossOfLevel(this.setup.levelId);
    return boss ? this.ctx.i18n.t(`boss.${boss.id}.name`) : '';
  }

  /**
   * The boss's words before a contest: the challenge, then the prize (none once won; a hint
   * when the player already has the boss and this win would give it more).
   */
  private contestBriefing(): string[] {
    const { i18n } = this.ctx;
    const contest = this.setup.contest!;
    const found = bossOfCharacter(contest.character);
    if (!found) return [];
    const id = found.boss.id;
    const time = formatTime(contest.timeMs);
    const challenge = i18n.t(`boss.${id}.briefing.${this.setup.mode}`, { time });
    if (!isDrawn(found.boss)) return [challenge, i18n.t('contest.briefing.workshop')];
    const progress = loadContestProgress();
    if (isContestBeaten(progress, found.levelId, found.kind)) return [challenge];
    const owned = bossCharacterFor(found.levelId, progress) !== null;
    return [challenge, i18n.t(owned ? 'contest.briefing.more' : 'contest.briefing.reward')];
  }

  /** The second briefing page of a ghost race: whom the player races and what to beat. */
  private ghostBriefing(): string | null {
    const ghost = this.setup.ghost;
    if (!ghost) return null;
    const value = this.ghostResultText();
    return ghost.kind === 'best'
      ? this.ctx.i18n.t('ghost.briefing.best', { value })
      : this.ctx.i18n.t('ghost.briefing.challenger', { name: this.ghostLabel, value });
  }

  private target(): MissionTarget | null {
    const mission = this.ctx.content.missions.levels[this.setup.levelId]!;
    return evaluateMission(mission, this.setup.mode, null, 0, 0).target;
  }

  /** Camera on the coach, like `Z()` (line 5021), above the box it talks in. */
  private aimAtCoach(): void {
    const npc = this.session.world.level.npc;
    if (!npc) return;
    this.speaker = { x: (npc.x << 10) + 512, y: (npc.y << 10) + 1024, fx: 0.2 };
    this.aimAtSpeaker();
  }

  /**
   * The camera keeps the talking character in sight: its feet just above where the box sits
   * at the bottom (the box goes above the head only where the level's edge stops the camera),
   * across the screen where it usually stands. Aimed every frame, since the box is laid out
   * after this screen when the screen changes size.
   */
  private aimAtSpeaker(): void {
    const s = this.speaker;
    if (!s) return;
    const h = this.view.height;
    const boxTop = this.speakerBox?.bottomTop ?? Math.round(h * 0.58);
    const feet = Math.max((HEAD_HEIGHT >> 5) + 12, boxTop - 4);
    this.camera.aimAtPoint(s.x, s.y, s.fx, Math.min(1, feet / h), this.level);
    if (this.snapAim) {
      this.camera.refocus(this.level);
      this.snapAim = false;
    }
  }

  /**
   * Show a character standing in `cell` at the left of the screen and above the message box.
   * The original puts it at the bottom-left corner; our box is taller on wide screens, so the
   * character sits a little higher.
   */
  private aimAtCell(cellX: number, cellY: number): void {
    const level = this.session.world.level;
    this.camera.aimAtPoint((cellX << 10) + 512, (cellY << 10) + 1024, 0.2, 0.58, level);
  }

  private pushBox(opts: {
    pages: string[];
    title?: string;
    tone?: MessageBoxOptions['tone'];
    delayMs?: number;
    tail: boolean;
    placement?: MessageBoxOptions['placement'];
    onClose: () => void;
  }): void {
    const { i18n, screens } = this.ctx;
    this.openBoxes++;
    if (this.coach) this.coach.talking = true;
    const presence = this.presence?.state === 'start' ? this.presence : null;
    if (presence) presence.talking = true;
    const talking = opts.tail && (presence !== null || this.coach !== null);
    const box = new MessageBox(
      { viewport: this.ctx.viewport, fonts: this.ctx.fonts },
      {
        title: opts.title,
        tone: opts.tone,
        pages: opts.pages,
        delayMs: opts.delayMs,
        placement: opts.placement ?? (talking ? 'auto' : undefined),
        speakerHeight: HEAD_HEIGHT >> 5,
        labels: { next: i18n.t('menu.next'), ok: i18n.t('menu.ok') },
        tailTarget:
          opts.tail && presence
            ? () => this.presenceHead()
            : opts.tail && this.coach
              ? () => this.coachHead()
              : undefined,
        // The scene keeps settling and animating under the box (camera spring, idle loop).
        onFrame: (dt) => this.update(dt),
        onClose: () => {
          this.openBoxes--;
          if (this.speakerBox === box) {
            this.speakerBox = null;
            this.speaker = null;
          }
          if (this.coach) this.coach.talking = this.openBoxes > 0;
          if (presence) presence.talking = this.openBoxes > 0;
          screens.pop();
          this.ctx.input.clear();
          opts.onClose();
        },
      },
    );
    if (talking) this.speakerBox = box;
    screens.push(box);
  }

  private coachHead(): { x: number; y: number } | null {
    if (!this.coach) return null;
    const alpha = 1;
    return {
      x: toScreen(this.coach.x, this.camera.renderX(alpha)),
      y: toScreen(this.coach.y - 1800, this.camera.renderY(alpha)),
    };
  }

  private presenceHead(): { x: number; y: number } | null {
    const spot = this.presence?.spot;
    if (!spot) return null;
    return {
      x: toScreen(spot.x, this.camera.renderX(1)),
      y: toScreen(spot.y - HEAD_HEIGHT, this.camera.renderY(1)),
    };
  }

  /** Whether a message box or another overlay is on top of this screen. */
  get covered(): boolean {
    return this.openBoxes > 0;
  }

  enter(): void {
    this.ctx.facingRight = () => this.session.world.player.facingRight;
    this.ctx.input.clear();
    if (!this.phaseEntered) this.beginPhase();
  }

  exit(): void {
    // Menus and dialogs on top get every tap.
    this.ctx.touch.shown = false;
  }

  onResize(): void {
    const { viewport, render } = this.ctx;
    this.view.width = viewport.width;
    this.view.height = viewport.height;
    this.camera.setViewport(viewport.width, viewport.height);
    // The runner stays above the touch buttons' place (shown or not): never among them.
    this.camera.setFrame(this.ctx.touch.frameHeight());
    render.scene.setViewport(viewport.width, viewport.height);
    // Whatever the camera was aimed at stays in view: a speaker, a flag, the flyover's place.
    this.tour?.resize(this.camera.viewW, this.camera.viewH, this.camera.frameH);
    this.camera.refocus(this.level);
    this.snapAim = true;
  }

  // -------------------------------------------------------------------------------------------
  // Frame
  // -------------------------------------------------------------------------------------------

  update(dt: number): void {
    const { input } = this.ctx;
    const world = this.session.world;
    const level = world.level;
    // Game-time units of this frame, with the original's cap (used outside the step loop).
    const units = Math.min(MAX_FRAME_UNITS, (dt * TIME_SCALE_NUM) >> TIME_SCALE_SHIFT);
    this.ctx.touch.shown =
      !this.covered && (this.flow.phase === 'play' || this.flow.phase === 'ready');
    switch (this.flow.phase) {
      case 'tutorial':
      case 'briefing':
        input.clear();
        // Only the camera spring and the idle animation run (`boolean_d`, line 10589).
        this.aimAtSpeaker();
        this.camera.settle(level, units << 10);
        this.characters.step(world.clock, units);
        return;
      case 'flyover': {
        input.clear();
        if (this.tour) {
          const p = this.tour.advance(units);
          this.camera.moveTo(p.x, p.y, level);
        }
        return;
      }
      case 'ready':
        input.clear();
        if (this.flow.tickReady(dt)) this.enterPhase();
        return;
      case 'play':
        break;
      default:
        // After the run: the coach's last words still pan to the coach.
        if (this.speaker) {
          this.aimAtSpeaker();
          this.camera.settle(level, units << 10);
          this.characters.step(world.clock, units);
        }
        return;
    }
    if (this.pendingHint && !this.session.paused && world.clock >= this.pendingHint.at) {
      const hint = this.pendingHint;
      this.pendingHint = null;
      this.session.paused = true;
      input.clear();
      this.pushBox({
        pages: [hint.text],
        tail: false,
        onClose: () => {
          this.session.paused = false;
        },
      });
      return;
    }
    if (this.session.paused) {
      input.clear();
      return;
    }
    const bits = input.consume();
    if (bits !== 0) this.session.queueInput(bits);
    this.session.advance(dt);
    if (this.session.finished && !this.resultsShown) {
      this.resultsShown = true;
      this.flow.finish();
      this.onFinished();
    }
  }

  private onFinished(): void {
    const { i18n, screens } = this.ctx;
    const world = this.session.world;
    // Faster than the boss: it arrives all the same, where the run ended, to see who beat it.
    this.glimpse?.show(null);
    if (this.presence) {
      const spot = this.bossSpot();
      if (this.presence.state === 'away') this.presence.appear(performance.now(), spot);
      else if (spot) this.presence.moveTo(spot, performance.now());
    }
    if (world.rules.missionType >= MissionType.WARM_UP_1) {
      // The coach congratulates and the warm-up counts as completed (state 6).
      const set = this.setup.mode === 'warmup2' ? 2 : 1;
      // A warm-up done last completes the level: the level-complete box follows the coach's.
      let completion: LevelCompletion | null = null;
      if (this.missionIndex >= 0) {
        const before = loadProgress();
        const { progress } = completeMission(this.setup.levelId, this.missionIndex);
        completion = levelCompletion(this.ctx.content, this.setup.levelId, before, progress);
      }
      this.aimAtCoach();
      this.pushBox({
        pages: [i18n.t(`tutorial.${set}.done`), ...(set === 2 ? [i18n.t('tutorial.2.ps')] : [])],
        tone: 'success',
        title: i18n.t('results.done'),
        tail: true,
        onClose: () => {
          screens.pop();
          if (!completion) return;
          screens.push(
            new LevelCompleteScreen(this.ctx, {
              ...completion,
              repeat: () => screens.push(new PlayScreen(this.ctx, this.setup)),
              leaveRun: () => {},
            }),
          );
        },
      });
      return;
    }
    screens.push(new ResultsScreen(this.ctx, this));
  }

  onKey(key: UiKey): void {
    switch (this.flow.phase) {
      case 'flyover':
        if (key.action === 'confirm') this.advancePhase();
        else if (key.action === 'back' || key.action === 'pause') this.pause();
        return;
      case 'ready':
      case 'play':
        if (key.action === 'pause' || key.action === 'back') this.pause();
        else if (key.action === 'restart' && !this.covered && !this.session.finished) {
          this.restart({ quick: true });
        }
        return;
      default:
        return;
    }
  }

  private pause(): void {
    if (this.session.finished || this.covered) return;
    this.ctx.screens.push(new PauseScreen(this.ctx, this));
  }

  onPointer(p: UiPointer): void {
    // The touch buttons for pause and restart arrive as `pause` and `restart` keys.
    if (p.type === 'down' && this.flow.phase === 'flyover') this.advancePhase();
  }

  private hudOptions(): HudOptions {
    const flash = this.splitFlash;
    const now = performance.now();
    const split = flash && now < flash.until ? flash : null;
    return { ...this.timerOptions(), split, contest: this.contestLine(now) };
  }

  /** Under the HUD in a contest: the boss's flags so far, then that it has finished. */
  private contestLine(now: number): HudOptions['contest'] {
    const contest = this.setup.contest;
    if (!contest) return null;
    const { i18n } = this.ctx;
    const clock = this.session.world.clock;
    const color = this.presence?.color.light ?? WORKSHOP_COLOR.light;
    const boss = this.bossName();
    if (clock >= contest.timeMs) {
      const text =
        now < this.contestBannerUntil || this.session.finished
          ? i18n.t('contest.finished', { boss, time: formatTime(contest.timeMs) })
          : i18n.t('contest.result', { boss, value: formatTime(contest.timeMs) });
      return { text, color };
    }
    const n = contest.splitsMs.filter((t) => t <= clock).length;
    return { text: i18n.t('contest.hud', { boss, n, total: contest.splitsMs.length }), color };
  }

  private timerOptions(): HudOptions {
    const { i18n } = this.ctx;
    const rules = this.session.world.rules;
    // Against a boss only its time counts, not the mission's limit.
    if (this.setup.contest) return { timer: 'elapsed', limitMs: -1, label: '' };
    switch (this.setup.mode) {
      case 'free':
        return { timer: 'elapsed', limitMs: -1, label: i18n.t('mode.free') };
      case 'sprint':
        return { timer: 'elapsed', limitMs: -1, label: '' };
      case 'flags': {
        const target = this.target();
        return target
          ? { timer: 'countdown', limitMs: target.value, label: '' }
          : { timer: 'elapsed', limitMs: -1, label: '' };
      }
      case 'score':
      case 'challenge':
        return rules.timeLimit > 0
          ? { timer: 'countdown', limitMs: rules.timeLimit, label: '' }
          : { timer: 'elapsed', limitMs: -1, label: '' };
      default:
        return { timer: 'none', limitMs: -1, label: '' };
    }
  }

  /** The ghost's name over its head and the label of its finish flag. */
  private drawGhostLabels(c: CanvasRenderingContext2D, cam: CameraPos, alpha: number): void {
    const ghostWorld = this.session.ghostWorld;
    const color = this.ghostColor;
    if (!ghostWorld || !color) return;
    const small = this.ctx.fonts.small;
    const pos = this.echo.screenPosition(ghostWorld.player, cam, alpha);
    if (pos) drawNameTag(c, small, this.ghostLabel, color, pos.x, pos.y, pos.anchored);
    for (const marker of this.echo.markers) {
      if (marker.runner !== ghostWorld.player) continue;
      const label = `${this.ghostLabel} ${this.ghostResultText()}`;
      drawMarkerLabel(c, small, label, color, toScreen(marker.x, cam.x), toScreen(marker.y, cam.y));
    }
  }

  /** The boss's name over its head while it stands somewhere. */
  private drawPresenceLabel(c: CanvasRenderingContext2D, cam: CameraPos): void {
    const presence = this.presence;
    const spot = presence?.spot;
    if (!presence || !spot) return;
    const { fonts } = this.ctx;
    const name = this.bossName();
    const label =
      presence.state === 'end' && this.setup.contest
        ? `${name} ${formatTime(this.setup.contest.timeMs)}`
        : name;
    drawNameTag(
      c,
      fonts.small,
      label,
      presence.color,
      toScreen(spot.x, cam.x),
      toScreen(spot.y, cam.y),
      false,
    );
  }

  /**
   * Arrows at the screen edge towards the boss, the ghost, the rival, and the finish of a score
   * run, while they are off screen.
   */
  private drawEchoArrows(c: CanvasRenderingContext2D, cam: CameraPos, alpha: number): void {
    const area = safeRect(this.ctx.viewport);
    const small = this.ctx.fonts.small;
    const world = this.session.world;
    const presence = this.presence;
    if (presence?.state === 'end' && this.setup.contest) {
      const spot = presence.end;
      const sx = toScreen(spot.x, cam.x);
      const sy = toScreen(spot.y, cam.y) - 30;
      drawEdgeArrow(c, small, area, sx, sy, presence.color, formatTime(this.setup.contest.timeMs));
    }
    for (const runner of world.runners) {
      if (runner === world.player) continue;
      const pose = this.characters.pose(runner, alpha);
      if (!pose) continue;
      const sx = toScreen(pose.x, cam.x);
      const sy = toScreen(pose.y, cam.y) - 30;
      drawEdgeArrow(c, small, area, sx, sy, RIVAL_ARROW_COLOR, this.rivalName);
    }
    // A score run ends at the finish, which is easy to lose on a big level.
    const finish = world.level.finish;
    if (this.setup.mode === 'score' && finish) {
      c.save();
      c.globalAlpha = FINISH_ARROW_OPACITY;
      const fx = toScreen((finish.x << 10) + 512, cam.x);
      const fy = toScreen(finish.y << 10, cam.y);
      drawEdgeArrow(c, small, area, fx, fy, FINISH_ARROW_COLOR, null);
      c.restore();
    }
    const ghostWorld = this.session.ghostWorld;
    if (!ghostWorld || !this.ghostColor) return;
    const pos = this.echo.screenPosition(ghostWorld.player, cam, alpha);
    if (!pos) return;
    const gap = this.ghostGap();
    const text = gap === null ? null : formatGap(gap);
    drawEdgeArrow(c, small, area, pos.x, pos.y - 30, this.ghostColor, text);
  }

  render(c: CanvasRenderingContext2D): void {
    const { render, viewport, touch, fonts, i18n } = this.ctx;
    const world = this.session.world;
    const playing = this.flow.playing;
    const alpha = playing ? this.session.alpha : 1;
    const exact = { x: this.camera.renderX(alpha), y: this.camera.renderY(alpha) };
    const now = performance.now();
    c.imageSmoothingEnabled = false;
    render.level.drawBackground(c, exact, this.view, now, this.theme, this.camera.frameH >> 5);
    // The world on the level's pixel grid, moved by the rest of a pixel to a screen pixel: a
    // slow camera glides on a big screen instead of jumping a big pixel every few frames.
    const grid = worldGrid(exact, screenPixels(c));
    const cam = grid.cam;
    c.save();
    c.translate(grid.dx, grid.dy);
    if (this.pulsing) {
      render.level.drawLevelArtTween(
        c,
        cam,
        this.view,
        this.artFrames[0],
        this.artFrames[1],
        render.level.pulse(now),
      );
    } else {
      render.level.drawLevelArt(c, cam, this.view, defaultLevelArtFrame(this.setup.levelId));
    }
    render.level.drawMarkers(c, cam, this.view, world.level, world.rules, now, this.bounce);
    this.particles.draw(c, cam, this.view, world.clock, false);
    this.characters.drawNpcs(c, cam, now);
    this.presence?.draw(c, cam, now, this.view);
    this.glimpse?.draw(c, cam, alpha, now, this.view);
    this.echo.draw(c, cam, alpha, world.clock, now, this.view);
    this.fx.drawBehind(c, cam, world.clock, now, this.view);
    this.characters.drawAll(c, cam, alpha, world.clock, world.player);
    this.fx.drawFront(c, cam);
    this.particles.draw(c, cam, this.view, world.clock, true);
    this.drawGhostLabels(c, cam, alpha);
    this.drawPresenceLabel(c, cam);
    c.restore();
    if (touch.shown) touch.draw(c);
    // The HUD is not drawn while a message box is up (`bj()`, line 10610).
    if (!this.covered && this.flow.phase !== 'tutorial' && this.flow.phase !== 'briefing') {
      this.hud.draw(c, world, viewport, this.hudOptions());
      if (playing) this.drawEchoArrows(c, cam, alpha);
    }
    const cx = viewport.width >> 1;
    const cy = viewport.height >> 1;
    if (this.flow.phase === 'ready') {
      const text = this.flow.readyLeft > READY_MS / 3 ? i18n.t('hud.getReady') : i18n.t('hud.go');
      outlined(c, fonts.title, text, cx, cy, { align: 'center', color: Theme.accent });
    } else if (this.flow.phase === 'flyover') {
      outlined(
        c,
        fonts.text,
        i18n.t('flyover.start'),
        cx,
        viewport.height - viewport.safeArea.bottom - 40,
        {
          align: 'center',
          color: Theme.text,
        },
      );
    }
  }
}
