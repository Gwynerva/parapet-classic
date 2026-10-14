"""Petra Radko's men's looks: her "twin brother" whom nobody has ever seen next to her (it is her
in disguise), after the owner's photos, on the man's body (base 1): an ordinary slim young man in
roomy clothes. His head (one face, four hairstyles, the blinks) is drawn anew in pr_him_face.py,
his chests, torsos, shins and shoes in pr_him_body.py, his gear in pr_him_props.py; the man's
arms, thighs and knees are recoloured and grown here.

- swordsman: his own mid-brown hair in a mop with a heavy straight fringe, an oversized navy tee
  with a grey-trimmed V-neck, loose black joggers with a white drawstring, knitted slipper-socks
  striped olive-yellow and black, the ornate longsword in a black scabbard on his back.
- fencer: the hair grown out and swept to the side, a sleeveless top of sheer brown mesh (his
  skin through it) with a black cord round the neck, bare arms, loose black trousers, black
  running shoes on white soles, two yellow-and-black feders on his back.
- rebel: wet waves to the jaw curling at the tips, a faded maroon tee too big for him with a
  stretched black-trimmed neckline, a sprayed circle-A, holes and a tiny badge, black joggers
  with white drawstrings, black-and-white checkerboard slip-ons.
- undercover: him as a 2B cosplayer in street clothes: a white bob wig with a long fringe swept
  over one eye (no blindfold), a sly half-smile, big black headphones round the neck, a long open
  black cardigan with tails over a white shirt, the straps of a black backpack, white gloves, a
  green band on the right wrist, slim indigo jeans, white canvas low-tops (no katana: on his back
  it read as a stray white stick).

Each look's accent (its effect's `</>` and the mask's ribbon) is a colour of the outfit. Run it
(`python3 pr_looks.py`, or petra.py) to write the four looks."""
import json

from lookgen import *
from heads import Palette
from body import outfit_parts
from gridpng import sheet
import pr_him_face as F
import pr_him_body as B
import pr_him_props as P

# His skin on the man's arms and hands (light to dark), as the head's.
ARM = [F.SKIN[k] for k in 'XWMSD']
BARE_ARMS = [
    *skin(ARM, ARMS + HAND, with_shins=False),
    # No watch: the wrist in skin.
    recolor(FOREARM, {WRIST[0]: ARM[2], WRIST[1]: ARM[3], WRIST[2]: ARM[3]}),
]


def sleeves(ramp5, sprites=UPPER_ARM):
    """Sleeves over the man's bare arm: its skin tones onto the cloth's ramp (light to dark)."""
    return recolor(sprites, {**ramp(SKIN, ramp5), **{c: ramp5[i] for c, i in HAND_EXTRA.items()}})


def legs(ramp5):
    """The man's shorts (thighs, knees) in the trousers' ramp."""
    return recolor(THIGH + KNEE, ramp(SHORTS, ramp5))


def grid_rows(rows, pal, legend=P.PROPS):
    """An attachment's rows (characters of `legend`, '+' the pivot) in the look's palette."""
    return enc(rows, legend, pal)


def make(id_, rules, plan, parts, hair, accent, attachments=None, ribbons=None, turn=(), post=None,
         smirk=False):
    """Writes a look: the man's arms, thighs and knees by `rules` grown by `plan`, the drawn `parts`,
    the head with `hair`, gear; turns the upright pictures (and `turn`), then `post` (the mesh)."""
    pal = Palette()
    look = {'id': id_, 'base': 1, 'accent': accent, '_raw_heads': True, 'recolor': rules, 'parts': {}}
    for k, p in outfit_parts(1, rules, plan).items():
        look['parts'][k] = pal.rows(p)
    for k, p in parts.items():
        look['parts'][k] = pal.rows(p)
    look['parts']['25'] = pal.rows(F.head(hair, smirk=smirk))
    look['parts']['29'] = pal.rows(F.head(hair, True, smirk=smirk))
    for face in F.FACES:
        look['parts'][str(face)] = pal.rows(F.head(hair, face=face, smirk=smirk))
    if attachments:
        look['attachments'] = {}
        for name, (layer, pics, *legend) in attachments.items():
            look['attachments'][name] = {'layer': layer,
                                         'sprites': {k: grid_rows(v, pal, *legend) for k, v in pics.items()}}
    if ribbons:
        look['ribbons'] = ribbons
    look['palette'] = pal.pal
    path = write_look('petra', look)
    rotate(path, ['25', *[str(k) for k in B.UPRIGHT if str(k) in parts], *turn])
    if post:
        with open(path, encoding='utf-8') as f:
            written = json.load(f)
        write_json(path, post(written))
    preview(id_)
    return look


# ------------------------------------------------------------------------------- swordsman
NAVY5 = [B.NAVY[k] for k in 'ABCEF']
JOG5 = [B.JOG[k] for k in 'jJKqQ']
swordsman = make('swordsman', [sleeves(NAVY5), *BARE_ARMS, legs(JOG5)],
                 {'upper-arm': 1, 'forearm': 0, 'hand': 0, 'thigh': 1, 'knee': 1}, B.parts('swordsman'), 'mop',
                 '#7d8fe0', attachments={'sword': ('back', {'57': P.LONGSWORD})}, turn=['sword@57'])

# ---------------------------------------------------------------------------------- fencer
fencer = make('fencer', [*BARE_ARMS, legs(JOG5)], {'upper-arm': 0, 'forearm': 0, 'hand': 0, 'thigh': 1, 'knee': 1},
              B.parts('fencer'), 'swept', '#f0cc3a',
              attachments={'feders': ('back', {'57': P.FEDERS})}, turn=['feders@57'], post=B.weave)

# ----------------------------------------------------------------------------------- rebel
MAROON5 = [B.MAROON[k] for k in 'ABCEF']
rebel = make('rebel', [sleeves(MAROON5), *BARE_ARMS, legs(JOG5)],
             {'upper-arm': 2, 'forearm': 0, 'hand': 0, 'thigh': 1, 'knee': 1}, B.parts('rebel'), 'waves', '#c8505a')

# ------------------------------------------------------------------------------ undercover
CARD5 = [B.CARD[k] for k in 'ABCEF']
JEANS5 = [B.JEANS[k] for k in 'jJKZY']
GLOVE = ['#ffffff', '#f2f2f6', '#dcdee6', '#b4b8c6', '#8a8e9e']
undercover = make('undercover', [
    sleeves(CARD5, ARMS),
    recolor(HAND, {**ramp(SKIN, GLOVE), **{c: GLOVE[i] for c, i in HAND_EXTRA.items()}}),
    # A thin green silicone band on the right wrist, at the sleeve's cuff.
    recolor(FOREARM, {WRIST[0]: '#3cc064', WRIST[1]: CARD5[2], WRIST[2]: CARD5[3]}) | {'on': 'right'},
    recolor(FOREARM, {WRIST[0]: CARD5[1], WRIST[1]: CARD5[2], WRIST[2]: CARD5[3]}) | {'on': 'left'},
    legs(JEANS5),
], {'upper-arm': 1, 'forearm': 1, 'hand': 0, 'thigh': 0, 'knee': 0}, B.parts('undercover'), 'bob', '#d8def0',
    attachments={'pack': ('back', {'57': P.BACKPACK}), 'tails': ('hips', B.tails(), B.CARD)},
    turn=['pack@57', 'tails@34'], smirk=True)

# His heads magnified (out/pr-heads.png): each hair's 25, 29 and the faces 76-78.
pal = Palette()
sheet('pr-heads.png', [(pal.rows(fn()), pal.pal) for _, fn in F.VIEWS], scale=10, per_row=5)
print('petra looks written')
