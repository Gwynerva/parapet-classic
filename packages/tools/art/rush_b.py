"""Rush B: the looks (rb_looks.py), the effects (casings, smoke) and the outfits in boss.json."""
from lookgen import *
from tricks import tricks
import json

import rb_looks  # noqa: F401  (the looks)

fx = {
    'palette': {'y': '#e8c060', 'Y': '#fff0a0', 'o': '#b88a2a', 'O': '#7a5a18', 'g': '#9a9ea6', 'G': '#c8ccd2',
                'd': '#6a6e76', 'w': '#ffffff', 'f': '#ffb040'},
    'sprites': {
        'casing1': ['Yyo'], 'casing2': ['Y', 'y', 'o'], 'casing3': ['oyY'],
        'smoke1': ['.GG.', 'GggG', '.gG.'],
        'smoke2': ['..GG..', '.GggG.', 'GgggdG', '.Gggd.', '..dd..'],
        'smoke3': ['...GGG...', '.GGgggG..', 'GggggggG.', 'GgggggddG', '.Ggggddd.', '..Gdddd..', '...ddd...'],
        'flash': ['..f..', '.fYf.', 'fYwYf', '.fYf.', '..f..'],
    },
    'emitters': {
        'casings': {
            'while': ['run', 'air'], 'every': 9, 'minSpeed': 50, 'anchor': 'hand.near', 'speed': [40, 70],
            'angle': [60, 110], 'inherit': 0.1, 'gravity': 420, 'life': [500, 700], 'fadeOut': 200, 'tumble': [4, 8],
            'sprite': {'frames': ['casing1', 'casing2', 'casing3'], 'random': True}, 'max': 30,
        },
        'spray': {
            'enter': ['land', 'flip', 'vault'], 'burst': [4, 6], 'anchor': 'hand.near', 'speed': [50, 90],
            'angle': [50, 130], 'gravity': 420, 'life': [500, 700], 'fadeOut': 200, 'tumble': [4, 8],
            'sprite': {'frames': ['casing1', 'casing2', 'casing3'], 'random': True},
        },
        'flash': {
            'enter': ['jump', 'flip'], 'burst': 1, 'anchor': 'hand.near', 'speed': 0, 'life': 90, 'fadeOut': 60,
            'sprite': {'frames': ['flash'], 'fps': 1}, 'blend': 'add',
        },
        'smoke': {
            'while': ['run', 'air'], 'every': 14, 'minSpeed': 50, 'anchor': 'feet', 'jitter': [3, 1],
            'speed': [6, 14], 'angle': [60, 120], 'gravity': -14, 'drag': 1.5, 'life': [900, 1400], 'fadeOut': 600,
            'sprite': {'frames': ['smoke1', 'smoke2', 'smoke3'], 'fps': 3, 'loop': False}, 'max': 16,
        },
        'grenade': {
            'enter': ['land', 'roll', 'flip'], 'burst': [4, 6], 'anchor': 'feet', 'speed': [15, 35], 'angle': [20, 160],
            'gravity': -10, 'drag': 1.2, 'life': [1200, 1800], 'fadeOut': 700,
            'sprite': {'frames': ['smoke1', 'smoke2', 'smoke3'], 'fps': 2, 'loop': False},
        },
        'burst': {
            'burst': 8, 'anchor': 'body', 'speed': [10, 40], 'angle': [0, 360], 'gravity': -10, 'drag': 1.4,
            'life': [1200, 1800], 'fadeOut': 700, 'sprite': {'frames': ['smoke1', 'smoke2', 'smoke3'], 'fps': 2, 'loop': False},
        },
        'brass': {
            'burst': 10, 'anchor': 'hands', 'speed': [40, 90], 'angle': [40, 140], 'gravity': 420, 'life': [500, 800],
            'fadeOut': 200, 'tumble': [4, 8], 'sprite': {'frames': ['casing1', 'casing2', 'casing3'], 'random': True},
        },
        'idle': {
            'perSecond': 1, 'anchor': 'feet', 'jitter': [6, 0], 'speed': [4, 10], 'angle': [70, 110], 'gravity': -8,
            'life': [1200, 1600], 'fadeOut': 600, 'sprite': {'frames': ['smoke1', 'smoke2'], 'fps': 2, 'loop': False},
        },
    },
    'variants': {'casings': {'emitters': ['casings', 'spray', 'flash']}, 'smoke': {'emitters': ['smoke', 'grenade']}},
    'presence': {'idle': ['idle'], 'vanish': ['burst', 'brass'], 'appear': ['burst', 'brass']},
}
write_json(BOSSES + '/rush-b/fx.json', tricks(fx, 'rush-b'))

# Its outfits in boss.json (its world, stage.json, is drawn in stages.py / stages2.py).
b = json.load(open(BOSSES + '/rush-b/boss.json', encoding='utf-8'))
b['looks'] = ['balaclava', 'shades', 'bandana', 'arctic', 'gas-mask', 'helmet', 'blue-squad', 'jungle']
write_json(BOSSES + '/rush-b/boss.json', b)
print('rush b written')
