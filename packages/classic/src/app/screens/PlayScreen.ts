/**
 * The game itself: a mission from its briefing to its results. The phases follow the
 * original's screen states (reference/notes/08-flow-and-menus.md §1): tutorial pages with the
 * coach (warm-ups), the briefing box, the Sprint flyover, "get ready", play with the in-play
 * hints of the warm-ups, then the warm-up's closing message or the results screen.
 */
import {
  evaluateMission,
  missionSlot,
  MissionType,
  MoveId,
  STEP,
  type Level,
  type MissionTarget,
} from '@parapet/sim';
import { Theme, type GameContext } from '../Context.ts';
import { RunSession, type RunSetup } from '@parapet/runtime/app/RunSession.ts';
import { MissionFlow } from '@parapet/runtime/app/MissionFlow.ts';
import type { Screen, UiKey, UiPointer } from '@parapet/runtime/app/Screen.ts';
import { Hud, type HudOptions } from '../ui/Hud.ts';
import { Camera } from '@parapet/runtime/render/Camera.ts';
import { CameraTour } from '@parapet/runtime/render/CameraTour.ts';
import { CharacterRenderer, type NpcVisual } from '@parapet/runtime/render/CharacterRenderer.ts';
import {
  defaultLevelArtFrame,
  MarkerBounce,
  themeOfLevel,
} from '@parapet/runtime/render/LevelRenderer.ts';
import { Particles } from '@parapet/runtime/render/Particles.ts';
import type { ViewSize } from '@parapet/runtime/render/View.ts';
import { toScreen } from '@parapet/runtime/render/View.ts';
import { vibrate } from '@parapet/runtime/input/InputManager.ts';
import { MessageBox, type MessageBoxOptions } from '@parapet/runtime/ui/MessageBox.ts';
import { outlined } from '@parapet/runtime/ui/draw.ts';
import {
  MAX_FRAME_UNITS,
  TIME_SCALE_NUM,
  TIME_SCALE_SHIFT,
} from '@parapet/runtime/app/GameLoop.ts';
import { completeMission } from '@parapet/runtime/storage/profile.ts';
import { COACH_IDLE_KEYFRAME, COACH_TALK_CLIP } from '../ui/sprites.ts';
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

export class PlayScreen implements Screen {
  private readonly ctx: GameContext;
  readonly setup: RunSetup;
  session!: RunSession;
  private camera!: Camera;
  private characters!: CharacterRenderer;
  private particles!: Particles;
  private bounce!: MarkerBounce;
  private readonly hud: Hud;
  private readonly theme: number;
  readonly flow: MissionFlow;
  private tour: CameraTour | null = null;
  private coach: NpcVisual | null = null;
  private artFrames: [number, number];
  private readonly pulsing: boolean;
  private resultsShown = false;
  private phaseEntered = false;
  private openBoxes = 0;
  private pendingHint: { text: string; at: number } | null = null;
  private readonly view: ViewSize = { width: 240, height: 320 };
  private readonly missionIndex: number;

  constructor(ctx: GameContext, setup: RunSetup) {
    this.ctx = ctx;
    this.setup = setup;
    this.hud = new Hud(ctx.fonts, ctx.i18n);
    this.theme = themeOfLevel(setup.levelId);
    const mission = ctx.content.missions.levels[setup.levelId];
    if (!mission) throw new Error(`level ${setup.levelId} is missing`);
    this.missionIndex = missionSlot(mission, setup.mode);
    const warmUp = setup.mode === 'warmup1' || setup.mode === 'warmup2';
    this.pulsing =
      warmUp || (setup.mode === 'challenge' && PULSING_CHALLENGE_LEVELS.has(setup.levelId));
    this.artFrames = [0, 1];
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

  /** Start the run from scratch (also used by the pause and results screens). */
  restart(): void {
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
    this.characters = new CharacterRenderer(render.scene, render.moves, render.clips);
    world.runners.forEach((runner, i) => {
      const isPlayer = runner === world.player;
      this.characters.attach(runner, {
        character: isPlayer ? this.setup.character : mission.rivalCharacter,
        ghost: !isPlayer,
        seed: i + 1,
      });
    });
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
    this.flow.reset();
    this.ctx.input.clear();
    // The first phase may push a box above this screen, so it waits until this screen is on
    // the stack (`enter`); a restart from the pause or results screen happens on top already.
    this.phaseEntered = false;
    if (this.ctx.screens.top === this) this.beginPhase();
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
    }
    this.characters.step(world.clock, STEP);
    this.particles.update(STEP, world.player);
    this.bounce.advance(STEP);
    this.camera.update(world.player, world.level);
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
        if (this.setup.mode === 'sprint' && level.npc) {
          // The camera shows the rival's start cell during a sprint briefing.
          this.aimAtCell(level.npc.x, level.npc.y);
        }
        this.pushBox({
          pages: [this.briefingText()],
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
        });
        this.tour.start(this.camera.x, this.camera.y);
        return;
      }
      case 'ready':
        this.tour = null;
        this.camera.reset(world.player, level);
        this.ctx.input.clear();
        return;
      case 'play':
        this.ctx.input.clear();
        // `a(true)` at the start of play: the menu track in the warm-ups, else the theme's.
        if (world.rules.missionType >= MissionType.WARM_UP_1) this.ctx.music.warmUp();
        else this.ctx.music.game(this.theme);
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

  /** Camera on the coach, like `Z()` (line 5021). */
  private aimAtCoach(): void {
    const npc = this.session.world.level.npc;
    if (npc) this.aimAtCell(npc.x, npc.y);
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
    onClose: () => void;
  }): void {
    const { i18n, screens } = this.ctx;
    this.openBoxes++;
    if (this.coach) this.coach.talking = true;
    const box = new MessageBox(
      { viewport: this.ctx.viewport, fonts: this.ctx.fonts },
      {
        title: opts.title,
        tone: opts.tone,
        pages: opts.pages,
        delayMs: opts.delayMs,
        labels: { next: i18n.t('menu.next'), ok: i18n.t('menu.ok') },
        tailTarget: opts.tail && this.coach ? () => this.coachHead() : undefined,
        // The scene keeps settling and animating under the box (camera spring, idle loop).
        onFrame: (dt) => this.update(dt),
        onClose: () => {
          this.openBoxes--;
          if (this.coach) this.coach.talking = this.openBoxes > 0;
          screens.pop();
          this.ctx.input.clear();
          opts.onClose();
        },
      },
    );
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

  /** Whether a message box or another overlay is on top of this screen. */
  get covered(): boolean {
    return this.openBoxes > 0;
  }

  enter(): void {
    this.ctx.facingRight = () => this.session.world.player.facingRight;
    this.ctx.input.clear();
    if (!this.phaseEntered) this.beginPhase();
  }

  onResize(): void {
    const { viewport, render } = this.ctx;
    this.view.width = viewport.width;
    this.view.height = viewport.height;
    this.camera.setViewport(viewport.width, viewport.height);
    render.scene.setViewport(viewport.width, viewport.height);
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
    switch (this.flow.phase) {
      case 'tutorial':
      case 'briefing':
        input.clear();
        // Only the camera spring and the idle animation run (`boolean_d`, line 10589).
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
    if (world.rules.missionType >= MissionType.WARM_UP_1) {
      // The coach congratulates and the warm-up counts as completed (state 6).
      const set = this.setup.mode === 'warmup2' ? 2 : 1;
      if (this.missionIndex >= 0) completeMission(this.setup.levelId, this.missionIndex);
      this.aimAtCoach();
      this.pushBox({
        pages: [i18n.t(`tutorial.${set}.done`), ...(set === 2 ? [i18n.t('tutorial.2.ps')] : [])],
        tone: 'success',
        title: i18n.t('results.done'),
        tail: true,
        onClose: () => screens.pop(),
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
    if (p.type !== 'down') return;
    if (this.flow.phase === 'flyover') {
      this.advancePhase();
      return;
    }
    // A tap in the top-centre band pauses (the corners belong to the HUD and touch buttons).
    const { width } = this.ctx.viewport;
    if (p.y < 28 && p.x > width * 0.35 && p.x < width * 0.65) this.pause();
  }

  private hudOptions(): HudOptions {
    const { i18n } = this.ctx;
    const rules = this.session.world.rules;
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

  render(c: CanvasRenderingContext2D): void {
    const { render, viewport, touch, fonts, i18n } = this.ctx;
    const world = this.session.world;
    const playing = this.flow.playing;
    const alpha = playing ? this.session.alpha : 1;
    const cam = { x: this.camera.renderX(alpha), y: this.camera.renderY(alpha) };
    const now = performance.now();
    c.imageSmoothingEnabled = false;
    render.level.drawBackground(c, cam, this.view, now, this.theme);
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
    this.characters.drawAll(c, cam, alpha, world.clock, world.player);
    this.particles.draw(c, cam, this.view, world.clock, true);
    if (playing) touch.draw(c);
    // The HUD is not drawn while a message box is up (`bj()`, line 10610).
    if (!this.covered && this.flow.phase !== 'tutorial' && this.flow.phase !== 'briefing') {
      this.hud.draw(c, world, viewport, this.hudOptions());
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
