"""Azure's looks: Liara T'Soni, her own head drawn anew (az_heads.py), her body drawn upright
(az_parts.py) and turned by the look tool. A slender scholar's build: thin limbs, small gloved hands
(Blaise's a pixel smaller all round), a teardrop silhouette of a light top over knee-length coat
skirts (a hips attachment, split in front) and dark legs in knee boots, each look's boots its own.

* `scholar` (Mass Effect 1): the sage-green dress-coat to the knee, split in front, the light
  asymmetric yoke edged with thick black piping, the ribbed standing collar, a white stripe down
  the sleeves and the dark X-05 armbands, black gloves, black leggings, smooth black knee boots on
  a ridged sole.
* `broker` (Lair of the Shadow Broker, Mass Effect 3): the white coat with indigo piping, collar
  and straps, grey grid panels, grey ribbed bracers, dark leggings, grey ribbed armoured knee boots
  with a white side panel and a grey toe cap; her drone Glyph comes along (the `glyph` effect).
* `leather` (Mass Effect 3, alternate outfit 3): glossy black leather with broad pink-red panels
  down the front of the body and the legs, a silver bracer on one forearm, long coat tails
  (ribbons), black knee boots with a grey knee plate and toe.
* `illium` (Mass Effect 2, the information broker on Illium): the sleeveless dark emerald coat to
  the knee over the ivory mesh bodysuit, ivory sleeves and gloves, dark green heeled boots.

All looks wear her head (25, 29) and the profile blinking and wincing (76-78)."""
import os
from lookgen import *
from heads import Palette
from body import part, apply_rules, shrink, FAMILIES
from gridpng import sheet
import az_heads as AH
import az_parts as AP

HAND_TONES = ['#fff3bd', '#ffd794', '#ffcb84', '#e7aa6b', '#bd7942', '#a56531', '#734521']


def hand_rules(ramp5):
    """The hands (Blaise's hand tones by lightness onto a five-tone ramp: her skin, a glove)."""
    m = {c: ramp5[min(4, round(i * 4 / (len(HAND_TONES) - 1)))] for i, c in enumerate(HAND_TONES)}
    return [recolor(HAND, m)]


def slim_hand(pic):
    """Her gloved hand a pixel smaller all round than Blaise's (a slender build), the tips the
    thinning leaves standing (a pixel with one neighbour or none) gone."""
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


def make(look_id, legend, pics, hands, accent, skirt=None, ribbons=None, effect=None):
    """Writes a look: the pictures drawn here (`pics`: key → rows in `legend`), the hands in their
    ramp, the heads and the profile's faces, the skirts (`skirt`: (rows on 34, rows on 38)) and the
    ribbons; turns the upright pictures."""
    pal = Palette()
    rules = hand_rules(hands)
    look = {'id': look_id, 'base': 0, 'accent': accent, 'parts': dict(no_ponytail())}
    for id_ in FAMILIES['hand']:
        look['parts'][str(id_)] = pal.rows(slim_hand(apply_rules(part(0, id_), id_, rules)))
    for k, rows in pics.items():
        look['parts'][k] = enc(rows, legend, pal)
    look['parts']['25'] = pal.rows(AH.profile())
    look['parts']['29'] = pal.rows(AH.front())
    for f in AH.FACES:
        look['parts'][str(f)] = pal.rows(AH.profile(f))
    turn = []
    if skirt:
        look['attachments'] = {'skirt': {'layer': 'hips', 'sprites': {'34': enc(skirt[0], legend, pal),
                                                                      '38': enc(skirt[1], legend, pal)}}}
        turn.append('skirt@34')
    if ribbons:
        look['ribbons'] = {k: {**r, 'texture': enc(r['texture'], legend, pal)} for k, r in ribbons.items()}
    if effect:
        look['effect'] = effect
    look['palette'] = pal.pal
    path = write_look('azure', look)
    upright = [k for k in ('25', '57', '34', '49', '53', '62', '30', '39', '43', '5', '9', '1', '1:right', '1:left')
               if k in look['parts']]
    rotate(path, upright + turn)
    preview(look_id)
    return pal, look


def body(legend, chest, torso, legs, knee, shin, shoes, upper, fore, far_leg=AP.LEG_FAR, far_arm=AP.ARM_FAR):
    """The pictures of a look by part: the chest and torso (profile, front), the near thigh (the far
    one shifted darker), the knee, the boot's shaft and its foot (39, 47, 48), the arms."""
    return {
        '57': chest[0], '61': chest[1], '34': torso[0], '38': torso[1],
        '53': legs, '49': shift(legs, far_leg), '62': knee, '30': shin,
        '39': shoes[0], '43': shift(shoes[0], AP.SHOE_FAR), '47': shoes[1], '48': shoes[2],
        '5': upper, '9': shift(upper, far_arm), '1': fore,
    }


# --------------------------------------------------------------------------------------------
# Scholar (Mass Effect 1)
# --------------------------------------------------------------------------------------------
SAGE = ['#86b08e', '#6a9a74', '#53805e', '#3e664a', '#2c4c38']
SCHOLAR = {**dict(zip('abcde', SAGE)), 'o': '#142219', 'w': '#dfe4ea', 'v': '#b4bcc6', 'u': '#7e8692',
           'k': '#121418', 'q': '#2c2f36', 'x': '#24262c', 'X': '#40444e', 'y': '#101114',
           'K': '#18191c', 'H': '#4c515c', 'J': '#060708', 'g': '#2a2c32', 'G': '#4a4d55'}


SCHOLAR_GLOVE = ['#4a4e58', '#30333b', '#1f2127', '#141519', '#0b0c0e']


def scholar():
    pics = body(SCHOLAR, (AP.SCHOLAR_57, AP.SCHOLAR_61), (AP.SCHOLAR_34, AP.SCHOLAR_38), AP.LEG_53, AP.LEG_62,
                AP.ME1_30, (AP.ME1_39, AP.ME1_47, AP.ME1_48), AP.SCHOLAR_5, AP.SCHOLAR_1)
    return make('scholar', SCHOLAR, pics, SCHOLAR_GLOVE, '#6ab4ff', skirt=(AP.SCHOLAR_SKIRT_34, AP.SCHOLAR_SKIRT_38))


# --------------------------------------------------------------------------------------------
# Broker (Lair of the Shadow Broker, Mass Effect 3)
# --------------------------------------------------------------------------------------------
WHITE = ['#f8f8f4', '#e4e4de', '#c6c6c2', '#9c9ca4', '#76768a']
BROKER = {**dict(zip('abcde', WHITE)), 'o': '#2c2c3c', 'w': '#d0d0cc', 'v': '#aeaeb0', 'u': '#808088',
          'r': '#4a4ccc', 'R': '#2c2c8c', 'k': '#16161a', 'q': '#3a3a42', 'x': '#2c2d36', 'X': '#464858',
          'y': '#18181f', 'K': '#8a8c92', 'H': '#b4b6ba', 'J': '#2e3036', 'P': '#ecece8', 'p': '#4a4c54',
          'g': '#24252a', 'G': '#3c3e44'}
GLOVE = ['#6a6c74', '#46484e', '#2c2d32', '#1c1d21', '#111214']


def broker():
    pics = body(BROKER, (AP.BROKER_57, AP.BROKER_61), (AP.BROKER_34, AP.BROKER_38), AP.BROKER_53, AP.BROKER_62,
                AP.BROKER_30, (AP.BROKER_39, AP.BROKER_47, AP.BROKER_48), AP.BROKER_5, AP.BROKER_1)
    return make('broker', BROKER, pics, GLOVE, '#6a70ff', skirt=(AP.BROKER_SKIRT_34, AP.BROKER_SKIRT_38),
                effect=['biotics', 'glyph'])


# --------------------------------------------------------------------------------------------
# Leather (Mass Effect 3, alternate outfit 3)
# --------------------------------------------------------------------------------------------
BLACK = ['#5a5868', '#34323e', '#24222c', '#18161e', '#0e0c12']
LEATHER = {**dict(zip('abcde', BLACK)), 'o': '#060508', 'z': '#e8899a', 'r': '#c45670', 'R': '#7e2c42', 'k': '#121016',
           'W': '#d4d8e0', 'w': '#e8ecf2', 'v': '#a8aeb8', 'u': '#6a707c',
           'K': '#1a1820', 'H': '#4e4c5c', 'J': '#060508', 'P': '#9a9ea8', 'p': '#6a6e78', 'g': '#2a2830'}
BLACK_GLOVE = ['#4a4856', '#32303a', '#22202a', '#16141c', '#0c0b10']


def leather():
    pics = body(LEATHER, (AP.LEATHER_57, AP.LEATHER_61), (AP.LEATHER_34, AP.LEATHER_38), AP.LEATHER_53,
                AP.LEATHER_62, AP.LEATHER_30, (AP.LEATHER_39, AP.LEATHER_47, AP.LEATHER_48), AP.LEATHER_5,
                AP.LEATHER_1, far_leg=AP.LEG_FAR_LEATHER)
    pics['1:right'] = AP.LEATHER_1_RIGHT
    pics['1:left'] = pics.pop('1')
    tail = {'anchor': 'hips', 'texture': AP.LEATHER_TAIL, 'segments': 4, 'stiffness': 0.3, 'drag': 2.6}
    return make('leather', LEATHER, pics, BLACK_GLOVE, '#ff6a8a',
                ribbons={'tail': {**tail, 'offset': [3, -2], 'gravity': 280},
                         'tail-near': {**tail, 'offset': [1, -1], 'gravity': 320, 'layer': 'behind'}})


# --------------------------------------------------------------------------------------------
# Illium (Mass Effect 2)
# --------------------------------------------------------------------------------------------
FOREST = ['#4f8a62', '#356a48', '#264f36', '#1a3826', '#10241a']
ILLIUM = {**dict(zip('abcde', FOREST)), 'o': '#07120c', 'w': '#eee8f2', 'v': '#c8c0d4', 'u': '#9a90aa',
          'x': '#cfc8d8', 'X': '#e8e4ee', 'y': '#7a7290', 'q': '#8a7a52',
          'K': '#1c3424', 'H': '#3f6a4c', 'J': '#07120c', 'g': '#101c14', 'k': '#5a4e34'}
WHITE_GLOVE = ['#f0ecf4', '#d8d0e0', '#b8aec6', '#90869e', '#5c546a']


def illium():
    pics = body(ILLIUM, (AP.ILLIUM_57, AP.ILLIUM_61), (AP.ILLIUM_34, AP.ILLIUM_38), AP.ILLIUM_53, AP.ILLIUM_62,
                AP.ILLIUM_30, (AP.ILLIUM_39, AP.ILLIUM_47, AP.ILLIUM_48), AP.ILLIUM_5, AP.ILLIUM_1,
                far_leg=AP.LEG_FAR_ILLIUM)
    return make('illium', ILLIUM, pics, WHITE_GLOVE, '#7ad08a', skirt=(AP.ILLIUM_SKIRT_34, AP.ILLIUM_SKIRT_38))


LOOKS = ['scholar', 'broker', 'leather', 'illium']
# AZURE_ONLY=broker,leather writes only those (while drawing one).
_only = [k for k in os.environ.get('AZURE_ONLY', '').split(',') if k]
pals = [globals()[k]()[0] for k in LOOKS if not _only or k in _only]
if pals:
    sheet('az-heads.png', [(pals[0].rows(p), pals[0].pal) for p in (AH.profile(), AH.front())], scale=10)
print('azure looks written')
