/**
 * What the menus are drawn over: one of the levels with runners crossing it, dimmed so the
 * menus stay readable. The runners replay real runs, so they run and jump like players, not
 * like bots: the original's rival recording of the level (a run by the developers) and the
 * player's own records there, which take other routes. They are at different points of their
 * runs (one just starting, one half-way, one near the end) and so in different parts of the
 * level doing different things; one that finishes starts again. The camera stays with one
 * runner and now and then cuts to another. They wear different characters, the bosses the
 * player has beaten among them, in random outfits and with their effects. After a while the
 * picture fades and another level begins.
 *
 * The backdrop only advances while it is drawn, so it rests during a run and in a hidden tab.
 * Coming back from a run, it shows the level just played (its art is already drawn).
 */
import {
  createReplayWorld,
  InputPlayer,
  isRankedMode,
  Level,
  LEVEL_COUNT,
  NO_INPUT,
  STEP,
  World,
  type InputRun,
  type RunMode,
} from '@parapet/sim';
import { FixedStepClock } from '@parapet/runtime/app/GameLoop.ts';
import { Camera } from '@parapet/runtime/render/Camera.ts';
import { screenPixels, worldGrid } from '@parapet/runtime/render/View.ts';
import { CharacterRenderer } from '@parapet/runtime/render/CharacterRenderer.ts';
import { defaultLevelArtFrame, themeOfLevel } from '@parapet/runtime/render/LevelRenderer.ts';
import { CharacterFx } from '@parapet/runtime/render/fx/CharacterFx.ts';
import { prefersReducedMotion } from '@parapet/runtime/ui/motion.ts';
import { loadContestProgress, loadRecord } from '@parapet/runtime/storage/profile.ts';
import type { GameContext } from '../Context.ts';
import { recordReplay, runContent } from '../ghosts.ts';
import { bossCharacterFor, characterFx, pickOutfit } from '../bosses.ts';

/** Where in their runs the runners are when a show begins (fractions of each run). */
const PHASES = [0, 0.42, 0.78];
/** At most this many of the player's records join in (the rest are the rival's run). */
const MAX_RECORDS = 2;
/** The dark veil over the level. */
const VEIL = 'rgba(16, 20, 24, 0.74)';
/** Fades between shows and on camera cuts, ms. */
const FADE_MS = 450;
const CUT_FADE_MS = 360;
/** Time on one runner before the camera cuts to another, ms of game time. */
const FOCUS_MS = 9000;
/** A runner stays this long after its run before it starts over, ms of game time. */
const LINGER_MS = 900;
/** Shows last at least this long, and at most until the longest run is over once. */
const MIN_SHOW_MS = 30000;

/** Where a runner's moves come from. */
type Source = { kind: 'rival' } | { kind: 'record'; mode: RunMode; input: InputRun[] };

/** One runner of a show, in its own world so it can be anywhere in its run. */
interface Actor {
  source: Source;
  world: World;
  input: InputPlayer | null;
  runner: World['player'];
  character: number;
  /** Game time into its run, and how long the run is (-1 until a record's input ends). */
  clock: number;
  length: number;
  /** Game time since the run ended (it starts over after `LINGER_MS`), or -1. */
  over: number;
}

interface Show {
  levelId: number;
  level: Level;
  actors: Actor[];
  characters: CharacterRenderer;
  fx: CharacterFx;
  camera: Camera;
  focus: number;
  focusSince: number;
  clock: number;
  endsAt: number;
}

export class MenuBackdrop {
  private readonly ctx: GameContext;
  private readonly clock = new FixedStepClock();
  private readonly still = prefersReducedMotion();
  private show: Show | null = null;
  private pendingDt = 0;
  /** Fade state: ms into the show (fade in), or the countdown to the next show. */
  private age = 0;
  private leaving = -1;
  private cutAt = -Infinity;
  /** A cut is due: the camera jumps in the middle of the dip. */
  private cutPending = false;
  private lastLevel = -1;

  constructor(ctx: GameContext) {
    this.ctx = ctx;
  }

  /** Real time of this frame, from the main loop (used when the backdrop is drawn). */
  frame(dt: number): void {
    this.pendingDt += dt;
  }

  draw(c: CanvasRenderingContext2D): void {
    const { viewport, render } = this.ctx;
    const dt = Math.min(250, this.pendingDt);
    this.pendingDt = 0;
    // A run changed the level renderer: show the level just played rather than draw another.
    const shown = render.level.levelId;
    if (!this.show || (shown >= 0 && shown !== this.show.levelId && this.leaving < 0)) {
      this.start(shown >= 0 ? shown : this.pickLevel());
    }
    const show = this.show;
    if (!show) return;
    if (!this.still) this.advance(show, dt);
    const now = performance.now();
    if (this.cutPending && now - this.cutAt >= CUT_FADE_MS / 2) {
      this.cutPending = false;
      const actor = show.actors[show.focus];
      if (actor) show.camera.reset(actor.runner, show.level);
    }
    const view = { width: viewport.width, height: viewport.height };
    show.camera.setViewport(view.width, view.height);
    render.scene.setViewport(view.width, view.height);
    const alpha = this.still ? 1 : this.clock.alpha;
    const exact = { x: show.camera.renderX(alpha), y: show.camera.renderY(alpha) };
    c.imageSmoothingEnabled = false;
    render.level.setLevel(show.levelId, show.level);
    render.level.drawBackground(c, exact, view, now, themeOfLevel(show.levelId));
    // The world on whole pixels, moved by the rest to a screen pixel (as in a run).
    const grid = worldGrid(exact, screenPixels(c));
    const cam = grid.cam;
    c.save();
    c.translate(grid.dx, grid.dy);
    render.level.drawLevelArt(c, cam, view, defaultLevelArtFrame(show.levelId));
    show.fx.drawBehind(c, cam, show.clock, now, view);
    show.characters.drawAll(c, cam, alpha, show.clock);
    show.fx.drawFront(c, cam);
    c.restore();
    c.fillStyle = VEIL;
    c.fillRect(0, 0, view.width, view.height);
    // Fades: into a show, out of it, and a short dip on a camera cut.
    let fade = Math.max(0, 1 - this.age / FADE_MS);
    if (this.leaving >= 0) fade = Math.max(fade, 1 - this.leaving / FADE_MS);
    const sinceCut = now - this.cutAt;
    if (sinceCut < CUT_FADE_MS) {
      fade = Math.max(fade, 1 - Math.abs(sinceCut / CUT_FADE_MS - 0.5) * 2);
    }
    if (fade > 0) {
      c.globalAlpha = Math.min(1, fade);
      c.fillStyle = '#101418';
      c.fillRect(0, 0, view.width, view.height);
      c.globalAlpha = 1;
    }
  }

  private advance(show: Show, dt: number): void {
    this.age += dt;
    if (this.leaving >= 0) {
      this.leaving -= dt;
      if (this.leaving < 0) this.start(this.pickLevel());
      return;
    }
    this.clock.advance(dt, {
      step: () => {
        this.stepShow(show);
        return true;
      },
    });
    if (show.clock >= show.endsAt) this.leaving = FADE_MS;
  }

  private stepShow(show: Show): void {
    show.clock += STEP;
    for (const actor of show.actors) this.stepActor(show, actor);
    show.characters.step(show.clock, STEP);
    show.fx.step({ clock: show.clock });
    this.maybeCut(show);
    // Until the dip hides the cut, the camera stays with the runner it had.
    const n = show.actors.length;
    const focus = this.cutPending ? (show.focus + n - 1) % n : show.focus;
    const target = show.actors[focus]?.runner;
    if (target) show.camera.update(target, show.level);
  }

  /** One step of one runner; a finished run starts over after a moment. */
  private stepActor(show: Show, actor: Actor): void {
    if (actor.over >= 0) {
      actor.over += STEP;
      if (actor.over >= LINGER_MS) this.restartActor(show, actor);
      return;
    }
    let bits = 0;
    if (actor.input) {
      bits = actor.input.next();
      if (bits === NO_INPUT) {
        // A record ends with its input: from then on the runner would only run on blindly.
        actor.length = actor.clock;
        actor.over = 0;
        return;
      }
    }
    actor.world.step(bits);
    show.characters.onEvents(actor.world.events);
    actor.clock += STEP;
    if (actor.length >= 0 && actor.clock >= actor.length) actor.over = 0;
  }

  /** After a while on one runner (or when its run is over), cut to another one. */
  private maybeCut(show: Show): void {
    const current = show.actors[show.focus];
    const ended = !current || current.over >= 0;
    if (!ended && show.clock - show.focusSince < FOCUS_MS) return;
    for (let k = 1; k < show.actors.length; k++) {
      const next = (show.focus + k) % show.actors.length;
      if (show.actors[next]!.over >= 0) continue;
      show.focus = next;
      show.focusSince = show.clock;
      this.cutAt = performance.now();
      this.cutPending = true;
      return;
    }
  }

  /** A new world for the actor's run, its runner on stage, and `phase` of the run played. */
  private beginActor(show: Show, actor: Actor, phase: number): void {
    const { render } = this.ctx;
    const { characters, fx } = show;
    const made = this.makeWorld(show.levelId, actor.source);
    if (!made) return;
    actor.world = made.world;
    actor.input = made.input;
    actor.runner = made.world.runners.find((r) => r !== made.world.player) ?? made.world.player;
    actor.clock = 0;
    actor.over = -1;
    characters.attach(actor.runner, {
      character: actor.character,
      outfit: pickOutfit(actor.character),
      seed: show.actors.indexOf(actor) + 1,
    });
    const runner = actor.runner;
    const style = characterFx(
      render.skins,
      actor.character,
      characters.get(runner)?.outfit ?? 0,
      (clock) => characters.swapFor(runner, clock),
      show.actors.indexOf(actor) + 7,
    );
    if (style) {
      fx.add(runner, { pose: () => characters.pose(runner, 1), move: () => runner.moveId }, style);
    }
    // Played at once (with the animations, so the runner shows up mid-stride; quietly).
    const target = Math.floor((phase * Math.max(0, actor.length)) / STEP) * STEP;
    while (actor.clock < target && actor.over < 0) {
      this.stepActor(show, actor);
      characters.step(show.clock, STEP);
      fx.step({ silent: true, clock: show.clock });
    }
  }

  private restartActor(show: Show, actor: Actor): void {
    show.characters.detach(actor.runner);
    show.fx.remove(actor.runner);
    this.beginActor(show, actor, 0);
  }

  private makeWorld(
    levelId: number,
    source: Source,
  ): { world: World; input: InputPlayer | null } | null {
    const { content } = this.ctx;
    const data = content.levels[levelId];
    const recording = content.rivals.get(levelId);
    if (!data) return null;
    if (source.kind === 'rival') {
      if (!recording) return null;
      // The rival's run on the sprint layout, where it was recorded.
      const world = new World({
        level: data,
        moves: content.moves,
        tables: content.tables,
        rules: { missionType: 0, freeRun: true },
        rivals: [{ recording, startDelay: 0 }],
        levelId,
      });
      return { world, input: null };
    }
    const entry = loadRecord(levelId, source.mode);
    const replay = entry ? recordReplay(this.ctx, levelId, source.mode, entry) : null;
    const runContentOf = runContent(this.ctx, levelId);
    if (!replay || !runContentOf) return null;
    const world = createReplayWorld({ ...replay, withRival: false }, runContentOf);
    return { world, input: new InputPlayer(source.input) };
  }

  /** Any level but the last one shown. */
  private pickLevel(): number {
    let id = Math.floor(Math.random() * LEVEL_COUNT);
    if (id === this.lastLevel) id = (id + 1) % LEVEL_COUNT;
    return id;
  }

  private start(levelId: number): void {
    const { content, render, viewport } = this.ctx;
    const data = content.levels[levelId];
    const recording = content.rivals.get(levelId);
    if (!data || !recording) {
      if (levelId !== 0) this.start(0);
      return;
    }
    this.lastLevel = levelId;
    // The player's records on this level first (their own routes), then the rival's run.
    const sources: { source: Source; length: number }[] = [];
    for (const mode of ['flags', 'sprint', 'score', 'challenge'] as RunMode[]) {
      if (sources.length >= MAX_RECORDS) break;
      const entry = isRankedMode(mode) ? loadRecord(levelId, mode) : null;
      if (!entry || !recordReplay(this.ctx, levelId, mode, entry)) continue;
      const length = entry.input.reduce((sum, run) => sum + run.ticks, 0) * STEP;
      sources.push({ source: { kind: 'record', mode, input: entry.input }, length });
    }
    while (sources.length < PHASES.length) {
      sources.push({ source: { kind: 'rival' }, length: recording.totalTime });
    }
    const characters = new CharacterRenderer(
      render.scene,
      render.moves,
      render.clips,
      render.skins,
    );
    const fx = new CharacterFx(render.echo, { reducedMotion: this.still });
    const level = new Level(data, 0);
    const show: Show = {
      levelId,
      level,
      actors: [],
      characters,
      fx,
      camera: new Camera(viewport.width, viewport.height),
      focus: 0,
      focusSince: 0,
      clock: 0,
      endsAt: Math.max(MIN_SHOW_MS, ...sources.map((s) => s.length)),
    };
    const cast = this.cast(sources.length);
    // Runs in a shuffled order of phases, so a record is not always the one at the start.
    const phases = PHASES.slice().sort(() => Math.random() - 0.5);
    sources.forEach((s, i) => {
      const placeholder = new World({
        level: data,
        moves: content.moves,
        tables: content.tables,
        rules: { missionType: 0, freeRun: true },
      });
      const actor: Actor = {
        source: s.source,
        world: placeholder,
        input: null,
        runner: placeholder.player,
        character: cast[i] ?? 1,
        clock: 0,
        length: s.length,
        over: -1,
      };
      show.actors.push(actor);
      this.beginActor(show, actor, phases[i] ?? 0);
    });
    // The camera starts on the runner that has just set off.
    show.focus = Math.max(
      0,
      show.actors.findIndex((a) => a.clock === 0),
    );
    show.camera.reset(show.actors[show.focus]!.runner, level);
    this.show = show;
    this.clock.reset();
    this.age = 0;
    this.leaving = -1;
    this.cutPending = false;
    if (this.still) this.age = FADE_MS;
  }

  /** Distinct characters: the original's ten and the bosses this player has beaten. */
  private cast(count: number): number[] {
    const progress = loadContestProgress();
    const pool: number[] = [];
    for (const skin of this.ctx.skins) pool.push(skin.character);
    for (let levelId = 0; levelId < LEVEL_COUNT; levelId++) {
      const c = bossCharacterFor(levelId, progress);
      if (c !== null && this.ctx.render.skins.has(c)) pool.push(c);
    }
    const out: number[] = [];
    while (out.length < count && pool.length > 0) {
      out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]!);
    }
    return out;
  }
}
