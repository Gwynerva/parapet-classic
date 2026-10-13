"""Shahzada: the looks (sh_looks.py), the effects (the sands of time, the dark sands) and his
outfits in boss.json.

The effect is the Dagger of Time and the rewind, quietly: running, now and then a glint on the
dagger's glass hilt and a grain of sand trickling from it; on flips and vaults a statue of sand of
his pose stays behind and crumbles into falling grains (it never happened); on some wall moves a
little sand runs off his boots; when he falls (`fail`), as he leaves and as he comes back, an
hourglass over his head turns over in a ring of sand ("no, no, that's not how it happened...").
The Dark Prince wears the same in charcoal and embers."""
import json
import math

from lookgen import *
from tricks import tricks

import sh_looks  # noqa: F401  (the looks)

PALETTE = {
    'Y': '#fff2b0',  # sand catching the light
    'y': '#f0cb63',  # sand, gold
    'o': '#d9a441',  # sand, ochre
    'O': '#a8752c',  # sand in shade
    'w': '#ffffff',
    'j': '#bfe8f8',  # the dagger's blade glint
    'W': '#7a4a1e',  # the hourglass's wood
    'V': '#c48a3c',  # the wood, lit
    'g': '#e6f2f6b0',  # glass
    'k': '#1c1a22',  # charcoal
    'K': '#3a3446',
    'r': '#ff8a1a',  # embers
    'R': '#c8400a',
    'e': '#ffd060',
}

# The hourglass upright with its sand run down; it turns over in quarter turns (like the particles'
# own tumbling): on its side, then upside down with the sand on top: time starts again.
# fmt: off
HOURGLASS = [
    '.VVVVVVV.',
    '.WWWWWWW.',
    '..g...g..',
    '...g.g...',
    '....y....',
    '...gYg...',
    '..gyyyg..',
    '.WWWWWWW.',
    '.VVVVVVV.',
]
# fmt: on


def turned(rows, deg):
    """A picture turned about its centre by `deg` (clockwise; quarter turns are exact)."""
    h, w = len(rows), len(rows[0])
    cx, cy = (w - 1) / 2, (h - 1) / 2
    a = math.radians(-deg)
    out = []
    for y in range(h):
        row = ''
        for x in range(w):
            dx, dy = x - cx, y - cy
            sx = round(cx + dx * math.cos(a) - dy * math.sin(a))
            sy = round(cy + dx * math.sin(a) + dy * math.cos(a))
            row += rows[sy][sx] if 0 <= sx < w and 0 <= sy < h else '.'
        out.append(row)
    return out


def trickle(rows):
    """The turned-over hourglass with a grain falling through its neck and one landed."""
    r = [list(x) for x in rows]
    r[4][4] = 'Y'
    r[6][4] = 'y'
    return [''.join(x) for x in r]


HG = {f'hg{d}': turned(HOURGLASS, d) for d in (0, 90, 180)}
HG['hg180t'] = trickle(HG['hg180'])
HG_FRAMES = ['hg0', 'hg0', 'hg0', 'hg90', 'hg90', 'hg180', 'hg180', 'hg180t', 'hg180', 'hg180t', 'hg180', 'hg180t']

SAND = ['y', 'o', 'Y', 'O']
DARK = ['k', 'K', 'k', 'r', 'R']

fx = {
    'palette': PALETTE,
    'sprites': {
        # the glint on the dagger's hilt: a point, a little star, a point
        'glint1': ['.Y.', 'YwY', '.Y.'],
        'glint2': ['..j..', '..Y..', 'jYwYj', '..Y..', '..j..'],
        **HG,
    },
    'emitters': {
        # --- the sands of time ----------------------------------------------------------------
        # running: now and then a glint on the hilt of the Dagger of Time…
        'glint': {
            'while': ['run', 'air'], 'perSecond': 0.22, 'minSpeed': 40, 'anchor': 'hips', 'offset': [-3, -4],
            'jitter': [1, 1], 'speed': 0, 'inherit': 1, 'life': 320, 'fadeIn': 60, 'fadeOut': 160,
            'sprite': {'frames': ['glint1', 'glint2', 'glint1'], 'fps': 10, 'loop': False}, 'blend': 'add',
            'layer': 'front', 'max': 1, 'reduced': 1,
        },
        # …and a grain of sand trickling out of it
        'grain': {
            'while': ['run', 'air', 'wall'], 'perSecond': 0.7, 'minSpeed': 40, 'anchor': 'hips', 'offset': [-3, -2],
            'jitter': [1, 1], 'speed': [0, 6], 'angle': [-100, -80], 'inherit': 0.25, 'gravity': 180,
            'life': [450, 700], 'fadeOut': 200, 'rect': {'size': 1, 'colors': ['y', 'Y', 'o']}, 'max': 3,
        },
        # some flips and vaults: the statue of sand (the afterimage) crumbling into falling grains,
        # which come with it (the afterimage's burst)
        'crumble': {
            'burst': [12, 16], 'anchor': 'body', 'jitter': [1, 2], 'speed': [0, 10],
            'angle': [-120, -60], 'inherit': 0, 'gravity': 150, 'drag': 0.5, 'life': [380, 700], 'fadeOut': 260,
            'rect': {'size': 1, 'colors': SAND}, 'max': 40,
        },
        # some wall moves: a little sand running off the boots
        'wall-sand': {
            'enter': ['wall'], 'chance': 0.3, 'burst': [3, 5], 'anchor': 'feet', 'jitter': [2, 1],
            'speed': [4, 14], 'angle': [-150, -30], 'inherit': 0.1, 'gravity': 160, 'life': [350, 600],
            'fadeOut': 200, 'rect': {'size': 1, 'colors': SAND}, 'max': 10,
        },
        # a fall: the hourglass turns over over his head in a ring of sand
        'hourglass': {
            'enter': ['fail'], 'burst': 1, 'anchor': 'head', 'offset': [0, -13], 'speed': 0, 'inherit': 0.6,
            'life': 1200, 'fadeIn': 90, 'fadeOut': 350, 'sprite': {'frames': HG_FRAMES, 'fps': 10, 'loop': False},
            'layer': 'front', 'max': 1, 'reduced': 1,
        },
        'ring': {
            'enter': ['fail'], 'burst': [22, 28], 'anchor': 'hips', 'jitter': [1, 1], 'speed': [55, 80],
            'angle': [0, 360], 'inherit': 0.3, 'gravity': 25, 'drag': 3.2, 'life': [450, 750], 'fadeOut': 300,
            'rect': {'size': 1, 'colors': SAND}, 'reduced': 0.4,
        },
        # --- the dark sands (the Dark Prince) -------------------------------------------------
        # an ember now and then off the Daggertail's hand, a cinder of black sand falling
        'ember': {
            'while': ['run', 'air'], 'perSecond': 0.9, 'minSpeed': 40, 'anchor': 'hand.far', 'jitter': [1, 1],
            'speed': [6, 16], 'angle': [60, 120], 'inherit': 0.2, 'gravity': -30, 'life': [300, 550],
            'fadeOut': 220, 'rect': {'size': 1, 'colors': ['r', 'e', 'R']}, 'blend': 'add', 'max': 3,
        },
        'cinder': {
            'while': ['run', 'air', 'wall'], 'perSecond': 0.6, 'minSpeed': 40, 'anchor': 'chest', 'jitter': [3, 4],
            'speed': [0, 6], 'angle': [-100, -80], 'inherit': 0.25, 'gravity': 160, 'life': [450, 700],
            'fadeOut': 200, 'rect': {'size': 1, 'colors': ['k', 'K', 'R']}, 'max': 3,
        },
        'dark-crumble': {
            'burst': [12, 16], 'anchor': 'body', 'jitter': [1, 2], 'speed': [0, 10],
            'angle': [-120, -60], 'inherit': 0, 'gravity': 150, 'drag': 0.5, 'life': [380, 700], 'fadeOut': 260,
            'rect': {'size': 1, 'colors': DARK}, 'max': 40,
        },
        'dark-ring': {
            'enter': ['fail'], 'burst': [22, 28], 'anchor': 'hips', 'jitter': [1, 1], 'speed': [55, 80],
            'angle': [0, 360], 'inherit': 0.3, 'gravity': 25, 'drag': 3.2, 'life': [450, 750], 'fadeOut': 300,
            'rect': {'size': 1, 'colors': DARK}, 'reduced': 0.4,
        },
        # --- presence: waiting by the start, leaving, coming back ------------------------------
        'idle': {
            'perSecond': 3, 'anchor': 'body', 'jitter': [7, 0], 'speed': [0, 4], 'angle': [-100, -80],
            'gravity': 50, 'life': [600, 1000], 'fadeIn': 100, 'fadeOut': 300, 'rect': {'size': 1, 'colors': SAND},
        },
        'turn': {
            'burst': 1, 'anchor': 'head', 'offset': [0, -10], 'speed': 0, 'life': 1200, 'fadeIn': 90,
            'fadeOut': 350, 'sprite': {'frames': HG_FRAMES, 'fps': 10, 'loop': False}, 'layer': 'front',
            'reduced': 1,
        },
        'scatter': {
            'burst': [26, 32], 'anchor': 'body', 'speed': [40, 80], 'angle': [0, 360], 'gravity': 40, 'drag': 2.6,
            'life': [500, 900], 'fadeOut': 350, 'rect': {'size': 1, 'colors': SAND}, 'reduced': 0.4,
        },
    },
    'variants': {
        'sands': {
            'emitters': ['glint', 'grain', 'wall-sand', 'hourglass', 'ring'],
            'afterimage': {'mode': 'snapshot', 'enter': ['flip', 'vault'], 'chance': 0.35, 'burst': ['crumble'],
                           'colors': ['#d9a441'], 'textured': True,
                           'life': 420, 'drift': [0, 14], 'alpha': 0.5},
        },
        'dark-sands': {
            'emitters': ['ember', 'cinder', 'hourglass', 'dark-ring'],
            'afterimage': {'mode': 'snapshot', 'enter': ['flip', 'vault'], 'chance': 0.35, 'burst': ['dark-crumble'],
                           'colors': ['#2a2430'], 'textured': True,
                           'life': 420, 'drift': [0, 14], 'alpha': 0.72},
        },
    },
    'presence': {'idle': ['idle'], 'vanish': ['turn', 'scatter'], 'appear': ['turn', 'scatter']},
}
write_json(BOSSES + '/shahzada/fx.json', tricks(fx, 'shahzada'))

# Its outfits in boss.json (its world, stage.json, is drawn in stages.py / stages2.py).
b = json.load(open(BOSSES + '/shahzada/boss.json', encoding='utf-8'))
b['looks'] = ['sands', 'warrior', 'wanderer', 'dark-prince']
b['effect'] = ['sands']
write_json(BOSSES + '/shahzada/boss.json', b)
print('shahzada written')
