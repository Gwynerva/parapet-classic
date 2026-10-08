"""Sir Nobody: the plate armour looks (drawn here on kn_parts.py), the effects (sparks, plume) and
his outfits in boss.json."""
from lookgen import *
from tricks import tricks
import json

from heads import Palette, Pic, shaded
from body import body_parts, metal, dome, part, apply_rules, keep_from
from kn_parts import helm, steel_rules, PLAN, OUTLINE

STEEL = ['#f6f9ff', '#d2d9e2', '#aab3c0', '#828c9a', '#5c6574', '#3c4350']
IRON = ['#9a9eaa', '#767a86', '#585c68', '#40434e', '#2c2e37', '#1c1d24']


LIMBS = set(range(1, 25)) | set(range(30, 34)) | set(range(39, 57)) | set(range(62, 66))
FAR_IDS = set(range(9, 13)) | set(range(21, 25)) | set(range(49, 53))


def darker(ramp):
    return ramp[1:] + [ramp[-1]]


def relight(i, p, ramp):
    if 57 <= i <= 61 or 34 <= i <= 38 or 17 <= i <= 24:
        return dome(p, ramp, OUTLINE)
    return metal(p, ramp, OUTLINE, segment=3 if 39 <= i <= 48 else 4)


def armour(ramp, trim):
    """Every body part grown thick and relit as plate, the far limbs a shade darker; the belt
    stays leather."""
    rules = steel_rules(ramp) + [recolor(TORSO, {BELT[0]: trim[0], BELT[1]: trim[1]})]
    grown = body_parts(1, rules, PLAN)
    out = {}
    for k, p in grown.items():
        i = int(k)
        if i in FAR_IDS:
            out[k] = relight(i, p.copy(), darker(ramp))
            continue
        relit = relight(i, p.copy(), ramp)
        if 34 <= i <= 38:
            src = apply_rules(part(1, i), i, rules)
            keep_from(relit, src, trim, PLAN['torso'])
        out[k] = relit
        if i in LIMBS and i not in set(range(5, 9)) | set(range(17, 21)) | set(range(53, 57)):
            out[f'{k}:far'] = relight(i, p.copy(), darker(ramp))
    return out


PAULDRON = [
    '...######...',
    '..########..',
    '.##########.',
    '############',
    '############',
    '############',
    '############',
    '############',
    '.##########.',
    '..########..',
    '...######...',
]


def pauldron(ramp):
    """A big round shoulder plate in three lames over the shoulder end of the arm (the left of
    the upright arm)."""
    p = shaded(PAULDRON, ramp, OUTLINE, light=(0.4, -0.7, 0.6))
    for y in range(1, 10):
        for x in (4, 8):
            if p.get(x, y) not in (None, OUTLINE):
                p.set(x, y, ramp[-2])
    # Drawn centred on the arm's point: empty columns on the right move it 4 px to the shoulder.
    return Pic([r[:] + [None] * 8 for r in p.g])


def plate(id_, ramp, trim, accent, plume):
    pal = Palette({'k': OUTLINE})
    parts = {k: pal.rows(p) for k, p in armour(ramp, trim).items()}
    parts['25'] = pal.rows(helm(ramp, trim=trim[0]))
    parts['29'] = pal.rows(helm(ramp, True, trim=trim[0]))
    attachments = {}
    for key, r in (('5', ramp), ('9', darker(ramp))):
        rows = pal.rows(pauldron(r))
        attachments.setdefault('pauldron', {'layer': 'over', 'sprites': {}})['sprites'][key] = rows
    look = {
        'id': id_, 'base': 1, 'accent': accent, '_raw_heads': True,
        'parts': parts,
        'attachments': attachments,
        'ribbons': {'plume': {'anchor': 'head', 'offset': [1, -8], 'segments': 6, 'length': 2.5, 'width': [3, 1],
                              'colors': plume, 'gravity': 120, 'drag': 3}},
    }
    look['palette'] = pal.pal
    path = write_look('sir-nobody', look)
    rotate(path, [25, 'pauldron@5', 'pauldron@9'])
    preview(id_)


plate('plate', STEEL, ['#8a5a32', '#5a3a1e'], '#b8c2cc', ['#e02a2a', '#c01c1c', '#ff5a4a'])
plate('dark-knight', IRON, ['#e8b84a', '#a07a20'], '#e8b84a', ['#2a2a34', '#1c1c24', '#4a4a56'])

fx = {
    'palette': {'y': '#ffe08a', 'o': '#ffa030', 'w': '#ffffff', 'r': '#e02a2a', 'R': '#a01818', 'l': '#ff7a6a'},
    'sprites': {
        'feather1': ['..rl', '.rr.', 'rr..', 'R...'],
        'feather2': ['.lr.', '.rr.', '.rr.', '.R..'],
        'feather3': ['....', 'lrrR', 'Rrrl', '....'],
    },
    'emitters': {
        'scrape': {
            'while': ['slide', 'wall', 'roll'], 'perSecond': 60, 'anchor': 'feet', 'jitter': [2, 0],
            'speed': [30, 90], 'angle': [10, 70], 'gravity': 300, 'life': [200, 400], 'fadeOut': 150,
            'rect': {'size': 1, 'colors': ['y', 'o', 'w']}, 'blend': 'add',
        },
        'clang': {
            'enter': ['land', 'vault', 'wall', 'hang'], 'burst': [8, 14], 'anchor': 'feet', 'speed': [40, 110],
            'angle': [0, 180], 'gravity': 320, 'life': [250, 450], 'fadeOut': 150,
            'rect': {'size': [1, 2], 'colors': ['y', 'o', 'w']}, 'blend': 'add',
        },
        'steps': {
            'while': ['run'], 'every': 22, 'minSpeed': 80, 'anchor': 'feet', 'speed': [20, 50], 'angle': [20, 80],
            'gravity': 300, 'life': [150, 300], 'rect': {'size': 1, 'colors': ['y', 'o']}, 'blend': 'add',
        },
        'feathers': {
            'while': ['run', 'air'], 'every': 20, 'minSpeed': 50, 'anchor': 'head', 'jitter': [2, 2],
            'speed': [8, 20], 'angle': [30, 100], 'inherit': 0.1, 'gravity': 30, 'drag': 2,
            'life': [900, 1400], 'fadeOut': 400, 'flutter': {'amp': 3, 'freq': 1.5},
            'sprite': {'frames': ['feather1', 'feather2', 'feather3', 'feather2'], 'fps': 4}, 'max': 12,
        },
        'burst': {
            'burst': 26, 'anchor': 'body', 'speed': [40, 120], 'angle': [0, 360], 'gravity': 200, 'life': [300, 600],
            'fadeOut': 200, 'rect': {'size': [1, 2], 'colors': ['y', 'o', 'w']}, 'blend': 'add',
        },
        'plumes': {
            'burst': 8, 'anchor': 'head', 'speed': [15, 40], 'angle': [30, 150], 'gravity': 30, 'drag': 2,
            'life': [900, 1400], 'fadeOut': 400, 'flutter': {'amp': 3, 'freq': 1.5},
            'sprite': {'frames': ['feather1', 'feather2', 'feather3', 'feather2'], 'fps': 4},
        },
        'idle': {
            'perSecond': 1, 'anchor': 'head', 'speed': [4, 10], 'angle': [60, 120], 'gravity': 20, 'drag': 2,
            'life': [1200, 1600], 'fadeOut': 400, 'flutter': {'amp': 3, 'freq': 1.5},
            'sprite': {'frames': ['feather1', 'feather2', 'feather3', 'feather2'], 'fps': 4},
        },
    },
    'ribbons': {
        'banner': {'anchor': 'chest', 'offset': [3, -2], 'segments': 6, 'length': 3, 'width': [4, 2],
                   'colors': ['#c01c1c', '#e02a2a', '#c9a85a'], 'gravity': 200, 'drag': 2.5},
    },
    'variants': {
        'sparks': {'emitters': ['scrape', 'clang', 'steps']},
        'plume': {'emitters': ['feathers'], 'ribbons': ['banner']},
    },
    'presence': {'idle': ['idle'], 'vanish': ['burst', 'plumes'], 'appear': ['burst', 'plumes']},
}
write_json(BOSSES + '/sir-nobody/fx.json', tricks(fx, 'sir-nobody'))

# Its outfits in boss.json (its world, stage.json, is drawn in stages.py / stages2.py).
b = json.load(open(BOSSES + '/sir-nobody/boss.json', encoding='utf-8'))
b['looks'] = ['plate', 'dark-knight']
write_json(BOSSES + '/sir-nobody/boss.json', b)
print('sir nobody written')
