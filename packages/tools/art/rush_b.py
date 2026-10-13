"""Rush B: the eight soldiers (rb_looks.py, rb_heads.py, rb_kit.py), the effect and the looks in
boss.json.

The effect is Counter-Strike's, kept as quiet as Max's butterflies:
* casings: now and then (one every five seconds or so of running) a single brass casing jumps up
  and back off him, glinting, tumbling, and falls away; on about a third of the flips and vaults a
  whole spray of them, casings and live rounds, flies off him every way up and back;
* smoke: on about one hard landing or roll in five a smoke grenade (grey, its green band) is
  tossed a step ahead, bounces once, rolls to a stop, hisses and pops a cloud of fat grey puffs
  that stays where it fell for a second and a half while he runs on through it, then thins away
  (B through your own smoke);
* presence: by the start a planted C4 lies at his heels, its red light blinking faster and
  faster; leaving and coming back he goes up in a puff of smoke, and the bomb stays.
No streams, no muzzle flashes, no money, no flashbang whiting out the screen."""
import json
import math

from lookgen import *
from tricks import tricks

import rb_looks  # noqa: F401  (the looks)
from rb_looks import LOOK_IDS
from rb_kit import _hash


class FxPalette:
    """Palette characters for the effect's colours, given out as pictures need them."""
    POOL = ('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!$%&*=?@^~<>/|;:#()[]{}_-,'
            + ''.join(chr(c) for c in range(0x3b1, 0x3ca)))

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

# ------------------------------------------------------------------------------ a brass casing
# A rifle casing seen from the side: its lit top, its shaded underside, the dark mouth at one
# end; tumbling, it shows it every way. Dark enough underneath to read over the sand-coloured
# walls of his world, not only against the sky.
BRASS = {'w': '#fff6c8', 'Y': '#f0cc66', 'o': '#a87a26', 'O': '#6a4a14', 'k': '#2e1f08'}
SPRITES['casing'] = P.rows([
    'wYYk',
    'oOOk',
], BRASS)

# A live round: the copper bullet in front of the brass case.
COPPER = {'r': '#ffb488', 'R': '#c86a3c', 'q': '#6a2e14'}
SPRITES['round'] = P.rows([
    'rRwYYk',
    'qRoOOk',
], {**BRASS, **COPPER})

# ------------------------------------------------------------------------------ the smoke grenade
# One particle plays the whole of it, 29 x 21, the ground on its bottom row: the grenade (a grey
# can, a green band, the dark lever) drops, bounces once, hisses, and its cloud swells into fat
# puffs lit from the upper front (the cast's light), grey and half see-through, and lingers.
SMOKE = ['#f4f4f2', '#dcdcda', '#c2c2c0', '#a2a2a2', '#828284']
NADE = {'k': '#1c1e1c', 'g': '#a6aaa6', 'G': '#7c807c', 'd': '#4e524e', 'n': '#2e8a2e', 'N': '#1a5a1a',
        'w': '#e8ece8'}
NADE_ROWS = [
    '.kk.',
    'kwgk',
    'nNNn',
    'kgGk',
    'kGdk',
    '.kk.',
]
W, Hh = 29, 21


def blank():
    return [[None] * W for _ in range(Hh)]


def put_nade(g, x0, lift):
    """The grenade standing with its foot `lift` pixels over the ground."""
    y0 = Hh - len(NADE_ROWS) - lift
    for dy, r in enumerate(NADE_ROWS):
        for dx, ch in enumerate(r):
            if ch != '.':
                g[y0 + dy][x0 + dx] = NADE[ch]


def puffs(g, balls, alpha=0xd8):
    """Fat round puffs (cx, cy, r) shaded as balls lit from the upper front: light toward the
    upper right, shade toward the lower left, the edge thinner."""
    lx, ly, lz = 0.45, -0.6, 0.65
    n = math.sqrt(lx * lx + ly * ly + lz * lz)
    lx, ly, lz = lx / n, ly / n, lz / n
    for cx, cy, r in balls:
        if r <= 0.4:
            continue
        for y in range(Hh):
            for x in range(W):
                dx, dy = (x + 0.5 - cx) / r, (y + 0.5 - cy) / r
                d2 = dx * dx + dy * dy
                if d2 > 1:
                    continue
                dz = math.sqrt(1 - d2)
                b = max(0.0, dx * lx + dy * ly + dz * lz)
                i = 0 if b > 0.9 else 1 if b > 0.72 else 2 if b > 0.5 else 3 if b > 0.28 else 4
                a = alpha if d2 < 0.62 else alpha - 0x40
                g[y][x] = SMOKE[i] + '%02x' % a


# The cloud's puffs when full: (x, y, r), round the grenade at x 13..16 on the ground.
CLOUD = [(9.5, 15.0, 5.2), (19.5, 15.5, 5.0), (14.5, 11.0, 6.2), (6.0, 17.0, 3.6), (23.0, 17.0, 3.6),
         (11.0, 6.5, 4.4), (18.0, 7.0, 4.2), (14.6, 4.0, 3.4)]


def cloud(k, rise=0.0):
    """The cloud at size k (0..1): puffs grow from the ground up, the high ones last."""
    out = []
    for i, (x, y, r) in enumerate(CLOUD):
        start = 0.12 * (i / len(CLOUD))
        kk = max(0.0, min(1.0, (k - start) / (1 - start)))
        # Low puffs swell from the grenade, high ones rise to their places.
        cx = 14.5 + (x - 14.5) * (0.4 + 0.6 * kk)
        cy = (Hh - 1) + (y - (Hh - 1)) * kk - rise
        out.append((cx, cy, r * kk))
    return out


frames = []
for i, lift in enumerate((5, 0, 2, 0)):
    g = blank()
    put_nade(g, 13, lift)
    SPRITES[f'nade{i}'] = P.grid(g)
    frames.append(f'nade{i}')
g = blank()
put_nade(g, 13, 0)
puffs(g, [(15.2, 14.0, 1.6), (16.5, 13.0, 1.2)])
SPRITES['nade-hiss'] = P.grid(g)
frames.append('nade-hiss')
for i, k in enumerate((0.3, 0.48, 0.64, 0.78, 0.9, 1.0)):
    g = blank()
    put_nade(g, 13, 0)
    puffs(g, cloud(k))
    SPRITES[f'cloud{i}'] = P.grid(g)
    frames.append(f'cloud{i}')
for i, rise in enumerate((0.4, 0.8)):
    g = blank()
    puffs(g, cloud(1.0, rise), alpha=0xc8 - 0x18 * i)
    SPRITES[f'linger{i}'] = P.grid(g)
SMOKE_FRAMES = frames + ['cloud5'] * 3 + ['linger0'] * 4 + ['linger1']

# ------------------------------------------------------------------------------ smoke puffs
# Presence: he goes up in a puff of smoke. Three sizes of a lumpy puff, grey, half see-through.
for name, balls in (('puff0', [(3.5, 4.0, 2.4)]),
                    ('puff1', [(3.0, 5.0, 2.6), (5.5, 4.5, 2.4), (4.5, 2.8, 2.0)]),
                    ('puff2', [(3.0, 5.5, 2.8), (6.0, 5.0, 2.8), (4.5, 2.5, 2.4)])):
    W, Hh = 9, 9
    g = blank()
    puffs(g, balls, alpha=0xd0)
    SPRITES[name] = P.grid(g)

# ------------------------------------------------------------------------------ the C4
# The bomb planted by the start: olive blocks of plastic explosive taped together, a black timer
# on top with its dark red display and the red light, wires out of it. The light blinks faster
# and faster, a soft red glow round it when it is on.
C4 = {'k': '#141614', 'A': '#8a9076', 'B': '#6e7462', 'C': '#565d4c', 'D': '#3a3e32', 't': '#d8d0b0',
      'T': '#a69e80', 'x': '#3a3a3a', 'X': '#262626', 's': '#7a1414', 'S': '#a82020', 'r': '#ff2a1a',
      'R': '#ffd2b0', 'o': '#5a1010', 'h': '#ff3a2a60', 'H': '#ff4a3a30', 'w': '#d02020', 'v': '#2a3a9a'}
C4_OFF = [
    '...............',
    '....kkkkkk.....',
    '....kxXXxk.....',
    '....ksSsok.....',
    '.kkkkkkkkkkkkk.',
    'kAABAABBtAABBAk',
    'kBBCBBCCTBBCCBk',
    'kCCDwvCCTCCDDCk',
    '.kkkkkkkkkkkkk.',
]
C4_ON = [
    '........H......',
    '....kkkhrh.....',
    '....kxXHRHk....',
    '....ksSsrk.....',
    '.kkkkkkkkkkkkk.',
    'kAABAABBtAABBAk',
    'kBBCBBCCTBBCCBk',
    'kCCDwvCCTCCDDCk',
    '.kkkkkkkkkkkkk.',
]
SPRITES['c4'] = P.rows(C4_OFF, C4)
SPRITES['c4-on'] = P.rows(C4_ON, C4)
# At 10 frames a second: a blink, then a pause that shortens, 0.9 s down to a fifth, the last
# rapid beeps and the light held on; about seven seconds, then it fades and another is planted.
C4_FRAMES = []
for gap in (9, 8, 7, 6, 5, 5, 4, 4, 3, 3, 3, 2, 2, 2, 2, 2):
    C4_FRAMES += ['c4-on'] + ['c4'] * (gap - 1)
C4_FRAMES += ['c4-on'] * 4
C4_LIFE = len(C4_FRAMES) * 100 + 400  # the whole countdown, then the light held on as it fades

fx = {
    'palette': P.pal,
    'sprites': SPRITES,
    'emitters': {
        # One casing every five seconds or so of running, up and back off his chest.
        'casing': {
            'while': ['run'], 'perSecond': 0.2, 'minSpeed': 40, 'anchor': 'chest', 'offset': [1, 0],
            'speed': [55, 80], 'angle': [60, 85], 'inherit': 0.25, 'gravity': 420, 'life': [700, 850],
            'fadeOut': 200, 'tumble': [6, 9], 'sprite': {'frames': ['casing']}, 'max': 2, 'reduced': 0.5,
        },
        # On some flips and vaults (tricks.py): a spray of casings and live rounds off his chest, up
        # and back every way, tumbling and glinting as they fall.
        'spray': {
            'burst': [4, 6], 'anchor': 'chest', 'jitter': [2, 2], 'speed': [60, 115], 'angle': [30, 150],
            'inherit': 0.2, 'gravity': 420, 'life': [650, 900], 'fadeOut': 200, 'tumble': [6, 10],
            'sprite': {'frames': ['casing', 'casing', 'round'], 'random': True}, 'max': 8, 'reduced': 0.3,
        },
        # On some hard landings and rolls (tricks.py): the grenade is tossed a little ahead, rolls
        # to a stop and pops; he runs on through its cloud, which stays where it fell. It keeps
        # none of his speed: falling onto a landing it would sink into the ground.
        'smoke-nade': {
            'burst': 1, 'anchor': 'feet', 'offset': [-2, -11], 'speed': [70, 95], 'angle': 180, 'inherit': 0,
            'drag': 3.2, 'life': 2000, 'fadeOut': 650,
            'sprite': {'frames': SMOKE_FRAMES, 'fps': 10, 'loop': False}, 'max': 2, 'reduced': 0.5,
        },
        # By the start: the planted bomb at his heels, blinking faster and faster.
        'c4': {
            'perSecond': 30, 'anchor': 'feet', 'offset': [13, -4], 'speed': 0, 'life': C4_LIFE, 'fadeIn': 300,
            'fadeOut': 450, 'sprite': {'frames': C4_FRAMES, 'fps': 10, 'loop': False}, 'max': 1,
        },
        # Leaving and coming back: a puff of smoke round him.
        'puff': {
            'burst': [7, 9], 'anchor': 'body', 'jitter': [4, 2], 'speed': [6, 20], 'angle': [0, 360],
            'drag': 1.6, 'gravity': -8, 'life': [1000, 1500], 'fadeIn': 60, 'fadeOut': 700,
            'sprite': {'frames': ['puff0', 'puff1', 'puff2'], 'fps': 5, 'loop': False}, 'reduced': 0.3,
        },
        'puff-feet': {
            'burst': [3, 4], 'anchor': 'feet', 'offset': [0, -3], 'jitter': [6, 1], 'speed': [10, 24],
            'angle': [-10, 190], 'drag': 1.8, 'gravity': -4, 'life': [900, 1300], 'fadeOut': 600,
            'sprite': {'frames': ['puff1', 'puff2'], 'fps': 4, 'loop': False}, 'reduced': 0.3,
        },
    },
    'variants': {'casings': {'emitters': ['casing', 'spray']}, 'smoke': {'emitters': ['smoke-nade']}},
    'presence': {'idle': ['c4'], 'vanish': ['puff', 'puff-feet'], 'appear': ['puff', 'puff-feet']},
}
write_json(BOSSES + '/rush-b/fx.json', tricks(fx, 'rush-b'))

# Its outfits and effect in boss.json (its world, stage.json, is drawn in stages2.py).
b = json.load(open(BOSSES + '/rush-b/boss.json', encoding='utf-8'))
b['looks'] = LOOK_IDS
b['effect'] = ['casings', 'smoke']
write_json(BOSSES + '/rush-b/boss.json', b)
print('rush b written')
