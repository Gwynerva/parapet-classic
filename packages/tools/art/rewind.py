"""Rewind: the looks (rw_looks.py), the effects and her outfits in boss.json.

The effect keeps Max's formula, quiet as she is:
* butterflies: now and then (one every three seconds or so of running, two at most) the blue
  Morpho of Life is Strange flutters off her, glowing cyan at the body, royal blue to the dark wing
  tips, its wings beating open, half, edge-on; one or two more on some flips and wall moves;
* snapshots: on about a third of the tricks a Polaroid pops out of her hands with the camera's
  flash and tumbles down, developing as it falls (the dark of fresh film, a grey ghost, the
  colours coming): the lighthouse at sunset, the blue butterfly, a selfie, Chloe's blue hair; on a
  flip her pose slides back a moment, pale, like a rewind (the duffle coat's `exposure` instead
  leaves her other self standing in gold, as Double Exposure's Pulse outlines it);
* presence: by the start a butterfly now and then; leaving, a few butterflies scatter; coming
  back, the rewind spiral turning by her shoulder, her ghost sliding back, two or three.
Sprite names fly1-fly3 stay: stages.py lends them to her world."""
import json
import math

from lookgen import *
from heads import mix
from tricks import tricks

import rw_looks  # noqa: F401  (the looks)


class FxPalette:
    """Palette characters for the effect's colours, given out as pictures need them."""
    POOL = ('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!$%&*=?@^~<>/|;:#()[]{}_-,'
            + ''.join(chr(c) for c in range(0x3b1, 0x3ca)) + ''.join(chr(c) for c in range(0x430, 0x450)))

    def __init__(self):
        self.pal = {}
        self.by = {}

    def char(self, colour):
        c = colour.lower()
        if c not in self.by:
            ch = next(ch for ch in self.POOL if ch not in self.pal)
            self.pal[ch] = c
            self.by[c] = ch
        return self.by[c]

    def rows(self, rows, legend):
        return [''.join('.' if c == '.' else self.char(legend[c]) for c in r) for r in rows]

    def grid(self, grid):
        return [''.join('.' if c is None else self.char(c) for c in r) for r in grid]


P = FxPalette()
SPRITES = {}

# ------------------------------------------------------------------------------ the Morpho
# Seen from above, head up: the wings open, half raised, edge-on (all 9 × 7, so the body stays put
# as they beat). Glowing cyan at the body, royal blue out to the dark forewing tips, a faint halo of
# its own light round the open wings.
MORPHO = {'k': '#0a1838', 'B': '#1460c4', 'b': '#2a8cf0', 'c': '#40ccfa', 'L': '#9af6ff', 'x': '#0a1020',
          'g': '#8ff4ff40'}
SPRITES['fly1'] = P.rows([
    '.g.....g.',
    'gkg...gkg',
    'kBbg.gbBk',
    'gbLcxcLbg',
    '.gcLxLcg.',
    '.gbcxcbg.',
    '..gBgBg..',
], MORPHO)
SPRITES['fly2'] = P.rows([
    '.........',
    '..k...k..',
    '..Bb.bB..',
    '..bLxLb..',
    '...cxc...',
    '..gbxbg..',
    '...B.B...',
], MORPHO)
SPRITES['fly3'] = P.rows([
    '.........',
    '....k....',
    '...bx....',
    '...Lx....',
    '...cx....',
    '...Bx....',
    '.........',
], MORPHO)
FLY = {'frames': ['fly1', 'fly2', 'fly3', 'fly2'], 'fps': 12}

# ------------------------------------------------------------------------------ Polaroids
# Portrait cards, 6 × 7: a one-pixel border, the 4 × 4 picture, the thick bottom border, the edge
# a shade darker. Each pops out with the camera's flash and develops once as it tumbles down:
# the dark of fresh film, a cold grey ghost of the picture, its colours coming, the picture.
FRAME = '#f4f1ea'
FRAME_SHADE = '#d4cec2'
UNDEVELOPED = '#2c2c38'
GHOST_TONES = ['#3c4050', '#565c70', '#7a8094']  # the half-developed picture, dark → light
SKY, SKY2, SEA, SEA2 = '#f4a868', '#e88aa0', '#3e5a8c', '#2a3e66'
DARK = '#1a2034'
HAIR, SKIN_, EYE = '#8c5634', '#fbd6b8', '#4a80c6'
PICTURES = {
    # Arcadia Bay's lighthouse at sunset: the white tower and its red lantern, the sea.
    'lighthouse': [
        ['#f8cc80', SKY, '#c83c3c', SKY2],
        [SKY, '#f0b888', '#f8f4ec', SKY2],
        [SEA, '#5a76a8', '#f8f4ec', SEA],
        [SEA2, '#4e4440', '#4e4440', SEA2],
    ],
    # The blue butterfly, glowing in the dark of the school's bathroom.
    'morpho': [
        [DARK, '#24304c', '#24304c', DARK],
        ['#2a8cf0', '#8ff4ff', '#8ff4ff', '#2a8cf0'],
        [DARK, '#40ccfa', '#40ccfa', DARK],
        [DARK, '#1460c4', '#1460c4', DARK],
    ],
    # A selfie: her bob, her blue eyes, the pink tee and the grey hoodie.
    'selfie': [
        ['#b8cce4', HAIR, HAIR, '#b8cce4'],
        [HAIR, SKIN_, SKIN_, HAIR],
        [HAIR, EYE, SKIN_, '#6c3c24'],
        ['#aeaaa4', '#e48aa2', '#e48aa2', '#aeaaa4'],
    ],
    # Chloe: the black beanie, the blue hair, the dark top.
    'chloe': [
        ['#d8c8a8', '#26262c', '#26262c', '#d8c8a8'],
        ['#3a8ad8', '#f6d0b4', '#f0c4a4', '#3a8ad8'],
        ['#2a6ab8', '#f0c4a4', '#e0a090', '#2a6ab8'],
        ['#2a2a30', '#48404c', '#48404c', '#2a2a30'],
    ],
}


def luma(c):
    return 0.299 * int(c[1:3], 16) + 0.587 * int(c[3:5], 16) + 0.114 * int(c[5:7], 16)


def developing(colour, stage):
    """A pixel of the picture at a stage of developing: 0 dark, 1 a grey ghost, 2 half, 3 done."""
    ghost = GHOST_TONES[min(2, int(luma(colour) / 256 * 3))]
    return [UNDEVELOPED, ghost, mix(ghost, colour, 0.55), colour][stage]


def polaroid(picture, stage):
    g = [[FRAME] * 6 for _ in range(7)]
    for y in range(7):
        g[y][5] = FRAME_SHADE
    g[6] = [FRAME_SHADE] * 6
    for y in range(4):
        for x in range(4):
            g[1 + y][1 + x] = developing(picture[y][x], stage)
    return g


# The flash it came with: a burst of light, gone in an eighth of a second.
SPRITES['flash'] = P.rows([
    '...w...',
    '...w...',
    '..wWw..',
    'wwWWWww',
    '..wWw..',
    '...w...',
    '...w...',
], {'W': '#ffffff', 'w': '#fff6d8b0'})
for name, picture in PICTURES.items():
    for i in range(4):
        SPRITES[f'{name}{i}'] = P.grid(polaroid(picture, i))


# ---------------------------------------------------------------------- the rewind spiral
def spiral(turn):
    """The rewind's spiral, a quarter turn further for each `turn` (anticlockwise)."""
    n = 11
    g = [[None] * n for _ in range(n)]
    c = (n - 1) / 2
    t = 0.0
    while t < 3.3 * math.pi:
        r = 0.55 * t
        a = t - turn * math.pi / 2
        x, y = round(c + r * math.cos(a)), round(c - r * math.sin(a))
        if 0 <= x < n and 0 <= y < n:
            g[y][x] = '#f4f8ff'
        t += 0.05
    # A soft edge of light round the line.
    for y in range(n):
        for x in range(n):
            if g[y][x] is None and any(0 <= x + dx < n and 0 <= y + dy < n and g[y + dy][x + dx] == '#f4f8ff'
                                       for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                g[y][x] = '#9ad8ff40'
    return g


for i in range(4):
    SPRITES[f'spiral{i + 1}'] = P.grid(spiral(i))

# --------------------------------------------------------------------------- her ghost
# Her standing silhouette (the idle pose of the hoodie look, light / mid / dark), pale and
# striped like a tape played back.
GHOST_SHAPE = [
    '.........cccbbccc.........',
    '.......ccbcbbbbbcc........',
    '......ccbcbbbbbbbbcc......',
    '.....ccbbcbbbbabbbbcc.....',
    '.....ccbcbbbbbbbbbbcc.....',
    '.....ccbaaabbbbbbbbcc.....',
    '.....ccbaccaacbbbbccc.....',
    '.....ccbacccabbccbccc.....',
    '.....ccbaaccaaaacbccc.....',
    '.....ccbaabaaaaabbccc.....',
    '.....ccbaaabaabbabccc.....',
    '.....ccbaaaaabaabbccc.....',
    '.....ccbbaaaabbabbbcc.....',
    '.....cccbbaaaaabbbccc.....',
    '.....ccccbbaababccccc.....',
    '......cc.cbbaabcaacc......',
    '........aacbbbcaaca.......',
    '.......bbaaaaaaaccab......',
    '.....bbaabaaaabccaabb.....',
    '....bbaaabaaaaccbabbb.....',
    '....baaabbaaaccbbabbb.....',
    '...baabcbaaaccbbbabba.....',
    '..baabbaaabccbbbbabbab....',
    '.baabb.aaaccabbbbabbbb....',
    'baabb...accbabbbbabbbbb...',
    '.baab...ccbbbbbbbbbbbab...',
    '..bbbb..cbbbbcccccbbaab...',
    '...baabbaabbbbbbbbbbab....',
    '....baabaaaabbabbbbbb.....',
    '.....abaaababbbbbbbb......',
    '.....aaaaaabbbbbbbb.......',
    '.....aaaabaabbbbcba.......',
    '.....baababbbbbbcbb.......',
    '......baabbbbbbbbcbb......',
    '.......bcbbbbbbbbcbc......',
    '........cbbbbbbbcbbc......',
    '........cbbbbbbccbbc......',
    '........cbbbbbbbbbbc......',
    '........cbbbbbbbbbbc......',
    '.........cbbbbbbbbc.......',
    '.........cbbbbbbbbc.......',
    '.........cbbb..bbbc.......',
    '.........cbbb..bbbb.......',
    '........bbbbb..bbbbc......',
    '.......bbbbcb..bbbbc......',
    '.......bbbbcb..bbbbc......',
    '.......bbbbc...cbbc.......',
    '.......bbbc....cbbb.......',
    '.......bbbc.....bbb.......',
    '.......bbbc.....bbb.......',
    '.......bbb......bbb.......',
    '.......bbb......cbc.......',
    '.......bbb......cccc......',
    '......ccccc....ccccc......',
    '.....cccaccc...cccccac....',
    '.....cccaccc...ccacccaac..',
    '.....ccaaacc...caaaaaaaaac',
    '.....caaaaac....ccccccccc.',
    '......ccccc...............',
]


def ghost():
    tone = {'a': '#e8f6ff', 'b': '#bfe2ff', 'c': '#8cc4f0'}
    out = []
    for y, row in enumerate(GHOST_SHAPE):
        a = 'a0' if y % 2 == 0 else '58'
        out.append([None if ch == '.' else tone[ch] + a for ch in row])
    return out


SPRITES['ghost'] = P.grid(ghost())

# -------------------------------------------------------------------------------- emitters
MORPHO_FLIGHT = {'gravity': -10, 'flutter': {'amp': 2.5, 'freq': 2}, 'face': True, 'sprite': FLY}
fx = {
    'palette': P.pal,
    'sprites': SPRITES,
    'emitters': {
        # One Morpho every three seconds or so of running or flying, two at most.
        'butterflies': {
            'while': ['run', 'air'], 'perSecond': 0.33, 'minSpeed': 40, 'anchor': 'body', 'jitter': [3, 5],
            'speed': [8, 18], 'angle': [30, 110], 'inherit': 0.15, 'drag': 0.6, 'life': [1800, 2600],
            'fadeIn': 200, 'fadeOut': 600, **MORPHO_FLIGHT, 'max': 2, 'reduced': 0.5,
        },
        # One or two more on some flips and wall moves.
        'flutter': {
            'enter': ['flip', 'wall'], 'chance': 0.45, 'burst': [1, 2], 'anchor': 'body', 'speed': [18, 36],
            'angle': [20, 160], 'drag': 1, 'life': [1200, 1800], 'fadeIn': 100, 'fadeOut': 500,
            **MORPHO_FLIGHT, 'gravity': -14, 'flutter': {'amp': 3, 'freq': 2.5}, 'max': 3, 'reduced': 0,
        },
        # By the start, now and then one round her.
        'idle': {
            'perSecond': 0.5, 'anchor': 'body', 'jitter': [10, 8], 'speed': [5, 10], 'angle': [60, 120],
            'life': [1800, 2600], 'fadeIn': 300, 'fadeOut': 700, **MORPHO_FLIGHT, 'gravity': -6, 'face': False,
        },
        # Leaving: a few take off from where she stood.
        'scatter': {
            'burst': [4, 6], 'anchor': 'body', 'speed': [20, 50], 'angle': [0, 360], 'drag': 1,
            'life': [1200, 1800], 'fadeOut': 500, **MORPHO_FLIGHT, 'gravity': -12,
            'flutter': {'amp': 3, 'freq': 3}, 'face': False, 'reduced': 0.5,
        },
        # Coming back: the rewind's spiral by her shoulder, her ghost sliding back, two or three.
        'arrive': {
            'burst': [2, 3], 'anchor': 'body', 'speed': [15, 35], 'angle': [30, 150], 'drag': 1,
            'life': [1200, 1700], 'fadeIn': 150, 'fadeOut': 500, **MORPHO_FLIGHT,
            'flutter': {'amp': 3, 'freq': 2.5}, 'face': False, 'reduced': 0.5,
        },
        'spiral': {
            'burst': 1, 'anchor': 'chest', 'offset': [-9, -6], 'speed': 0, 'life': 750, 'fadeIn': 120,
            'fadeOut': 400, 'sprite': {'frames': ['spiral1', 'spiral2', 'spiral3', 'spiral4'], 'fps': 12},
            'blend': 'add', 'layer': 'front', 'reduced': 1,
        },
        'ghost': {
            'burst': 1, 'anchor': 'feet', 'offset': [0, -29], 'speed': [40, 50], 'angle': 0, 'drag': 2.5,
            'life': 650, 'fadeOut': 550, 'face': True, 'sprite': {'frames': ['ghost']}, 'reduced': 0,
        },
    },
    'variants': {
        'butterflies': {'emitters': ['butterflies', 'flutter']},
        # Life is Strange: the Polaroids, and on some flips her pose sliding back a moment, pale blue.
        'snapshots': {
            'emitters': [],
            'afterimage': {'mode': 'snapshot', 'enter': ['flip'], 'chance': 0.35, 'colors': ['#bcd8f4'], 'life': 400,
                           'drift': [45, 0], 'alpha': 0.35},
        },
        # Double Exposure (the duffle coat's): the Polaroids, and on some flips and wall moves her
        # other self from the other timeline, outlined in gold like the Pulse shows it, staying put.
        'exposure': {
            'emitters': [],
            'afterimage': {'mode': 'snapshot', 'enter': ['flip', 'wall'], 'chance': 0.35, 'colors': ['#f4b844'],
                           'life': 550,
                           'drift': [0, -4], 'alpha': 0.4},
        },
    },
    'presence': {'idle': ['idle'], 'vanish': ['scatter'], 'appear': ['spiral', 'ghost', 'arrive']},
}

# The Polaroids: one or two at a time, each developing one of the pictures (tricks.py gives them
# their tricks and chance).
fx['emitters']['photo'] = {
    'enter': ['flip'], 'burst': [1, 2], 'anchor': 'hands', 'speed': [20, 45], 'angle': [60, 120], 'inherit': 0.1,
    'gravity': 120, 'drag': 1.5, 'life': [1800, 2200], 'fadeOut': 450, 'tumble': [1, 2],
    'sprite': {'frames': [],
               'sets': [['flash', f'{n}0', f'{n}0', f'{n}1', f'{n}1', f'{n}2', f'{n}3'] for n in PICTURES],
               'fps': 10, 'loop': False},
    'max': 2, 'reduced': 0,
}
fx['variants']['snapshots']['emitters'].append('photo')
fx['variants']['exposure']['emitters'].append('photo')

write_json(BOSSES + '/rewind/fx.json', tricks(fx, 'rewind'))

# Her outfits in boss.json (her world, stage.json, is drawn in stages.py).
b = json.load(open(BOSSES + '/rewind/boss.json', encoding='utf-8'))
b['looks'] = ['hoodie', 'beanie']
b['effect'] = ['butterflies', 'snapshots']
write_json(BOSSES + '/rewind/boss.json', b)
print('rewind written')
