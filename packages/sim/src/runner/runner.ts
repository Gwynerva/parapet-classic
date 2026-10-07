/**
 * State of one runner (the player or a rival). Port of class `e` plus the per-entity globals
 * the original kept in arrays indexed by entity (`J`, `K`, probes, lookahead probe).
 * Field comments give the original obfuscated name.
 */
import { Probe } from '../collision/probe.ts';
import type { ScoreState } from '../scoring.ts';

export const DEFAULT_HANDS_DY = -1536;
export const DEFAULT_GRAVITY = 8800;

export class RunnerState {
  /** Feet position in world units (`k`, `l`). */
  x = 0;
  y = 0;
  /** Hands/head offset from the feet (`g`, `h`); standing is (0, -1536). */
  handsDx = 0;
  handsDy = DEFAULT_HANDS_DY;
  /** Per-step deltas applied to the hands offset (`e`, `f`) and to the feet (`i`, `j`). */
  handsDeltaX = 0;
  handsDeltaY = 0;
  rootDeltaX = 0;
  rootDeltaY = 0;
  /** Velocity in units per 1024 time units (`q`, `r`). */
  vx = 0;
  vy = 0;
  /** Velocity at the start of the step (`u`, `v`). */
  prevVx = 0;
  prevVy = 0;
  /** Unused by the physics but part of the rival snapshot (`s`). */
  spare = 0;
  /** Stored tangential speed (`t`). */
  tangentSpeed = 0;
  /** Render coordinates (`m`, `n`, `o`, `p`). */
  renderHandsDx = 0;
  renderHandsDy = DEFAULT_HANDS_DY;
  renderX = 0;
  renderY = 0;
  /** Sub-step time accumulator (`var_int_a`). */
  subStepAcc = 0;
  /** Index of the contact probe: 0 hands, 1 body, 2 feet (`var_int_b`). */
  contactProbe = 0;
  /** Constant acceleration applied while airborne (`var_int_c`, `var_int_d`). */
  accelX = 0;
  accelY = DEFAULT_GRAVITY;
  /** Hands are pinned to a point (`var_boolean_a`). */
  handsPinned = false;
  /** Facing (`var_boolean_b`). */
  facingRight = true;
  /** The anchor is the hands point instead of the feet (`var_boolean_c`, move flag 0x1). */
  handsAnchored = false;
  /** Facing is locked (`var_boolean_d`, move flag 0x10). */
  facingLocked = false;
  /** Snap / root-motion type (`x`) and its scratch value (`y`). */
  snapType = 0;
  snapY = 0;
  /** Impulse type (`z`) and parameters (`A`, `B`, `C`, `D`). */
  impulseType = 0;
  paramA = 0;
  paramB = 0;
  paramC = 0;
  paramD = 0;
  /** Time in the current phase and the phase duration (`E`, `F`). */
  phaseTime = 0;
  phaseDuration = 0;
  /** Scratch values of the impulse types (`G`, `H`, `I`, `J`). */
  scratchG = 0;
  scratchH = 0;
  scratchI = 0;
  scratchJ = 0;
  /** Pending impulse (`K`, `L`) and the acceleration applied this step (`M`, `N`). */
  impulseX = 0;
  impulseY = 0;
  accX = 0;
  accY = 0;
  /** Jump power regeneration timers 0..65536 (`O`, `P`). */
  jumpPowerA = 65536;
  jumpPowerB = 65536;
  /** Presses buffered since entering the current move (`Q`). */
  inputBuffer = 0;
  /** Speed stored on entering a move with flag 0x8000 (`w`). */
  storedSpeed = 0;

  // ---- per-entity engine state kept in global arrays by the original ----

  /** Current move (`var_int_arr_J[ax]`). */
  moveId = 0;
  /** Move timer (`var_int_arr_K[ax]`). */
  moveTimer = 0;
  /** Presses applied on this step (`bB` while this runner is stepped). */
  pressedBits = 0;
  /** Probes: 0 hands, 1 body, 2 feet (`var_c_arr_a[3*ax + i]`). */
  readonly probes: [Probe, Probe, Probe] = [new Probe(true), new Probe(), new Probe()];
  /** Lookahead ray probe (`var_c_a`). */
  readonly lookahead = new Probe();
  /** Bits of notable moves performed (`bC`), used by challenge missions. */
  moveBits = 0;
  /** Incremented on every move entry so that renderers can restart animations. */
  moveEntryCount = 0;
  /** Score state; only the human player is scored in the original. */
  score: ScoreState | null = null;

  /** Reset to the spawn state (`aJ`, line 7573). */
  spawn(x: number, y: number, facingRight: boolean): void {
    this.contactProbe = 0;
    for (const p of this.probes) {
      p.reset();
    }
    this.probes[0].isHands = true;
    this.probes[1].isHands = false;
    this.probes[2].isHands = false;
    this.lookahead.reset();
    this.subStepAcc = 0;
    this.accelX = 0;
    this.accelY = DEFAULT_GRAVITY;
    this.handsPinned = false;
    this.handsDeltaX = 0;
    this.handsDeltaY = 0;
    this.handsDx = 0;
    this.handsDy = DEFAULT_HANDS_DY;
    this.x = x;
    this.y = y;
    this.renderX = x;
    this.renderY = y;
    this.renderHandsDx = this.handsDx;
    this.renderHandsDy = this.handsDy;
    this.rootDeltaX = 0;
    this.rootDeltaY = 0;
    this.vx = 0;
    this.vy = 0;
    this.spare = 0;
    this.tangentSpeed = 0;
    this.prevVx = 0;
    this.prevVy = 0;
    this.facingRight = facingRight;
    this.handsAnchored = false;
    this.snapType = 0;
    this.impulseType = 0;
    this.paramB = 0;
    this.paramC = 0;
    this.paramD = 0;
    this.phaseTime = 0;
    this.phaseDuration = 0;
    this.scratchG = 0;
    this.scratchH = 0;
    this.scratchI = 0;
    this.scratchJ = 0;
    this.impulseX = 0;
    this.impulseY = 0;
    this.accX = 0;
    this.accY = 0;
    this.jumpPowerA = 65536;
    this.jumpPowerB = 65536;
    this.facingLocked = false;
    this.inputBuffer = 0;
    this.paramA = 0;
    this.snapY = 0;
    this.storedSpeed = 0;
    this.moveId = 0;
    this.moveTimer = 0;
    this.pressedBits = 0;
    this.moveBits = 0;
  }

  copyFrom(o: RunnerState): void {
    this.x = o.x;
    this.y = o.y;
    this.handsDx = o.handsDx;
    this.handsDy = o.handsDy;
    this.handsDeltaX = o.handsDeltaX;
    this.handsDeltaY = o.handsDeltaY;
    this.rootDeltaX = o.rootDeltaX;
    this.rootDeltaY = o.rootDeltaY;
    this.vx = o.vx;
    this.vy = o.vy;
    this.prevVx = o.prevVx;
    this.prevVy = o.prevVy;
    this.spare = o.spare;
    this.tangentSpeed = o.tangentSpeed;
    this.renderHandsDx = o.renderHandsDx;
    this.renderHandsDy = o.renderHandsDy;
    this.renderX = o.renderX;
    this.renderY = o.renderY;
    this.subStepAcc = o.subStepAcc;
    this.contactProbe = o.contactProbe;
    this.accelX = o.accelX;
    this.accelY = o.accelY;
    this.handsPinned = o.handsPinned;
    this.facingRight = o.facingRight;
    this.handsAnchored = o.handsAnchored;
    this.facingLocked = o.facingLocked;
    this.snapType = o.snapType;
    this.snapY = o.snapY;
    this.impulseType = o.impulseType;
    this.paramA = o.paramA;
    this.paramB = o.paramB;
    this.paramC = o.paramC;
    this.paramD = o.paramD;
    this.phaseTime = o.phaseTime;
    this.phaseDuration = o.phaseDuration;
    this.scratchG = o.scratchG;
    this.scratchH = o.scratchH;
    this.scratchI = o.scratchI;
    this.scratchJ = o.scratchJ;
    this.impulseX = o.impulseX;
    this.impulseY = o.impulseY;
    this.accX = o.accX;
    this.accY = o.accY;
    this.jumpPowerA = o.jumpPowerA;
    this.jumpPowerB = o.jumpPowerB;
    this.inputBuffer = o.inputBuffer;
    this.storedSpeed = o.storedSpeed;
    this.moveId = o.moveId;
    this.moveTimer = o.moveTimer;
    this.pressedBits = o.pressedBits;
    for (let i = 0; i < 3; i++) {
      this.probes[i]!.copyFrom(o.probes[i]!);
    }
    this.lookahead.copyFrom(o.lookahead);
    this.moveBits = o.moveBits;
    this.moveEntryCount = o.moveEntryCount;
    if (o.score) {
      if (!this.score) this.score = o.score.clone();
      else this.score.copyFrom(o.score);
    } else {
      this.score = null;
    }
  }

  clone(): RunnerState {
    const r = new RunnerState();
    r.copyFrom(this);
    return r;
  }
}
