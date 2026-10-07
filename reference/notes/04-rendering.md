# 04. Rendering, camera, animation, HUD

## Screen and loop

- 240×320 px; a tile is 32 px (`px = units >> 5`).
- Fixed 30-unit ticks; game time per frame = real delta × 900/1024, capped at 150 (line 10477).
- Order of one tick: input → physics `int_m(30)` → end check → animation `z(30720)` → score → particles → camera (line 10493).
- Render positions are the interpolated `m, n, o, p` fields of the entity (fraction of the pending sub-step).

## Draw order (`bj`, line 10599)

1. `bb()` (line 9958): sky gradient (12 bands), clouds, far layer, near layer, and water in theme 3.
2. `aV()` (line 9847): level art (k-file object).
3. `aS()` (line 9747): checkpoint flags and finish marker.
4. Background particles.
5. `ak()` (line 5911): the coach NPC.
6. Characters: rivals/ghosts first, the player last.
7. Message box (the simulation is paused while it is shown).
8. `aW()` (line 9862) HUD, then foreground particles.

## Parallax and sky (`bb`, line 9958)

- Horizon y = `260 − (camY / levelHeight >> 4)` (−32 in theme 3).
- Far layer scrolls at 0.117× camera x, near layer at 0.234×, clouds at 0.059× plus 1 px per 512 ms.
- Theme = `level / 3`; the matching g-file (g4..g7) is loaded on level start. Table `M` (b1 @12246): per theme ground colour, sky bottom, sky top, far-layer sprite, cloud sprite (−1 = none).

## Camera (`void_a(e)` line 9351, `b(int, boolean)` line 9436, `k`/`l` lines 9370/9380)

`bD, bE` is the top-left corner in units.

- Target = player − (3840, n). Look-ahead x = `vx · 3840 / 4143`, clamped ±3840, set to 0 when a wall is within 4 tiles ahead.
- `n = 5888 ± 1280` depending on the player's height within the level; look-ahead y = `vy · 5120 / 4143`, clamped ±n.
- Spring per tick: `velocity += dx · 200 / 65536` (clamped to ±dx · 0.117); y uses 240/65536 and half the clamp.
- Hard limit of ±60 px / ±80 px around the player, then clamped to the level bounds: x ∈ `[0, W·1024 − 7680]`, y ≤ `H·1024 − 10240` (the camera may go above the map; there is no top boundary).
- Sprint flyover (line 9392): the camera tours start → checkpoints → finish with smoothstep easing (3t² − 2t³), about 2 ms per px plus 625 ms per leg.

## Level art frames (`aV`, line 9847)

Background objects have 1, 3 or 5 frames that encode mission state: frame pairs (0,1) pulse in tutorials and challenges, (2,3) are used after the challenge flag is collected, and the static frame is 4, 2 or 0 depending on the level. The warm-up arrows live in these frames, not in the tile map.

## Character animation

- The character is the single object of `k0`: 463 keyframes, pivot (50, 76), 134×142, 19 body-part sprites (see 01).
- **Clips** (`short_h`, blob 17): at an offset, `count` followed by `count` keyframe indices.
- Move table fields [6] (clip offset) and [7] (mode); flags 0x200 / 0x400 select 15 / 10 fps; 0x20 disables blending.
- Per-entity visual state is class `g` (set at line 5702, advanced at line 5786); mode `d` picks the frame index `b`:

| Mode    | Behaviour                                 |
| ------- | ----------------------------------------- |
| 0, 1, 9 | hold first frame                          |
| 2, 10   | hold last frame                           |
| 3, 5    | loop at 13 fps (15 / 10 / 4 fps variants) |
| 6       | loop backwards                            |
| 4       | play once over duration `l`               |
| 7       | play once reversed                        |
| 8       | loop at a rate proportional to \|speed\|  |

- Drawing (`aj`, line 5886) **always tweens from the previous keyframe to the current one** by `j/256`.
- Root motion is not in the animation data: entity deltas e, f, i, j come from the x-types and impulses (03).
- There are no hitboxes in the animation; collision uses the three probes. The only boxes are the menu-demo bounding boxes in `short_j`.

### Skins (`a(int, int[])`, line 5931)

- Character 0 is Blaise and uses the default heads 25–29.
- Character c ≥ 1 swaps those heads for `82 + 5(c−1) … +4`.
- Male characters (1, 2, 4, 7, 9) also swap body parts 34–38 → 127–131 and 57–61 → 132–136, and hide sprites 13–16 (Blaise's ponytail).
- Ghosts (earlier hot-seat players) replace every body part with the 8×8 sprite 80 (line 3348).
  Parapet Classic does not use the dots: rivals and the ghosts of recorded runs are drawn as
  "echoes" (`packages/runtime/src/render/EchoRenderer.ts`), a recoloured hologram of the same
  skeleton.
- Faces: a blink (sprites 76/77, 250 ms, roughly 1 in 64 chance per tick) and a pain face (78, 400 ms) (line 5755).

## HUD (`aW`, line 9862)

- Timer at (5, 5) in sprite digits 194–211; blinks during the last 10 s.
- Checkpoint dots at (5 + 11i, 30), sprites 192/193.
- Off-screen arrow (sprite 182) at the screen edge (line 9705).
- Score at (235, 5), right-aligned, with floating trick popups (line 7518).
- Multiplier gauge (line 7293): ×1/2/4/6/8/10 (sprites 185–190, frame 184), filled by `bz` in 0…5120; a crash removes 2048.

## Particles (`void_d(4 ints)` line 4213, `void_r(int)` line 4280)

40 slots. Types: 1 dust, 2 birds (spawned from tile 63, fly off when the player is within about 2 tiles), 3 sparks, 4 debris, 5 fireworks. Flag 0x10000 = screen space, 0x20000 = foreground.

## Sprite drawing

Sprites are drawn with one of 8 transforms (01). `b(8 ints)` at line 3218 draws a composite object: rectangles with `fillRect`, sprites centred on their position, nested objects at frame 0, tiled sprites across a rectangle; x, y, w, h and colours are interpolated between two keyframes. Mirroring composes the sprite transform with a horizontal mirror (line 3364). Text is drawn with the phone's fonts; styled text uses the control codes listed in 01.

## Our additions on top of the original drawing (runtime)

- Frame interpolation: the original drew the per-step position only (about 29 fps). The runtime interpolates the character and the camera between steps for 60+ Hz displays, but never across a discontinuity: when the draw origin switches between feet and hands (ledge grabs, ladders, drops) or a move entry snaps the runner, the step is drawn instantly. The keyframes of hands-anchored and feet-anchored clips are authored in different frames, so sliding the origin between them would throw the body up or down by 1.5 tiles over one step.
- The animator state (class `g`) and the draw parameters of `aj()` are verified against the oracle traces step by step (`packages/runtime/test/animator.test.ts`), including a decompiler artefact found that way: the clip setter assigns the hands flag unconditionally.
- The camera port is verified against the oracle traces on the original viewport (`camera.test.ts`); on wider viewports its constants are expressed as fractions of the view size, which is our generalisation.
