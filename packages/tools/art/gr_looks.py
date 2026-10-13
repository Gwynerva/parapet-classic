"""Grove's looks: Carl "CJ" Johnson, drawn anew (gr_heads.py, gr_parts.py).

- grove-tank: the start of the game and the "here we go again" meme: a white tank top, the
  boxers' waistband over a brown belt, baggy mid-blue jeans, black low-tops with light stripes.
- grove-green: the Grove Street colours: an oversized green shirt open over a longer white tee,
  long loose sleeves, a green rag knotted at the back (its tails fly), the same jeans, black
  sneakers with a white toe and sole.
- grove-cover: the cover art and the BMX artwork: a pale grey-mint shirt over the tank, short
  sleeves, dark navy jeans, tan work boots."""
import json

from lookgen import *
from heads import Palette
from body import outfit_parts
from gridpng import sheet
import gr_heads
import gr_parts

H = gr_heads.SKIN
# The arms and hands: the original man's, in his skin (light → dark).
ARM_SKIN = [H['W'], H['L'], H['M'], H['S'], H['D']]
RULES = [
    *skin(ARM_SKIN, ARMS + HAND, with_shins=False),
    recolor(FOREARM, {WRIST[0]: ARM_SKIN[2], WRIST[1]: ARM_SKIN[3], WRIST[2]: ARM_SKIN[4]}),
]
FACES = {'25': gr_heads.profile, '29': gr_heads.front, '76': gr_heads.blink, '77': gr_heads.squint,
         '78': gr_heads.pain}
G = gr_parts.GREEN
P = gr_parts.PALE


def build(look_id, parts, rules=RULES, rag=False, extra=None):
    pal = Palette()
    look = {'id': look_id, 'base': 1, 'accent': '#3fae4c', '_raw_heads': True, 'recolor': rules, 'parts': {}}
    for k, fn in FACES.items():
        look['parts'][k] = pal.rows(fn(rag))
    full_profile = look['parts']['25']
    look['parts']['25'] = pal.rows(gr_heads.profile_short(rag))
    for k, p in parts.items():
        look['parts'][k] = pal.rows(p)
    if extra:
        extra(look, pal)
    look['palette'] = pal.pal
    path = write_look('grove', look)
    # The tilted heads from the profile without its long neck, then the profile with it.
    rotate(path, [25])
    with open(path, encoding='utf-8') as f:
        written = json.load(f)
    written['parts']['25'] = full_profile
    write_json(path, written)
    rotate(path, gr_parts.UPRIGHT)
    preview(look_id)
    with open(path, encoding='utf-8') as f:
        return json.load(f)


tank = build('grove-tank', gr_parts.tank_parts())

# ---------------------------------------------------------------- grove-green
# Long loose sleeves: the arms in the shirt's green, a pixel wider all round, a darker cuff.
SLEEVE_GREEN = [G['a'], G['b'], G['c'], G['d'], G['e']]
GREEN_RULES = [
    *skin(ARM_SKIN, HAND, with_shins=False),
    recolor(ARMS, {**ramp(SKIN, SLEEVE_GREEN), **{c: SLEEVE_GREEN[i] for c, i in HAND_EXTRA.items()}}),
    recolor(FOREARM, {WRIST[0]: G['c'], WRIST[1]: G['d'], WRIST[2]: G['e']}),
]


def green_extra(look, pal):
    for k, p in outfit_parts(1, GREEN_RULES, {'upper-arm': 1, 'forearm': 1}).items():
        look['parts'][k] = pal.rows(p)
    # The rag's two tails, from the knot at the back of the head.
    look['ribbons'] = {
        'rag': {'anchor': 'head', 'offset': [7, -3], 'segments': 3, 'length': 2.5, 'width': [2, 1],
                'colors': [gr_heads.RAG['C'], gr_heads.RAG['E'], gr_heads.RAG['E']], 'gravity': 90,
                'drag': 3, 'stiffness': 0.2},
    }


green = build('grove-green', gr_parts.green_parts(), GREEN_RULES, rag=True, extra=green_extra)

# ---------------------------------------------------------------- grove-cover
# Short sleeves of the pale shirt over the upper arms, the forearms bare.
SLEEVE_PALE = [P['h'], P['h'], P['i'], P['k'], P['l']]
COVER_RULES = [
    *skin(ARM_SKIN, FOREARM + HAND, with_shins=False),
    recolor(FOREARM, {WRIST[0]: ARM_SKIN[2], WRIST[1]: ARM_SKIN[3], WRIST[2]: ARM_SKIN[4]}),
    recolor(UPPER_ARM, {**ramp(SKIN, SLEEVE_PALE), **{c: SLEEVE_PALE[i] for c, i in HAND_EXTRA.items()}}),
]


def cover_extra(look, pal):
    for k, p in outfit_parts(1, COVER_RULES, {'upper-arm': 1}).items():
        look['parts'][k] = pal.rows(p)


cover = build('grove-cover', gr_parts.cover_parts(), COVER_RULES, extra=cover_extra)

# The heads magnified (out/gr-heads.png).
sheet('gr-heads.png', [(look['parts'][k], look['palette']) for look in (tank, green) for k in FACES], scale=10,
      per_row=5)
print('grove looks written')
