"""Shahzada's looks, the Prince of Persia. One face (sh_heads.py) in four games, every look with its
own build, cloth, boots and props (painted along the parts with sh_parts.py):

- sands: the Sands of Time (2003), a lean acrobat (chest and arms not thickened, the trousers
  ballooning two pixels at the thigh and the knee, the shins narrow in boots): bare tanned chest,
  a baldric with a gold edge and buckle, the wide navy sash with its knot and two ends, cream
  trousers with a dark embroidered band down the outer seam, studded bracers with gold rims, a
  navy band with a fluttering tail round the right arm, the Dagger of Time at the hip, soft brown
  boots to mid-calf with a navy strip and gold studs;
- warrior: the Warrior Within (2004), heavier (chest and arms a pixel stronger): armour of dark
  leather straps with a bronze medallion, straps across the bare belly, the torn red sash with its
  ends flying, dark trousers, leather wrapped round the forearms and the tall boots;
- dark-prince: the Dark Prince (The Two Thrones, 2005), charcoal all over with gold veins glowing
  on the chest and the arms, black spikes on the shoulders, a ragged dark loincloth, dark steel
  greaves with a spike at the knee and pointed sabatons, the Daggertail lashing from his left hand;
- wanderer: the prince of 2008, broad and long-legged: an open white shirt under a long brown vest
  with gold embroidery (its tails behind him), a patterned belt, rust trousers, leather wrapped
  round the shins with knee pads, sandal-boots with the toes bare, the long blue-and-red scarf
  and the big clawed gauntlet on his left hand.
"""
import math

from lookgen import *
from heads import Palette, Pic
from body import part, apply_rules, inflate, shrink, FAMILIES
import sh_heads
from sh_parts import paint, relight, edge, rot_index, axis

# Skin on the body: the face's ramp (sh_heads.SKIN), light → dark.
TAN = [sh_heads.SKIN[k] for k in '12345']
CREAM = ['#fdf6e4', '#ede2c6', '#d6c7a2', '#b2a07a', '#7a6648']
NAVY = ['#4f8ad6', '#2b62b0', '#1d4584', '#132c58', '#0a1632']
LEATHER = ['#c08652', '#94603a', '#6c4224', '#462814', '#26140a']
GOLD = ['#fff0a8', '#f2c452', '#bb8a2e', '#7c5816']
STUD = '#ece6d4'
OUTLINE = '#1a0d06'


def family_of(id_):
    for fam, ids in FAMILIES.items():
        if id_ in ids:
            return fam
    return None


def build(rules, plan, paint_fn=None, sides=None):
    """The body parts of a look: every picture of the families in `plan` recoloured by `rules`,
    grown or thinned, then painted by paint_fn(id, pic, side) (side '' or, for the families in
    `sides` ({family: (side, ...)}), each of its sides: pictures `<id>:<side>`)."""
    out = {}
    for fam, how in plan.items():
        n, axis_ = (how, None) if isinstance(how, int) else how
        for id_ in FAMILIES[fam]:
            for side in ('',) + tuple((sides or {}).get(fam, ())):
                p = apply_rules(part(1, id_), id_, rules)
                if n > 0:
                    inflate(p, n, axis_)
                elif n < 0:
                    shrink(p, -n, axis_)
                if paint_fn:
                    p = paint_fn(id_, p, side) or p
                out[f'{id_}:{side}' if side else str(id_)] = p
    return out


def pad_centred(pic, n):
    """Room round a picture without moving its centre."""
    return pic.pad(n, n, n, n)


def outline(p, colour, lit=None, light=(0.45, -0.6)):
    """Every edge pixel of a picture in `colour` (or `lit` where the edge faces the light)."""
    q = p.copy()
    for y in range(p.h):
        for x in range(p.w):
            if p.get(x, y) and edge(p, x, y):
                v = 0.0
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    if p.get(x + dx, y + dy) is None:
                        v += dx * light[0] + dy * light[1]
                q.set(x, y, lit if lit and v > 0.3 else colour)
    p.g = q.g
    return p


def make(look_id, rules, plan, head, paint_fn, sides=None, ribbons=None, attachments=None, parts=None,
         effect=None, accent='#e8b84a', extra_rotate=(), ribbon_colours=None, faces=None):
    pal = Palette(ribbon_colours or {})
    look = {'id': look_id, 'base': 1, 'accent': accent, '_raw_heads': True, 'recolor': rules}
    if effect:
        look['effect'] = effect
    look['parts'] = {}
    for k, pic in build(rules, plan, paint_fn, sides).items():
        look['parts'][k] = pal.rows(pic)
    for k, pic in (parts or {}).items():
        look['parts'][k] = pal.rows(pic)
    look['parts']['25'] = pal.rows(head(False))
    look['parts']['29'] = pal.rows(head(True))
    for k, pic in (faces or {}).items():
        look['parts'][k] = pal.rows(pic)
    if attachments:
        look['attachments'] = {name: {'layer': layer, 'sprites': {k: pal.rows(v) for k, v in pics.items()}}
                               for name, (layer, pics) in attachments.items()}
    if ribbons:
        look['ribbons'] = ribbons
    look['palette'] = pal.pal
    path = write_look('shahzada', look)
    rotate(path, ['25', *extra_rotate])
    preview(look_id)
    return path


def shoes(near39, front47, front48, legend, far_shade):
    """The shoe pictures: the near one upright (turned to 40-42 by the look tool), the far one a
    shade darker, the 3/4 and front ones."""
    near = Pic.text(near39, legend)
    far = near.copy().recolor(far_shade)
    return {'39': near, '43': far, '47': Pic.text(front47, legend), '48': Pic.text(front48, legend)}


def shade_map(ramp):
    """Each colour of a ramp to the next darker one (the far shoe, the far leg)."""
    return {ramp[i]: ramp[i + 1] for i in range(len(ramp) - 1)}


def faces_of(head25, legend, pad=(0, 0)):
    """76 / 77 / 78 of a look's profile head (padded by pad = (left, top))."""
    return sh_heads.faces(head25, legend, mouth_at=(13 + pad[0], 14 + pad[1]))


# --- painters along a part (s: 0 at its start → 1 at its end; t: -1 front … 1 back for the body
# and the legs, across for the arms; d0 / d1: pixels from the start / the end) --------------------

def baldric(p, id_, leather, gold, slope=1.6, start=-0.35, front_slope=1.9, front_start=-0.95):
    """A leather strap from the right shoulder down across the chest: its lit upper side, a gold
    edge under it and the square buckle on the breast."""
    front = id_ == 61
    a, b = (front_start, front_slope) if front else (start, slope)
    centre = {}

    def strap(x, y, s, t, c, d0, d1):
        if s < 0.1:
            return None
        dt = t - (a + b * s)
        if edge(p, x, y):
            return leather[3] if abs(dt) <= 0.3 else None
        if -0.3 <= dt < 0:
            return leather[1]
        if 0 <= dt <= 0.3:
            centre.setdefault(round(s * 20), (x, y))
            return leather[2]
        if 0.3 < dt <= 0.58:
            return gold[1]
        return None
    paint(p, id_, strap)
    # the buckle: a gold square with its dark middle, two thirds of the way down
    keys = sorted(centre)
    if keys:
        x, y = centre[keys[len(keys) * 3 // 5]]
        p.set(x, y, gold[0])
        if p.get(x + 1, y) and not edge(p, x + 1, y):
            p.set(x + 1, y, gold[2])


def belt_rows(id_):
    """The belt's pixels of the male torso picture `id_`."""
    orig = part(1, id_)
    return {(x, y) for y in range(orig.h) for x in range(orig.w)
            if orig.get(x, y) and orig.get(x, y).lower() in (BELT[0], BELT[1])}


def sash(p, id_, ramp, knot=True, above=1, pad=0, torn=False):
    """The belt grown into a sash: the belt's rows and `above` more over it, cloth with its folds
    (lighter on top, darker under), a knot in front (lighter, bulging); torn: ragged lower edge."""
    belt = {(x + pad, y + pad) for x, y in belt_rows(id_)}
    ax = axis(p, id_)
    belt = {q for q in belt if q in ax}
    if not belt:
        return set()
    top = min(ax[q][2] for q in belt)
    cloth = set(belt)
    for _ in range(above):
        for (x, y) in list(cloth):
            for dx, dy in ((0, -1), (1, -1), (-1, -1)):
                q = (x + dx, y + dy)
                if q in ax and q not in cloth and ax[q][2] < ax[(x, y)][2] - 0.4 and ax[q][2] > top - above - 0.6:
                    cloth.add(q)
    first = min(round(ax[q][2]) for q in cloth)
    last = max(round(ax[q][2]) for q in cloth)
    for q in cloth:
        k = round(ax[q][2]) - first
        tone = ramp[1] if k == 0 else ramp[2] if k < last - first else ramp[3]
        if edge(p, *q):
            tone = ramp[3] if k < last - first else ramp[4]
        p.set(q[0], q[1], tone)
    if knot:
        for q in cloth:
            if ax[q][1] < -0.35 and not edge(p, *q):
                p.set(q[0], q[1], ramp[0] if ax[q][2] - first < 1.5 else ramp[1])
    if torn:
        # a few rags hanging a pixel under the lower edge
        for q in cloth:
            if round(ax[q][2]) == last and (q[0] + q[1]) % 3 == 0:
                below = (q[0], q[1] + 1)
                if below in ax and below not in cloth:
                    p.set(below[0], below[1], ramp[3])
    return cloth


def bracer(p, id_, leather, rim, stud, length=4.6):
    """A leather bracer over the wrist end of a forearm: a rim at both ends, a stud between."""
    def fn(x, y, s, t, c, d0, d1):
        if d1 < 1.0 or length - 1 <= d1 < length:
            return rim[2] if edge(p, x, y) and t < 0 else rim[1]
        if d1 < length:
            if abs(t) < 0.5 and not edge(p, x, y) and abs(d1 - (length / 2 + 0.2)) < 0.6:
                return stud
            if edge(p, x, y):
                return leather[3] if t < 0 else leather[2]
            return leather[1] if t > 0 else leather[2]
    paint(p, id_, fn)


def arm_band(p, id_, ramp, tail=True, at=(0.40, 0.60)):
    """A cloth band round an upper arm, its little tail fluttering off the back."""
    band = []

    def fn(x, y, s, t, c, d0, d1):
        if at[0] <= s <= at[1]:
            band.append((x, y, t))
            return ramp[3] if edge(p, x, y) else (ramp[1] if t > 0 else ramp[2])
    paint(p, id_, fn)
    if tail and band:
        # off the band's lower side (the back of the hanging arm), two pixels trailing
        k = rot_index(id_)
        th = math.radians(22.5 * k)
        dx, dy = math.cos(th), math.sin(th)
        nx, ny = math.sin(th), -math.cos(th)
        low = min(band, key=lambda b: b[2])
        x, y = low[0], low[1]
        pad_centred(p, 2)
        x, y = x + 2, y + 2
        a = (round(x - nx), round(y - ny))
        b = (round(x - 2 * nx - 0.8 * dx), round(y - 2 * ny - 0.8 * dy))
        for q, c in ((a, ramp[2]), (b, ramp[3])):
            if p.get(*q) is None:
                p.set(q[0], q[1], c)
    return p


def seam(p, id_, dark, dot, width=0.22, at=0.0):
    """The embroidered band down the outer seam of a trouser leg, gold dots along it."""
    def fn(x, y, s, t, c, d0, d1):
        if 0.12 < s < 0.92 and abs(t - at) <= width and not edge(p, x, y):
            return dot if round(d0) % 3 == 0 else dark
    paint(p, id_, fn)


def wraps(p, id_, ramp, start=0.0, end=1.0, every=2, rim=None):
    """Strips of leather or cloth wound round a part between s = start and end: a lit strip, a
    darker one, each lit on its upper side; `rim` a metal band at both ends of the wrapping."""
    def fn(x, y, s, t, c, d0, d1):
        if not (start <= s <= end):
            return None
        if rim and (s - start < 0.09 or end - s < 0.09):
            return rim[2] if edge(p, x, y) else (rim[0] if t < -0.2 else rim[1])
        if edge(p, x, y):
            return ramp[3]
        k = int(d0 + 0.5 * t) % every
        light = 0 if t < -0.3 else 1 if t < 0.4 else 2
        return ramp[min(3, light + (1 if k == every - 1 else 0))]
    paint(p, id_, fn)


def vein_walk(p, id_, colours, seed, start=(0.1, 0.2), step=0.07, wobble=0.35, branch=0.5, end=0.95):
    """A glowing vein along a part from `start` (s, t), wandering across it, a pixel wide and
    unbroken, with a branch; brighter where it starts (colours bright → dim)."""
    import random
    r = random.Random(seed)
    ax = axis(p, id_)
    inner = {q: (v[0], v[1]) for q, v in ax.items() if not edge(p, *q)}
    if not inner:
        return p

    def nearest(s, t):
        return min(inner, key=lambda q: (inner[q][0] - s) ** 2 * 6 + 0.25 * (inner[q][1] - t) ** 2)

    def line(a, b, c):
        n = max(abs(b[0] - a[0]), abs(b[1] - a[1]))
        for i in range(n + 1):
            q = (round(a[0] + (b[0] - a[0]) * i / max(1, n)), round(a[1] + (b[1] - a[1]) * i / max(1, n)))
            if q in inner:
                p.set(q[0], q[1], c)

    def run(s, t, stop, shade):
        last = nearest(s, t)
        while s < stop:
            s += step
            t = max(-0.7, min(0.7, t + r.uniform(-wobble, wobble)))
            q = nearest(s, t)
            k = min(len(colours) - 1, shade + int(2 * s))
            line(last, q, colours[k])
            last = q
    s0, t0 = start
    run(s0, t0, end, 0)
    if branch:
        run(s0 + branch * 0.6, t0 - 0.5, min(end, s0 + branch * 0.6 + 0.3), 1)
    return p


def relit_metal(p, id_, ramp, line, shine=True):
    """A part relit as metal: a cylinder of `ramp` with a sharp highlight and reflected light on
    its shadow edge."""
    relight(p, id_, ramp, line)
    ax = axis(p, id_)
    for (x, y), (s, t, d0, d1) in ax.items():
        if edge(p, x, y):
            continue
        if shine and -0.35 < t < -0.05:
            p.set(x, y, ramp[0])
        elif t > 0.6:
            p.set(x, y, ramp[2])
    return p


# =================================================================================================
# sands — the Sands of Time
# =================================================================================================

SOT_RULES = [
    *skin(TAN, ARMS + HAND + CHEST + TORSO, with_shins=False),
    recolor(CHEST + TORSO, ramp(MALE_SHIRT, TAN[1:4])),
    recolor(TORSO + THIGH + KNEE, ramp(SHORTS, CREAM)),
    recolor(TORSO, {BELT[0]: NAVY[1], BELT[1]: NAVY[2]}),
]
SOT_PLAN = {'chest': 0, 'torso': 0, 'upper-arm': 0, 'forearm': 0, 'hand': 0, 'thigh': 2, 'knee': 2}


def sot_paint(id_, p, side):
    fam = family_of(id_)
    if fam == 'chest':
        baldric(p, id_, LEATHER[1:], GOLD)
    elif fam == 'torso':
        sash(p, id_, NAVY)
    elif fam == 'forearm':
        bracer(p, id_, LEATHER[1:], GOLD, STUD)
    elif fam == 'upper-arm' and side == 'right':
        arm_band(p, id_, NAVY)
    elif fam == 'thigh' and id_ >= 53:
        # the near leg: the dark band down its outer seam, gold dots in it
        seam(p, id_, NAVY[3], GOLD[1], width=0.2, at=0.05)
    return p


# Soft brown boots to mid-calf: the trousers tucked in at the top, a navy strip with gold studs
# down the outer side (seen on the near leg).
def sot_shin(id_, side):
    p = inflate(part(1, id_), 1, 'x' if id_ == 30 else None)
    relight(p, id_, LEATHER[:4], OUTLINE)
    ax = axis(p, id_)
    for (x, y), (s, t, d0, d1) in ax.items():
        if d0 < 2.6:
            # the cream trouser over the boot's top
            p.set(x, y, '#5a4a32' if edge(p, x, y) else (CREAM[1] if t > -0.2 else CREAM[2]))
        elif d0 < 3.6:
            p.set(x, y, OUTLINE if edge(p, x, y) else LEATHER[3])
        elif side == 'near' and abs(t) <= 0.3 and not edge(p, x, y):
            p.set(x, y, GOLD[1] if round(d0) in (6, 9) else NAVY[3])
    return p


SOT_SHOE = {'k': OUTLINE, 'H': LEATHER[0], 'h': LEATHER[1], 'm': LEATHER[2], 'd': LEATHER[3], 's': '#3a2416',
            'g': GOLD[1], 'n': NAVY[3]}
# fmt: off
SOT_39 = [
    '.kHhhhdk.....',
    '.kHhhhhhkkk..',
    'kmHhhhhhhhhk.',
    'kmhhmmmmmmhhk',
    '.kssssssssskk',
]
SOT_47 = [
    '..kHhhdk...',
    '.kHhhhhhkk.',
    'kmHhhhhhhhk',
    'kmhhmmmmmhk',
    '.ksssssssk.',
]
SOT_48 = [
    '.kHhdk.',
    'kHhhhdk',
    'kHhhhmk',
    'khmmmmk',
    '.ksssk.',
]
# fmt: on
SOT_FAR = {LEATHER[0]: LEATHER[1], LEATHER[1]: LEATHER[2], LEATHER[2]: LEATHER[3]}

# The Dagger of Time on his hip: the glass hilt glowing with sand, the dark guard with its blue
# jewel, the sheath slanting down and back with a gold chape (on the torso's pictures, three
# pixels of room round them).
DAGGER = {'Y': '#fff4b8', 'y': '#ffcf4a', 'o': '#c8861c', 'k': '#1c1418', 'j': '#62d0f4',
          's': '#4a2a16', 'S': '#6c4224', 'g': GOLD[1]}
# fmt: off
DAGGER_34 = [
    '...............',
    '...............',
    '...............',
    '...............',
    '...............',
    '...............',
    '.........Y.....',
    '........yo.....',
    '.......kj......',
    '......sk.......',
    '......S........',
    '.....sS........',
    '.....s.........',
    '....sS.........',
    '....s..........',
    '...gs..........',
    '...g...........',
    '...............',
    '...............',
    '...............',
    '...............',
    '...............',
]
DAGGER_38 = [
    '.................',
    '.................',
    '.................',
    '.................',
    '.................',
    '.................',
    '.................',
    '..........Y......',
    '..........yo.....',
    '..........jk.....',
    '...........ks....',
    '...........Ss....',
    '............Ss...',
    '............s....',
    '............Ss...',
    '.............g...',
    '.............g...',
    '.................',
    '.................',
    '.................',
    '.................',
    '.................',
]
# fmt: on

# The two ends of the sash hanging from its knot, fringed.
SASH_A = ['LN', 'Nn', 'LN', 'Nn', 'nN', 'Nn', 'LN', 'Nn', 'n.', 'N.']
SASH_B = ['L', 'N', 'n', 'N', 'n', 'N', 'n']


def sands():
    sot25 = sh_heads.sot()
    make('sands', SOT_RULES, SOT_PLAN, sh_heads.sot, sot_paint, sides={'upper-arm': ('right',)},
         parts={**{f'{i}:near': sot_shin(i, 'near') for i in SHIN}, **{f'{i}:far': sot_shin(i, 'far') for i in SHIN},
                **shoes(SOT_39, SOT_47, SOT_48, SOT_SHOE, SOT_FAR)},
         faces=faces_of(sot25, sh_heads.SOT),
         extra_rotate=('39', '43', 'dagger@34'),
         attachments={'dagger': ('hips', {'34': Pic.text(DAGGER_34, DAGGER), '38': Pic.text(DAGGER_38, DAGGER)})},
         ribbons={
             'sash': {'anchor': 'hips', 'offset': [-2, -1], 'texture': SASH_A, 'segments': 4,
                      'gravity': 260, 'drag': 2.6, 'layer': 'front'},
             'sash-end': {'anchor': 'hips', 'offset': [-1, -1], 'texture': SASH_B, 'segments': 3,
                          'gravity': 300, 'drag': 3.0, 'layer': 'front'},
         }, ribbon_colours={'L': NAVY[1], 'N': NAVY[2], 'n': NAVY[3]})


# =================================================================================================
# warrior — the Warrior Within
# =================================================================================================

WW_TAN = [sh_heads.WW_SKIN[k] for k in '12345']
WW_LEATHER = ['#7c6650', '#5a4838', '#3e3128', '#28201a', '#16100c']
BRONZE = ['#f4d690', '#c49c52', '#86642e', '#4a3416']
WW_RED = ['#ee5a48', '#c8262c', '#8a1218', '#520a0e', '#2e0508']
WW_PANTS = ['#5c524e', '#443c3a', '#302a28', '#201c1b', '#120f0e']
WW_WRAP = ['#a08262', '#7a5e44', '#56402e', '#36281c']
WW_LINE = '#0c0806'

WW_RULES = [
    *skin(WW_TAN, ARMS + HAND + CHEST + TORSO, with_shins=False),
    recolor(CHEST + TORSO, ramp(MALE_SHIRT, WW_TAN[1:4])),
    recolor(TORSO + THIGH + KNEE, ramp(SHORTS, WW_PANTS)),
    recolor(TORSO, {BELT[0]: WW_RED[1], BELT[1]: WW_RED[2]}),
]
WW_PLAN = {'chest': 1, 'torso': 1, 'upper-arm': 1, 'forearm': 1, 'hand': 0, 'thigh': 1, 'knee': 1}


def boss(p, id_, s0, t0, colours, corners=False):
    """A round boss or medallion: the pixel of a part nearest to (s0, t0) (t0 None: the middle of
    the picture across) and the four round it, lit at the top (colours light, mid, dark); with
    `corners` a 3×3 disc, its corners in the dark tone."""
    ax = axis(p, id_)
    inner = [q for q in ax if not edge(p, *q)]
    if not inner:
        return p
    if t0 is None:
        xs = [q[0] for q in ax]
        mid = (min(xs) + max(xs)) / 2
        x, y = min(inner, key=lambda q: (ax[q][0] - s0) ** 2 * 40 + (q[0] - mid) ** 2)
    else:
        x, y = min(inner, key=lambda q: (ax[q][0] - s0) ** 2 * 4 + (ax[q][1] - t0) ** 2)
    ring = [(0, 0, colours[0]), (0, -1, colours[0]), (-1, 0, colours[1]), (1, 0, colours[1]), (0, 1, colours[2])]
    if corners:
        ring += [(-1, -1, colours[1]), (1, -1, colours[1]), (-1, 1, colours[2]), (1, 1, colours[2])]
        ring[1] = (0, -1, colours[1])
    for dx, dy, c in ring:
        if (x + dx, y + dy) in ax and not edge(p, x + dx, y + dy):
            p.set(x + dx, y + dy, c)
    return p


def ww_chest(id_, p):
    """Armour of dark leather straps over the chest, a high collar, a bronze medallion in front."""
    relight(p, id_, WW_LEATHER, WW_LINE)
    front = id_ == 61

    def fn(x, y, s, t, c, d0, d1):
        if edge(p, x, y):
            return None
        if d0 < 1.6:
            return WW_LEATHER[1] if t < 0.2 else WW_LEATHER[2]      # the collar's lit rim
        if round(d0) % 3 == 0:
            return WW_LEATHER[4] if t > 0 else WW_LEATHER[3]      # the joins between straps
    paint(p, id_, fn)
    boss(p, id_, 0.45, None if front else -0.55, BRONZE, corners=front)
    return p


def ww_torso(id_, p):
    """Straps across the bare belly, the red sash torn at the hip, a belt with a bronze boss."""
    belt = {(x + 1, y + 1) for x, y in belt_rows(id_)}
    ax = axis(p, id_)
    btop = min(ax[q][2] for q in belt if q in ax)
    # the belly straps: two bands across with skin showing between
    def fn(x, y, s, t, c, d0, d1):
        if (x, y) in belt or d0 > btop - 1.2:
            return None
        k = btop - d0
        if 2.6 < k < 3.8 or 5.6 < k < 6.8:
            if edge(p, x, y):
                return WW_LINE
            return BRONZE[1] if abs(t + 0.55) < 0.2 else (WW_LEATHER[1] if t < 0 else WW_LEATHER[2])
    paint(p, id_, fn)
    sash(p, id_, WW_RED, knot=False, above=1, pad=1, torn=True)
    # the belt under the sash: dark leather and a bronze boss in front
    def belt_fn(x, y, s, t, c, d0, d1):
        k = d0 - btop
        if 2.2 < k < 3.4:
            if abs(t + 0.45) < 0.25 and not edge(p, x, y):
                return BRONZE[0]
            return WW_LINE if edge(p, x, y) else WW_LEATHER[2]
    paint(p, id_, belt_fn)
    return p


def ww_paint(id_, p, side):
    fam = family_of(id_)
    if fam == 'chest':
        ww_chest(id_, p)
    elif fam == 'torso':
        ww_torso(id_, p)
    elif fam == 'forearm':
        wraps(p, id_, WW_WRAP, start=0.3, end=1.0, every=2, rim=BRONZE[1:])
    elif fam == 'upper-arm' and side == 'right':
        # the tattoo on his right shoulder: a dark curl
        def fn(x, y, s, t, c, d0, d1):
            if not edge(p, x, y) and ((0.24 < s < 0.34 and abs(t - 0.45) < 0.3) or (0.34 <= s < 0.46 and abs(t) < 0.25)
                                       or (0.46 <= s < 0.54 and abs(t + 0.3) < 0.3)):
                return '#4a2e26'
        paint(p, id_, fn)
    return p


def ww_shin(id_, side):
    """Tall boots of dark leather with strips wound round them, a bronze band at the top."""
    p = inflate(apply_rules(part(1, id_), id_, WW_RULES), 1, 'x' if id_ == 30 else None)
    relight(p, id_, WW_LEATHER[:4], WW_LINE)
    wraps(p, id_, [WW_WRAP[1], WW_WRAP[2], WW_LEATHER[2], WW_LEATHER[3]], start=0.18, end=0.95, every=2)
    ax = axis(p, id_)
    for (x, y), (s, t, d0, d1) in ax.items():
        if d0 < 1.6:
            p.set(x, y, WW_LINE if edge(p, x, y) else (BRONZE[0] if t < -0.3 else BRONZE[1]))
    if side == 'far':
        p.recolor(shade_map([WW_WRAP[1], WW_WRAP[2], WW_LEATHER[2], WW_LEATHER[3]]))
    return p


WW_SHOE = {'k': WW_LINE, 'H': WW_WRAP[0], 'h': WW_WRAP[1], 'm': WW_WRAP[2], 'd': WW_LEATHER[2], 'D': WW_LEATHER[3],
           's': '#1c1410', 'b': BRONZE[2], 'B': BRONZE[1]}
# fmt: off
# Heavy boots: the wrapping crossing over the instep, a bronze cap on the toe, a thick sole.
WW_39 = [
    '.kHmhmdk.....',
    '.kmHhmHdkkk..',
    'kdhmHmhmdBBk.',
    'kDdDdDdDdbBbk',
    '.kssssssssssk',
]
WW_47 = [
    '..kHmhdk...',
    '.kmHhmHdkk.',
    'kdhmHmhdBBk',
    'kDdDdDdDbbk',
    '.ksssssssk.',
]
WW_48 = [
    '.kHmdk.',
    'kmHhmdk',
    'kdhBhdk',
    'kDbBbDk',
    '.ksssk.',
]
# fmt: on

# The torn red sash: two rags off the hip, flying behind him.
WW_SASH_A = ['RrR', 'rRr', 'RxR', 'rRr', 'xRr', 'R.r', 'rR.', '.Rx', 'R.r', '..R', '.r.']
WW_SASH_B = ['Rr', 'rR', 'Rx', 'r.', 'R.', '.r', '.R']


def warrior():
    head25 = sh_heads.warrior()
    make('warrior', WW_RULES, WW_PLAN, sh_heads.warrior, ww_paint, sides={'upper-arm': ('right',)},
         parts={**{f'{i}:near': ww_shin(i, 'near') for i in SHIN}, **{f'{i}:far': ww_shin(i, 'far') for i in SHIN},
                **shoes(WW_39, WW_47, WW_48, WW_SHOE, {WW_WRAP[0]: WW_WRAP[1], WW_WRAP[1]: WW_WRAP[2]})},
         faces=faces_of(head25, {**sh_heads.SOT, **sh_heads.WW_SKIN}, sh_heads.WW_PAD),
         extra_rotate=('39', '43'),
         ribbons={
             'sash': {'anchor': 'hips', 'offset': [1, -1], 'texture': WW_SASH_A, 'segments': 4,
                      'gravity': 170, 'drag': 2.8},
             'sash-end': {'anchor': 'hips', 'offset': [2, 0], 'texture': WW_SASH_B, 'segments': 3,
                          'gravity': 200, 'drag': 3.0},
         }, ribbon_colours={'R': WW_RED[1], 'r': WW_RED[2], 'x': WW_RED[3]}, accent='#c8262c')


# =================================================================================================
# dark-prince — the Dark Prince
# =================================================================================================

DP_SKIN = [sh_heads.DARK_SKIN[k] for k in '12345']
VEIN = ['#ffe08a', '#ffb000', '#ff7a1a', '#c8400a']
DP_CLOTH = ['#4a4044', '#342c30', '#231e21', '#161214', '#0a0809']
STEEL = ['#b4b8c4', '#767c8a', '#4c5260', '#30343e', '#18191e']
DP_LINE = '#050407'

DP_RULES = [
    *skin(DP_SKIN, ARMS + HAND + CHEST + TORSO, with_shins=False),
    recolor(FOREARM, {WRIST[0]: DP_SKIN[1], WRIST[1]: DP_SKIN[2], WRIST[2]: DP_SKIN[3]}),
    recolor(CHEST + TORSO, ramp(MALE_SHIRT, DP_SKIN[1:4])),
    recolor(TORSO + THIGH + KNEE, ramp(SHORTS, DP_CLOTH)),
    recolor(TORSO, {BELT[0]: DP_CLOTH[2], BELT[1]: DP_CLOTH[3]}),
]
DP_PLAN = {'chest': 1, 'torso': 1, 'upper-arm': 1, 'forearm': 1, 'hand': 0, 'thigh': 1, 'knee': 1}


def spikes(p, id_, colours, at=(1.0, 3.2), length=2, side=1):
    """Black scaly spikes off the start of an arm (the shoulder), on its `side` (1: the top of the
    upright picture), leaning back toward the start."""
    k = rot_index(id_)
    th = math.radians(22.5 * k)
    d = (math.cos(th), math.sin(th))
    n = (math.sin(th) * side, -math.cos(th) * side)
    pad_centred(p, length + 1)
    ax = axis(p, id_)
    for target in at:
        cand = [q for q, v in ax.items() if abs(v[2] - target) < 0.8 and v[1] * side > 0.3]
        if not cand:
            continue
        x, y = max(cand, key=lambda q: ax[q][1] * side)
        for i in range(1, length + 1):
            q = (round(x + n[0] * i - d[0] * 0.45 * i), round(y + n[1] * i - d[1] * 0.45 * i))
            if p.get(*q) is None:
                p.set(q[0], q[1], colours[0] if i == length else colours[1])
    return p


def dp_paint(id_, p, side):
    fam = family_of(id_)
    if fam == 'chest':
        vein_walk(p, id_, VEIN[1:], seed=id_, start=(0.12, -0.2), wobble=0.3, branch=0.5, end=0.8)
        if id_ == 61:
            vein_walk(p, id_, VEIN[1:], seed=id_ + 100, start=(0.2, 0.45), wobble=0.25, branch=0, end=0.6)
    elif fam == 'torso':
        vein_walk(p, id_, VEIN[2:], seed=id_ + 7, start=(0.02, -0.3), step=0.08, branch=0, end=0.3)
        sash(p, id_, DP_CLOTH, knot=False, above=0, pad=1, torn=True)
    elif fam == 'upper-arm':
        vein_walk(p, id_, VEIN[1:], seed=id_ * 3, start=(0.2, 0.1), wobble=0.3, branch=0, end=0.9)
        spikes(p, id_, ['#6a6078', '#24202c'], at=(0.8, 2.6), length=3)
    elif fam == 'forearm':
        vein_walk(p, id_, VEIN[1:], seed=id_ * 5, start=(0.05, 0.0), wobble=0.3, branch=0, end=0.75)
    elif fam == 'knee':
        relit_metal(p, id_, STEEL[1:], DP_LINE)
    return p


def dp_shin(id_, side):
    """Greaves of dark steel, a spike off the knee."""
    p = inflate(apply_rules(part(1, id_), id_, DP_RULES), 1, 'x' if id_ == 30 else None)
    ramp_ = STEEL[1:] if side == 'near' else STEEL[2:] + [DP_LINE]
    relit_metal(p, id_, ramp_, DP_LINE)
    # bands across the greave
    ax = axis(p, id_)
    for (x, y), (s, t, d0, d1) in ax.items():
        if not edge(p, x, y) and round(d0) in (4, 8):
            p.set(x, y, ramp_[3])
    # the spike forward off the knee
    k = rot_index(id_)
    th = math.radians(22.5 * k)
    fwd = (math.cos(th), math.sin(th))
    pad_centred(p, 2)
    ax = axis(p, id_)
    top = [q for q, v in ax.items() if v[2] < 1.6]
    if top:
        x, y = min(top, key=lambda q: ax[q][1])
        for i, c in ((1, ramp_[1]), (2, ramp_[0])):
            q = (round(x + fwd[0] * i), round(y + fwd[1] * i - 0.5 * i))
            if p.get(*q) is None:
                p.set(q[0], q[1], c)
    return p


DP_SHOE = {'k': DP_LINE, 'S': STEEL[0], 's': STEEL[1], 'M': STEEL[2], 'D': STEEL[3], 'd': STEEL[4]}
# fmt: off
# Sabatons: lames of dark steel across the foot, a pointed toe.
DP_39 = [
    '.kSsMDk......',
    '.kSsMDMkkk...',
    'kSsMDMsMDMkk.',
    'kMDdDdDdDdMMk',
    '.kkkkkkkkkkkk',
]
DP_47 = [
    '..kSsMDk...',
    '.kSsMDMkkk.',
    'kSsMDMsMDMk',
    'kMDdDdDdDMk',
    '.kkkkkkkkk.',
]
DP_48 = [
    '.kSsDk.',
    'kSsMDdk',
    'kSMsMDk',
    'kMDsDdk',
    '.kkkkk.',
]
# fmt: on

# The Daggertail: a chain of sickle blades lashing from his left hand.
DAGGERTAIL = ['.c.', 'Sc.', 'sc.', '.cS', '.cs', '.c.', 'Sc.', 'sc.', '.cS', '.cs', '.c.', 'Sc.', 'sc.',
              '.cS', '.cs', '.c.', 'Sc.', 'sc.', '.cS', '.cs', '.c.', 'YcS', '.y.']
# The rags of his loincloth.
DP_RAGS_A = ['TtT', 'tTt', 'TtT', 'T.t', 't.T', '..t']
DP_RAGS_B = ['tT', 'Tt', 't.', 'T.', '.t']


def dark_prince():
    head25 = sh_heads.dark()
    make('dark-prince', DP_RULES, DP_PLAN, sh_heads.dark, dp_paint,
         parts={**{f'{i}:near': dp_shin(i, 'near') for i in SHIN}, **{f'{i}:far': dp_shin(i, 'far') for i in SHIN},
                **shoes(DP_39, DP_47, DP_48, DP_SHOE, shade_map(STEEL))},
         faces=faces_of(head25, {**sh_heads.SOT, **sh_heads.DARK_SKIN}, sh_heads.DARK_PAD[:2]),
         extra_rotate=('39', '43'), effect=['dark-sands'],
         ribbons={
             'daggertail': {'anchor': 'hand.near', 'offset': [0, 1], 'texture': DAGGERTAIL, 'segments': 7,
                            'gravity': 300, 'drag': 2.0, 'layer': 'front'},
             'rags': {'anchor': 'hips', 'offset': [-1, 0], 'texture': DP_RAGS_A, 'segments': 2,
                      'gravity': 280, 'drag': 2.8, 'layer': 'front'},
             'rags-back': {'anchor': 'hips', 'offset': [2, 0], 'texture': DP_RAGS_B, 'segments': 2,
                           'gravity': 240, 'drag': 3.0},
         }, ribbon_colours={'c': STEEL[3], 'S': STEEL[0], 's': STEEL[2], 'Y': VEIN[0], 'y': VEIN[2],
                            'T': DP_CLOTH[2], 't': DP_CLOTH[3]}, accent='#ff9a2a')


# =================================================================================================
# wanderer — the prince of 2008
# =================================================================================================

SHIRT_W = ['#fbf7ee', '#e8e0cf', '#c9bea6', '#9a8e74']
VEST = ['#94745a', '#715642', '#523c2c', '#36261a', '#1e140c']
EMBROID = '#d0a860'
RUST = ['#ee8c50', '#cc6a2c', '#a24a1c', '#6e2e10', '#401a08']
LEGWRAP = ['#c8a87e', '#9e7e58', '#76583c', '#4e3826']
GAUNT = ['#8e5e4a', '#663f32', '#462920', '#2a170f']
CLAW = ['#f4f0e6', '#b8b2a6', '#706c64']
W8_LINE = '#140c08'

W8_RULES = [
    *skin(TAN, ARMS + HAND + CHEST + TORSO, with_shins=False),
    recolor(CHEST + TORSO, ramp(MALE_SHIRT, TAN[1:4])),
    recolor(TORSO + THIGH + KNEE, ramp(SHORTS, RUST)),
    recolor(TORSO, {BELT[0]: VEST[2], BELT[1]: VEST[3]}),
]
W8_PLAN = {'chest': 1, 'torso': 1, 'upper-arm': 1, 'forearm': 1, 'hand': 0, 'thigh': 1, 'knee': 1}


def open_shirt(p, id_, s_max=1.0):
    """The open white shirt under the long vest: bare skin in the opening, the shirt's edges, the
    vest's gold-trimmed front edge and its embroidery behind."""
    front = id_ in (38, 61)

    def fn(x, y, s, t, c, d0, d1):
        if s > s_max:
            return None
        u = abs(t) if front else -t          # how near the opening (1 at it)
        opening = 0.32 * (1 - 0.35 * s) if front else 0.55
        if front:
            if u < opening:
                return None                  # skin
            if u < opening + 0.24:
                return SHIRT_W[3] if edge(p, x, y) else (SHIRT_W[0] if t < 0 else SHIRT_W[1])
            if u < opening + 0.34:
                return EMBROID
        else:
            if u > opening:
                return None
            if u > opening - 0.3:
                return SHIRT_W[3] if edge(p, x, y) else (SHIRT_W[0] if d0 < 3 else SHIRT_W[1])
            if u > opening - 0.42:
                return EMBROID
        if edge(p, x, y):
            return W8_LINE
        if (round(d0) + round(3 * t)) % 4 == 0 and abs(t) < 0.85:
            return EMBROID if (round(d0) // 2) % 2 == 0 else VEST[0]
        return VEST[1] if t < 0.3 else VEST[2]
    paint(p, id_, fn)
    return p


def w8_belt(p, id_):
    """The broad patterned belt: bronze-brown leather with a row of gold studs, a plaque in front."""
    belt = {(x + 1, y + 1) for x, y in belt_rows(id_)}
    cloth = sash(p, id_, [VEST[1], VEST[2], VEST[2], VEST[3], W8_LINE], knot=False, above=1, pad=1)
    ax = axis(p, id_)
    for q in cloth:
        if edge(p, *q):
            continue
        s, t, d0, d1 = ax[q]
        if round(d0) == round(ax[min(cloth, key=lambda r: ax[r][2])][2]) + 1 and q[0] % 2 == 0 and abs(t) < 0.8:
            p.set(q[0], q[1], EMBROID)
    boss(p, id_, ax[min(cloth, key=lambda q: ax[q][2])][0] + 0.05, -0.5 if id_ != 38 else 0.0,
         [GOLD[0], GOLD[1], GOLD[2]])
    return p


def gauntlet_arm(p, id_):
    """The gauntlet's cuff: dark leather over the whole forearm, two gold buckles."""
    relight(p, id_, GAUNT, W8_LINE)

    def fn(x, y, s, t, c, d0, d1):
        if round(d0) in (2, 5) and not edge(p, x, y):
            return GOLD[1] if t > 0 else GOLD[2]
    paint(p, id_, fn)
    return p


def claw_hand(p, id_):
    """The clawed glove: the fist a pixel bigger, dark leather lit from the upper front, three
    steel claws hooking off its front and lower side (turned with the fist)."""
    from heads import shaded
    from body import mask_of
    inflate(p, 1)
    p.g = shaded(mask_of(p), GAUNT, W8_LINE, light=(0.45, -0.6, 0.65)).g
    pad_centred(p, 2)
    pts = [(x, y) for y in range(p.h) for x in range(p.w) if p.get(x, y)]
    cx = sum(q[0] for q in pts) / len(pts)
    cy = sum(q[1] for q in pts) / len(pts)
    turn = 22.5 * rot_index(id_)
    for ang in (0, 35, 70):
        a = math.radians(ang + turn)
        dx, dy = math.cos(a), math.sin(a)
        x, y = max(pts, key=lambda q: (q[0] - cx) * dx + (q[1] - cy) * dy)
        step = (round(dx), round(dy))
        q1 = (x + step[0], y + step[1])
        # the tip hooks down (toward the palm)
        hook = (round(math.cos(a + math.radians(50))), round(math.sin(a + math.radians(50))))
        q2 = (q1[0] + hook[0], q1[1] + hook[1])
        if p.get(*q1) is None:
            p.set(q1[0], q1[1], CLAW[1])
            if p.get(*q2) is None:
                p.set(q2[0], q2[1], CLAW[0])
    return p


def w8_paint(id_, p, side):
    fam = family_of(id_)
    if fam == 'chest':
        open_shirt(p, id_)
    elif fam == 'torso':
        belt = belt_rows(id_)
        ax = axis(p, id_)
        btop = min(ax[(x + 1, y + 1)][0] for x, y in belt if (x + 1, y + 1) in ax)
        open_shirt(p, id_, s_max=btop - 0.02)
        w8_belt(p, id_)
    elif fam == 'upper-arm':
        # the shirt's short sleeve
        def fn(x, y, s, t, c, d0, d1):
            if d0 < 2.6:
                return SHIRT_W[3] if edge(p, x, y) else (SHIRT_W[0] if t > 0 else SHIRT_W[1])
        paint(p, id_, fn)
    elif fam == 'forearm':
        if side == 'left':
            gauntlet_arm(p, id_)
        else:
            wraps(p, id_, [LEGWRAP[0], LEGWRAP[1], LEGWRAP[2], LEGWRAP[3]], start=0.55, end=1.0, every=2)
    elif fam == 'hand' and side == 'left':
        claw_hand(p, id_)
    elif fam == 'knee':
        relight(p, id_, LEGWRAP, W8_LINE)
        boss(p, id_, 0.5, -0.3, [GOLD[1], GOLD[2], GOLD[3]])
    return p


def w8_shin(id_, side):
    """Leather wound slantwise round the shin from the knee to the ankle."""
    p = inflate(apply_rules(part(1, id_), id_, W8_RULES), 1, 'x' if id_ == 30 else None)
    ramp_ = LEGWRAP if side == 'near' else LEGWRAP[1:] + [W8_LINE]
    relight(p, id_, ramp_, W8_LINE)

    def fn(x, y, s, t, c, d0, d1):
        if edge(p, x, y):
            return None
        k = int(d0 + 1.4 * t + 9) % 3
        if k == 0:
            return ramp_[3]
        if k == 1 and t < 0:
            return ramp_[0]
    paint(p, id_, fn)
    return p


W8_SHOE = {'k': W8_LINE, 'H': LEGWRAP[0], 'h': LEGWRAP[1], 'm': LEGWRAP[2], 'd': LEGWRAP[3], 's': '#2a1a10',
           '1': TAN[0], '2': TAN[1], '3': TAN[2], '4': TAN[3]}
# fmt: off
# Sandal-boots: straps wound to the ankle, a strap over the instep, the toes bare.
W8_39 = [
    '.kHmhdk......',
    '.kmHmhdk.....',
    'kdhmHmhk2k...',
    'kmdmhmd4321k.',
    '.kssssssssssk',
]
W8_47 = [
    '..kHmhk....',
    '.kmHmhdk...',
    'kdhmHmk21k.',
    'kmdmhd4321k',
    '.ksssssssk.',
]
W8_48 = [
    '.kHmdk.',
    'kmHhmdk',
    'k2mHm2k',
    'k21H12k',
    '.ksssk.',
]
# fmt: on

# The scarf, blue with red stripes, frayed at the end; the vest's tails behind him; the knot's
# ends of the head-wrap.
W8_SCARF = ['NnN', 'nNn', 'RrR', 'NnN', 'nNn', 'NnN', 'nNn', 'RrR', 'rRr', 'NnN', 'nNn', 'NnN', 'nNn', 'RrR',
            'rRr', 'NnN', 'nNn', 'NnN', 'RrR', 'nNn', 'N.n', '.n.']
W8_TAILS = ['vVVVv', 'vVgVv', 'vVVVv', 'vgVVv', 'vVVVv', 'vVVgv', 'vVVVv', 'vVgVv', 'vVVVv', 'vgVVv', 'vVVVv',
            'v.V.v']
W8_KNOT = ['Rn', 'nR', 'n.']


def wanderer():
    head25 = sh_heads.wanderer()
    make('wanderer', W8_RULES, W8_PLAN, sh_heads.wanderer, w8_paint,
         sides={'forearm': ('left',), 'hand': ('left',)},
         parts={**{f'{i}:near': w8_shin(i, 'near') for i in SHIN}, **{f'{i}:far': w8_shin(i, 'far') for i in SHIN},
                **shoes(W8_39, W8_47, W8_48, W8_SHOE, shade_map(LEGWRAP))},
         faces=faces_of(head25, {**sh_heads.SOT, **sh_heads.WRAP}, sh_heads.W8_PAD[:2]),
         extra_rotate=('39', '43'),
         ribbons={
             'tails': {'anchor': 'hips', 'offset': [3, -2], 'texture': W8_TAILS, 'segments': 4, 'stiffness': 0.25,
                       'gravity': 300, 'drag': 2.4},
             'scarf': {'anchor': 'neck', 'offset': [2, 0], 'texture': W8_SCARF, 'segments': 7,
                       'gravity': 110, 'drag': 3.2},
             'knot': {'anchor': 'head', 'offset': [5, -3], 'texture': W8_KNOT, 'segments': 2,
                      'gravity': 150, 'drag': 3.0},
         }, ribbon_colours={'N': '#5a74c4', 'n': '#3c52a0', 'R': '#e0583a', 'r': '#a8321c',
                            'V': VEST[1], 'v': VEST[3], 'g': EMBROID}, accent='#5a7ad0')


# Written when the module is imported (shahzada.py) or run.
sands()
warrior()
dark_prince()
wanderer()
print('shahzada looks written')
