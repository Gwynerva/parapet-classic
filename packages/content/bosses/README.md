# Bosses

Every level has a boss, a character of its own with a name, a look (or several), an effect and
a little world. On its level the boss holds a record in Flag hunt and in Sprint (without the
original's rival): "Boss: Flag hunt" and "Boss: Sprint" in the mission list, open once every
mission of the level is complete. A boss does not race in sight, so its routes stay secret but
for two seconds around each flag (`glimpses.json`), which loop as a hologram by the player's
next flag: it waits by the start in a haze of its own particles, vanishes in a burst of them
when the run starts and appears again when its time is up, where the player's run will end: at
the goal in a sprint, by the flag the player is to take next in a flag hunt (moving on with
every flag taken, floating where a flag hangs in the air, never where its hologram goes).

Beating either record opens the boss as a character for normal play; beating both, in any
order, also gives it its effect, which the player finds out when it happens (the briefings only
hint at it). The two versions are two character numbers (10 + 2 × level with the effect, the
next one plain), so runs and replays keep the version they were made with. The contests are not
missions of the original: they do not count towards unlocking levels or the Prize.

| Level | Boss         | Folder          |
| ----- | ------------ | --------------- |
| 1     | Pierre       | `pierre/`       |
| 2     | Rewind       | `rewind/`       |
| 3     | Grove        | `grove/`        |
| 4     | Vera         | `vera/`         |
| 5     | B-2          | `b2/`           |
| 6     | Sir Nobody   | `sir-nobody/`   |
| 7     | Granger      | `granger/`      |
| 8     | Rush B       | `rush-b/`       |
| 9     | Five         | `five/`         |
| 10    | Flittermouse | `flittermouse/` |
| 11    | Shahzada     | `shahzada/`     |
| 12    | Azure        | `azure/`        |

`bosses.json` lists them in level order; moving a boss to another level is moving its id there.

## `contests.json` — the records

Written by `npm run tas -- publish`, never by hand. Per level and mode: the time, the split time
at each flag or checkpoint (the k-th one reached, whichever it was) and a SHA-256 of the run's
replay, plus the simulation version and the level data they were found on. The test
`packages/runtime/test/bosses.test.ts` fails when the simulation or a level changes: the records
then have to be searched again.

The runs come from a tool-assisted search (`packages/tools/src/tas`) under human limits:

- single presses of the four direction keys, like a keyboard (no held keys, no chords), at
  least 3 steps (≈ 100 ms) apart;
- no frame-perfect presses: a press that also works one step early or late (the presses after
  it unchanged, or moved along) loses at most 300 ms. Where no run without one was found, a
  record may have one or two such moments; `npm run tas -- report` lists them.

Nobody keeps every press within a step of its place for a whole run, so a boss races slower than
its found run: the game stretches the time and every split by an allowance (`CONTEST_ALLOWANCE`
in `packages/classic/src/app/bosses.ts`), 6.5 % for every boss (the later records are hard
enough as they are). Each
stretch between flags gives in proportion to its length, and the screens show only the stretched
times. `contests.json` keeps the found ones.

The inputs of the runs stay in `packages/tools/tas-out/`, which git ignores: of the runs, only
two seconds around each flag are published, as poses (below). `reference/notes/09-tas.md` tells
how the records were found.

```bash
npm run tas -- run              # search all 24 records (about 15 min on 12 cores)
npm run tas -- run --resume     # continue from the stored runs, e.g. with another --seed
npm run tas -- verify           # re-simulate the stored runs, compare with both files
npm run tas -- publish          # write contests.json and glimpses.json
npm run tas -- report           # the times next to the original's records
```

## `glimpses.json` — the route hints

What a boss did around each flag: its runner as the game draws it, step by step, from a second
before the flag is taken to a second after (33 steps on each side, 67 poses). Only these pieces
of the routes are published, and as poses, never as input: they show how a flag is taken, not
how to get there or which presses do it. `npm run tas -- publish` writes them with
`contests.json`, from the stored runs played again in a world that never finishes: the run of a
flag hunt ends on its last flag, and the second after it is the runner going on by itself.

Per level and mode: one clip per flag or checkpoint, by its index (not in the order taken:
Central Park's flag hunt takes the fifth flag before the fourth), and the SHA-256 of the run's
replay, the same as in `contests.json`; with the file's format, the simulation version, the
level data and the window (`beforeSteps`, `afterSteps`). `npm run tas -- verify` records the
clips again and compares them; `packages/runtime/test/bosses.test.ts` fails when the versions, a
level or a run's hash no longer match, so new records mean publishing both files again.

A clip is base64url bytes (`packages/runtime/src/content/glimpses.ts`): per pose a header byte
(facing, hands or feet as the origin, a cut the drawing must not interpolate across, how the
keyframes changed, how the tween is found), then the position as the change of the step's move,
the keyframes as changes and the tween, exact in 256ths, as a byte only when the clip's own pace
does not predict it within one. About 3.9 bytes a pose: the 120 clips take 41.5 kB of the
file's 48.6 kB.

A glimpse moves at the found run's own pace; the game races the slower, stretched times.

## A boss's folder

```
<boss>/boss.json     {id, color, gender, looks: [look ids], effect: [variant names]}
<boss>/looks/*.json  its outfits (one picked at random for every run; nobody chooses)
<boss>/fx.json       its effect
<boss>/stage.json    its little world on the character screen
```

`color` marks the boss in the menus; `gender` (`female`, `male`, `neutral`) is for the grammar
of its texts; `effect` names the variants of `fx.json` it wears together (an outfit may wear
others: `effect` in the look). Texts are in `i18n/<code>/bosses.json`: `boss.<id>.name`,
`.desc`, `.briefing.flags`, `.briefing.sprint`, `.won`, `.lost`, `.fx.<first variant>` and
`.look.<look id>`.

## Looks

A look is pixel art as text over an original character's body (`base`: 0 is Blaise, 1 the
man), every picture rows of palette characters, `.` transparent
(`packages/runtime/src/render/Look.ts`):

- `palette` — characters → colours (`#rrggbb` or `#rrggbbaa`).
- `recolor` — exact colour replacements inside chosen sprites (sleeves, trousers, shoes, skin);
  with `on` (`left`, `right`, `near`, `far`…) on one side of the body only (a dark arm).
- `overlays` — rows painted over a sprite of the same size: `.` keeps a pixel, a space erases
  it, a palette character paints it.
- `parts` — sprites drawn anew, of any size: a heavy breastplate, thin legs, long hair. A part
  is centred on the original part's point; a `+` in it marks another pixel to put there (a
  pauldron over the shoulder end of an arm). Drawn upright, a part turns by itself into its
  pictures turned 22.5°, 45° and 67.5°, unless those are drawn too (`npm run look -- rotate`
  writes them, so the game does not turn them at every start).
- `attachments` — gear on a part, of any size and turned with it (a sword on the back, a
  reactor on the chest, a skirt), on a layer: `back` behind everything, `under` / `over` the
  part, `hips` over both legs but under the head and the near arm, `front` over everything.
- `ribbons` — cloth that moves: a band of `colors` (a plume) or a `texture` stretched along a
  chain (a cape from the `back`, a sash from the `hips`, a scarf from the `neck`; a bag on a
  strap is one stiff segment). `gravity` is how heavy it is, `drag` how much it catches the
  air, `stiffness` (0..1) how much it keeps straight; the runner's speed blows it back, the
  body's jolts swing it.
- `extends` / `abstract` — a kit shared by several outfits: fields merge key by key, `null`
  deletes, `recolor` rules run parent first.
- `accent` — the colour of the outfit's effect and name tag.

Keys of `parts`, `overlays` and attachment pictures name a sprite in Blaise's numbering (`npm
run look -- poses base --parts --out map.png` paints which is which) and may say when the
picture applies:

```
<id>                    always
<id>:near | <id>:far    on the near or the far arm or leg only
<id>:flip | <id>:noflip only when the part is drawn mirrored / not mirrored
<id>:left | <id>:right  the character's own left or right (a tattoo round the right eye: 25:right)
```

Arms lie along x in their upright pictures (shoulder or elbow on the left), legs and the body
along y; a boss's build is in the size of its parts: a knight's every part two pixels thicker
than Blaise's, a slender girl's legs a pixel thinner.

### Drawing one

```bash
npm run look -- template rewind/raincoat --base 0                # a new look to start from
npm run look -- atlas raincoat --out raincoat.png                # its parts, one cell each,
                                                                 # to paint in any editor
npm run look -- import raincoat raincoat.png --write             # the painted cells back
npm run look -- sheet raincoat --out sheet.png --changed         # the parts magnified, labelled
npm run look -- poses raincoat --out poses.png --both            # a row of poses each way
npm run look -- lineup hoodie raincoat --out l.png --columns 4   # several looks side by side
npm run look -- rotate raincoat --from 25,57,cape@57 --write     # turn upright pictures
```

`atlas --margin 8` leaves room to draw bigger parts; `import` crops each cell around the
part's point. On the dev server, `/dev/looks.html` does it all on one page: pick an outfit, get
its atlas, drop the painted picture anywhere on the page and the outfit runs with it at once,
both ways, with its effect, in its world, next to a sheet of poses; **Save** writes the look's
file. `debug.html` cycles the characters and outfits on a level with **C**/**O** and shows a
magnified sheet of poses with **V**. The looks, effects and worlds of the twelve bosses were
drawn by the scripts in [`packages/tools/art`](../../tools/art).

## Effects — `fx.json`

One particle system draws every boss's effect; only the data differs
(`packages/runtime/src/render/fx/FxData.ts`):

- `palette` and `sprites` — pixel art like the looks' (animation frames by name).
- `emitters` — what a move gives off. `while` (run, air, wall, slide…) emits all along, every
  `every` pixels run or `perSecond`; `enter` (flip, vault, wall, roll, land…) emits a `burst`
  once, with a `chance`: a boss's flourish on some of its tricks, not on every one (Vera's
  glass, Pierre's idea, Rewind's photos). Then `anchor` (feet, hips, chest, back, neck, head,
  hand.near / far, hands, body), `offset` (+x behind), `speed` and `angle` (0 behind), `inherit`,
  `gravity`, `drag`, `life`, `fadeIn` / `fadeOut`, `scale`, `tumble`, `flutter`, `face`,
  `sprite` frames or `rect` pixels, `blend: add`, `layer`, `max`, and `reduced` for players who
  ask for less motion.
- `ribbons` — cloth of the effect, like the looks'.
- `variants` — named sets of emitters, ribbons and an `afterimage`: echo or rush trails, a
  `snapshot` of the pose on a trick (with a `chance`: on some of them; `burst`: emitters coming
  with it), colours or the rainbow.
- `presence` — the haze by the start (`idle`) and the bursts as the boss leaves (`vanish`) and
  comes back (`appear`).

## Its world — `stage.json`

The character screen's preview: the character runs through a strip of its boss's world
(`packages/runtime/src/render/Stage.ts`):

- `sky` — colours from the top down to the horizon, in bands; `stars` twinkle over it.
- `layers` — back to front, each scrolling at its `speed` (0 still, 1 with the ground) and
  repeating every `period` pixels; their `items` sprites stand at `x`, their bottom `y` pixels
  above the ground (0: on it; only the sky's things float). An item may animate (`frames`,
  `fps`: waves, a lighthouse's beam, torches), a layer drift on its own (`drift`: clouds,
  flying cars), fade (`alpha`) or come `front`.
- `ground` — the strip under the feet; `tint` — a colour over everything (dusk, night).
- `ambient` — the place's own particles (`emitters`): leaves, rain, sand, spores.

## `theme.json` — the music

The contests' theme: a small tracker score (`packages/runtime/src/audio/Score.ts`) played by
the same synthesiser as the original's MIDI music. D minor with the Phrygian E♭ and the
harmonic minor's C♯, 168 BPM, 32 bars that loop: a heartbeat intro, the theme, a rising climb
with guitar stabs, a break with a snare roll, the theme an octave up.
