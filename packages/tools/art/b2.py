"""B-2: the look (b2_looks.py), the effects (evade, decay) and her outfit in boss.json."""
from lookgen import *
from tricks import tricks
import json

import b2_looks  # noqa: F401  (the look)

fx = {
    'palette': {'y': '#ffd060', 'Y': '#fff2b0', 'o': '#e8a33a', 'w': '#ffffff', 'W': '#e8ecf4', 'k': '#16161c', 'K': '#34343e'},
    'sprites': {'spark': ['.Y.', 'YwY', '.Y.'], 'cube1': ['ww', 'ww'], 'cube2': ['kk', 'kk'], 'cube3': ['W']},
    'emitters': {
        'evade-sparks': {
            'enter': ['roll', 'flip', 'dash', 'wall'], 'burst': [12, 18], 'anchor': 'body', 'speed': [40, 110],
            'angle': [0, 360], 'gravity': 120, 'drag': 2, 'life': [300, 600], 'fadeOut': 250,
            'rect': {'size': [1, 2], 'colors': ['y', 'Y', 'o']}, 'blend': 'add',
        },
        'glitter': {
            'while': ['run', 'air'], 'perSecond': 8, 'minSpeed': 60, 'anchor': 'feet', 'jitter': [3, 1],
            'speed': [10, 25], 'angle': [30, 90], 'gravity': 80, 'life': [250, 450], 'fadeOut': 200,
            'sprite': {'frames': ['spark'], 'fps': 1}, 'blend': 'add',
        },
        'decay': {
            'while': ['run', 'air', 'wall'], 'every': 4, 'minSpeed': 40, 'anchor': 'body', 'jitter': [3, 8],
            'speed': [6, 18], 'angle': [60, 120], 'gravity': -20, 'drag': 1, 'life': [400, 800], 'fadeOut': 300,
            'sprite': {'frames': ['cube1', 'cube2', 'cube3'], 'random': True}, 'max': 50,
        },
        'shatter': {
            'enter': ['land', 'flip', 'roll'], 'burst': [8, 12], 'anchor': 'body', 'speed': [20, 50],
            'angle': [0, 360], 'gravity': -10, 'drag': 1.5, 'life': [500, 900], 'fadeOut': 350,
            'sprite': {'frames': ['cube1', 'cube2', 'cube3'], 'random': True},
        },
        'burst': {
            'burst': 30, 'anchor': 'body', 'jitter': [4, 10], 'speed': [10, 50], 'angle': [45, 135], 'gravity': -30,
            'drag': 1, 'life': [600, 1100], 'fadeOut': 400, 'sprite': {'frames': ['cube1', 'cube2', 'cube3'], 'random': True},
        },
        'idle': {
            'perSecond': 3, 'anchor': 'body', 'jitter': [5, 8], 'speed': [4, 8], 'angle': [80, 100], 'gravity': -6,
            'life': [700, 1000], 'fadeOut': 400, 'sprite': {'frames': ['cube3'], 'fps': 1},
        },
    },
    'variants': {
        # On her tricks her own silhouette flares up in bright gold where she was, and fades.
        'evade': {'emitters': ['evade-sparks', 'glitter'],
                  'afterimage': {'mode': 'snapshot', 'enter': ['roll', 'flip', 'dash', 'wall', 'vault'],
                                 'colors': ['#ffd23a'], 'textured': False, 'life': 800, 'drift': [-6, -4],
                                 'alpha': 0.85}},
        'decay': {'emitters': ['decay', 'shatter']},
    },
    'presence': {'idle': ['idle'], 'vanish': ['burst'], 'appear': ['burst']},
}
write_json(BOSSES + '/b2/fx.json', tricks(fx, 'b2'))

# Its outfits in boss.json (its world, stage.json, is drawn in stages.py / stages2.py).
b = json.load(open(BOSSES + '/b2/boss.json', encoding='utf-8'))
b['looks'] = ['android']
write_json(BOSSES + '/b2/boss.json', b)
print('b2 written')
