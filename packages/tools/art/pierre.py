"""Pierre: four of his looks (pr_looks.py) and his effect (code: glyphs and ideas). His other
looks (mechanic, kate, evening, birthday) and boss.json are not drawn here."""
from lookgen import *
from tricks import tricks

import pr_looks  # noqa: F401  (the looks)

# Code in every colour of the rainbow, blown off him every way; now and then an idea lights up.
GLYPHS = {
    'lbrace': ['.##', '.#.', '#..', '.#.', '.##'],
    'rbrace': ['##.', '.#.', '..#', '.#.', '##.'],
    'semi': ['.', '#', '.', '#', '#'],
    'lt': ['..#', '.#.', '#..', '.#.', '..#'],
    'gt': ['#..', '.#.', '..#', '.#.', '#..'],
    'slash': ['..#', '..#', '.#.', '#..', '#..'],
    'eq': ['...', '###', '...', '###', '...'],
    'hash': ['#.#', '###', '#.#', '###', '#.#'],
    'zero': ['.#.', '#.#', '#.#', '#.#', '.#.'],
    'one': ['.#', '##', '.#', '.#', '.#'],
    'lpar': ['.#', '#.', '#.', '#.', '.#'],
    'rpar': ['#.', '.#', '.#', '.#', '#.'],
}
RAINBOW = {'1': '#ff4a5a', '2': '#ffa030', '3': '#ffe040', '4': '#50e070', '5': '#40d8ff', '6': '#5a7aff',
           '7': '#c060ff'}
sprites = {f'{g}{c}': [r.replace('#', c) for r in rows] for g, rows in GLYPHS.items() for c in RAINBOW}
sprites['bulb1'] = ['..yyy..', '.yYWYy.', 'yYWWWYy', 'yYWWWYy', '.yYWYy.', '..kgk..', '..kgk..', '...k...']
sprites['bulb2'] = ['..aaa..', '.aYWYa.', 'aYWWWYa', 'aYWWWYa', '.aYWYa.', '..kgk..', '..kgk..', '...k...']
glyphs = sorted(k for k in sprites if k[-1] in RAINBOW)
fx = {
    'palette': {**RAINBOW, 'y': '#ffe06a', 'Y': '#fff2a8', 'W': '#ffffff', 'a': '#ffd04080', 'k': '#3a3440',
                'g': '#8a8e9a'},
    'sprites': sprites,
    'emitters': {
        'code': {
            'while': ['run', 'air', 'wall'], 'every': 6, 'minSpeed': 40, 'anchor': 'body', 'jitter': [3, 7],
            'speed': [15, 45], 'angle': [-75, 75], 'gravity': -12, 'drag': 1.2, 'life': [600, 1100],
            'fadeOut': 400, 'sprite': {'frames': glyphs, 'random': True}, 'max': 36, 'reduced': 0.3,
        },
        'code-burst': {
            'enter': ['flip', 'vault', 'land'], 'burst': [4, 7], 'anchor': 'body', 'speed': [30, 70],
            'angle': [-180, 180], 'gravity': -10, 'drag': 1.5, 'life': [500, 900], 'fadeOut': 350,
            'sprite': {'frames': glyphs, 'random': True},
        },
        # An idea: a light bulb comes on over his head, glows, rises and fades.
        'bulb': {
            'while': ['run', 'air', 'wall'], 'perSecond': 0.2, 'anchor': 'head', 'offset': [-1, -12],
            'speed': [4, 8], 'angle': [80, 100], 'gravity': -6, 'life': 1300, 'fadeIn': 150, 'fadeOut': 550,
            'sprite': {'frames': ['bulb1', 'bulb2'], 'fps': 5}, 'max': 1, 'layer': 'front', 'reduced': 1,
        },
        'burst': {
            'burst': 26, 'anchor': 'body', 'speed': [30, 90], 'angle': [0, 360], 'gravity': -10, 'drag': 1.4,
            'life': [700, 1200], 'fadeOut': 400, 'sprite': {'frames': glyphs, 'random': True},
        },
        'idea': {
            'burst': 1, 'anchor': 'head', 'offset': [0, -12], 'speed': [4, 8], 'angle': [80, 100], 'gravity': -6,
            'life': 1300, 'fadeIn': 150, 'fadeOut': 550, 'sprite': {'frames': ['bulb1', 'bulb2'], 'fps': 5},
        },
        'idle': {
            'perSecond': 3, 'anchor': 'body', 'jitter': [8, 10], 'speed': [6, 14], 'angle': [60, 120],
            'gravity': -8, 'life': [800, 1300], 'fadeIn': 150, 'fadeOut': 400,
            'sprite': {'frames': glyphs, 'random': True},
        },
    },
    'variants': {'code': {'emitters': ['code', 'code-burst', 'bulb']}},
    'presence': {'idle': ['idle'], 'vanish': ['burst', 'idea'], 'appear': ['burst', 'idea']},
}
write_json(BOSSES + '/pierre/fx.json', tricks(fx, 'pierre'))
print('pierre written')
