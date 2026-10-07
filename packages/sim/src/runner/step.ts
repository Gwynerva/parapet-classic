/**
 * One simulation step of a runner. Port of `int_m(int)` (d.java line 7656) together with the
 * probe sweep `c(e,int)` (8457), move entry `O(int)` (9239) and the transition/timer update
 * `boolean_h(int)` (9321).
 */
import { approxLength, imin, isqrt } from '../math/int.ts';
import type { Level } from '../level/level.ts';
import { rayMarch } from '../collision/raymarch.ts';
import type { PhysicsTables } from '../tables.ts';
import { evalCondition, isOnSurface, type ConditionContext } from './conditions.ts';
import { applyImpulse } from './impulses.ts';
import { ChallengeBit, MoveFlag, MoveId, type MoveDef, type MoveTable } from './moves.ts';
import { advancePhase, applyRootMotion, initImpulse, snapOnEntry } from './rootMotion.ts';
import type { RunnerState } from './runner.ts';

export const STEP = 30;

/** Surface types that respond like a wall or ceiling: keep only the tangential velocity. */
function isWallLike(k: number): boolean {
  return k === 17 || k === 14 || k === 9 || k === 8 || k === 12 || k === 11;
}

export interface StepContext extends ConditionContext {
  level: Level;
  tables: PhysicsTables;
  moves: MoveTable;
  sine: Int16Array;
  /** Game clock in time units, used by scoring. */
  clock: number;
  /** Events emitted during the step (move entries, dust, fails). */
  events: SimEvent[];
}

export interface MoveEntrySnapshot {
  facingRight: boolean;
  handsAnchored: boolean;
  renderX: number;
  renderY: number;
  renderHandsDx: number;
  renderHandsDy: number;
  vx: number;
  vy: number;
  prevVx: number;
  prevVy: number;
}

export type SimEvent =
  | {
      type: 'move';
      runner: RunnerState;
      from: number;
      to: number;
      /** Move timer assigned at entry (`int_p`), before the stored speed may change. */
      timer: number;
      /** Runner fields as they were at entry: the facing flip, anchor change and render
       *  positions of this step happen after the move is entered, and the original sets up
       *  the animation at entry time. */
      entry: MoveEntrySnapshot;
    }
  | { type: 'dust'; runner: RunnerState; x: number; y: number }
  | { type: 'fail'; runner: RunnerState }
  | { type: 'pit'; runner: RunnerState };

/** Moves whose entry spawns a dust puff at the feet (`O`, line 9253). */
const DUST_MOVES = new Set([24, 25, 29, 41, 54, 76, 82, 89]);
/** Moves that set a bit in `moveBits` (challenge tracking), move id → bit. */
const MOVE_BIT: Record<number, number> = {
  [MoveId.TIC_TAC_JUMP]: ChallengeBit.TIC_TAC_JUMP,
  [MoveId.WALL_FLIP]: ChallengeBit.WALL_FLIP,
  67: ChallengeBit.SPIDER_JUMP,
  [MoveId.MONKEY_VAULT]: ChallengeBit.MONKEY_VAULT,
  69: ChallengeBit.MONKEY_FLIP,
  [MoveId.POLE_JUMP]: ChallengeBit.POLE_JUMP,
  [MoveId.POLE_SPIN]: ChallengeBit.POLE_SPIN,
};

/** `int_p(int)`: duration of a move, -1 meaning `100 + (storedSpeed >> 3)`. */
export function moveDuration(r: RunnerState, m: MoveDef): number {
  return m.duration >= 0 ? m.duration : 100 + (r.storedSpeed >> 3);
}

/** `O(int)`: enter a move. */
export function enterMove(r: RunnerState, ctx: StepContext, id: number): void {
  const old = ctx.moves.get(r.moveId);
  if (r.score && (old.scoreType === 1 || old.scoreType === 3)) {
    r.score.pay(old.points, old.scoreType === 3, ctx.clock);
  }
  if (DUST_MOVES.has(id)) {
    ctx.events.push({ type: 'dust', runner: r, x: r.x, y: r.y });
  }
  const bit = MOVE_BIT[id];
  if (bit !== undefined) {
    r.moveBits |= bit;
  }
  const from = r.moveId;
  r.moveId = id;
  r.moveEntryCount++;
  const m = ctx.moves.get(id);
  r.moveTimer = moveDuration(r, m);
  ctx.events.push({
    type: 'move',
    runner: r,
    from,
    to: id,
    timer: r.moveTimer,
    entry: {
      facingRight: r.facingRight,
      handsAnchored: r.handsAnchored,
      renderX: r.renderX,
      renderY: r.renderY,
      renderHandsDx: r.renderHandsDx,
      renderHandsDy: r.renderHandsDy,
      vx: r.vx,
      vy: r.vy,
      prevVx: r.prevVx,
      prevVy: r.prevVy,
    },
  });
  if ((m.flags & MoveFlag.STORE_SPEED) !== 0) {
    r.storedSpeed = r.prevVy;
  }
  if (r.score && m.scoreType !== -1) {
    switch (m.scoreType) {
      case 0:
        ctx.events.push({ type: 'fail', runner: r });
        r.score.fail();
        return;
      case 2:
      case 5:
        r.score.setContinuous(m.points, id, ctx.clock);
        r.score.resetChainFactor();
        return;
      case 4:
        r.score.resetChainFactor();
        return;
      default:
        return;
    }
  }
}

/**
 * `boolean_h(int)`: check the transitions of the current move and its parents, then the
 * timer. Returns true when a move was entered.
 */
export function updateTransitions(r: RunnerState, ctx: StepContext, dt: number): boolean {
  let id = r.moveId;
  while (id !== -1) {
    const m = ctx.moves.get(id);
    for (const t of m.transitions) {
      let ok = true;
      for (const c of t.conditions) {
        if (!evalCondition(r, ctx, c)) {
          ok = false;
          break;
        }
      }
      if (ok) {
        enterMove(r, ctx, t.target);
        return true;
      }
    }
    id = m.parent;
  }
  if (r.moveTimer !== -1) {
    r.moveTimer = r.moveTimer - dt >= 0 ? r.moveTimer - dt : -2;
    const m = ctx.moves.get(r.moveId);
    if (r.moveTimer === -2 && m.next !== -1) {
      enterMove(r, ctx, m.next);
      return true;
    }
  }
  return false;
}

/** `c(e,int)`: sweep the three probes along this step's motion. */
export function sweepProbes(r: RunnerState, ctx: StepContext, dt: number): void {
  const [hands, body, feet] = r.probes;
  const flags = ctx.moves.get(r.moveId).flags;
  const endX = r.x + r.rootDeltaX + (((r.vx * dt) / 1024) | 0);
  const endY = r.y + r.rootDeltaY + (((r.vy * dt) / 1024) | 0);
  if ((flags & MoveFlag.NO_COLLISION) === 0) {
    const hdx = r.handsDx + r.handsDeltaX;
    const hdy = r.handsDy + r.handsDeltaY;
    const bdx = (hdx / 2) | 0;
    const bdy = (hdy / 2) | 0;
    let allProbes = true;
    if ((flags & MoveFlag.SINGLE_PROBE) === 0) {
      feet.hit = rayMarch(
        ctx.level,
        ctx.tables,
        feet,
        r.x,
        r.y,
        endX,
        endY,
        !r.handsAnchored,
        true,
        false,
        r.facingRight,
      );
      body.hit = rayMarch(
        ctx.level,
        ctx.tables,
        body,
        r.x + ((r.handsDx / 2) | 0),
        r.y + ((r.handsDy / 2) | 0),
        endX + bdx,
        endY + bdy,
        false,
        false,
        true,
        r.facingRight,
      );
      hands.hit =
        !r.handsPinned &&
        rayMarch(
          ctx.level,
          ctx.tables,
          hands,
          r.x + r.handsDx,
          r.y + r.handsDy,
          endX + hdx,
          endY + hdy,
          r.handsAnchored,
          false,
          false,
          r.facingRight,
        );
    } else if (r.handsAnchored) {
      feet.hit = false;
      body.hit = false;
      hands.hit =
        !r.handsPinned &&
        rayMarch(
          ctx.level,
          ctx.tables,
          hands,
          r.x + r.handsDx,
          r.y + r.handsDy,
          endX + hdx,
          endY + hdy,
          true,
          false,
          false,
          r.facingRight,
        );
    } else {
      feet.hit = rayMarch(
        ctx.level,
        ctx.tables,
        feet,
        r.x,
        r.y,
        endX,
        endY,
        true,
        true,
        false,
        r.facingRight,
      );
      body.hit = false;
      hands.hit = false;
      allProbes = false;
    }
    if ((flags & MoveFlag.LEDGE_PROBE) !== 0 && !hands.hit && !r.handsPinned && allProbes) {
      hands.hit = rayMarch(
        ctx.level,
        ctx.tables,
        hands,
        r.x + r.handsDx,
        r.y + r.handsDy,
        endX + hdx + (r.facingRight ? 32 : -32),
        endY + hdy,
        r.handsAnchored,
        false,
        false,
        r.facingRight,
      );
      if ((hands.hit && hands.surface !== 11 && hands.surface !== 12) || hands.tile === 1) {
        hands.hit = false;
      }
    }
  } else {
    feet.hit = false;
    body.hit = false;
    hands.hit = false;
  }
  if (feet.hit) {
    const dx = r.x - feet.px;
    const dy = r.y - feet.py;
    feet.distSq = dx * dx + dy * dy;
  }
  if (body.hit) {
    const dx = r.x + ((r.handsDx / 2) | 0) - body.px;
    const dy = r.y + ((r.handsDy / 2) | 0) - body.py;
    body.distSq = dx * dx + dy * dy;
  }
  if (hands.hit) {
    const dx = r.x + r.handsDx - hands.px;
    const dy = r.y + r.handsDy - hands.py;
    hands.distSq = dx * dx + dy * dy;
  }
}

/**
 * `int_m(int)`: advance one runner by `dt` time units (always 30 in practice). Returns the
 * number of units consumed, like the original.
 */
export function stepRunner(r: RunnerState, ctx: StepContext, dt: number): number {
  const [hands, body, feet] = r.probes;
  let fullStep = false;
  let detached = false;
  r.inputBuffer |= r.pressedBits;
  r.prevVx = r.vx;
  r.prevVy = r.vy;
  r.subStepAcc += dt;
  let sub: number;
  if (r.subStepAcc >= 30) {
    sub = 30;
    r.subStepAcc -= 30;
    fullStep = true;
  } else {
    sub = r.subStepAcc;
    fullStep = false;
  }
  sweepProbes(r, ctx, sub);
  let freeMove = false;
  const oldX = r.x;
  const oldY = r.y;
  if (hands.hit || body.hit || feet.hit) {
    let respond = 1;
    if (
      hands.hit &&
      (!feet.hit ||
        hands.distSq < feet.distSq ||
        (!r.handsAnchored && hands.distSq === feet.distSq))
    ) {
      if (hands.surface !== 0) {
        if (hands.surface !== 15 && hands.surface !== 16) {
          r.contactProbe = 0;
          r.x = hands.px + hands.pushX - r.handsDx;
          r.y = hands.py + hands.pushY - r.handsDy;
          feet.surface = 0;
        } else {
          r.x = hands.px + hands.pushX - r.handsDx;
          r.y = hands.py + hands.pushY - r.handsDy;
          respond = 0;
        }
      } else {
        freeMove = true;
        respond = 0;
      }
    } else if (
      feet.hit &&
      ((isOnSurface(r) && (!body.hit || feet.distSq < body.distSq)) || !isOnSurface(r))
    ) {
      if (feet.surface !== 0) {
        r.contactProbe = 2;
        r.x = feet.px + feet.pushX;
        r.y = feet.py + feet.pushY;
        hands.surface = 0;
      } else {
        freeMove = true;
        respond = 0;
      }
    } else {
      r.contactProbe = 1;
      r.x = body.px + body.pushX - ((r.handsDx / 2) | 0);
      r.y = body.py + body.pushY - ((r.handsDy / 2) | 0);
      feet.surface = 0;
      hands.surface = 0;
    }
    if (respond !== 0) {
      const c = r.probes[r.contactProbe]!;
      if (isWallLike(c.surface)) {
        const along = ((r.vx * -c.ny + r.vy * c.nx) / 1024) | 0;
        r.vx = ((-along * c.ny) / 1024) | 0;
        r.vy = ((along * c.nx) / 1024) | 0;
        r.tangentSpeed = -r.tangentSpeed;
      } else {
        r.vx = ((r.tangentSpeed * -c.ny + 0) / 1024) | 0;
        r.vy = ((0 + r.tangentSpeed * c.nx) / 1024) | 0;
      }
    }
    fullStep = true;
  } else if (fullStep && !r.handsPinned && isOnSurface(r)) {
    const c = r.handsAnchored ? hands : feet;
    const slope = ctx.tables.G[c.surface]!;
    const baseX = r.handsAnchored ? c.px + c.pushX - r.handsDx - r.handsDeltaX : c.px + c.pushX;
    const baseY = r.handsAnchored ? c.py + c.pushY - r.handsDy - r.handsDeltaY : c.py + c.pushY;
    const cc = r.probes[r.contactProbe]!;
    if (
      r.handsAnchored &&
      (cc.surface === 11 || cc.surface === 12 || hands.surface === 8 || hands.surface === 9)
    ) {
      r.y += r.rootDeltaY + (((r.vy * sub) / 1024) | 0);
      r.x = baseX;
    } else {
      r.x += r.rootDeltaX + (((r.vx * sub) / 1024) | 0);
      r.y = (((slope * (r.x - baseX)) / 1024) | 0) + baseY;
    }
    r.handsDx += r.handsDeltaX;
    r.handsDy += r.handsDeltaY;
    r.contactProbe = r.handsAnchored ? 0 : 2;
  } else if (fullStep) {
    freeMove = true;
  }
  if (freeMove) {
    r.x += r.rootDeltaX + (((r.vx * sub) / 1024) | 0);
    r.y += r.rootDeltaY + (((r.vy * sub) / 1024) | 0);
    r.handsDx += r.handsDeltaX;
    r.handsDy += r.handsDeltaY;
  }
  if (fullStep) {
    if (r.handsPinned) {
      r.handsDx -= r.x - oldX;
      r.handsDy -= r.y - oldY;
    }
    r.rootDeltaX = 0;
    r.rootDeltaY = 0;
    r.handsDeltaX = 0;
    r.handsDeltaY = 0;
  }
  if (isOnSurface(r)) {
    r.jumpPowerB = 65536;
  }
  let flags = ctx.moves.get(r.moveId).flags;
  const timerDt = r.moveTimer > 0 && r.moveTimer < dt ? r.moveTimer : dt;
  do {
    if (updateTransitions(r, ctx, timerDt)) {
      const m = ctx.moves.get(r.moveId);
      flags = m.flags;
      if (r.facingLocked && (flags & MoveFlag.FACE_AGAINST_VELOCITY) === 0) {
        r.facingRight = !r.facingRight;
      }
      r.facingLocked = (flags & MoveFlag.LOCK_FACING) !== 0;
      r.inputBuffer = (flags & MoveFlag.KEEP_BUFFER) !== 0 ? r.inputBuffer : 0;
      snapOnEntry(r, m.snapType);
      initImpulse(r, m.impulseType, m.paramB, m.paramC, m.paramD, moveDuration(r, m));
      r.handsAnchored = (flags & MoveFlag.HANDS) !== 0;
      fullStep = true;
    }
    r.jumpPowerA += 20 * dt;
    if (r.jumpPowerA > 65536) {
      r.jumpPowerA = 65536;
    }
    r.jumpPowerB += 11 * dt;
    if (r.jumpPowerB > 65536) {
      r.jumpPowerB = 65536;
    }
    if (r.moveTimer === 0 || fullStep) {
      applyRootMotion(r, r.snapType, 30, ctx.sine);
      applyImpulse(r, r.impulseType, 30, 30);
      advancePhase(r, 30);
      // `(flags & 4) == 1` in the original never holds, so flag 0x4 is dead.
      if ((flags & MoveFlag.FORCE_GRAVITY) !== 0 || !isOnSurface(r)) {
        hands.surface = 0;
        feet.surface = 0;
        detached = true;
      }
      let ax = r.accX + (detached ? ((r.accelX * 30) / 1024) | 0 : 0);
      let ay = r.accY + (detached ? ((r.accelY * 30) / 1024) | 0 : 0);
      if (isOnSurface(r)) {
        const speed = approxLength(r.vx, r.vy);
        const c = r.probes[r.contactProbe]!;
        const cls = ctx.tables.C[c.surface]!;
        const down = r.vy > 0 ? 1 : 0;
        const scale = ctx.tables.E[cls + (1 - down)]!;
        const cap = ((3400 * scale) / 1024) | 0;
        if ((((r.vx * r.accX + r.vy * r.accY) / 1024) | 0) > 0) {
          if (speed > cap) {
            const brake = ctx.tables.D[cls >> 1]!;
            ax -= ((brake * r.vx) / speed) | 0;
            ay -= ((brake * r.vy) / speed) | 0;
          } else {
            const bucket = (cap / 12) | 0;
            const idx = imin((speed / bucket) | 0, 11);
            ax = ((ax * ctx.tables.F[idx]!) / 1024) | 0;
            ay = ((ay * ctx.tables.F[idx]!) / 1024) | 0;
          }
        }
      }
      r.vx += ax;
      r.vy += ay;
      if (isOnSurface(r)) {
        const sq = r.vx * r.vx + r.vy * r.vy;
        const c = r.probes[r.contactProbe]!;
        const limit = c.ny === -1024 ? 3400 : Math.abs(c.nx) === 1024 ? 5250 : 4000;
        if (sq > limit * limit) {
          const len = isqrt(sq);
          r.vx = ((r.vx * limit) / len) | 0;
          r.vy = ((r.vy * limit) / len) | 0;
        }
      } else if (r.vy > 17300) {
        r.vy = 17300;
      }
      r.tangentSpeed = r.vx;
      if (!r.facingLocked) {
        if (!r.handsPinned) {
          if (r.vx > 0) r.facingRight = true;
          else if (r.vx < 0) r.facingRight = false;
        }
      }
      if ((flags & MoveFlag.FACE_AGAINST_VELOCITY) !== 0 && !r.facingLocked) {
        r.facingRight = !r.facingRight;
      }
    }
    if (fullStep) {
      r.renderHandsDx = r.handsDx;
      r.renderHandsDy = r.handsDy;
      r.renderX = r.x;
      r.renderY = r.y;
    } else {
      r.renderHandsDx = r.handsDx + (((r.handsDeltaX * sub) / 30) | 0);
      r.renderHandsDy = r.handsDy + (((r.handsDeltaY * sub) / 30) | 0);
      r.renderX = r.x + (((r.rootDeltaX * sub) / 30) | 0) + (((r.vx * sub) / 1024) | 0);
      r.renderY = r.y + (((r.rootDeltaY * sub) / 30) | 0) + (((r.vy * sub) / 1024) | 0);
    }
    const killY = ctx.level.killRows[r.renderX >> 10]! << 10;
    if (r.renderY + r.renderHandsDy > killY + 2048) {
      r.y = killY - 2048;
      r.renderY = killY - 2048;
      ctx.events.push({ type: 'pit', runner: r });
      enterMove(r, ctx, 11);
    }
  } while (moveDuration(r, ctx.moves.get(r.moveId)) === 0 && ctx.moves.get(r.moveId).next !== -1);
  return dt !== 0 ? dt : 1;
}
