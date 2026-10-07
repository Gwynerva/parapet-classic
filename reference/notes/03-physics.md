# 03. Physics, simulation step, scoring

## Units

- A tile is 1024 units = 32 px (`px = units >> 5`). The screen is 240×320 px = 7.5×10 tiles = 7680×10240 units. Y points down.
- A step is 30 time units. Game time per frame = `realMs * 900 >> 10`, capped at 150 (line 10477), so a step is about 34.1 ms of real time (~29.3 Hz). Velocities are units per 1024 time units: `pos += v * 30 / 1024` per step.
- All arithmetic is Java `int`: division truncates toward zero, overflow wraps at 32 bits. There are no floats in the constant pool.
- Determinism: `Random` is used only in cutscenes and particles (lines 4429–4452, 5756, 10578).

## Entity (class `e`)

The body is a feet point `(k, l)` plus a hands offset `(g, h)`; standing is `(0, −1536)` (1.5 tiles tall). Velocity `(q, r)`, previous velocity `(u, v)`, stored tangential speed `t`. Per-step deltas `(e, f)` for the hands and `(i, j)` for the feet come from x-types (root motion) and are zeroed after use. `(m, n, o, p)` are the interpolated render coordinates. Timers `O`, `P` regenerate jump power (grow to 65536). `Q` is the input buffer. `E`, `F` are time in state and phase duration. `K`, `L` → `M`, `N` are impulse and applied acceleration. `w` is the speed stored on entry (flag 0x8000). Flags: `a` hands pinned, `b` facing right, `c` hands-anchored, `d` facing locked.

## One step (`int_m(30)`, line 7656)

The frame loop (`boolean_d`, line 10473) adds `w*900>>10` to `cf` (capped at 150) and runs one step per 30 units. Rivals (indices 0..ay−1) run first, then the player (`ay`). After each player step it calls `aG()` (scoring) and `boolean_c()` (checkpoints). `cg` is the game clock, +30 per step.

1. `Q |= bB`; save `u = q`, `v = r`.
2. **Probes** `c(e, 30)` (line 8457) sweep this step's motion:
   - feet [2]: from `(k, l)` to `(k + i + q*30/1024, l + j + r*30/1024)`;
   - body [1]: from the body midpoint;
   - hands [0]: from `(k+g, l+h)`; skipped when pinned (`e.a`).
     State flags: 0x8 no collision; 0x80 contact probe only; 0x100 extra hands probe 32 units ahead, accepted only on a ledge corner (k 11/12).
3. **Resolve** (lines 7680–7750). Probe choice: hands if it hit and (feet missed, or `g0 < g2`, or `g0 == g2` while not hanging); otherwise feet; otherwise body. Position snaps: `root = contact + (c, d) − probeOffset`; `e.b` records the contact probe index.
   - wall, ledge or ceiling (`k ∈ {8, 9, 11, 12, 14, 17}`): remove the normal component, `v = (v·tangent)·tangent`, set `t = −t`;
   - floor or slope: `q = t·(−f)/1024`, `r = t·e/1024`, where `t` is the previous `q` — **landing keeps only the horizontal speed**;
   - pole (15/16): snap only;
   - no hit but on a surface (`boolean_a(e)`, line 8442): `x += q·dt`, `y = contactY + G[k]·(x − contactX)/1024` — follow the surface line; on a wall/ledge/ladder x is locked and only y moves;
   - otherwise free Euler: `k += i + q·30/1024`, `l += j + r·30/1024`, `g += e`, `h += f`.
     If the hands are pinned, `g, h` compensate so the hands stay fixed. Then `i = j = e = f = 0`.
4. On a surface → `P = 65536`.
5. **Loop** (lines 7766–7897):
   - `boolean_h` checks transitions, then the timer (see 02). On a state change the entry effects apply.
   - regenerate `O += 600`, `P += 330` (each capped at 65536).
   - physics: `void_a(e, x, 30)` (x-type root motion, line 8137); `a(e, z, 30, 30)` (impulse `K,L → M,N`, line 8206); `E = min(E + 30, F)`; gravity `r += 257` (8800·30/1024) if `flags & 2` or not on a surface; soft cap; `q += M`, `r += N`; hard cap; `t = q`; facing: if not locked and not pinned it follows `sign(q)` (unchanged when `q == 0`), then 0x800 flips it.
   - pit safety: if the head is below `(killRow[o>>10] << 10) + 2048`, set `l = p = row − 2048` and enter state 11 (lines 7892–7896).
   - **repeat while the state has duration 0 and a next state** — instant states chain within one step, each with its own physics and regeneration pass.

`onSurface` (`boolean_a(e)`): hands-anchored → probe 0 has `k ∈ {8, 9, 11, 12, 17}`; otherwise the feet probe has `k ∉ {0, 8, 9, 17}`. Wall contact by the feet counts as airborne.

## Collision

- **Ray march** `a(c, x0, y0, x1, y1, bl, bl2, bl3, bl4)` (line 8520): a DDA over grid lines. The cell index rounds toward the cell the point is coming from: `(v−1)>>10` when moving positive (`c()`, line 8981). For each sub-segment clipped to one cell it calls the tile shape dispatch with local endpoints and returns the first hit. Hit points are not interpolated: the tests use the sub-segment's start coordinate on the axis parallel to the surface (lines 8807–8972). Flags: `bl` contact probe, `bl2` feet, `bl3` body, `bl4` facing right.
- **Contact following** `a(c, localX, col, row, dx, isFeet, facing)` (line 8628) runs before the tile test when the probe already has `k ≠ 0`. For the feet it runs only on a column change or on a post. It uses pairs `B[22*k + A[tile]]` = (flags, newK) for the tile at the feet ("upper") and the tile below ("lower"). Flag bits: 1 upper when moving right, 2 lower when moving right, 4 upper when moving left, 8 lower when moving left. If newK ∈ {1, 10, 6, 7} it synthesises the floor/slope contact; newK 0 drops the contact (that is how the runner walks off edges); 8/9 hand over to the tile test (walls). For the hands probe k8/k9/k17 are kept only on ladder or bar tiles.
- Fields of class `c`: `var_boolean_a` hit this step; `var_boolean_b` static "this is the hands probe" (probe 0 only, line 7573); `var_int_a, var_int_b` contact point; `c, d` push-out (±1/±2); `e, f` normal ×1024; `g` squared distance from probe start to hit (earliest wins); `h` tile id; `i, j` tile coordinates; `k` surface type — **persists between steps**.
- `int_n(q)` (line 8988) reads a tile relative to the player: bits 0/1 dx +1/−1 (relative to facing); 2/3 dy +1/−1, flipped when `r ≤ 0`; 0x10 from the feet point; 0x20 from the hands point; 0x40 relative to the last lookahead hit; 0x80 absolute up; 0x100 absolute down; 0x800 dy −2; 0x200/0x400 x shifted 5/512 units forward.

## Constants and tables (blobs 18–25 in `b1`)

- Gravity `var_int_d = 8800` → +257 per step (line 7586). Fall cap `r ≤ 17300`.
- Hard cap on a surface (line 7853): 3400 if the contact normal has `f == −1024` (flat floor); 5250 if `|e| == 1024` (vertical, e.g. ladder); otherwise 4000. Uses the exact `isqrt` (`int_o`).
- Soft cap (lines 7826–7848), only on a surface and when the acceleration has a component along the velocity: `cap = 3400·E[C[k] + (r > 0 ? 0 : 1)]/1024`, where `r > 0` means moving down the slope. Below the cap the acceleration is scaled by `F[min(speed/(cap/12), 11)]`; above it, `D[C[k] >> 1]` is subtracted along the velocity. Speed uses the `int_f` approximation (octagonal norm, line 9116). Flat floor cap = 4150; 45° slopes 5060 (down) / 3878 (up).
- `F` = 1024, 1024, 1024, 1024, 900, 715, 512, 256, 64, 32, 8, 0.
- `A` (tile → B column): 0→0; {1,3,5,6,15,16,19,20,21,23}→2; 9→4; 10→6; 11→8; 12→10; 7→12; 8→14; {2,17,25}→16; {4,18,26}→18; 24→20; all others 0.
- `B` is 11 rows (k = 0..10) × 11 pairs; row k=1: `[0,0, 10,1, 1,2, 8,3, 2,4, 4,5, 9,6, 6,7, 1,8, 4,9, 0,0]` (full dump from b1 @10978).
- `G` (slope dy/dx ×1024, by k): `[0, 0, −512, −512, 512, 512, −1024, 1024, 0…]`.
- `C` (k → class): `[0, 2, 4, 4, 4, 4, 6, 6, 0…]`. `D` (over-speed brake by class>>1): `[0, 0, 256, 512]`. `E`: `[1250, 1250, 1250, 1250, 1424, 1168, 1524, 1168]`.
- `H` (tile flag mask): `[1, 131842, 256, 2, 512, 2306, 4610, 64, 128, 4, 8, 32, 16, 31490, 31490, 130, 66, 256, 512, 131074, 2, 131842, 98304, 2, 1024, 31490, 31490]`. Bits: 0 air; 1 walkable top; 2–5 half slopes; 6/7 "/" and "\" slopes; 8/9 wall facing left/right; 10 half-height floor; 11/12 ledge on left/right; 13–14 posts; 15–16 pole; 17 solid underside. Common masks: 2304 = wall/ledge ahead when facing right, 4608 facing left, 252 = any slope, 98305 = air or pole.
- There is no ground friction in run states.
- Sine: `short_arr_a` (line 3447) builds a 512-entry table of amplitude 1024 by recurrence.

## z-types (impulses; `a(e,int,int,int)`, line 8206)

Applied once at `E == 0` unless noted. For z < 19 the result is used as-is (`M = K`, `N = L`); for z ≥ 19 it is rotated into the contact frame (`M = −f·K/1024 + e·L/1024`, `N = e·K/1024 + f·L/1024`) and is zero without a contact.

| z            | Effect                                                                                                                                  |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| 0, 15 (jump) | `s = max(B,                                                                                                                             | v   | ·C>>10)`(z15 uses 1227 instead of` | v   | `), scaled by `O>>16`(z0) or`P>>16`(z15, then`P −= 9050`). `D == 1`→ direction (265, −989), else (658, −784).`q = r = 0`, then `K, L`added. z15 when`r > 0`: `L += (r·500>>10) − 100`. **`O` is never decreased, so the z0 scaling is a no-op.** |
| 19 (run)     | `F = 1000`. Each step, once `E > 100`: `K = (E/100)·±B` and `E −= 100·(E/100)` — B is applied about every 3.33 steps                    |
| 4, 12        | jump to apex `H = C` above: `L = −r − √(r² − r²/1024 + 17600·H)`, `K = ±B`; z12 first cancels gravity until `E` reaches `D`, then fires |
| 9            | `r = 0`; `K = ±B`; `L = C`                                                                                                              |
| 10           | velocity set to (±B, C)                                                                                                                 |
| 11           | at time `D`: velocity set to (±B, C)                                                                                                    |
| 13           | velocity held at 0 (gravity cancelled) until `D`, then add (±B, C)                                                                      |
| 2            | `v = (±B, 0)`                                                                                                                           |
| 5            | over `F`: move B forward and 1536 up, then stop                                                                                         |
| 3            | move feet by `(g, h+1536)` over `F`                                                                                                     |
| 6            | stop (`v = 0`)                                                                                                                          |
| 18           | stop horizontal                                                                                                                         |
| 7            | `q ·= B/1024` every step                                                                                                                |
| 8            | `                                                                                                                                       | q   | = B` every step                    |
| 14           | `                                                                                                                                       | q   | = (                                | q   | + B)/2`; `r +=                                                                                                                                                                                                                                   | r   | /2` |
| 16           | `K = ±256`                                                                                                                              |
| 17           | `q = 0`; downward speed limited to C, max change B per step                                                                             |
| 1            | `q` linearly to ±100 over `F`, then stop                                                                                                |
| 20           | `(K, L) = (±B, C)` in the surface frame                                                                                                 |
| 21           | velocity set to (±B, 0) in the surface frame every step (ladder)                                                                        |

Derived launch speeds: run jump (18) vx 3630, vy −4325 (apex ≈ 1060 ≈ 1 tile); steep jump (19) 1138 / −4249; tic-tac (20) 3759 / −4478 at full `P`; tiger jump: hold 190, then apex 1400 and +400 forward; wall-run kicks `r` = −5100 / −4380 / −3550 / −3400.

## x-types (snap on entry `a(e,int)`, line 7905; per-step motion `void_a(e,int,int)`, line 8137)

| x                        | Effect                                                                          |
| ------------------------ | ------------------------------------------------------------------------------- |
| −1, 12 (default)         | body upright `(0, −1536)`, hands not pinned; 12 = mid-state tuck (feet +160 up) |
| 7                        | `h = −10` (roll and crash: the body collapses)                                  |
| 13                       | feet up 384                                                                     |
| 14                       | legs forward/down 192/96                                                        |
| 1                        | `l += 3` and drop contacts                                                      |
| 18 / 4 / 2 / 9 / 25 / 23 | pin the hands to a tile corner with the feet hanging 1536 below                 |
| 0                        | hands to the corner, feet stay                                                  |
| 8                        | at the end, `l = y − 1537`                                                      |
| 16 / 17                  | hands rotate on a 1536 radius (0→90° / 90→180°)                                 |
| 6                        | feet to the hands, `h = −10`                                                    |
| 11                       | re-stand under the hands                                                        |
| 26 / 27 / 30             | plant feet on the tile top                                                      |
| 29                       | feet +1024 forward and +1536 down                                               |
| 15 / 24                  | set the hands contact (wall / ceiling)                                          |
| 19                       | `l −= 64`                                                                       |
| 21 / 22                  | low-obstacle anchors                                                            |

Animation does not affect movement: `e, f, i, j` come only from x-types and impulses; clips (`c(int,int,int)` 5702, `z` 5786) are purely visual.

## Scoring (`O` 9239, `aG` 7496, `aF` 7278, `aD` 7457)

- On entering any state, the **old** state's points are paid first if its type is 1 or 3: `i += pts`; type 3 also increments `h` (popup counter).
- Type of the new state: 0 = fail: vibrate and `aF()` — sets `i = 0` (a trick that exits directly into a fail is lost — that is what "flawless" means) and drops the meter by 2048. Types 2/5 = continuous points per step (5 only while `r < 0`). Types 2, 4, 5 reset `h = 1`.
- Each player step `aG()`: continuous → `score += d·mult` (the meter does not grow); otherwise meter `bz += 2·i` (capped at 5120) and `score += i·mult`.
- Multiplier: `L = bz >> 10` → 1, 2, 4, 6, 8, 10. The meter never decays; it only drops on fails.
- The ×h chain values, popups and the 2000-unit chain timeout are display only. The penalty `g` computed in `aF` is never applied, so the score never decreases. Rivals are never scored. There is no time bonus; score and time records are stored separately.
