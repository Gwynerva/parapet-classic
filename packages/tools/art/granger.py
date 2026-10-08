"""Granger: the looks (gn_looks.py), the effects (blink, recall) and the outfits in boss.json."""
from lookgen import *
from tricks import tricks
import json

from gn_looks import CYAN  # (importing the looks writes them)

fx = {
    'palette': {'c': CYAN, 'C': '#bff4ff', 'w': '#ffffff', 'b': '#2a8ab0', 'B': '#1a5a80'},
    'sprites': {
        'ring1': ['.c.', 'c.c', '.c.'],
        'ring2': ['.cc.', 'c..c', 'c..c', '.cc.'],
        'ring3': ['..ccc..', '.c...c.', 'c.....c', 'c..w..c', 'c.....c', '.c...c.', '..ccc..'],
        'tick': ['c.c', '.w.', 'c.c'],
    },
    'emitters': {
        'streaks': {
            'while': ['run', 'air'], 'every': 4, 'minSpeed': 70, 'anchor': 'body', 'jitter': [1, 8],
            'speed': [2, 6], 'angle': [-3, 3], 'life': [140, 260], 'fadeOut': 140,
            'rect': {'size': 1, 'colors': ['c', 'C', 'w']}, 'blend': 'add', 'max': 60,
        },
        'blink': {
            'enter': ['jump', 'dash', 'vault', 'flip'], 'burst': [10, 14], 'anchor': 'body', 'jitter': [1, 8],
            'speed': [60, 120], 'angle': [-6, 6], 'drag': 6, 'life': [200, 320], 'fadeOut': 180,
            'rect': {'size': 1, 'colors': ['c', 'C', 'w']}, 'blend': 'add',
        },
        'ticks': {
            'while': ['run', 'air'], 'every': 26, 'minSpeed': 60, 'anchor': 'chest', 'speed': [4, 10],
            'angle': [0, 40], 'life': [500, 700], 'fadeOut': 300, 'sprite': {'frames': ['ring1', 'ring2', 'ring3'], 'fps': 6, 'loop': False},
            'blend': 'add',
        },
        'burst': {
            'burst': 3, 'anchor': 'chest', 'speed': 0, 'life': 500, 'fadeOut': 300,
            'sprite': {'frames': ['ring1', 'ring2', 'ring3'], 'fps': 7, 'loop': False}, 'blend': 'add', 'scale': [1, 2],
        },
        'sparks': {
            'burst': 22, 'anchor': 'body', 'jitter': [1, 10], 'speed': [80, 160], 'angle': [-8, 8], 'drag': 5,
            'life': [250, 400], 'fadeOut': 200, 'rect': {'size': 1, 'colors': ['c', 'C', 'w']}, 'blend': 'add',
        },
        'idle': {
            'perSecond': 1, 'anchor': 'chest', 'speed': 0, 'life': 600, 'fadeOut': 300,
            'sprite': {'frames': ['ring1', 'ring2', 'ring3'], 'fps': 5, 'loop': False}, 'blend': 'add',
        },
    },
    'variants': {
        'blink': {'emitters': ['streaks', 'blink'],
                  'afterimage': {'mode': 'snapshot', 'enter': ['jump', 'dash', 'vault', 'flip'], 'colors': [CYAN],
                                 'life': 260, 'drift': [0, 0], 'alpha': 0.6, 'textured': False}},
        'recall': {'emitters': ['ticks'],
                   'afterimage': {'steps': [{'back': 6, 'alpha': 0.15}, {'back': 4, 'alpha': 0.25}, {'back': 2, 'alpha': 0.4}],
                                  'colors': [CYAN], 'textured': True, 'scanlines': True, 'while': 'running'}},
    },
    'presence': {'idle': ['idle'], 'vanish': ['sparks', 'burst'], 'appear': ['sparks', 'burst']},
}
write_json(BOSSES + '/granger/fx.json', tricks(fx, 'granger'))

# Its outfits in boss.json (its world, stage.json, is drawn in stages.py / stages2.py).
b = json.load(open(BOSSES + '/granger/boss.json', encoding='utf-8'))
b['looks'] = ['classic', 'pink', 'silver']
write_json(BOSSES + '/granger/boss.json', b)
print('granger written')
