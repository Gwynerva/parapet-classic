"""Rewind's looks: Max Caulfield, her own face drawn anew (rw_heads.py).

* `hoodie` (Life is Strange, 2015): the open grey zip hoodie with its white zipper trim and the
  hood lying on her back, the dusty-pink "Jane Doe" tee down the front, the messenger bag's strap
  across the chest and the bag swinging at her hip (navy flap, khaki canvas, brass buckles), a
  cyan wristband on her right wrist, slim blue jeans cuffed once over grey socks, black canvas
  high-tops with white toe caps, grey laces and a speck of yellow print.
* `beanie` (Double Exposure, 2024): the sage duffle coat to mid-thigh with its toggles, the light
  grey hood lying over the collar, a mustard beanie and gloves, light cuffed jeans, cherry-red
  eight-eyelet boots with the yellow welt stitch, a brown leather satchel on a burgundy strap. It
  wears its own effect: the butterflies and the Polaroids, and on a flip her other self in gold
  (`exposure` in fx.json) instead of the pale rewind.

Both wear her heads (25, 29) and the profile blinking and wincing (76-78), all drawn in
rw_heads.py; the hoodie's bob also has her left side (the fringe over the brow) for when she faces
left.

A slim teen of average build on Blaise's body: narrow, slim legs, her silhouette from the soft
open top, the bag at the hip and the chunky shoes. The upright pictures (chest 57, torso 34,
thighs 49 / 53, knee 62, shin 30, shoes 39 / 43) are drawn here; the look tool turns them."""
from lookgen import *
from heads import Palette
from body import outfit_parts, write_parts
from gridpng import sheet
import rw_heads as RH

# Her skin on the arms, hands and neck (the head's tones, light → dark).
SKIN5 = ['#fff2e2', '#fddcc2', '#f0b898', '#da9078', '#b8604e']
GREY = ['#cac6c0', '#aeaaa4', '#928e88', '#73706c', '#55524f']
TRIM = '#f4f2ec'
PINK = ['#f6b0c0', '#e48aa2', '#c06a84']
JEANS = ['#8eaacc', '#6a88b0', '#506c94', '#3c547a', '#2a3c5c']
CYAN = ['#5ad8f8', '#2aa8dc']
STRAP = ['#7a5236', '#5a3a22', '#3a2414']
SOCK = '#b8b8bc'


def legend(**ramps):
    out = {}
    for chars, colours in ramps.values():
        out.update(dict(zip(chars, colours)))
    return out


# Characters shared by the body pictures: the top's ramp a..e (light → dark), the skin n N M,
# the trim W, the tee p P q, the strap S s x, the jeans G J j H Z (light → dark), the sock o.
def body_legend(top, jeans, tee=PINK, trim=TRIM, strap=STRAP):
    return {**dict(zip('abcde', top)), **dict(zip('nNM', SKIN5[1:4])), 'W': trim,
            **dict(zip('pPq', tee)), **dict(zip('SsX', strap)), **dict(zip('GJjHZ', jeans)), 'o': SOCK}


# ------------------------------------------------------------------------------------- legs
# Slim jeans: the near thigh (53; the far one, 49, a tone darker), the knee, the shin with its
# cuff turned up once over the sock.
THIGH = [
    '.JJJJj.',
    'GJJJJjj',
    'GJJJJjH',
    'GJJJjjH',
    'GJJJjjH',
    '.GJJjjH',
    '.GJJjjH',
    '.GJJjH.',
    '.GJJjH.',
    '..GJjH.',
    '..GJjH.',
    '..GJjH.',
    '..GJjH.',
    '..JjjH.',
]
KNEE = [
    '.GJj.',
    'GJJjH',
    'GJJjH',
    'JJjjH',
    '.jjH.',
]
SHIN = [
    '..JJ.',
    '.GJjH',
    '.GJjH',
    '.GJjH',
    '.GJjH',
    '.GJj.',
    '.GJj.',
    '.GJj.',
    '.HjH.',
    'GGJJ.',
    'GJJj.',
    'ooo..',
]


FAR = {'G': 'J', 'J': 'j', 'j': 'H', 'H': 'Z', 'a': 'b', 'b': 'c', 'c': 'd', 'd': 'e'}

# ------------------------------------------------------------------------------- the hoodie
# The chest in profile (12 × 14, the base's grown by one): the hood lying on the upper back, its
# white lining showing; the open front with the zip's white edge and the pink tee; the strap.
HOODIE_57 = [
    '....MNN.....',
    '...MNnnN....',
    '.bbaMNnN....',
    'bWWWaMNnp...',
    'bbabcaWpp...',
    '.bbbbbSWpp..',
    '.cbbbbbSWp..',
    'cbbbbbbbSWp.',
    'cbbbbbbbbSWp',
    'ccbbbbbbbcSW',
    'cccbbbbbccWP',
    '.ccbbbbbcdWP',
    '.ccccccccdWq',
    '..ddddddddd.',
]
# The chest turned to us (13 × 15): the hood round the neck, the tee between the zip's edges,
# the strap from her left shoulder to her right hip.
HOODIE_61 = [
    '....MNNM.....',
    '...MNnnNM....',
    '..bWMNnNMWb..',
    '.bbWWpPpWWSb.',
    'abbbWpppWSsbc',
    'abbbWppPSsWbc',
    'abbbWppSsPWcc',
    'abbbWpSsPPWcc',
    'bbbbWSsPPqWcd',
    'bbbcSsPPPqWcd',
    'bbbSsWPPqqWdd',
    '.bSscWqqqqWdd',
    '.Ssccddddddd.',
    '.Xccddeeeeed.',
    '..ddddddddd..',
]
# The torso (11 × 16): the hoodie's sides over the tee, its hem at the hips, slim jeans.
HOODIE_34 = [
    '...bbbbbW..',
    '..cbbbbbWp.',
    '..cbbbbbWp.',
    '..cbbbbbWP.',
    '..cbbbbbWP.',
    '..ccbbbbWP.',
    '..ccbbbbWq.',
    '..dccccdWJ.',
    '..eddddddJ.',
    '..HjJJJJGJ.',
    '.HjjJJJJGJ.',
    '.HjjJJJJJj.',
    '.HHjjJJJjj.',
    '..HHjjjjH..',
    '...HHHHH...',
    '...........',
]
HOODIE_38 = [
    '...bbWpPWbb..',
    '..bbbWpPWbbb.',
    '..bbbWPPWbbc.',
    '..bbbWPqWbcc.',
    '..bbbWPqWccc.',
    '..bbbWqqWccc.',
    '..cbbWqqWccd.',
    '..ccddJJdddd.',
    '..eddJJjjddd.',
    '..GJJJJjjjH..',
    '..GJJJjjjjH..',
    '.GJJJJjHjjjH.',
    '.GJJJjHHjjjH.',
    '..GJJjH.jjH..',
    '..HHHH..HHH..',
    '.............',
]

# Black canvas high-tops: the toe to the right, two rows higher than the original sneakers (the
# collar up the ankle) and as many padding rows under them, so they stand where those stood.
HIGHTOP = {'k': '#0c0c10', 'K': '#26262c', 'g': '#3c3c46', 'G': '#5c5c68', 'W': '#f2f2ec',
           'w': '#c0c0b8', 'l': '#c8c8d0', 'y': '#e8c030'}
HIGHTOP_39 = [
    '.kkkk........',
    'kGgKk........',
    'kgKKgkl......',
    'kKKyKglkl....',
    'kKKKKKKglWWk.',
    'kwWWWWWWWWWWk',
    '.kkkkkkkkkkk.',
    '.............',
    '.............',
]
HIGHTOP_47 = [
    '.kkkk......',
    'kGgKk......',
    'kgKKglk....',
    'kKyKKglWk..',
    'kwWWWWWWWWk',
    '.kkkkkkkkk.',
    '...........',
]
HIGHTOP_48 = [
    '.kkkkk.',
    'kKglgKk',
    'kKglgKk',
    'kKWWWKk',
    'kwWWWwk',
    '.kkkkk.',
    '.......',
]
SHOE_FAR = {'G': 'g', 'g': 'K', 'W': 'w', 'l': 'G'}

BAG = {'s': STRAP[1], 'S': STRAP[0], 'n': '#2a3040', 'N': '#3e4658', 'c': '#a89070', 'C': '#c4ac88',
       'd': '#7e6a50', 'y': '#d8b060', 'k': '#16120e'}
BAG_ROWS = ['..+...'] + ['..s...'] * 10 + [
    'kkkkkk',
    'kNNNNk',
    'knnnnk',
    'knynyk',
    'kCsCsk',
    'kcscdk',
    '.kkkk.',
]


def bag_ribbon(rows, leg, pal):
    """The bag on its strap: one stiff segment from the back, swinging at the hip."""
    return {'anchor': 'back', 'offset': [-1, 0], 'texture': enc(rows, leg, pal), 'segments': 1,
            'stiffness': 0.6, 'gravity': 380, 'drag': 2, 'layer': 'front'}


def kit_rules(sleeve, wrist_right, wrist_left):
    """Recolour rules for the parts not drawn here: her skin on the hands, the sleeves on the arms
    (the wrist bands of the original: a cuff, and on her right wrist the cyan band)."""
    return [
        recolor(ARMS + HAND, {**ramp(SKIN, SKIN5), '#ffcb84': SKIN5[1], '#a56531': SKIN5[3]}),
        recolor(UPPER_ARM + FOREARM, ramp(SKIN5, sleeve)),
        {**recolor(FOREARM, {WRIST[0]: sleeve[3], WRIST[2]: wrist_right[0], WRIST[1]: wrist_right[1]}), 'on': 'right'},
        {**recolor(FOREARM, {WRIST[0]: sleeve[3], WRIST[2]: wrist_left[0], WRIST[1]: wrist_left[1]}), 'on': 'left'},
    ]


def make(look_id, rules, plan, pics, head, front, ribbons, accent, attachments=None, turn=(), faces=None,
         effect=None, sides=None):
    """Writes a look: the recoloured base parts of `plan`, the pictures drawn here (`pics`: key →
    (rows, legend)), the heads (and the profile blinking, `faces`: id → picture; `sides`: key →
    picture, the head seen from her left), the bag; turns the upright pictures."""
    pal = Palette()
    look = {'id': look_id, 'base': 0, 'accent': accent, 'recolor': rules,
            'parts': {k: v for k, v in no_ponytail().items()}}
    write_parts(look, outfit_parts(0, rules, plan), pal)
    for k, (rows, leg) in pics.items():
        look['parts'][k] = enc(rows, leg, pal)
    look['parts']['25'] = pal.rows(head)
    look['parts']['29'] = pal.rows(front)
    for k, p in {**(faces or {}), **(sides or {})}.items():
        look['parts'][str(k)] = pal.rows(p)
    look['ribbons'] = {k: f(pal) for k, f in ribbons.items()}
    if attachments:
        look['attachments'] = attachments(pal)
    if effect:
        look['effect'] = effect
    look['palette'] = pal.pal
    path = write_look('rewind', look)
    heads = [25] + (['25:left'] if '25:left' in (sides or {}) else [])
    rotate(path, [*heads, 57, 34, 49, 53, 62, 30, 39, 43, *turn])
    preview(look_id)
    return path


def legs(leg):
    return {
        '53': (THIGH, leg), '49': (shift(THIGH, FAR), leg), '62': (KNEE, leg), '30': (SHIN, leg),
    }


def shoes(rows39, rows47, rows48, leg, far):
    return {'39': (rows39, leg), '43': (shift(rows39, far), leg), '47': (rows47, leg), '48': (rows48, leg)}


def hoodie():
    leg = body_legend(GREY, JEANS)
    rules = kit_rules(GREY, CYAN, [GREY[2], GREY[3]])
    pics = {
        '57': (HOODIE_57, leg), '61': (HOODIE_61, leg), '34': (HOODIE_34, leg), '38': (HOODIE_38, leg),
        **legs(leg), **shoes(HIGHTOP_39, HIGHTOP_47, HIGHTOP_48, HIGHTOP, SHOE_FAR),
    }
    make('hoodie', rules, {'upper-arm': 0, 'forearm': 0, 'hand': 0}, pics, RH.lis_profile(), RH.lis_front(),
         {'bag': lambda pal: bag_ribbon(BAG_ROWS, BAG, pal)}, '#38a8f0',
         faces={f: RH.lis_profile(f) for f in RH.BLINK},
         sides={'25:left': RH.lis_profile(side='left'), '29:left': RH.lis_front('left'),
                **{f'{f}:left': RH.lis_profile(f, 'left') for f in RH.BLINK}})



# ----------------------------------------------------------------------------- Double Exposure
COAT = ['#88a892', '#6a8a78', '#4e6e60', '#3a544a', '#26383a']
HOOD = ['#e6e4e0', '#cac8c4', '#a4a29e']
TOGGLE = ['#dcc492', '#5a4636']
GLOVE = ['#ecb25a', '#d8943a', '#b06e28', '#7a4818']
BURGUNDY = ['#a43e46', '#7e2a32', '#561a20']
JEANS_DE = ['#d4e0ee', '#b8c8de', '#98acc8', '#7a8eac', '#5c6e8e']


def coat_legend():
    return {**dict(zip('abcde', COAT)), **dict(zip('nNM', SKIN5[1:4])), **dict(zip('uvw', HOOD)),
            't': TOGGLE[0], 'T': TOGGLE[1], **dict(zip('SsX', BURGUNDY)), **dict(zip('GJjHZ', JEANS_DE)),
            'o': '#e4e4e8'}


# The duffle coat in profile: the grey hood lying over the collar (a hump on the back, its sides
# round the neck), the burgundy strap, the toggles on their loops down the front.
COAT_57 = [
    '....MNN.....',
    '..uuMNnN....',
    '.uvvuMNnN...',
    'uvvvvuMNvu..',
    'wvvvvvuvvvw.',
    '.wcbbsbbbbbt',
    '.cbbbbsbbbbT',
    'cbbbbbbsbbbc',
    'cbbbbbbbsbbt',
    'ccbbbbbbbsbT',
    'cccbbbbbbbsc',
    '.ccbbbbbbbct',
    '.cccccccccdT',
    '..ddddddddd.',
]
COAT_61 = [
    '....MNNM.....',
    '..uuMNnNuu...',
    '.uvvuMNMuvvu.',
    'uvvvvuMuvvvvu',
    'wvvvvwvwvvvsw',
    'abbbbcvcbbsbc',
    'abbbbtTtbsbbc',
    'abbbbbcbsbbcc',
    'abbbbbcsbbccd',
    'abbbbtTsbbccd',
    'bbbbbbsbbbccd',
    '.bbbbsbbbbcdd',
    '.bbbsbtTbccdd',
    '.cccsccccddd.',
    '..dXddddddd..',
]
COAT_34 = [
    '...bbbbbbc.',
    '..cbbbbbbt.',
    '..cbbbbbbT.',
    '..cbbbbbbc.',
    '..cbbbbbbc.',
    '..ccbbbbbt.',
    '..ccbbbbbT.',
    '..cccbbbbc.',
    '..ccccbbbcc',
    '.cccccbbbbc',
    '.dccccbbbbc',
    '.dccccbbbbc',
    '.ddcccbbbbc',
    '..ddcccbbcd',
    '...dddccdd.',
    '...........',
]
COAT_38 = [
    '...bbbcbbb...',
    '..bbbbcbbbb..',
    '..bbbtTtbbc..',
    '..bbbbcbbbc..',
    '..bbbbcbbcc..',
    '..bbbtTtbcc..',
    '..bbbbcbbcc..',
    '..bbbbcbbccd.',
    '.bbbbbcbbcccd',
    '.bbbbtTtbcccd',
    '.bbbbbcbbcccd',
    '.bbbbbcbbcccd',
    '.cbbbbcbccddd',
    '..cccccccddd.',
    '...dddddddd..',
    '.............',
]
# The coat's skirt over the thighs (hips layer), 13 × 32 centred like the torso: torso row r is
# row r + 8 here, column c is c + 1.
COAT_SKIRT_34 = ['.' * 13] * 17 + [
    '..cccccbbbbc.',
    '..dccccbbbbt.',
    '.ddccccbbbbT.',
    '.ddcccccbbbc.',
    '.dddccccbbbc.',
    '.ddcccccbbbt.',
    '.ddcccccbbbT.',
    'ddddcccccbbc.',
    'ddddccccccbc.',
    '.eddddcccccc.',
    '..eeeeddddd..',
] + ['.' * 13] * 4
COAT_SKIRT_38 = ['.' * 15] * 17 + [
    '..bbbbbcbbcccd.',
    '..bbbbbcbbcccd.',
    '..bbbbtTtbcccd.',
    '.bbbbbbcbbcccdd',
    '.bbbbbbcbbcccdd',
    '.bbbbbbcbbcccdd',
    '.bbbbbbcbbcccdd',
    'bbbbbbbcbbccddd',
    'cbbbbbccbcccdde',
    '.cccccc.cccddde',
    '..ddddd..ddee..',
] + ['.' * 15] * 4

# Cherry-red eight-eyelet boots: up the calf (four rows over the original sneaker's), the yellow
# welt stitch over a honey sole.
DOCS = {'k': '#1c0608', 'r': '#cc4a50', 'R': '#9e2832', 'q': '#76182a', 'Q': '#4a0c16',
        'l': '#16100e', 'y': '#e8c040', 'o': '#b07a40', 'O': '#6a4420'}
DOCS_39 = [
    '.kkkkk.......',
    'kRrRqk.......',
    'kRrRqlk......',
    'kRrRqlk......',
    'kRrRRqlk.....',
    'kRRRRRqllk...',
    'kqRRRRRRRrRk.',
    'kyyyyyyyyyyyk',
    '.kOoOoOoOoOk.',
    '.............',
    '.............',
    '.............',
    '.............',
]
DOCS_47 = [
    '.kkkkk.....',
    'kRrRqk.....',
    'kRrRqlk....',
    'kRrRqllk...',
    'kRRRRRRrRk.',
    'kyyyyyyyyyk',
    '.kOoOoOoOk.',
    '...........',
    '...........',
]
DOCS_48 = [
    '.kkkkk.',
    'kRlrlqk',
    'kRlrlqk',
    'kRlrlqk',
    'kRrRRqk',
    'kyyyyyk',
    '.kOOOk.',
    '.......',
    '.......',
]
DOCS_FAR = {'r': 'R', 'R': 'q', 'q': 'Q', 'y': 'o', 'o': 'O'}

SATCHEL = {'s': BURGUNDY[1], 'S': BURGUNDY[0], 'b': '#9a6440', 'B': '#b87e52', 'd': '#6a4228',
           'D': '#4a2c18', 'k': '#24140a', 'y': '#e8c040', 'c': '#3ab0d0', 'p': '#e85a70'}
SATCHEL_ROWS = ['...+...'] + ['...s...'] * 10 + [
    'kkkkkkk',
    'kBBBBBk',
    'kbybcbk',
    'kbbbbbk',
    'kddyddk',
    'kdbbbdk',
    'kDdddDk',
    '.kkkkk.',
]


def beanie():
    leg = coat_legend()
    rules = [
        recolor(HAND, {**ramp(SKIN, GLOVE[:1] + GLOVE + GLOVE[3:]), '#ffcb84': GLOVE[0], '#a56531': GLOVE[2]}),
        recolor(UPPER_ARM + FOREARM, ramp(SKIN, COAT)),
        recolor(FOREARM, {WRIST[0]: COAT[3], WRIST[1]: GLOVE[2], WRIST[2]: COAT[4]}),
    ]
    pics = {
        '57': (COAT_57, leg), '61': (COAT_61, leg), '34': (COAT_34, leg), '38': (COAT_38, leg),
        **legs(leg), **shoes(DOCS_39, DOCS_47, DOCS_48, DOCS, DOCS_FAR),
    }

    def attachments(pal):
        return {'coat': {'layer': 'hips', 'sprites': {'34': enc(COAT_SKIRT_34, leg, pal),
                                                      '38': enc(COAT_SKIRT_38, leg, pal)}}}

    make('beanie', rules, {'upper-arm': (1, 'across'), 'forearm': 0, 'hand': 0}, pics, RH.de_profile(),
         RH.de_front(), {'bag': lambda pal: bag_ribbon(SATCHEL_ROWS, SATCHEL, pal)}, '#d8943a',
         attachments, turn=['coat@34'], faces={f: RH.de_profile(f) for f in RH.BLINK},
         effect=['butterflies', 'exposure'])

hoodie()
beanie()
pal = Palette()
sheet('rw-heads.png', [(pal.rows(p), pal.pal) for p in (RH.lis_profile(), RH.lis_front(), RH.de_profile(),
                                                         RH.de_front())], scale=9)
print('rewind looks written')
