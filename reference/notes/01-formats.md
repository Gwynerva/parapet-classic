# 01. File formats inside the JAR

All numbers are big-endian. "Line N" refers to `reference/decompiled/d.java`.

## Archive contents

| File                    | Size      | What it is                                                                                                                                                                                                                        |
| ----------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `S.class`, `a..g.class` |           | MIDlet `S`; `d` is the whole game (GameCanvas + Runnable, 330 fields, 350 methods); `e` runner entity (47 ints), `c` collision probe, `f` animation/score state, `g` character visual state, `b` record entry, `a` PlayerListener |
| `i`                     | 1866      | Index: key map, sprite tables, blob directory, MIDI offsets                                                                                                                                                                       |
| `p`                     | 5474      | 113 RGB565 palettes                                                                                                                                                                                                               |
| `g0..g8`                | 19–108 KB | Sprite packs, 8-bit palette indices                                                                                                                                                                                               |
| `b0`, `b1`, `b2`        | 10–18 KB  | Containers of binary blobs (not fonts!): name-entry data, rival recordings, move state table, animations, physics tables, level tile maps, mission table                                                                          |
| `k0..k13`               | 3–53 KB   | "Composite" vector art: character (`k0`), props (`k1`), level backgrounds (`k2..k13`)                                                                                                                                             |
| `l`                     | 20 KB     | 205 localisation strings (Russian): `u16 len` + modified UTF-8 (`readUTF`)                                                                                                                                                        |
| `s`                     | 213 KB    | 14 MIDI files concatenated; offsets in `i`                                                                                                                                                                                        |
| `i.png`                 |           | MIDlet icon                                                                                                                                                                                                                       |
| `MC_KoMpOtIk.gif`       |           | Not part of the game (added by a distributor)                                                                                                                                                                                     |

There are no fonts: text uses the phone's system fonts (`Font.getFont`, lines 10689–10692); only the HUD digits are sprites.

## `i` — index (read by `l()`, line 1239)

```
16 bytes   j[]   j[2+n] = type of sound n (1 = MIDI); bytes 0–1 unused
593 × i16  S[]
166 × i32  D[]
```

`S[]`:

| Range         | Meaning                                                                                        |
| ------------- | ---------------------------------------------------------------------------------------------- |
| 0..29         | key-code groups (stored as keycode+56)                                                         |
| 30..34        | string-group start indices                                                                     |
| 35..44        | first image slot of each g-file: 0, 900, 902, 928, 967, 969, 972, 975, 978, 1080               |
| 45+id         | sprite id → image slot (ids 0–313)                                                             |
| 359+g / 365+g | sound groups (count / first): {0}, {1}, {2–4}, {5–7}, {8–10}, {11–13}                          |
| 371+n         | sound slot                                                                                     |
| 385..         | menu definitions; `S[457+m]` menu offsets; `S[473+4k]` menu items (type, param, state, string) |

`D[]`:

| Range          | Meaning                                            |
| -------------- | -------------------------------------------------- |
| 0..3           | byte offsets of string groups in `l`               |
| 4+n / 32+n     | offset / length of MIDI n inside `s`               |
| 18+n           | duration of MIDI n in ms                           |
| 46+3k .. 48+3k | blob k = (b-file number, offset, length); 40 blobs |

## `p` — palettes (`void_c()`, line 569)

`u8 count` (=113), then per palette: `u8 n`, then `(n−1)` × `u16` RGB565 for indices 1..n−1. Index 0 is always transparent. Expand to 8 bits as `r=(r5<<3)|(r5>>2)`, `g=(g6<<2)|(g6>>4)`, `b=(b5<<3)|(b5>>2)`.

## `g0..g8` — sprite packs (`int_d`, line 782; PNG assembly `int_a`, line 430)

A file is a plain run of records with no file header:

```
u16 w, u16 h, u8 pal
pixels: pal != 255 → w*h bytes of palette indices (row-major); pal == 255 → w*h*4 bytes B,G,R,A
u8 flags: low nibble = number of transformed copies; high nibble always 0
u8 code × (number of copies)
```

Copies are generated at load time and occupy the following slots (`int_b[slot]` holds the code of the next copy, 15 ends the list, line 739). Transform codes: 0 none, 1 rot90 CW, 2 rot180, 3 rot270 CW, 4 mirror X, 5 flip Y, 6 transpose, 7 anti-transpose.

Sprite id ↔ image is a 1:1 sequential mapping:

| File  | Sprite ids | Contents                                                                                                                                                      |
| ----- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| g0    | 0–150      | character body parts and heads; 137–140 checkpoint flags; 141–150 mission icons                                                                               |
| g1    | 151–152    | splash logos                                                                                                                                                  |
| g2    | 153–175    | menu art; 163 locked level; 164–175 level thumbnails                                                                                                          |
| g3    | 176–211    | particles 176–181; off-screen arrow 182; multiplier frame 184; multipliers ×1–×10 185–190; finish marker 191; checkpoint dots 192/193; HUD digit font 194–211 |
| g4–g7 | 212–222    | parallax backgrounds for themes 0–3                                                                                                                           |
| g8    | 223–313    | level props; birds 296–298                                                                                                                                    |

How the game builds a PNG in memory (line 430): IHDR with 8-bit depth and colour type 3 (indexed) or 6 (RGBA); PLTE with n+1 entries (entry 0 and the last are filler); tRNS of one zero byte; zlib header `78 DA`; **uncompressed** blocks, each in its own IDAT; Adler-32 in a separate IDAT; every row has filter byte 0. CRC-32 uses the table built by `void_b()` (line 372, polynomial 0xEDB88320).

## `b0`, `b1`, `b2` — data blobs (read by `a(int,int,int,byte[]/int[]/short[])`, lines 1442–1479)

| #     | Location    | Size      | Contents                                                                                                | Variable  |
| ----- | ----------- | --------- | ------------------------------------------------------------------------------------------------------- | --------- |
| 0     | b0 @0       | 51 B      | name-entry keypad characters                                                                            | `byte_l`  |
| 1     | b0 @51      | 11 B      | which characters belong to which key                                                                    | `byte_k`  |
| 2     | b0 @62      | 20×3 i16  | Moves-menu demos: (clip offset, frame count, description string)                                        | `short_i` |
| 3     | b0 @182     | 463×4 i16 | per-keyframe bounding box of the character (minX, minY, maxX, maxY); only used to centre the menu demos | `short_j` |
| 4–15  | b0 @3886..  |           | rival input recordings, one per level (see 05)                                                          |           |
| 16    | b1 @0       | 2366 i32  | move state table: 135 records × 14 ints + transition lists (see 02)                                     | `int_I`   |
| 17    | b1 @9464    | 605 i16   | animation clips: `count, frameId…`                                                                      | `short_h` |
| 18–25 | b1 @10674.. |           | physics tables F, A, B, G, C, D, E, H (see 03)                                                          |           |
| 26    | b1 @12246   | 20 i32    | 4 background themes × (ground colour, sky bottom, sky top, far-layer sprite, cloud sprite or −1)        | `int_M`   |
| 27–38 | b2 @0..     |           | 12 level tile maps, levels 0–11                                                                         |           |
| 39    | b2 @16906   | 336 i32   | mission table 12 × 28 (see 05)                                                                          | `int_z`   |

### Level tile map (`m(int,int)`, lines 9588–9661)

```
i16 W, i16 H                       size in tiles
RLE: pairs (count-1, tileId) until W*H cells are filled, row-major (index = y*W + x)
6 mission sections, one per mission type aN = 0..5, each terminated by -1:
  startX, startY
  finishX, finishY   | -2 (none)
  npcX, npcY         | -2 (none; stored <<10 as bV/bW — the coach)
  (cpX, cpY)*        checkpoints / flags
  -1
```

Coordinates name the cell the runner stands in (the floor is in the cell below). Spawn: `k = sx*1024`, `l = sy*1024 + 1024` (line 7592).

At load time: checkpoint i is written as tile `49+i` into cells (x,y) and (x,y−1) (line 9635), so any collision tile there is lost; tile 63 is removed and replaced by a decorative bird (particle type 2); `killRow[x]` = the deepest row of the column containing a tile from {1,3,5,6,7,8}, or 0 if none (line 9640).

Map sizes: L0 80×17, L1 100×20, L2 100×20, L3 99×13, L4 88×17, L5 150×13, L6 75×21, L7 100×20, L8 118×14, L9 150×16, L10 150×28, L11 99×50.

Background k-file per level: L0 k3, L1 k4, L2 k8, L3 k2, L4 k10, L5 k5, L6 k12, L7 k13, L8 k6, L9 k7, L10 k11, L11 k9. A background is about `W*32` px wide (k3 is 2606 px against L0's 2560).

### Tile catalogue (shape dispatch `a(c, 7 ints, 3 bools)`, lines 8731–8972; local coordinates 0..1024, y down)

Probe filters: **C** = contact probe, **F** = feet, **B** = body, **Hd** = hands only.

| Tile                | Collision                                                                                                                    | Meaning                                  |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| 0                   | none                                                                                                                         | air                                      |
| 1                   | top k1, bottom k17, left face k8, right face k9; all probes                                                                  | solid block                              |
| 2                   | x=0 face (blocks moving right) k8; C or B                                                                                    | wall                                     |
| 4                   | x=1024 face (blocks moving left) k9; C or B                                                                                  | wall                                     |
| 3                   | top k1; C or F                                                                                                               | floor surface (interiors left empty)     |
| 5                   | top k1 (C), left face k8 (C), ledge k11 (Hd: upper half of the side, or left half of the top)                                | left building corner                     |
| 6                   | mirror of 5: k1, k9, ledge k12                                                                                               | right building corner                    |
| 7                   | 45° "/" line y=1024−x, k6, normal (−726,−726); C                                                                             | slope rising to the right                |
| 8                   | "\" line y=x, k7, normal (726,−726); C                                                                                       | slope falling to the right               |
| 13 / 14             | 256-wide post at x 0–256 / 768–1024: side walls k8/k9 and top k13 (all probes), bottom k14; ledge k11/k12 on both sides (Hd) | low obstacles to vault                   |
| 17 / 18             | like 2 / 4 but C only; the k8/k9 contact is kept while the next tile is also 17 (or 5 above 17) / 18 (line 8723)             | ladder / wall-run surface                |
| 19                  | y=0 line: Hd crossing upwards gives k17 (hang), crossing downwards gives k1; C gives k1                                      | overhead bar                             |
| 20                  | top k1, only if C and F                                                                                                      | plank                                    |
| 21                  | top k1, ceiling at y=256 k17, side faces for y≤256                                                                           | 256-unit slab, low ceiling to roll under |
| 22                  | x=512 line, Hd only: k15 when moving right, k16 when moving left                                                             | pole                                     |
| 9–12, 15, 16, 23–26 | no case                                                                                                                      | unused (half slopes, variants)           |
| 49+                 | none                                                                                                                         | checkpoint markers                       |
| 63                  | removed at load                                                                                                              | bird decoration                          |

Surface types `k` (normal e,f; push-out c,d):

| k       | Surface                                  | normal                                              | push-out |
| ------- | ---------------------------------------- | --------------------------------------------------- | -------- |
| 0       | airborne                                 | —                                                   | —        |
| 1       | floor at tile top                        | (0,−1024)                                           | (0,−1)   |
| 6 / 7   | "/" and "\" slopes                       | (±726,−726)                                         | (0,−2)   |
| 8 / 9   | wall hit moving right / moving left      | (∓1024,0)                                           | (∓1,0)   |
| 11 / 12 | ledge on left / right side               | (∓1024,0), or (0,−1024) when caught on the top edge | —        |
| 13 / 14 | post top / post bottom                   | —                                                   | —        |
| 15 / 16 | pole                                     | e = ∓1024                                           | —        |
| 17      | ceiling or hang bar                      | (0,1024)                                            | —        |
| 2–5, 10 | half slopes / floor at y=512 — dead code |                                                     |          |

The tangent is (−f, e).

## `k0..k13` — composite vector art (parser `void_g`, line 3020; drawing `b(8 ints)`, line 3218)

A file is an i16 array: `S[0]` = object count, `S[1+i]` = offset of object i. Object id = `(file << 11) | index`.

Object: `[frames, pivotX, pivotY, w, h]`, then primitives until a 0 header:

- `hdr`: low 8 bits = parameter count (≤ 6); bits 8–13 = type; 0x4000 = hidden; 0x8000 = swap body parts per character.
- if `frames > 1`: a `mask` word; bit i set means parameter i has one value per frame, otherwise one shared value.
- parameters: `[0] x, [1] y, [2] colour RGB565 | sprite (id<<3)|transform | nested object id, [3] w, [4] h`.
- types: 0 = filled rectangle; 1 = sprite drawn centred (id −1 = skip); 2 = nested object, frame 0, top-left; 3 = sprite tiled across the w×h rectangle.

Drawing `b(obj, frameA, frameB, t/65536, x, y, anchor, flip)` interpolates x, y, w, h and the colour (in RGB565) between the two frames; the sprite id is always taken from frameA. Mirroring is `x' = −x − width + objW`, and each sprite's transform is composed with a mirror (line 3364).

- `k0`: one object, 463 keyframes, pivot (50, 76), 134×142, 19 body-part sprites — **the character**.
- `k1`: 23 single-frame props, ids 2048–2070.
- `k2..k13`: level backgrounds; mostly rectangles; 1, 3 or 5 frames; 2.4k–5k px wide. Frames carry mission states (see 04).

`void_p` (line 3077) only builds a 120×160 px culling grid.

## `l` — localisation

205 strings, each `u16 len` + modified UTF-8. Control characters inside strings: `\x1b<n>:` style/colour, `\x13<n>:` font, `\x14`/`\x15` column tabs, `\x16` centred, `\x19<n>:` indent, `%1..%9` substitutions. Strings 36–55 are move names, 56–75 their descriptions, 97–108 level names, 109–120 level descriptions, 121–126 mode names.

## `s` — music

14 standard MIDI files (MThd) back to back. The game has no sound effects at all; it vibrates instead.
