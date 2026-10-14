"""Widow's looks: Widowmaker of Overwatch, her own head drawn anew (wd_heads.py), her body drawn
upright (wd_parts.py) and turned by the look tool, her long high ponytail a ribbon from the cuff on
her crown, Widow's Kiss across her back.

* `widow-classic` (Overwatch): the glossy magenta bodysuit with its high collar and the deep V
  down to the waist edged in light blue, the dark side panels that cinch the waist, the lilac
  leg panels cut high on the hip with their black ribs, the grey armoured knee-high stiletto boots
  with the pointed knee guards and blue claws; bare arms, the dark grey shoulder plate with its
  glowing W and the grappling hook's gauntlet on her LEFT arm, the "cauchemar" tattoo on her
  RIGHT forearm, dark grey gloves; the raised Infra-Sight visor; the rifle on her back.

All looks wear her face (25, 29) and the profile blinking and wincing (76-78)."""
import os
from lookgen import *
from heads import Palette
from body import part, apply_rules, shrink, FAMILIES
from gridpng import sheet
import wd_heads as H
import wd_parts as P

HAND_TONES = ['#fff3bd', '#ffd794', '#ffcb84', '#e7aa6b', '#bd7942', '#a56531', '#734521']


def hand_rules(ramp5):
    """The hands (Blaise's hand tones by lightness onto a five-tone ramp: a glove)."""
    m = {c: ramp5[min(4, round(i * 4 / (len(HAND_TONES) - 1)))] for i, c in enumerate(HAND_TONES)}
    return [recolor(HAND, m)]


def slim_hand(pic):
    """Her gloved hand a pixel smaller all round than Blaise's (slender), the tips the thinning
    leaves standing (a pixel with one neighbour or none) gone."""
    shrink(pic, 1)
    for _ in range(2):
        old = [r[:] for r in pic.g]
        for y in range(pic.h):
            for x in range(pic.w):
                near = sum(1 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
                           if 0 <= x + dx < pic.w and 0 <= y + dy < pic.h and old[y + dy][x + dx] is not None)
                if old[y][x] is not None and near <= 1:
                    pic.g[y][x] = None
    return pic


SKIN = {k: H.SKIN[k] for k in 'WSstTD'}


def tail(head, pal):
    """The ponytail: a ribbon from the cuff on her crown, streaming back as she runs."""
    return {'anchor': 'head', 'offset': list(H.TAIL_ROOT), 'texture': enc(H.TAIL, H.head_legend(head), pal),
            'segments': 5, 'gravity': 240, 'drag': 2.8, 'stiffness': 0.1}


def body(cut, legend_far=None, arms='bare'):
    """The pictures every look has, by part: `cut` maps a part to its picture (the chest and the
    torso in profile and turned to us, the thigh, the knee, the shin, the boot's foot); the far leg
    a tone darker; the arms: her right one bare with the tattoo (or sleeved: `arms` a mapping of
    the skin's tones onto the sleeve's), the left one with the shoulder's plate and the
    gauntlet."""
    far = legend_far or P.FAR
    arm, plate, fore = P.ARM_5, P.PLATE_5, P.FORE_1_RIGHT
    if arms != 'bare':
        arm, fore = shift(arm, arms), shift(fore, arms)
        plate = shift(plate, {k: v for k, v in arms.items() if k in 'StT' or k == 's'})
    pics = {
        '57': cut['57'], '61': cut['61'], '34': cut['34'], '38': cut['38'],
        '5:right': arm, '9:right': shift(arm, far), '5:left': plate, '9:left': shift(plate, far),
        '1:right': fore, '1:left': P.FORE_1_LEFT,
        '53': cut['53'], '49': shift(cut['53'], far), '62': cut['62'], '30': cut['30'],
        '39': cut['39'], '43': shift(cut['39'], far), '47': cut['47'], '48': cut['48'],
    }
    return pics


def make(look_id, legend, pics, glove, accent, head='classic', attachments=None, ribbons=None, effect=None,
         turn=()):
    """Writes a look: the pictures drawn here (`pics`: key → rows in `legend`), the gloved hands,
    the heads of `head` (wd_heads.HEADS) and the profile's faces, the ponytail unless the hair is
    up, the attachments ({name: (layer, {key: rows})}) and the ribbons; turns the upright
    pictures."""
    pal = Palette()
    look = {'id': look_id, 'base': 0, 'accent': accent, 'parts': dict(no_ponytail())}
    rules = hand_rules(glove)
    for id_ in FAMILIES['hand']:
        look['parts'][str(id_)] = pal.rows(slim_hand(apply_rules(part(0, id_), id_, rules)))
    for k, rows in pics.items():
        look['parts'][k] = enc(rows, legend, pal)
    look['parts']['25'] = pal.rows(H.profile(look=head))
    look['parts']['29'] = pal.rows(H.front(look=head))
    for f in H.FACES:
        look['parts'][str(f)] = pal.rows(H.profile(face=f, look=head))
    if attachments:
        look['attachments'] = {name: {'layer': layer, 'sprites': {k: enc(rows, legend, pal) for k, rows in sprites.items()}}
                               for name, (layer, sprites) in attachments.items()}
    ribbons = dict(ribbons or {})
    if H.has_tail(head):
        ribbons['tail'] = lambda pal: tail(head, pal)
    if ribbons:
        look['ribbons'] = {k: f(pal) for k, f in ribbons.items()}
    if effect:
        look['effect'] = effect
    look['palette'] = pal.pal
    path = write_look('widow', look)
    upright = [k for k in ('25', '57', '34', '49', '53', '62', '30', '39', '43', '5', '9', '5:right', '5:left',
                           '9:right', '9:left', '1', '1:right', '1:left') if k in look['parts']]
    rotate(path, upright + list(turn))
    preview(look_id)
    return pal, look


RIFLE = {'57': P.rifle('side'), '61': P.rifle('front')}


# --------------------------------------------------------------------------------------------
# Classic (Overwatch)
# --------------------------------------------------------------------------------------------
CLASSIC = {
    # Glossy magenta latex: gloss, light, mid, shade, outline.
    'a': '#f2a6f6', 'b': '#c866da', 'c': '#a048b8', 'd': '#723088', 'e': '#34143e',
    # Lilac grey leg panels, their black ribs.
    'f': '#9896c2', 'g': '#73709c', 'h': '#544f78', 'j': '#241f36', 'k': '#120e1a',
    # The light blue trim.
    'p': '#aac0f0', 'P': '#7286c4',
    **SKIN,
    # Dark grey armour and carbon; the gauntlet's violet glow.
    'm': '#8e9098', 'n': '#666972', 'N': '#46484f', 'q': '#2a2b32', 'o': '#121216', 'v': '#b880ee',
    'V': '#ecd0ff',
    # Grey boots, their blue claws.
    'B': '#aaa6a0', 'C': '#7c7973', 'E': '#5a5753', 'F': '#3c3a37', 'x': '#88aee4', 'X': '#d0e2fa',
    # The tattoo; the rifle's blue-lilac metal and its red light.
    'z': '#2c2240', 'i': '#7c82c0', 'I': '#2e3150', 'r': '#ff3a3a',
}
GLOVE = ['#8a8b92', '#67686e', '#4c4d53', '#333439', '#1c1d21']
CLASSIC_CUT = {'57': P.CLASSIC_57, '61': P.CLASSIC_61, '34': P.CLASSIC_34, '38': P.CLASSIC_38,
               '53': P.THIGH_53, '62': P.KNEE_62, '30': P.SHIN_30, '39': P.BOOT_39, '47': P.BOOT_47,
               '48': P.BOOT_48}


def classic():
    return make('widow-classic', CLASSIC, body(CLASSIC_CUT), GLOVE, '#c04ae0',
                attachments={'rifle': ('back', RIFLE)}, turn=['rifle@57'])


# --------------------------------------------------------------------------------------------
# Noire (the pre-order skin): black and blood red
# --------------------------------------------------------------------------------------------
NOIRE = {
    # Black latex: sheen, light, mid, shade, outline; the blood-red corset and cartridges.
    'a': '#76748a', 'b': '#3e3c4c', 'c': '#282632', 'd': '#1a1822', 'e': '#08070b',
    'r': '#c8344e', 'R': '#8a1c32', 'X': '#ff6a7e',
    'f': '#3e3c4c', 'g': '#282632', 'h': '#1a1822', 'j': '#08070b', 'k': '#1a1822',
    'p': '#d23c56', 'P': '#8a1c32',
    **SKIN,
    # Black armour; the gauntlet's red glow.
    'm': '#6a6878', 'n': '#45434f', 'N': '#2c2a34', 'q': '#18161c', 'o': '#060508', 'v': '#e8304e',
    'V': '#ffb0bc',
    # Black stilettos, the red soles and heels.
    'B': '#6a6878', 'C': '#3a3844', 'E': '#26242e', 'F': '#18161e', 'x': '#d02842',
    'z': '#3c3258', 'i': '#5e5c70', 'I': '#2a2836',
}
NOIRE_GLOVE = ['#5c5a68', '#3c3a46', '#28262f', '#1a1820', '#0c0b10']
NOIRE_CUT = {'57': P.NOIRE_57, '61': P.NOIRE_61, '34': P.NOIRE_34, '38': P.NOIRE_38,
             '53': shift(P.THIGH_53, P.NOIRE_LEG), '62': P.NOIRE_62, '30': P.NOIRE_30, '39': P.NOIRE_39,
             '47': P.NOIRE_47, '48': P.NOIRE_48}


def noire():
    pics = body(NOIRE_CUT, arms=P.NOIRE_ARM)
    pics['5:left'] = shift(P.PLATE_5, P.NOIRE_PLATE)
    pics['9:left'] = shift(pics['5:left'], P.FAR)
    return make('noire', NOIRE, pics, NOIRE_GLOVE, '#e8304e', head='noire',
                attachments={'rifle': ('back', RIFLE)}, turn=['rifle@57'])


# --------------------------------------------------------------------------------------------
# Odile (the black swan of Swan Lake)
# --------------------------------------------------------------------------------------------
ODILE = {
    # Teal satin corset: sheen → outline; its black lace (q), black tulle (r R), teal ribbons (k).
    'a': '#a6e6dc', 'b': '#5cb4aa', 'c': '#3c8e88', 'd': '#286462', 'e': '#0e2a2c',
    'r': '#3a3846', 'R': '#1c1a22',
    'f': '#56546a', 'g': '#383646', 'h': '#262430', 'j': '#0c0b10', 'k': '#4cc0b0',
    'p': '#4cc0b0', 'P': '#2a8078',
    **SKIN,
    # The silver gauntlet, its rose glow; black feathers on the shoulder ('p' teal glints).
    'm': '#eeeef6', 'n': '#bcbccc', 'N': '#8a8aa0', 'q': '#16151c', 'o': '#08070b', 'v': '#ff58b8',
    'V': '#ffd6f0',
    # Black pumps, teal ribbons.
    'B': '#5a5a6a', 'C': '#30303c', 'E': '#1e1e26', 'F': '#121218', 'x': '#2e9a8e', 'X': '#8ee0d4',
    'z': '#3c3258', 'i': '#4a8e8a', 'I': '#1c3838',
}
ODILE_GLOVE = ['#5a5868', '#3a3846', '#26242e', '#18161e', '#0c0b10']
ODILE_CUT = {'57': P.ODILE_57, '61': P.ODILE_61, '34': P.ODILE_34, '38': P.ODILE_38,
             '53': P.ODILE_53, '62': P.ODILE_62, '30': P.ODILE_30, '39': P.ODILE_39, '47': P.ODILE_47,
             '48': P.ODILE_48}
# The feathers on her left shoulder instead of the plate: black, a teal glint.
ODILE_PLATE = {'m': 'r', 'n': 'R', 'N': 'R', 'p': 'k'}
# Her left forearm in the silver gauntlet: the plate pictures' darks as silver.
ODILE_FAR = {**P.FAR, 'k': 'x'}


def odile():
    pics = body(ODILE_CUT, legend_far=ODILE_FAR)
    pics['5:left'] = shift(P.PLATE_5, ODILE_PLATE)
    pics['9:left'] = shift(pics['5:left'], P.FAR)
    return make('odile', ODILE, pics, ODILE_GLOVE, '#4cc0b0', head='odile',
                attachments={'rifle': ('back', RIFLE), 'tutu': ('hips', {'34': P.TUTU_34, '38': P.TUTU_38})},
                turn=['rifle@57', 'tutu@34'])


# --------------------------------------------------------------------------------------------
# Comtesse (the countess Guillard)
# --------------------------------------------------------------------------------------------
COMTESSE = {
    # The violet frock coat: sheen → outline; gold frogging and edges; the white lace jabot.
    'a': '#a68cd4', 'b': '#7660aa', 'c': '#584484', 'd': '#3e2e60', 'e': '#1a1026',
    'p': '#eebc7a', 'P': '#b07848', 'r': '#f6eef6', 'R': '#c6b6d0',
    # Violet breeches, a gold seam down them.
    'f': '#8670b4', 'g': '#644e92', 'h': '#463670', 'j': '#1a1026', 'k': '#d4a060',
    **SKIN,
    # The bronze gauntlet and plate, the amber glow.
    'm': '#ffe2a4', 'n': '#d2a264', 'N': '#9a6a38', 'q': '#5a3a1c', 'o': '#1e1008', 'v': '#ffa030',
    'V': '#ffe6b0',
    # Brown riding boots, the tan suede cuffs, the spur.
    'B': '#b88a5c', 'C': '#8a5e38', 'E': '#63401f', 'F': '#422a12', 'x': '#a8805a', 'X': '#cca47a',
    'z': '#3c3258', 'i': '#d4a464', 'I': '#7a5028',
}
COMTESSE_GLOVE = ['#8a6a4e', '#6a4c34', '#4e3624', '#362414', '#1e140a']
COMTESSE_CUT = {'57': P.COMTESSE_57, '61': P.COMTESSE_61, '34': P.COMTESSE_34, '38': P.COMTESSE_38,
                '53': P.COMTESSE_53, '62': P.COMTESSE_62, '30': P.COMTESSE_30, '39': P.COMTESSE_39,
                '47': P.COMTESSE_47, '48': P.COMTESSE_48}


def comtesse():
    pics = body(COMTESSE_CUT, arms=P.SLEEVE)
    return make('comtesse', COMTESSE, pics, COMTESSE_GLOVE, '#eebc7a', head='comtesse',
                attachments={'rifle': ('back', RIFLE), 'coat': ('back', {'34': P.COAT_34, '38': P.COAT_38})},
                turn=['rifle@57', 'coat@34'])


LOOKS = ['widow-classic', 'noire', 'odile', 'comtesse']
# WIDOW_ONLY=widow-classic,noire writes only those (while drawing one).
_only = [k for k in os.environ.get('WIDOW_ONLY', '').split(',') if k]
_fns = {'widow-classic': classic, 'noire': noire, 'odile': odile, 'comtesse': comtesse}
pals = [_fns[k]()[0] for k in LOOKS if not _only or k in _only]
if pals:
    sheet('wd-heads.png', [(pals[0].rows(p), pals[0].pal) for lk in H.HEADS for p in (H.profile(look=lk), H.front(look=lk))],
          scale=10)
print('widow looks written')
