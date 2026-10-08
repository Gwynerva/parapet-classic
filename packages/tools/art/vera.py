"""Vera: the looks (vr_looks.py), the effect (wind, glass) and her outfits in boss.json."""
from lookgen import *
from tricks import tricks
import json

import vr_looks  # noqa: F401  (the looks)

# ------------------------------------------------------------------ effects
fx = {
    'palette': {'r': '#ff3a2e', 'R': '#c01c18', 'w': '#ffffff', 'c': '#bfe8ff', 'C': '#7ac8f0', 'g': '#e8f6ff',
                'a': '#ffffffc0', 'b': '#e4f4ff80', 'd': '#c8e6ff60'},
    'sprites': {
        # Gusts of wind: thin streaks, brighter where they lead.
        'gust1': ['ddbbaaaaaa'],
        'gust2': ['...ddbbaa', 'dbbaaa...'],
        'gust3': ['ddbbbaaaaaaa'],
        'gust4': ['dbbaa....', '....dbbaa'],
        'gust5': ['ddbaaaa'],
        'shard1': ['w..', 'cw.', 'Ccw'],
        'shard2': ['.w.', 'cwc', 'C.C'],
        'shard3': ['wc', 'cC', 'C.'],
    },
    'emitters': {
        # Her speed in the air around her: streaks blown past her, more the faster she goes.
        'gusts': {
            'while': ['run', 'air', 'wall'], 'every': 4, 'minSpeed': 70, 'anchor': 'body', 'jitter': [2, 9],
            'offset': [3, 0], 'speed': [25, 60], 'angle': [-4, 4], 'life': [180, 320], 'fadeIn': 30,
            'fadeOut': 140, 'face': True,
            'sprite': {'frames': ['gust1', 'gust2', 'gust3', 'gust4', 'gust5'], 'random': True}, 'max': 40,
        },
        'gust-burst': {
            'enter': ['jump', 'flip', 'vault', 'wall'], 'burst': [4, 6], 'anchor': 'body', 'jitter': [3, 8],
            'speed': [50, 90], 'angle': [-8, 8], 'life': [220, 360], 'fadeOut': 160, 'face': True,
            'sprite': {'frames': ['gust1', 'gust3', 'gust5'], 'random': True},
        },
        # Only now and then a landing breaks glass.
        'rare-glass': {
            'enter': ['land', 'roll'], 'chance': 0.18, 'burst': [4, 7], 'anchor': 'feet', 'speed': [30, 70],
            'angle': [20, 160], 'gravity': 280, 'life': [400, 700], 'fadeOut': 250, 'tumble': [2, 5],
            'sprite': {'frames': ['shard1', 'shard2', 'shard3'], 'random': True},
        },
        'shatter': {
            'burst': [6, 9], 'anchor': 'feet', 'speed': [30, 70], 'angle': [20, 160], 'gravity': 280,
            'life': [400, 700], 'fadeOut': 250, 'tumble': [2, 5],
            'sprite': {'frames': ['shard1', 'shard2', 'shard3'], 'random': True},
        },
        'burst': {
            'burst': 18, 'anchor': 'body', 'jitter': [4, 10], 'speed': [60, 120], 'angle': [-10, 10], 'drag': 2,
            'life': [250, 450], 'fadeOut': 200, 'sprite': {'frames': ['gust1', 'gust3', 'gust5'], 'random': True},
        },
        'idle': {
            'perSecond': 3, 'anchor': 'body', 'jitter': [6, 10], 'offset': [6, 0], 'speed': [15, 30],
            'angle': [-5, 5], 'life': [300, 500], 'fadeIn': 80, 'fadeOut': 200,
            'sprite': {'frames': ['gust1', 'gust5'], 'random': True},
        },
    },
    'variants': {
        'wind': {'emitters': ['gusts', 'gust-burst', 'rare-glass']},
    },
    'presence': {'idle': ['idle'], 'vanish': ['burst', 'shatter'], 'appear': ['burst', 'shatter']},
}
write_json(BOSSES + '/vera/fx.json', tricks(fx, 'vera'))

# Its outfits in boss.json (its world, stage.json, is drawn in stages.py / stages2.py).
b = json.load(open(BOSSES + '/vera/boss.json', encoding='utf-8'))
b['looks'] = ['vera-tank', 'vera-vest', 'vera-hood']
write_json(BOSSES + '/vera/boss.json', b)
print('vera written')
