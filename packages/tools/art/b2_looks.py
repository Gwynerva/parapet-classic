"""B-2's looks: 2B of NieR:Automata, her own face drawn anew (b2_heads.py) and her body drawn here
(b2_parts.py).

* `android` (YoRHa No.2 Type B): the black velvet dress with its high turtleneck and puffed
  sleeves, the feather cuffs, the white forearms and black gloves, the bell skirt to mid-thigh
  with its light grey lining and the slit at the front, the band of dark stocking, the black
  thigh-high stiletto boots, the white katana Virtuous Contract floating behind her back.
* `replica` (2P's Body Replica): the same body inverted, as the DLC has it: black hair, a white
  blindfold and hairband, the dress, its feathers and the boots white, the lining black, the
  forearms black and the gloves white.
* `kimono` (YoRHa Uniform 1): the sleeveless black mini-kimono with its white-piped wrap collar,
  bare shoulders and detached sleeves, white gloves, the wide light grey obi with its black cord
  and the bow's white knot and tassel, the short skirt trimmed white, the long black tail panel
  down her back (a ribbon), sheer black stockings tied with white cord bows, black stiletto pumps
  strapped round the ankle, the white fox mask on the side of her head.

All the looks wear her face (25, 25:left, 29, 29:left; the kimono's with the mask). A slender
doll on Blaise's body: thin legs on stiletto heels, puffed upper sleeves, the narrow waist and the
bell of the skirt. The upright pictures are drawn; the look tool turns them."""
from lookgen import *
from heads import Pic, Palette
from gridpng import sheet
import b2_heads as BH
import b2_parts as BP


def enc(rows, legend, pal):
    """Text rows in a picture legend → rows in the look's palette."""
    return [''.join(c if c in '.+' else pal.char(legend[c]) for c in r) for r in rows]


def shift(rows, mapping):
    return [''.join(mapping.get(c, c) for c in r) for r in rows]


# A tone darker for the far arm and leg.
FAR = {'a': 'b', 'b': 'c', 'c': 'd', 'g': 'G', 'G': 'j', 'j': 'J', 'S': 's', 's': 't', 't': 'T', 'n': 'N',
       'N': 'M', 'o': 'O', 'O': 'u'}

# Her skin on the body (the head's tones).
SKIN = {'S': BH.SKIN['S'], 's': BH.SKIN['s'], 't': BH.SKIN['t'], 'T': BH.SKIN['T']}
SKIN_BASE = ['#fff3bd', '#ffd794', '#e7aa6b', '#bd7942', '#734521']
# Virtuous Contract: the white blade and hilt, silver, the black of the collar and the diamonds.
SWORD = {'w': '#f8f6f0', 'W': '#d4d0c8', 'v': '#a29e98', 'i': '#b8bac2', 'I': '#7a7c86', 'z': '#141418'}

ANDROID = {
    # Black velvet (sheen → outline), cool in its sheen like the anime's.
    'a': '#7c8090', 'b': '#4c4e5a', 'c': '#2c2c35', 'd': '#1b1b22', 'e': '#0c0c10',
    # Glossy black leather: gloss, lit, mid, dark.
    'g': '#8c8e9c', 'G': '#45464f', 'j': '#25252c', 'J': '#17171c',
    # The sheer stocking over skin, its band.
    'n': '#9c7a72', 'N': '#6e5458', 'M': '#4a383e', 'k': '#121216',
    **SKIN,
    # The white forearms and leotard, the lining.
    'o': '#f6f4ee', 'O': '#d6d2ca', 'u': '#a8a4a0', 'r': '#b8bac0', 'R': '#8a8c94',
}
GLOVE_BLACK = ['#5a5c68', '#3a3b45', '#25252c', '#17171c', '#0c0c10']

# 2P: white velvet (sheen → outline), white leather, white sheer stocking, the lining black, the
# forearms black.
REPLICA = {
    'a': '#ffffff', 'b': '#f6f4f0', 'c': '#e8e4de', 'd': '#cbc7c0', 'e': '#868290',
    'g': '#ffffff', 'G': '#f0eee8', 'j': '#d6d2cc', 'J': '#b2aea8',
    'n': '#f4e4dc', 'N': '#dcc6be', 'M': '#b8a29c', 'k': '#f2f0ec',
    **SKIN,
    'o': '#4a4a56', 'O': '#2c2c35', 'u': '#18181e', 'r': '#2a2a32', 'R': '#141418',
}
GLOVE_WHITE = ['#ffffff', '#f0eee8', '#d4d0c8', '#aeaaa4', '#6e6a72']


def hand_rules(glove):
    return [recolor(HAND, {**ramp(SKIN_BASE, glove), '#ffcb84': glove[1], '#a56531': glove[3]})]


def body(leg):
    """The android's body pictures (upright; the far arm and leg a tone darker)."""
    return {
        '57': BP.CHEST_57, '61': BP.CHEST_61, '34': BP.TORSO_34, '38': BP.TORSO_38,
        '5': BP.UPPER_ARM, '9': shift(BP.UPPER_ARM, FAR), '1': BP.FOREARM, '1:far': shift(BP.FOREARM, FAR),
        '53': BP.THIGH, '49': shift(BP.THIGH, FAR), '62': BP.KNEE, '30': BP.SHIN,
        '39': BP.BOOT_39, '43': shift(BP.BOOT_39, FAR), '47': BP.BOOT_47, '48': BP.BOOT_48,
    }


TURN = [25, '25:left', 57, 34, 5, 9, 1, '1:far', 49, 53, 30, 39, 43]


def make(look_id, leg, pics, heads, glove, accent, attachments, turn, ribbons=None, effect=None):
    """Writes a look: the pictures drawn here (`pics`: key → rows in `leg`), the heads, the gloves,
    the attachments ({name: (layer, {key: rows})}); turns the upright pictures."""
    pal = Palette()
    look = {'id': look_id, 'base': 0, 'accent': accent, 'recolor': hand_rules(glove), 'parts': dict(no_ponytail())}
    full = {**leg, **SWORD}
    for k, rows in pics.items():
        look['parts'][k] = enc(rows, full, pal)
    for k, p in heads.items():
        look['parts'][k] = pal.rows(p)
    look['attachments'] = {name: {'layer': layer, 'sprites': {k: enc(rows, full, pal) for k, rows in sprites.items()}}
                           for name, (layer, sprites) in attachments.items()}
    if ribbons:
        look['ribbons'] = {k: f(pal, full) for k, f in ribbons.items()}
    if effect:
        look['effect'] = effect
    look['palette'] = pal.pal
    path = write_look('b2', look)
    rotate(path, turn)
    preview(look_id)
    return path


def heads(hair=BH.HAIR_WHITE, velvet=BH.VELVET, extra=None):
    return {'25': BH.profile(False, hair, velvet, extra), '25:left': BH.profile(True, hair, velvet, extra),
            '29': BH.front(False, hair, velvet, extra), '29:left': BH.front(True, hair, velvet, extra)}


SWORD_SPRITES = {'57': BP.sword('side'), '61': BP.sword('front')}


def android():
    make('android', ANDROID, body(ANDROID), heads(), GLOVE_BLACK, '#d9c38a',
         {'sword': ('back', SWORD_SPRITES), 'skirt': ('hips', {'34': BP.SKIRT_34, '38': BP.SKIRT_38})},
         TURN + ['skirt@34', 'sword@57'])


def replica():
    make('replica', REPLICA, body(REPLICA), heads(BH.HAIR_BLACK, BH.VELVET_WHITE), GLOVE_WHITE, '#e8e4dc',
         {'sword': ('back', SWORD_SPRITES), 'skirt': ('hips', {'34': BP.SKIRT_34, '38': BP.SKIRT_38})},
         TURN + ['skirt@34', 'sword@57'])


# YoRHa Uniform 1: black satin, the white trim and cords, the obi's greys, the sheer black
# stockings, black patent pumps.
KIMONO = {
    'a': '#62667a', 'b': '#3c3e4a', 'c': '#25252e', 'd': '#18181f', 'e': '#0c0c10',
    'o': '#f4f2ec', 'O': '#cfcbc4', 'u': '#a29e98',
    'p': '#e2ded4', 'P': '#bdb8ac', 'q': '#8e8a80',
    'g': '#9496a4', 'G': '#4a4b56', 'j': '#26262e', 'J': '#17171c',
    'n': '#5e5056', 'N': '#3e343a', 'M': '#282228', 'k': '#141418',
    **SKIN,
}


def kimono_heads():
    return {k: BH.masked(p, k) for k, p in heads().items()}


def tail(pal, leg):
    """The long black panel down her back from the obi to the ankles."""
    return {'anchor': 'hips', 'offset': [2, -2], 'texture': enc(BP.TAIL, leg, pal), 'segments': 6,
            'stiffness': 0.12, 'gravity': 380, 'drag': 2.6}


def kimono():
    pics = {
        '57': BP.K_CHEST_57, '61': BP.K_CHEST_61, '34': BP.K_TORSO_34, '38': BP.K_TORSO_38,
        '5': BP.K_UPPER_ARM, '9': shift(BP.K_UPPER_ARM, FAR), '1': BP.K_FOREARM, '1:far': shift(BP.K_FOREARM, FAR),
        '53': BP.K_THIGH, '49': shift(BP.K_THIGH, FAR), '62': BP.K_KNEE, '30': BP.K_SHIN,
        '39': BP.PUMP_39, '43': shift(BP.PUMP_39, FAR), '47': BP.PUMP_47, '48': BP.PUMP_48,
    }
    make('kimono', KIMONO, pics, kimono_heads(), GLOVE_WHITE, '#c8383c',
         {'sword': ('back', SWORD_SPRITES), 'skirt': ('hips', {'34': BP.K_SKIRT_34, '38': BP.K_SKIRT_38})},
         TURN + ['skirt@34', 'sword@57'], ribbons={'tail': tail})


android()
replica()
kimono()

pal = Palette()
sheet('b2-heads.png', [(pal.rows(p), pal.pal) for p in
                       [*heads().values(), *heads(BH.HAIR_BLACK, BH.VELVET_WHITE).values()]], scale=12)
print('b2 looks written')
