/**
 * Score, flow meter and multiplier. Port of class `f` and the functions `void_a(int,boolean)`
 * (pay points, line 7408), `j(int,int)` (continuous points, 7434), `aB` (7404), `aC` (7442),
 * `aD` (7457), `aE` (7464), `aF` (fail, 7480), `aG` (per-step, 7496), `L` (meter up, 7267),
 * `av` (meter down, 7278) and `M` (popup, 7384).
 */

export interface ScorePopup {
  /** Game clock at which the popup expires. */
  until: number;
  value: number;
}

export class ScoreState {
  /** Total score (`var_int_a`). */
  score = 0;
  /** Multiplier 1, 2, 4, 6, 8 or 10 (`var_int_b`). */
  multiplier = 1;
  /** Chain of trick values for the popup display (`var_int_arr_a`, 8 slots). */
  readonly chain = new Int32Array(8);
  /** Chain write index (`c`). */
  chainIndex = 0;
  /** Points per step of the active continuous move (`d`) and that move's id (`e`). */
  continuous = 0;
  continuousMove = 0;
  /** Clock stamp of the last chain change, -1 = none (`f`). */
  chainTime = -1;
  /** Penalty computed on fails but never applied by the original (`g`). */
  penalty = 0;
  /** Chain factor applied to exit points (`h`). */
  chainFactor = 1;
  /** Points pending until the next step (`i`). */
  pending = 0;
  /** Flow meter 0..5120 (`bz`). */
  meter = 0;
  /** Meter flash timer for the HUD (`bA`). */
  meterFlash = 0;
  /** Popup ring (`var_int_arr_b`, `j`). */
  readonly popups: ScorePopup[] = [];
  popupCount = 0;

  /** `aA` (line 7394): reset at run start. */
  reset(): void {
    this.score = 0;
    this.multiplier = 1;
    this.chainIndex = 0;
    this.continuous = 0;
    this.chainTime = -1;
    this.chainFactor = 1;
    this.pending = 0;
    this.chain.fill(0);
    this.penalty = 0;
    this.meter = 0;
    this.meterFlash = 0;
    this.popups.length = 0;
    this.popupCount = 0;
  }

  /** `M(int)`: queue a popup. */
  private popup(value: number, clock: number): void {
    if (value === 0) return;
    const slot = this.popupCount % 8;
    this.popups[slot] = { until: clock + 3000, value };
    this.popupCount++;
  }

  /** `void_a(int,boolean)`: pay exit points of a move. `withPopup` = scoring type 3. */
  pay(points: number, withPopup: boolean, clock: number): void {
    if (this.continuous !== 0) {
      this.popup(this.chain[this.chainIndex]!, clock);
    } else if (this.chainIndex > 0) {
      this.popup(this.chain[this.chainIndex - 1]!, clock);
    }
    if (this.continuous !== 0) {
      this.advanceChain(clock);
    }
    this.chainTime = clock;
    this.chain[this.chainIndex++] = points * this.chainFactor;
    if (this.chainIndex === 8) {
      this.chainIndex = 1;
      this.chain[0] = this.chain[7]!;
      for (let i = 1; i < 8; i++) {
        this.chain[i] = 0;
      }
    }
    if (withPopup) {
      this.chainFactor++;
    }
    this.pending += points;
  }

  /** `j(int,int)`: start a continuous-points move. */
  setContinuous(pointsPerStep: number, moveId: number, clock: number): void {
    if (this.chainIndex > 0 && this.continuous === 0 && pointsPerStep > 0) {
      this.popup(this.chain[this.chainIndex - 1]!, clock);
    }
    this.continuous = pointsPerStep;
    this.continuousMove = moveId;
  }

  /** `aB`: reset the chain factor. */
  resetChainFactor(): void {
    this.chainFactor = 1;
  }

  /** `aC`: close the current chain slot. */
  advanceChain(clock: number): void {
    this.chainTime = clock;
    this.chainIndex++;
    this.continuous = 0;
    if (this.chainIndex === 8) {
      this.chainIndex = 1;
      this.chain[0] = this.chain[7]!;
      for (let i = 1; i < 8; i++) {
        this.chain[i] = 0;
      }
    }
  }

  /** `aD`: multiplier from the meter: 1, 2, 4, 6, 8, 10. */
  updateMultiplier(): void {
    this.multiplier = (this.meter >> 10) + 1;
    if (this.multiplier > 2) {
      this.multiplier = (this.multiplier - 1) << 1;
    }
  }

  /** `aE`: chain timed out. */
  private resetChain(clock: number): void {
    this.advanceChain(clock);
    this.penalty = 0;
    for (let i = 0; i < this.chainIndex; i++) {
      this.chain[i] = 0;
    }
  }

  /** `L(int)`: raise the meter. */
  addMeter(amount: number): void {
    if ((this.meter + amount) >> 10 > this.meter >> 10) {
      this.meterFlash = 400;
    }
    this.meter += amount;
    if (this.meter > 5120) {
      this.meter = 5120;
    }
    this.updateMultiplier();
  }

  /** `av`: drop the meter by 2048. */
  private dropMeter(): void {
    if (this.meter >> 10 > (this.meter - 2048) >> 10) {
      this.meterFlash = -400;
    }
    this.meter -= 2048;
    if (this.meter < 0) {
      this.meter = 0;
    }
    this.updateMultiplier();
  }

  /** `aF`: a fail move was entered. Pending points are lost and the meter drops. */
  fail(): void {
    this.penalty = 0;
    for (let i = 0; i < this.chainIndex; i++) {
      this.penalty -= this.chain[i]! * this.multiplier;
      this.chain[i] = 0;
    }
    this.chainIndex = 0;
    this.continuous = 0;
    this.chainTime = -1;
    this.pending = 0;
    this.resetChainFactor();
    this.dropMeter();
  }

  /**
   * `aG`: per-step update after the player's physics step. `moveId` is the runner's current
   * move, `risingOnly` tells whether the continuous move only scores while rising (type 5)
   * and `vy` the runner's vertical velocity.
   */
  step(moveId: number, risingOnly: boolean, vy: number, clock: number): void {
    if (this.continuous > 0) {
      if (moveId !== this.continuousMove) {
        this.advanceChain(clock);
      } else if (!risingOnly || vy < 0) {
        this.chain[this.chainIndex] = this.chain[this.chainIndex]! + this.continuous;
        this.score += this.continuous * this.multiplier;
        if (this.chainTime === -1) {
          this.chainTime = clock;
        }
      }
    } else if (this.pending > 0) {
      this.addMeter((this.pending * 2048) >> 10);
      this.score += this.pending * this.multiplier;
      this.pending = 0;
    }
    if (this.chainTime !== -1 && clock - this.chainTime >= 2000 && this.continuous === 0) {
      this.resetChain(clock);
    }
  }

  copyFrom(o: ScoreState): void {
    this.score = o.score;
    this.multiplier = o.multiplier;
    this.chain.set(o.chain);
    this.chainIndex = o.chainIndex;
    this.continuous = o.continuous;
    this.continuousMove = o.continuousMove;
    this.chainTime = o.chainTime;
    this.penalty = o.penalty;
    this.chainFactor = o.chainFactor;
    this.pending = o.pending;
    this.meter = o.meter;
    this.meterFlash = o.meterFlash;
    this.popups.length = 0;
    for (const p of o.popups) {
      this.popups.push({ until: p.until, value: p.value });
    }
    this.popupCount = o.popupCount;
  }

  clone(): ScoreState {
    const s = new ScoreState();
    s.copyFrom(this);
    return s;
  }
}
