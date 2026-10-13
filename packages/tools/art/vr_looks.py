"""Vera's looks: Faith Connors of Mirror's Edge (2008) and Catalyst (2016), DICE's "Pixel Faith"
in every one of them (a black top, white legs, red feet, ONE red hand), her heads in vr_heads.py.

* `vera-tank` (Mirror's Edge): the black tank with two white stripes down its side, baggy white
  cargo trousers gathered at the ankle over black socks, low red tabi-like runners with a dark
  sole and two white stripes by the heel; on her right arm only the circuit tattoo, the black
  compression sleeve at the elbow and the red fingerless glove; the straight-fringed bob.
* `vera-vest` (Catalyst): the short sleeveless vest with a red edge over the longer tank, the
  red-black strap from her right shoulder to the pouch on her left hip, slim white capris with
  black wedges, the bare ankle in glossy red slip-ons with a black stripe, the gauntlet and the
  red-black glove on her right forearm, the armband; the A-line bob.
* `vera-street` (Catalyst's street clothes): the dark leather biker jacket, the hood down behind
  the collar, olive sleeves, dark jeans, black velcro high-tops with white laces.

Her arms are the original ones in her light skin, her right one painted along the limb on every
turn of its pictures; trousers, tops and shoes are drawn anew."""
from lookgen import *
from heads import Pic, Palette
from body import part, apply_rules
import vr_heads as VH

# Her skin on the arms and the neck (the head's tones): highlight, light, mid, shadow, outline.
SKIN5 = ['#fff2d8', '#f8d2b0', '#e8a585', '#c97461', '#7a3438']


def enc(rows, legend, pal):
    """Text rows in a picture legend → rows in the look's palette."""
    return [''.join(c if c in '.+' else pal.char(legend[c]) for c in r) for r in rows]


def darker(rows, shift):
    return [''.join(shift.get(c, c) for c in r) for r in rows]


def pic_rows(p, pal):
    return pal.rows(p)


# ------------------------------------------------------------------------------------ arms
# Her arms are the original ones in her skin; her right one (the near one facing right) is
# painted on every turn of its pictures, along the limb: the tattoo, a sleeve or an armband, the
# glove's cuff, keeping the original shading (each skin tone becomes the same tone of the cloth).
BARE_WRIST = {WRIST[0]: SKIN5[2], WRIST[1]: SKIN5[3], WRIST[2]: SKIN5[3]}


def skin_rules():
    return [recolor(ARMS + HAND, {**ramp(SKIN, SKIN5), '#ffcb84': SKIN5[1], '#a56531': SKIN5[3]}),
            recolor(FOREARM, BARE_WRIST)]


def along(p):
    """Every pixel of a limb's picture → (s, k): pixels along the limb from its top-left end (the
    shoulder, or the elbow) and across it from its middle."""
    import math
    pts = [(x, y) for y in range(p.h) for x in range(p.w) if p.get(x, y)]
    cx = sum(x + 0.5 for x, _ in pts) / len(pts)
    cy = sum(y + 0.5 for _, y in pts) / len(pts)
    sxx = sum((x + 0.5 - cx) ** 2 for x, _ in pts)
    syy = sum((y + 0.5 - cy) ** 2 for _, y in pts)
    sxy = sum((x + 0.5 - cx) * (y + 0.5 - cy) for x, y in pts)
    ang = 0.5 * math.atan2(2 * sxy, sxx - syy)
    ux, uy = math.cos(ang), math.sin(ang)
    if ux + uy < 0:
        ux, uy = -ux, -uy
    vx, vy = -uy, ux
    proj = {(x, y): ((x + 0.5 - cx) * ux + (y + 0.5 - cy) * uy, (x + 0.5 - cx) * vx + (y + 0.5 - cy) * vy)
            for x, y in pts}
    s0 = min(a for a, _ in proj.values())
    return {pt: (a - s0, b) for pt, (a, b) in proj.items()}


def tone(c):
    """A skin colour's place in SKIN5 (light 0 → outline 4)."""
    c = c.lower()
    return SKIN5.index(c) if c in SKIN5 else 2


def arm(id_, paint):
    """The base arm picture `id_` in her skin, painted by `paint(pic, along)`."""
    p = apply_rules(part(0, id_), id_, skin_rules())
    paint(p, along(p))
    return p


# The circuit tattoo: (along, across) pixels on the upper arm from the shoulder down.
CIRCUIT = {(2, 0), (3, 0), (4, 0), (4, -1), (6, 0), (7, 0), (7, 1)}
INK_TONES = ['#5a4a56', '#45363f', '#382a33', '#2a1f27', '#1c141a']


def circuit(p, al, extra=()):
    for (x, y), (a, b) in al.items():
        if (round(a - 0.5), round(b)) in CIRCUIT:
            p.set(x, y, INK_TONES[tone(p.get(x, y))])
    return p


SLEEVE = ['#4a4a58', '#363642', '#24242c', '#16161c', '#0c0c10']
GLOVE = ['#ff5440', '#e8221a', '#b81414', '#7e0a0e', '#420606']
ARMBAND = ['#40404c', '#2c2c36', '#1e1e26', '#121218', '#08080a']


def band(p, al, s0, s1, ramp_):
    """Cloth round the limb from `s0` to `s1` pixels along it (by tone)."""
    for (x, y), (a, _) in al.items():
        if s0 <= a < s1:
            p.set(x, y, ramp_[tone(p.get(x, y))])
    return p


def forearm_me1(p, al):
    """The black compression sleeve below the elbow, bare skin, the glove's red cuff."""
    n = max(a for a, _ in al.values())
    band(p, al, 0, 3, SLEEVE)
    return band(p, al, n - 0.6, n + 1, GLOVE)


# ------------------------------------------------------------------------------ the tank (ME1)
ME1 = {
    '1': SKIN5[0], '2': SKIN5[1], '3': SKIN5[2], '4': SKIN5[3], '5': SKIN5[4],
    'a': '#4a4d5c', 'b': '#2e3039', 'c': '#1f2029', 'd': '#121318',
    'W': '#f4f4f6', 'w': '#8a8e9a',
    'G': '#ffffff', 'J': '#eef0f4', 'j': '#d6dae4', 'H': '#b0b6c4', 'Z': '#7a8090', 'z': '#565a68',
    'q': '#22222a', 'o': '#2c2c34', 'O': '#18181c',
}
TANK_57 = [
    '...432....',
    '...4322...',
    '...4322...',
    '..dcb32...',
    '.dcbb322..',
    '.dcbbb32b.',
    'dcbwbwbaab',
    'dcbwbwbbab',
    'dcbwbwbbbc',
    'dccwbwbbcc',
    '.dcwcwbcc.',
    '.dddddddd.',
]
TANK_61 = [
    '...4322....',
    '...4322....',
    '..4432213..',
    '.3c3221b2..',
    '4cb4322ab3.',
    'dcbb432aabd',
    'dwcbbbbbawd',
    'dwcbbbbbawd',
    'dwccbbbbbwd',
    'dwccbbbbbwd',
    '.wcccbbbbw.',
    '.wdccccccw.',
    '.dddddddd..',
]
TANK_34 = [
    '...dcbb..',
    '..dcwbwa.',
    '..dcwbwa.',
    '..dcwbwb.',
    '...cwbwb.',
    '...dwbwb.',
    '..dcwbwbb',
    '..ddddddd',
    '.ZjJJJJGZ',
    '.HjJJJJGJ',
    'ZHjJJJJJj',
    'ZHjjJJJjj',
    'ZZHjjjjjH',
    'zZZHHHHH.',
    '.zZZZZZz.',
    '...zzzz..',
]
TANK_38 = [
    '...dcbbbb..',
    '..dWcbbbaW.',
    '..dWcbbbaW.',
    '..dWcbbbbW.',
    '...Wcbbbbw.',
    '...wcbbbbw.',
    '..dwccbbbwd',
    '..ddddddddd',
    '.zjJJJJJGJz',
    '.HjJJJHJGJz',
    'ZHjJJJHJJjZ',
    'ZHjjJjHjJjZ',
    'ZZHjjHZHjHZ',
    'zZZHHz.ZHHz',
    '.zZZz..zZz.',
    '...........',
]
CARGO_53 = [
    '..ZjJJGZ.',
    '.ZjJJJGJZ',
    'ZHjJJJGJZ',
    'ZHjJJJGJZ',
    'ZHjJJJJJZ',
    'ZHHHHHjJZ',
    'ZHjJJHJGZ',
    '.ZHjJHJGZ',
    '.ZHjJHJJZ',
    '.ZHjjHjJZ',
    '.ZHHHHjjZ',
    '..ZHjjJZ.',
    '..ZHjjJZ.',
    '..ZZHHZZ.',
]
CARGO_62 = [
    '......jZ',
    '....jJJZ',
    '..ZjJGJZ',
    '.ZHjJJjZ',
    'ZHjjJJJZ',
    'ZHHjjjHZ',
    '.ZZZZZZ.',
]
CARGO_30 = [
    '..jJJZ.',
    '.HjJGJZ',
    '.HjJGJZ',
    '.HjJJJZ',
    'ZHjJJJZ',
    'ZHjJJZ.',
    'ZHjJJZ.',
    'ZHHjjZ.',
    '.ZqqqZ.',
    '.ooo...',
    '.oOo...',
    '.oO....',
]
FAR_LEG = {'G': 'J', 'J': 'j', 'j': 'H', 'H': 'Z', 'Z': 'z'}

# Low red tabi-like runners: a dark sole, two white stripes by the heel, black heel and toe.
TABI = {'k': '#140c0e', 'R': '#ff3a2c', 'r': '#e3141c', 'q': '#a80c12', 'Q': '#5e070b', 'W': '#ffffff',
        'w': '#c8c8d0', 'l': '#2b1d1b', 'L': '#4a3430', 'o': '#2c2c34'}
TABI_39 = [
    '.ooo.........',
    'kkrRRRr......',
    'kkWrWRRRRr...',
    'kWrWrrrrrrrkk',
    '.llllllllllll',
]
TABI_47 = [
    '.ooo.......',
    'kkrRrRRr...',
    'kWrWRRRRrkk',
    'kqWqrrrrqqk',
    '.lllllllll.',
]
TABI_48 = [
    '.ooo...',
    'krRRRrk',
    'kRRRRrk',
    'kqrkrqk',
    '.lllll.',
]
TABI_FAR = {'R': 'r', 'r': 'q', 'W': 'w'}


def make(look_id, pics, heads, accent, rules=(), arms=None, faces=None, turn=()):
    pal = Palette()
    look = {'id': look_id, 'base': 0, 'accent': accent, 'recolor': skin_rules() + list(rules),
            'parts': {k: v for k, v in no_ponytail().items()}}
    for k, (rows, leg) in pics.items():
        look['parts'][k] = enc(rows, leg, pal)
    for k, p in (arms or {}).items():
        look['parts'][k] = pal.rows(p)
    for k, p in heads.items():
        look['parts'][k] = pal.rows(p)
    for k, p in (faces or {}).items():
        look['parts'][k] = pal.rows(p)
    look['palette'] = pal.pal
    path = write_look('vera', look)
    rotate(path, [25, '25:left', 57, 34, 49, 53, 62, 30, 39, 43, *turn])
    preview(look_id)
    return path


def heads(style):
    """Her heads in a hairstyle (VH.me1, VH.cat): the profile and the 3/4 face each side, and the
    profile's faces (blinking, the pain face)."""
    out = {'25': style(side='right'), '25:left': style(side='left'),
           '29': style(True, side='right'), '29:left': style(True, side='left')}
    for f in VH.FACES:
        out[str(f)] = style(side='right', face=f)
        out[f'{f}:left'] = style(side='left', face=f)
    return out


def heads_me1():
    return heads(VH.me1)


def arms_kit(upper=circuit, forearm=forearm_me1):
    """Her right arm, every picture of it: the upper arm (tattoo, armband), the forearm (sleeve,
    gauntlet, the glove's cuff); the left one stays bare."""
    out = {f'{i}:right': arm(i, upper) for i in UPPER_ARM}
    out.update({f'{i}:right': arm(i, forearm) for i in FOREARM})
    return out


def glove_rules(glove=None):
    return [{**recolor(HAND, ramp(SKIN5, glove or GLOVE)), 'on': 'right'}]


def tank():
    leg = ME1
    pics = {'57': (TANK_57, leg), '61': (TANK_61, leg), '34': (TANK_34, leg), '38': (TANK_38, leg),
            '53': (CARGO_53, leg), '49': (darker(CARGO_53, FAR_LEG), leg), '62': (CARGO_62, leg),
            '30': (CARGO_30, leg),
            '39': (TABI_39, TABI), '43': (darker(TABI_39, TABI_FAR), TABI), '47': (TABI_47, TABI),
            '48': (TABI_48, TABI)}
    make('vera-tank', pics, heads_me1(), '#e5332a', glove_rules(), arms_kit())


# --------------------------------------------------------------------------- the vest (Catalyst)
CAT = {
    '1': SKIN5[0], '2': SKIN5[1], '3': SKIN5[2], '4': SKIN5[3], '5': SKIN5[4],
    'a': '#3e404c', 'b': '#2a2c35', 'c': '#1c1d24', 'd': '#111216',
    'v': '#454a58', 'V': '#2c303b', 'u': '#1a1c23', 'U': '#0d0e12',
    'R': '#ff3a2e', 'r': '#d01c18', 'q': '#7e0c0e', 'k': '#0e0e12',
    'G': '#ffffff', 'J': '#eef0f4', 'j': '#d6dae4', 'H': '#b0b6c4', 'Z': '#7a8090', 'z': '#565a68',
    'P': '#23252d', 'p': '#3a3d48',
}
# The short sleeveless vest over the longer tank: its collar up at the nape, the red-black strap
# from her right shoulder down across the chest to the left hip, a red edge down the front.
VEST_57 = [
    '...432....',
    '..u4322...',
    '..uU322...',
    '.uVvRr2...',
    '.uVvvRr2..',
    'uVVvvvRrb.',
    'uVVvvvvRrb',
    'uVVVvvvvRr',
    'uuVVVvvvbR',
    'uuVVVVvvbq',
    '.uuVVVVVcb',
    '.UUUUUUUcc',
]
VEST_61 = [
    '...4322....',
    '..u4322u...',
    '..uR322Uu..',
    '.uVrR32bVu.',
    'uVvvrR2bvVu',
    'uVvvvrRbvVu',
    'uVvvvbrRvVu',
    'uVvvvbbrRVu',
    'uVVvvbbbrRu',
    'uVVvVbbbbrq',
    '.uVVVccbbcq',
    '.UUUUccbUUU',
    '..ccccccc..',
]
VEST_34 = [
    '...cbbb..',
    '..dcbbba.',
    '..dcbbba.',
    '..dcbbbkk',
    '...cbbkRk',
    '...dcbkrk',
    '..dccbbkk',
    '..dddccdd',
    '.ZjJJJPPz',
    '.HjJJPPGz',
    'ZHjJPPJJj',
    'ZHjjPJJjj',
    'ZZHjPjjjH',
    'zZZHHHHH.',
    '.zZZZZZz.',
    '...zzzz..',
]
# Her left side (seen facing left): the strap comes round the front from the far shoulder down
# to the pouch on this hip.
VEST_57L = [
    '...432....',
    '..u4322...',
    '..uU322...',
    '.uVvvV2...',
    '.uVvvvV2..',
    'uVVvvvvVb.',
    'uVVvvvvvab',
    'uVVVvvvvRr',
    'uuVVVvvRrb',
    'uuVVVvRrbq',
    '.uuVVRrVcb',
    '.UUURrUUcc',
]
VEST_34L = [
    '...cbbb..',
    '..dcbbba.',
    '..dkkkka.',
    '..kRkRkb.',
    '..kkkkkb.',
    '...dcbbb.',
    '..dccbbbb',
    '..dddccdd',
    '.ZjJJJPPz',
    '.HjJJPPGz',
    'ZHjJPPJJj',
    'ZHjjPJJjj',
    'ZZHjPjjjH',
    'zZZHHHHH.',
    '.zZZZZZz.',
    '...zzzz..',
]
VEST_38 = [
    '...cbbbbb..',
    '..dcbbbbba.',
    '..dcbbbbbkk',
    '..dcbbbbkRk',
    '...cbbbbkrk',
    '...ccbbbbkk',
    '..dccbbbbbd',
    '..ddccccddd',
    '.zjPJJJJPJz',
    '.HjPPJJPPJz',
    'ZHjjPJJPJjZ',
    'ZHjjPjHPjjZ',
    'ZZHjjHZHjHZ',
    'zZZHHz.ZHHz',
    '.zZZz..zZz.',
    '...........',
]
# Slim white capris to mid-calf: a long black wedge down the outer thigh, pleats at the knee, the
# bare calf and ankle under them.
CAPRI_53 = [
    '.zjJPz.',
    'ZHjPPJz',
    'ZHjPPJz',
    'ZHjPpGz',
    'ZHjjPGz',
    'ZHjjPGz',
    '.ZHjPJz',
    '.ZHjPJz',
    '.ZHjjPz',
    '.ZHjjPz',
    '.ZHjjJz',
    '..ZHjz.',
    '..ZHjz.',
    '..ZZz..',
]
CAPRI_62 = [
    '......jZ',
    '....jJJZ',
    '..ZHHHjZ',
    '.ZjJGJjZ',
    'ZHHHHHHZ',
    'ZjjJJJjZ',
    '.ZZZZZZ.',
]
CAPRI_30 = [
    '..jJJz.',
    '.HjJGz.',
    '.HHHHz.',
    '.HjJJz.',
    '.ZHHHz.',
    '.4323..',
    '.4321..',
    '4321...',
    '4322...',
    '432....',
    '432....',
    '43.....',
]
# Glossy red slip-ons on the bare foot: a black heel cup, a curved black stripe from the instep to
# the toe, a thin black sole.
SLIP = {'k': '#0e0a0c', 'R': '#ff3a2c', 'r': '#e01418', 'q': '#9a0c10', 'Q': '#5a0709', 'W': '#ffc8c0',
        '3': SKIN5[2], '4': SKIN5[3]}
SLIP_39 = [
    '.............',
    'kRRRk........',
    'kRRRRkkRRr...',
    'kqRRRRRkkRWrk',
    '.kkkkkkkkkkkk',
]
SLIP_47 = [
    '...........',
    'kRRRkk.....',
    'kRRRRRkkWr.',
    'kqRRRRRRkkk',
    '.kkkkkkkkk.',
]
SLIP_48 = [
    '.......',
    '.kRRRk.',
    'kRRWRrk',
    'kqRkRqk',
    '.kkkkk.',
]
SLIP_FAR = {'R': 'r', 'r': 'q', 'W': 'R', 'q': 'Q'}

GLOVE_CAT = ['#ff5a48', '#e8261e', '#b8141a', '#24242c', '#0a0a0c']


def circuit_band(p, al):
    """Catalyst: the tattoo on the shoulder, the black armband above the elbow."""
    circuit(p, al)
    return band(p, al, 6, 8, ARMBAND)


GAUNTLET = ['#3a3c46', '#2a2c34', '#1c1d24', '#121318', '#08080a']


def gauntlet(p, al):
    """The MAG rope gauntlet on her right forearm: a black block to the wrist, a red light on it."""
    n = max(a for a, _ in al.values())
    band(p, al, 2.5, n + 1, GAUNTLET)
    lit = min((pt for pt, (a, b) in al.items() if 4 <= a < 5), key=lambda pt: al[pt][1], default=None)
    if lit:
        p.set(*lit, '#ff3a2e')
    return p


def vest():
    leg = CAT
    pics = {'57': (VEST_57, leg), '57:left': (VEST_57L, leg), '61': (VEST_61, leg), '34': (VEST_34, leg),
            '34:left': (VEST_34L, leg), '38': (VEST_38, leg), '53': (CAPRI_53, leg), '49': (darker(CAPRI_53, FAR_LEG), leg), '62': (CAPRI_62, leg),
            '30': (CAPRI_30, leg),
            '39': (SLIP_39, SLIP), '43': (darker(SLIP_39, SLIP_FAR), SLIP), '47': (SLIP_47, SLIP),
            '48': (SLIP_48, SLIP)}
    make('vera-vest', pics, heads_cat(), '#e5332a', glove_rules(GLOVE_CAT), arms_kit(circuit_band, gauntlet),
         turn=['57:left', '34:left'])


def heads_cat():
    return heads(VH.cat)


# ----------------------------------------------------------------- the street jacket (Catalyst)
STREET = {
    '1': SKIN5[0], '2': SKIN5[1], '3': SKIN5[2], '4': SKIN5[3], '5': SKIN5[4],
    'L': '#6a6468', 'l': '#47424a', 'm': '#322e33', 'n': '#211e22', 'N': '#121013',
    'Z': '#d4d8de', 'z': '#8a8e96',
    'o': '#8e8064', 'O': '#6c604a', 'Q': '#4e4536', 'q': '#342e24',
    'h': '#3e3a3e', 'H': '#2a272a',
    'a': '#3e404c', 'b': '#2a2c35', 'c': '#1c1d24', 'd': '#111216',
    'J': '#62646e', 'j': '#4a4c56', 'g': '#363842', 'G': '#262830', 'x': '#15161b', 'y': '#7a7c86',
}
# The leather biker jacket, the hood lying down behind the collar, the lapel and the zip down the
# front, an olive band at the hem; the black tank showing at the neck and under the hem.
JACKET_57 = [
    '....432.....',
    '..hH4322....',
    '.hhHm322l...',
    '.hHmLl32Ll..',
    'hHmLLlbbLl..',
    'HmmmLllbbzl.',
    'nmmmmLlllZl.',
    'nmmmmlLllzlm',
    'nmmmmmlllzmm',
    'nnmmmmmllzmn',
    'nnmmmmmmlzmn',
    '.nnmmmmmmznn',
    '.NOOOOOOOOON',
    '..NNNNNNNN..',
]
JACKET_61 = [
    '.....4322.....',
    '...hH4322Hh...',
    '..hHmL322Lmh..',
    '.hHmlLb32Llmn.',
    'nmmllLbb2LllmN',
    'nmmllLbbbLzlmN',
    'nmmlllLbbLZlnN',
    'nmmllllLbLZlnN',
    'nmmllllLbZllnN',
    'nnmmllllLZlmnN',
    'nnmmmllllZmmnN',
    '.nnmmmlllZmnN.',
    '.NOOOOOOOOOON.',
    '..NNNNNNNNNN..',
]
JACKET_34 = [
    '...nmmlllm.',
    '...nmmmlZm.',
    '..NOOOOOOO.',
    '...cbbbbba.',
    '...cbbbbba.',
    '...dcbbbbb.',
    '..dccbbbbb.',
    '..ddddcccd.',
    '..xGgjjjJx.',
    '..xGgjjjJj.',
    '.xGgjjjJJj.',
    '.xGggjjjjj.',
    '.xGGgjjjjg.',
    '.xxGGgggg..',
    '..xxGGGGx..',
    '....xxxx...',
]
JACKET_38 = [
    '...nmmlLlmmn..',
    '...nmmllZlmn..',
    '..NOOOOOOOOON.',
    '...cbbbbbbba..',
    '...cbbbbbbba..',
    '...dcbbbbbbb..',
    '..dccbbbbbbbd.',
    '..ddddcccddd..',
    '..xjjJjjgjJx..',
    '..xjjJjjgjJx..',
    '.xgjjJjygjJjx.',
    '.xgjjjjxgjjjx.',
    '.xggjjgxGgjgx.',
    '..xxggx.xggx..',
    '...xxx...xx...',
    '..............',
]
JEANS_53 = [
    '.xjJjx.',
    'xGjJJjx',
    'xGjJJjx',
    'xGjjJjx',
    'xGgjJjx',
    'xGgjJjx',
    '.xGjjJx',
    '.xGjyJx',
    '.xGjjJx',
    '.xGjjJx',
    '.xGgjJx',
    '..xGjx.',
    '..xGjx.',
    '..xxx..',
]
JEANS_62 = [
    '......jx',
    '....jjJx',
    '..xgjJjx',
    '.xGgjJjx',
    'xGgjjJjx',
    'xGGgggjx',
    '.xxxxxx.',
]
JEANS_30 = [
    '..jJjx.',
    '.GjJjx.',
    '.GjJjx.',
    '.GjJjx.',
    '.GjJjx.',
    'xGjJx..',
    'xGjJx..',
    'xGjjx..',
    'xGjjx..',
    'xGgjx..',
    'xGgx...',
    'xgg....',
]
FAR_JEANS = {'J': 'j', 'j': 'g', 'g': 'G', 'G': 'x', 'y': 'j'}
# Black velcro high-tops: up the ankle, a strap across it, white laces, a pale rim on the sole.
HTOP = {'k': '#0c0c0e', 'K': '#26282e', 'v': '#3a3c44', 'V': '#5a5c66', 'w': '#ececf0', 'W': '#9c9ca4',
        's': '#8a8a92'}
HTOP_39 = [
    '.kkkk........',
    'kKVVk........',
    'kVVVVk.......',
    'kKKwKkw......',
    'kKKKwKwkk....',
    'kKKKKKKwwkk..',
    'kWWWWWWWWWWWk',
    '.kkkkkkkkkkk.',
    '.............',
]
HTOP_47 = [
    '.kkkk......',
    'kKVVk......',
    'kVVVVk.....',
    'kKKwKwk....',
    'kKKKwKwwk..',
    'kWWWWWWWWWk',
    '.kkkkkkkkk.',
    '...........',
    '...........',
]
HTOP_48 = [
    '.kkkkk.',
    'kKVVVKk',
    'kVVVVVk',
    'kKwKwKk',
    'kKKwKKk',
    'kWWWWWk',
    '.kkkkk.',
    '.......',
    '.......',
]
HTOP_FAR = {'K': 'k', 'V': 'v', 'W': 's', 'w': 's'}
OLIVE = ['#8e8868', '#726c50', '#5a553e', '#433f2e', '#27251a']


def street():
    leg = STREET
    pics = {'57': (JACKET_57, leg), '61': (JACKET_61, leg), '34': (JACKET_34, leg), '38': (JACKET_38, leg),
            '53': (JEANS_53, leg), '49': (darker(JEANS_53, FAR_JEANS), leg), '62': (JEANS_62, leg),
            '30': (JEANS_30, leg),
            '39': (HTOP_39, HTOP), '43': (darker(HTOP_39, HTOP_FAR), HTOP), '47': (HTOP_47, HTOP),
            '48': (HTOP_48, HTOP)}
    rules = [recolor(ARMS, ramp(SKIN5, OLIVE)),
             recolor(FOREARM, {WRIST[0]: OLIVE[3], WRIST[1]: OLIVE[4], WRIST[2]: OLIVE[4]})]
    make('vera-street', pics, heads_cat(), '#e5332a', rules)


if __name__ == '__main__' or True:
    tank()
    vest()
    street()
    print('vera looks written')
