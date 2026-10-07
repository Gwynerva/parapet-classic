/**
 * Phases of a mission around the simulation, after the original's screen states 1-5
 * (d.java `x()`, line 5246): the tutorial pages of a warm-up, the briefing box, the Sprint
 * flyover, "get ready", play. The flow only sequences; the host (a play screen) shows the
 * boxes, moves the camera and lets the session step once `phase` is `play`. Any app that runs
 * a mission (the classic game, a gate run in the open world) drives it the same way.
 */

export type FlowPhase = 'tutorial' | 'briefing' | 'flyover' | 'ready' | 'play' | 'done';

export interface FlowConfig {
  /** Tutorial pages shown one box at a time before the briefing phase (warm-ups: 3). */
  tutorialPages: number;
  /** Whether a briefing box precedes the run. */
  briefing: boolean;
  /** Whether the camera tours the route before the run (Sprint). */
  flyover: boolean;
  /** Length of the "get ready" banner before the first step, in ms. */
  readyMs: number;
}

export class MissionFlow {
  phase: FlowPhase = 'done';
  tutorialPage = 0;
  /** Milliseconds left of the "get ready" banner. */
  readyLeft = 0;
  private readonly cfg: FlowConfig;
  private readonly hints = new Set<number>();

  constructor(cfg: FlowConfig) {
    this.cfg = cfg;
    this.reset();
  }

  /** Back to the first phase of a fresh attempt (also forgets the hints shown). */
  reset(): void {
    this.tutorialPage = 0;
    this.hints.clear();
    if (this.cfg.tutorialPages > 0) this.enter('tutorial');
    else if (this.cfg.briefing) this.enter('briefing');
    else this.enter(this.afterBriefing());
  }

  get playing(): boolean {
    return this.phase === 'play';
  }

  /** Whether the simulation is frozen (every phase before play, and after it ended). */
  get frozen(): boolean {
    return this.phase !== 'play';
  }

  /** The current box closed, or the flyover was confirmed. Returns the new phase. */
  advance(): FlowPhase {
    switch (this.phase) {
      case 'tutorial':
        if (this.tutorialPage + 1 < this.cfg.tutorialPages) this.tutorialPage++;
        else this.enter(this.afterBriefing());
        break;
      case 'briefing':
        this.enter(this.afterBriefing());
        break;
      case 'flyover':
        this.enter('ready');
        break;
      case 'ready':
        this.enter('play');
        break;
      default:
        break;
    }
    return this.phase;
  }

  /** Count the "get ready" banner down; returns true on the frame play begins. */
  tickReady(dtMs: number): boolean {
    if (this.phase !== 'ready') return false;
    this.readyLeft -= dtMs;
    if (this.readyLeft > 0) return false;
    this.enter('play');
    return true;
  }

  /** The run ended. */
  finish(): void {
    this.phase = 'done';
  }

  /** In-play hints show once per attempt (`bN` bits): true the first time `key` is claimed. */
  claimHint(key: number): boolean {
    if (this.hints.has(key)) return false;
    this.hints.add(key);
    return true;
  }

  private afterBriefing(): FlowPhase {
    return this.cfg.flyover ? 'flyover' : 'ready';
  }

  private enter(phase: FlowPhase): void {
    this.phase = phase;
    if (phase === 'ready') this.readyLeft = this.cfg.readyMs;
  }
}
