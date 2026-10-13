"""Vera: the looks (vr_looks.py, vr_heads.py), the effect (Runner Vision's red route and the glass
she breaks off walls) and her outfits in boss.json."""
from lookgen import *
from tricks import tricks
import json

import vr_looks  # noqa: F401  (the looks)

# ------------------------------------------------------------------ effects
# "Follow the red": Runner Vision of Mirror's Edge marks a runner's way in red. Vera's flips,
# vaults and wall runs leave a dotted red line in the world along her hips that fades in half a
# second; now and then it crumbles into little red triangles as she lands (Catalyst's route
# breaking up), or the edge she lands on lights up red under her feet. Waiting for a contest she
# stands in a Time Trial checkpoint: a faint red column rising round her. The second variant is
# the glass of the city: shards off the wall on some of her kick-offs.
fx = {
    'palette': {'r': '#ff1a10', 'R': '#c00102', 'o': '#ff6a4a', 'q': '#8a0004',
                'w': '#ffffff', 'c': '#c5e2f2', 'C': '#75a9ce', 'D': '#2e5c84',
                'p': '#ff3a1ab0', 'P': '#ff1a1070'},
    'sprites': {
        # The route breaking up: little triangles, light edge up.
        'tri1': ['.o', 'rR'],
        'tri2': ['o.', 'rq'],
        'tri3': ['.o.', 'rrR'],
        'tri4': ['orR', '.R.'],
        # A lit edge under her feet: the surface Runner Vision shows her.
        'edge': ['RRrrroorrRR'],
        # A Time Trial checkpoint's wall, rising.
        'seg': ['p', 'p', 'P', 'P'],
        # The checkpoint's ring on the ground.
        'ring': ['.....PPPPPPPPPPP.....', '..PPP...........PPP..', 'PP.................PP',
                 '..ppp...........ppp..', '.....ppppppppppp.....'],
        # Glass: a white glint, pale and deep blue.
        'shard1': ['w...', 'cw..', 'cCw.', 'DDCw'],
        'shard2': ['.w', 'wc', 'cC', 'D.'],
        'shard3': ['wcc', '.CD'],
        'shard4': ['.w.', 'wcC', 'DD.'],
    },
    'emitters': {
        # The red route: a dot every two pixels along her hips while she flips, vaults or runs on
        # a wall, left in the world; it fades in about half a second.
        'route': {
            'while': ['flip', 'vault', 'wall'], 'every': 2, 'anchor': 'hips', 'speed': 0, 'inherit': 0,
            'life': [520, 680], 'fadeOut': 320, 'max': 80, 'reduced': 0.5,
            'rect': {'size': 1, 'colors': ['#ff1a10', '#ff1a10', '#ff3a20', '#c00102']},
        },
        # The route crumbling into triangles behind her as she comes down from a trick into a
        # landing (some of them).
        'crumble': {
            'moves': [23], 'chance': 0.35, 'burst': [3, 5], 'anchor': 'hips', 'offset': [6, 0],
            'jitter': [5, 3], 'speed': [6, 22], 'angle': [30, 150], 'gravity': 110, 'tumble': [1, 3],
            'life': [420, 680], 'fadeOut': 300, 'reduced': 0.3,
            'sprite': {'frames': ['tri1', 'tri2', 'tri3', 'tri4'], 'random': True},
        },
        # Now and then the edge she touches down on (after a trick, a drop) lights up red.
        'edge': {
            'moves': [24, 25], 'chance': 0.1, 'burst': 1, 'anchor': 'feet', 'offset': [1, -3], 'speed': 0,
            'inherit': 0, 'life': 620, 'fadeIn': 70, 'fadeOut': 380, 'reduced': 0.5,
            'sprite': {'frames': ['edge']},
        },
        # Glass off the wall on some kick-offs (the tic-tac jump, the wall flip).
        'kick-glass': {
            'moves': [20, 48], 'chance': 0.2, 'burst': [4, 6], 'anchor': 'feet', 'jitter': [2, 4],
            'speed': [30, 75], 'angle': [-20, 200], 'gravity': 260, 'life': [450, 700], 'fadeOut': 260,
            'tumble': [2, 5], 'reduced': 0.3,
            'sprite': {'frames': ['shard1', 'shard2', 'shard3', 'shard4'], 'random': True},
        },
        # Presence: the Time Trial checkpoint she waits in: its ring on the ground, its two faint
        # walls and red specks rising round her.
        'checkpoint': {
            'perSecond': 7, 'anchor': 'feet', 'jitter': [9, 0], 'speed': [14, 28], 'angle': 90,
            'life': [900, 1400], 'fadeIn': 150, 'fadeOut': 500,
            'rect': {'size': 1, 'colors': ['#ff3a1ab0', '#ff6a3a99', '#ff1a10cc']},
        },
        'column-a': {
            'perSecond': 4, 'anchor': 'feet', 'offset': [10, 0], 'jitter': [0.5, 0], 'speed': [18, 28],
            'angle': 90, 'life': [1200, 1600], 'fadeIn': 200, 'fadeOut': 600, 'reduced': 0.5,
            'sprite': {'frames': ['seg']},
        },
        'column-b': {
            'perSecond': 4, 'anchor': 'feet', 'offset': [-10, 0], 'jitter': [0.5, 0], 'speed': [18, 28],
            'angle': 90, 'life': [1200, 1600], 'fadeIn': 200, 'fadeOut': 600, 'reduced': 0.5,
            'sprite': {'frames': ['seg']},
        },
        'ring': {
            'perSecond': 1.5, 'anchor': 'feet', 'offset': [0, -1], 'speed': 0, 'life': 1000, 'fadeIn': 300,
            'fadeOut': 500, 'reduced': 1, 'sprite': {'frames': ['ring']},
        },
        # Leaving and coming back: her route bursting into triangles, a few glass shards.
        'tris': {
            'burst': [12, 16], 'anchor': 'body', 'jitter': [4, 10], 'speed': [30, 80], 'angle': [0, 360],
            'drag': 1.5, 'gravity': 60, 'tumble': [1, 3], 'life': [400, 750], 'fadeOut': 320, 'reduced': 0.3,
            'sprite': {'frames': ['tri1', 'tri2', 'tri3', 'tri4'], 'random': True},
        },
        'shatter': {
            'burst': [5, 8], 'anchor': 'feet', 'speed': [30, 70], 'angle': [20, 160], 'gravity': 280,
            'life': [400, 700], 'fadeOut': 250, 'tumble': [2, 5], 'reduced': 0.3,
            'sprite': {'frames': ['shard1', 'shard2', 'shard3', 'shard4'], 'random': True},
        },
    },
    'variants': {
        'vision': {'emitters': ['route', 'crumble', 'edge']},
        'glass': {'emitters': ['kick-glass']},
    },
    'presence': {'idle': ['ring', 'checkpoint', 'column-a', 'column-b'], 'vanish': ['tris', 'shatter'],
                 'appear': ['tris', 'shatter']},
}
write_json(BOSSES + '/vera/fx.json', tricks(fx, 'vera'))

# Her outfits in boss.json (its world, stage.json, is drawn in stages2.py).
b = json.load(open(BOSSES + '/vera/boss.json', encoding='utf-8'))
b['looks'] = ['vera-tank', 'vera-vest', 'vera-street']
b['effect'] = ['vision', 'glass']
write_json(BOSSES + '/vera/boss.json', b)
print('vera written')
