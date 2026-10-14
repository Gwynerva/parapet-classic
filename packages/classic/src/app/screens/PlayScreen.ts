/**
 * The game itself: a mission from its briefing to its results. The phases follow the
 * original's screen states (reference/notes/08-flow-and-menus.md §1): tutorial pages with the
 * coach (warm-ups), the briefing box, the Sprint flyover, "get ready", play with the in-play
 * hints of the warm-ups, then the warm-up's closing message or the results screen.
 *
 * A contest with a boss (`play/BossContest.ts`) and a race with a ghost (`play/GhostRace.ts`)
 * ride along. A runner playing a boss character wears one of its outfits, picked at random for
 * the run, and leaves its effects (`CharacterFx`).
 */
import {
  evaluateMission,
  isSplitEvent,
  type Level,
  missionSlot,
  type MissionTarget,
  MissionType,
  MoveId,
  STEP,
  tileCentre,
  type World,
  type WorldEvent,
} from '@parapet/sim';
import { Theme, type GameContext } from '../Context.ts';
import { runContent } from '../ghosts.ts';
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
import { FrameUnits } from '@parapet/runtime/app/GameLoop.ts';
import { completeMission, loadProgress } from '@parapet/runtime/storage/profile.ts';
import { COACH_IDLE_KEYFRAME, COACH_TALK_CLIP } from '../ui/sprites.ts';
import { drawEdgeSign, formatGap, type EdgePicture } from '../ui/GhostOverlay.ts';
import { characterFx, pickOutfit } from '../bosses.ts';
import { showsFinishPointer } from '../ui/finishPointer.ts';
import { HEAD_HEIGHT } from '../ui/BossPresence.ts';
import { holdLevelNews, levelCompletion, type LevelCompletion } from './LevelCompleteScreen.ts';
import { PauseScreen } from './PauseScreen.ts';
import { BossContest } from './play/BossContest.ts';
import { GhostRace } from './play/GhostRace.ts';
import { FINISH_SIGN, headSign } from './play/signs.ts';
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
  /** The contest with the level's boss, null outside one. */
  private contest: BossContest | null = null;
  /** The race with a ghost, null without one. */
  private readonly ghost: GhostRace | null;
  private particles!: Particles;
  private bounce!: MarkerBounce;
  private readonly hud: Hud;
  /** Game time of the frames outside the step loop (briefings, the flyover). */
  private readonly frameUnits = new FrameUnits();
  private readonly theme: number;
  readonly flow: MissionFlow;
  private tour: CameraTour | null = null;
  private coach: NpcVisual | null = null;
  /** The rival's head on its sign at the screen's edge (`drawEdgeSigns`). */
  private rivalSign: EdgePicture | null = null;
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
    this.ghost = setup.ghost ? new GhostRace(ctx, setup.ghost) : null;
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
    const mission = content.missions.levels[this.setup.levelId];
    const data = runContent(this.ctx, this.setup.levelId);
    if (!mission || !data) throw new Error(`level ${this.setup.levelId} is missing`);
    this.session = new RunSession(this.setup, data);
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
    this.rivalSign = headSign(
      this.ctx,
      render.skins.sceneFor(mission.rivalCharacter),
      render.skins.swapFor(mission.rivalCharacter),
    );
    this.addFx(world.player, this.setup.character);
    this.ghost?.attach(this.session, this.characters, this.echo, (events, w) =>
      this.onGhostStep(events, w),
    );
    this.splitFlash = null;
    this.coach = null;
    const npc = world.level.npc;
    const warmUp = world.rules.missionType >= MissionType.WARM_UP_1;
    if (npc && warmUp) {
      // The coach stands mid-cell on the floor, always facing right (`ak()`, line 5911).
      this.coach = this.characters.attachNpc('coach', {
        x: tileCentre(npc.x),
        y: (npc.y << 10) + 1024,
        character: mission.rivalCharacter,
        idleKeyframe: COACH_IDLE_KEYFRAME,
        talkClipOffset: COACH_TALK_CLIP,
      });
    }
    this.contest = this.setup.contest
      ? new BossContest(this.ctx, this.setup.contest, this.setup.mode, this.setup.levelId, world)
      : null;
    this.particles = new Particles(render.sheet, render.sine);
    this.particles.setLevel(world.level);
    this.bounce = new MarkerBounce();
    this.artFrames = [0, 1];
    render.level.setLevel(this.setup.levelId, world.level);
    this.onResize();
    this.camera.reset(world.player, world.level);
    this.session.onStep((events) => this.onStep(events));
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

  private beginPhase(): void {
    this.phaseEntered = true;
    this.enterPhase();
  }

  private onStep(events: readonly WorldEvent[]): void {
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
    this.contest?.step(world, events);
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
          this.camera.aimAtPoint(tileCentre(flag.x), tileCentre(flag.y), 0.5, 0.5, level);
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
        if (this.contest) {
          // The boss in the middle, above the box.
          const spot = this.contest.presence.start;
          this.speaker = { x: spot.x, y: spot.y, fx: 0.5 };
          this.aimAtSpeaker();
          this.pushBox({
            pages: this.contest.briefing(),
            title: this.contest.name,
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
        const ghostLine = this.ghost?.briefing();
        this.pushBox({
          pages: ghostLine ? [this.briefingText(), ghostLine] : [this.briefingText()],
          tail: false,
          onClose: () => this.advancePhase(),
        });
        return;
      }
      case 'flyover': {
        const points = [
          ...level.checkpoints.map((cp) => ({ x: tileCentre(cp.x), y: tileCentre(cp.y) })),
          ...(level.finish
            ? [{ x: tileCentre(level.finish.x), y: tileCentre(level.finish.y) }]
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
        this.contest?.start(world);
        // `a(true)` at the start of play: the menu track in the warm-ups, else the theme's.
        if (world.rules.missionType >= MissionType.WARM_UP_1) this.ctx.music.menu();
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

  private target(): MissionTarget | null {
    const mission = this.ctx.content.missions.levels[this.setup.levelId]!;
    return evaluateMission(mission, this.setup.mode, null, 0, 0).target;
  }

  /** Camera on the coach, like `Z()` (line 5021), above the box it talks in. */
  private aimAtCoach(): void {
    const npc = this.session.world.level.npc;
    if (!npc) return;
    this.speaker = { x: tileCentre(npc.x), y: (npc.y << 10) + 1024, fx: 0.2 };
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
    this.camera.aimAtPoint(tileCentre(cellX), (cellY << 10) + 1024, 0.2, 0.58, level);
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
    const presence = this.contest?.presence.state === 'start' ? this.contest.presence : null;
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
    return {
      x: toScreen(this.coach.x, this.camera.renderX(1)),
      y: toScreen(this.coach.y - 1800, this.camera.renderY(1)),
    };
  }

  private presenceHead(): { x: number; y: number } | null {
    const spot = this.contest?.presence.spot;
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
    // Menus and dialogs on top get every tap, and no longer press with this runner's facing.
    this.ctx.touch.shown = false;
    this.ctx.facingRight = () => true;
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
    // Game-time units of this frame (used outside the step loop).
    const units = this.frameUnits.take(dt);
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
    this.contest?.finish(world);
    if (world.rules.missionType >= MissionType.WARM_UP_1) {
      // The coach congratulates and the warm-up counts as completed (state 6).
      const set = this.setup.mode === 'warmup2' ? 2 : 1;
      // A warm-up done last completes the level: its news waits for the level's menu.
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
          if (completion) holdLevelNews(completion);
          screens.pop();
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
    const contest = this.contest?.hudLine(this.session.world, this.session.finished, now) ?? null;
    return { ...this.timerOptions(), split, contest };
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

  /**
   * Signs at the screen's edge towards the boss (waiting, with its time), the rival, the finish
   * (of a score run, or once the flags are taken) and the ghost (with the gap), while they are
   * off screen.
   */
  private drawEdgeSigns(c: CanvasRenderingContext2D, cam: CameraPos, alpha: number): void {
    const area = safeRect(this.ctx.viewport);
    const small = this.ctx.fonts.small;
    const world = this.session.world;
    this.contest?.drawSign(c, area, cam, small);
    for (const runner of world.runners) {
      if (runner === world.player || !this.rivalSign) continue;
      const pose = this.characters.pose(runner, alpha);
      if (!pose) continue;
      const sx = toScreen(pose.x, cam.x);
      const sy = toScreen(pose.y, cam.y) - 30;
      drawEdgeSign(c, area, sx, sy, this.rivalSign);
    }
    // The finish is easy to lose on a big level; a boss waiting there has its own sign.
    const finish = world.level.finish;
    const bossAtFinish = this.contest?.presence.state === 'end' && this.setup.mode === 'sprint';
    if (
      finish &&
      !bossAtFinish &&
      showsFinishPointer(this.setup.mode, world.level, world.rules.remainingMask)
    ) {
      const fx = toScreen(tileCentre(finish.x), cam.x);
      const fy = toScreen(finish.y << 10, cam.y);
      drawEdgeSign(c, area, fx, fy, FINISH_SIGN);
    }
    this.ghost?.drawSign(c, area, this.session, this.echo, cam, alpha, small);
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
    this.particles.draw(c, cam, world.clock, false);
    this.characters.drawNpcs(c, cam, now);
    this.contest?.draw(c, cam, alpha, now, this.view);
    this.echo.draw(c, cam, alpha, world.clock, now, this.view);
    this.fx.drawBehind(c, cam, world.clock, now, this.view);
    this.characters.drawAll(c, cam, alpha, world.clock, world.player);
    this.fx.drawFront(c, cam);
    this.particles.draw(c, cam, world.clock, true);
    this.ghost?.drawLabels(c, this.session, this.echo, cam, alpha);
    this.contest?.drawLabel(c, cam);
    c.restore();
    if (touch.shown) touch.draw(c);
    // The HUD is not drawn while a message box is up (`bj()`, line 10610).
    if (!this.covered && this.flow.phase !== 'tutorial' && this.flow.phase !== 'briefing') {
      this.hud.draw(c, world, viewport, this.hudOptions());
      if (playing) this.drawEdgeSigns(c, cam, alpha);
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
