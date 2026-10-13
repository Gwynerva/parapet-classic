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
  tricks (Vera's glass, Petra's idea, Rewind's photos).
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
  `kn_helms.py` and `kn_parts.py` (Sir Nobody's helms and materials), `fm_heads.py` (Flittermouse's cowl) and
  `sh_heads.py` (Shahzada's heads) draw pieces of looks.
- `tricks.py` — the bosses' flourishes on tricks, merged into an effect before it is written.
- `stages.py`, `stages2.py` — the worlds, one function per boss; `scene.py` draws their scenery
  (lit blobs, foliage, trees, pines, palms, buildings, skylines, ground strips) and `room.py` the
  author's room, Petra's world.
- `gridpng.py` — pictures as a magnified PNG.

## The scripts

| Script            | Writes (in `bosses/<boss>/`)                                                                                                                                                                                                                                                                        |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `petra.py`        | `fx.json` (`pr_fx.py`) and `effect` in `boss.json`; her looks `kate`, `mechanic`, `birthday`, `evening` (`pr_her.py`, `pr_her_heads.py`, `pr_her_parts.py`), her twin brother's `swordsman`, `fencer`, `rebel`, `undercover` (`pr_looks.py`, `pr_him_face.py`, `pr_him_body.py`, `pr_him_props.py`) |
| `rewind.py`       | `fx.json`; looks `hoodie`, `beanie` (`rw_looks.py`); `looks` in `boss.json`                                                                                                                                                                                                                         |
| `grove.py`        | `fx.json`; looks `grove-tank`, `grove-green`, `grove-cover` (`gr_looks.py`, `gr_heads.py`, `gr_parts.py`)                                                                                                                                                                                           |
| `vera.py`         | `fx.json` (`vr_fx.py`); looks `vera-tank`, `vera-vest`, `vera-street` (`vr_looks.py`, `vr_heads.py`); `looks` and `effect` in `boss.json`                                                                                                                                                           |
| `b2.py`           | `fx.json` (`b2_fx.py`); looks `android`, `replica`, `kimono` (`b2_looks.py`, `b2_heads.py`, `b2_parts.py`); `looks` in `boss.json`                                                                                                                                                                  |
| `sir_nobody.py`   | `fx.json` (sparks in `kn_sparks.py`); looks `sunlight`, `onion`, `hollow` (`kn_looks.py`, helms in `kn_helms.py`, materials in `kn_parts.py`); `looks` and `effect` in `boss.json`                                                                                                                  |
| `granger.py`      | `fx.json` (`gn_fx.py`); looks `classic`, `slipstream`, `punk` (`gn_looks.py`, `gn_heads.py`, `gn_parts.py`); `looks` in `boss.json`                                                                                                                                                                 |
| `rush_b.py`       | `fx.json`; looks `phoenix`, `leet`, `arctic`, `guerrilla`, `seal`, `gsg9`, `sas`, `gign` (`rb_looks.py`, `rb_heads.py`, `rb_kit.py`); `looks` and `effect` in `boss.json`                                                                                                                           |
| `five.py`         | `fx.json` (`fv_fx.py`); looks `five-her`, `five-him`, `five-kid`, `five-edgerunner` (`fv_looks.py`, `fv_heads.py`, `fv_parts.py`, `fv_extra.py`); `looks` and `effect` in `boss.json`                                                                                                               |
| `flittermouse.py` | `fx.json` (`fm_fx.py`); looks `asylum`, `armored`, `future` (`fm_heads.py`, `fm_body.py`); `looks` in `boss.json`                                                                                                                                                                                   |
| `shahzada.py`     | `fx.json`; looks `sands`, `warrior`, `wanderer`, `dark-prince` (`sh_looks.py`, `sh_heads.py`, `sh_parts.py`); `looks` in `boss.json`                                                                                                                                                                |
| `azure.py`        | `fx.json` (`az_fx.py`); looks `scholar`, `broker`, `leather`, `illium` (`az_looks.py`, `az_heads.py`, `az_parts.py`); the whole `boss.json`                                                                                                                                                         |
| `stages.py`       | `stage.json` of every boss, or of the bosses named                                                                                                                                                                                                                                                  |

Petra's and Grove's `boss.json`, `bosses.json`, `contests.json` and `theme.json` are written by
nothing here.
