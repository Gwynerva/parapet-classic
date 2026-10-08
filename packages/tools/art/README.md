# Boss art

The bosses' outfits, effects and little worlds (`packages/content/bosses/`) were drawn as code:
these Python scripts write their JSON.

- **Heads** are built on the original characters' hand-drawn heads: recoloured (skin, hair, eyes,
  lips), painted over (goggles, a blindfold, tattoos, a cowl), hair grown past the box, a hood or
  a helmet shaded over them.
- **Bodies** are the original parts, every turn of every one: recoloured like the look's rules,
  thickened or thinned keeping their outline and shading (a knight's plate, a slender girl's
  legs), relit as metal, a fitted suit or cloth with stripes, painted over (a belt, a bat on the
  chest).
- **Effects** are particle sprites and emitters, with each boss's flourish thrown on some of its
  tricks (Vera's glass, Pierre's idea, Rewind's photos).
- **Worlds** are the character screen's dioramas: scenery drawn piece by piece, lit from the
  sun's side, far things hazy.

The JSON in `packages/content/bosses/` is what ships; the scripts are how it was drawn. Editing
the JSON by hand (or on the dev server's `/dev/looks.html`) is fine, but running the script again
overwrites the edit.

## Running

Python 3.10 or later, the standard library only. The looks are turned and previewed with the
look tool (`npm run look`), so Node and the extracted game (`npm run extract`) are needed too.

```bash
python packages/tools/art/rewind.py            # Rewind: looks, fx.json, the list in boss.json
python packages/tools/art/rw_looks.py          # only the looks
python packages/tools/art/stages.py            # every boss's stage.json
python packages/tools/art/stages.py b2 five    # some of them
npm run format                                 # the JSON as the repository keeps it
npm run look -- lineup hoodie beanie --out l.png --columns 4
```

Then see the outfits run, with their effect, in their world on `/dev/looks.html` (`npm run dev`).
The scripts run from any folder. A boss's script goes before `stages.py`: a world borrows sprites
from its boss's `fx.json` (Rewind's butterflies). All of them take about a minute and a half,
mostly the look tool turning and previewing every look.

Every look also leaves a row of poses each way in `out/<look>-poses.png`, and the looks modules a
magnified sheet of their heads (`out/rw-heads.png`…); git ignores `out/`.

`PARAPET_BOSSES` sends every file to another copy of the bosses' folder, to compare a run with the
content without touching it:

```bash
cp -r packages/content/bosses /tmp/bosses
PARAPET_BOSSES=/tmp/bosses python packages/tools/art/vera.py
npx prettier --config .prettierrc --write "/tmp/bosses/*/looks/*.json" "/tmp/bosses/*/*.json"
diff -r /tmp/bosses packages/content/bosses
```

## The toolkit

- `lookgen.py` — paths (and `PARAPET_BOSSES`), the base characters' colour ramps and sprite
  numbers, recolour rules, pictures as text grids, `write_look`, `rotate` and `preview` (the look
  tool), a `Canvas` for props and effect sprites.
- `heads.py` — `Pic` (a picture in hex colours), the `Palette` builder that gives every colour a
  character, ramps by lightness, `shaded`, `hood`, `beard`, `rim`, `neat_mouth`.
- `body.py` — the original parts grown or thinned by family (`outfit_parts`, `inflate`,
  `shrink`), relit as `metal`, `dome` or a `suit`.
- `base_heads.json`, `base_body.json` — the original characters' heads and body parts from the
  atlas, rows and a palette per sprite.
- `*_looks.py` — a boss's looks (`rw_looks.py`: Rewind's), written when the module is imported;
  `kn_parts.py` (Sir Nobody's armet and steel), `fm_heads.py` (Flittermouse's cowl) and
  `sh_heads.py` (Shahzada's heads) draw pieces of looks.
- `tricks.py` — the bosses' flourishes on tricks, merged into an effect before it is written.
- `stages.py`, `stages2.py` — the worlds, one function per boss; `scene.py` draws their scenery
  (lit blobs, foliage, trees, pines, palms, buildings, skylines, ground strips) and `room.py` the
  author's room, Pierre's world.
- `gridpng.py` — pictures as a magnified PNG.

## The scripts

| Script            | Writes (in `bosses/<boss>/`)                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------ |
| `pierre.py`       | `fx.json`; looks `swordsman`, `fencer`, `rebel`, `undercover` (`pr_looks.py`)                          |
| `rewind.py`       | `fx.json`; looks `hoodie`, `beanie` (`rw_looks.py`); `looks` in `boss.json`                            |
| `grove.py`        | `fx.json`; look `grove-tank` (`gr_looks.py`)                                                           |
| `vera.py`         | `fx.json`; looks `vera-tank`, `vera-vest`, `vera-hood` (`vr_looks.py`); `looks` in `boss.json`         |
| `b2.py`           | `fx.json`; look `android` (`b2_looks.py`); `looks` in `boss.json`                                      |
| `sir_nobody.py`   | `fx.json`; looks `plate`, `dark-knight`; `looks` in `boss.json`                                        |
| `granger.py`      | `fx.json`; looks `classic`, `pink`, `silver` (`gn_looks.py`); `looks` in `boss.json`                   |
| `rush_b.py`       | `fx.json`; its eight looks (`rb_looks.py`); `looks` in `boss.json`                                     |
| `five.py`         | `fx.json`; looks `five-her`, `five-him` (`fv_looks.py`); `looks` in `boss.json`                        |
| `flittermouse.py` | `fx.json`; looks `armored`, `future`; `looks` in `boss.json`                                           |
| `shahzada.py`     | `fx.json`; looks `sands`, `warrior`, `wanderer`, `dark-prince` (`sh_looks.py`); `looks` in `boss.json` |
| `azure.py`        | `fx.json`; looks `scholar`, `broker`, `leather`, `twilight`; the whole `boss.json`                     |
| `stages.py`       | `stage.json` of every boss, or of the bosses named                                                     |

B-2's sword is not drawn here: `b2_looks.py` takes it from her current `android.json`. Pierre's
looks `mechanic`, `kate`, `evening` and `birthday`, his and Grove's `boss.json`, `bosses.json`,
`contests.json` and `theme.json` are written by nothing here.
