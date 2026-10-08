"""Flittermouse: the looks (drawn here on fm_heads.py), the effects (swarm, shade) and his outfits
in boss.json."""
from lookgen import *
from tricks import tricks
from heads import Palette
from fm_heads import cowl, cowl_front
from body import body_parts, outfit_parts, write_parts, metal, dome, part, apply_rules, keep_from
import json

ARMOR = ['#5a5e68', '#44484f', '#33363d', '#24262c', '#16171b']
SUIT = ['#565666', '#3e3e4c', '#2c2c38', '#1c1c24', '#101016']


def cape_texture(h=26, w=13):
    """The cape hanging from the neck: widening down, two folds, a scalloped hem."""
    c = Canvas(w, h)
    mid = w // 2
    for y in range(h):
        half = round(2 + 4 * min(1, y / 14))
        x0, x1 = mid - half, mid + half
        for x in range(x0, x1 + 1):
            ch = 'q'
            if x in (x0, x1):
                ch = 'k'
            elif x in (x0 + 1, x1 - 1):
                ch = 'd'
            elif y > 5 and x in (mid - 2, mid + 2):
                ch = 'Q'
            c.set(x, y, ch)
    # Bat-wing points along the hem.
    for x in range(w):
        if x % 4 != 0:
            c.set(x, h - 1, '.')
        if x % 4 == 2:
            c.set(x, h - 2, '.').set(x, h - 3, 'k')
        elif x % 4 in (1, 3):
            c.set(x, h - 2, 'k')
    return c.rows()


PLATE = ['#7a7e8a', '#5c606a', '#464a54', '#363940', '#26282e', '#18191e']
OUTLINE = '#08080b'
ARMOR_PLAN = {'chest': 2, 'torso': 1, 'upper-arm': 1, 'forearm': 1, 'hand': 1, 'thigh': 1, 'knee': 1, 'shin': 1}


def armour(rules, belt):
    """The armoured suit: every part grown and relit as dark plate, the gold belt kept, the bat
    on the breastplate."""
    grown = body_parts(1, rules, ARMOR_PLAN)
    out = {}
    for k, p in grown.items():
        i = int(k)
        n = ARMOR_PLAN[next(f for f, ids in __import__('body').FAMILIES.items() if i in ids)]
        if 57 <= i <= 61 or 34 <= i <= 38 or 17 <= i <= 24:
            relit = dome(p, PLATE, OUTLINE, light=(0.45, -0.6, 0.65))
        else:
            relit = metal(p, PLATE, OUTLINE, segment=0, shine=False)
        if 34 <= i <= 38:
            keep_from(relit, apply_rules(part(1, i), i, rules), belt, n)
        if i == 57:
            for x, y in ((8, 6), (9, 6), (11, 6), (12, 6), (8, 7), (9, 7), (10, 7), (11, 7), (12, 7), (10, 8)):
                if relit.get(x, y):
                    relit.set(x, y, OUTLINE)
        out[k] = relit
    return out


def bat_suit(id_, ramp5, eyes, belt, extra_overlay, with_cape, accent):
    pal = Palette({'k': '#0c0c10', 'A': ramp5[2], 'a': ramp5[1], 'c': ramp5[3], 'C': ramp5[1], 'B': '#e02020',
                   'q': ramp5[3], 'Q': ramp5[2], 'd': ramp5[4]})
    head, front = pal.rows(cowl(eyes)), pal.rows(cowl_front(eyes))
    rules = [
        recolor(ARMS + HAND + CHEST + TORSO, {**ramp(SKIN, ramp5), **{c: ramp5[i] for c, i in HAND_EXTRA.items()}}),
        recolor(CHEST + TORSO, ramp(MALE_SHIRT, ramp5[1:4])),
        recolor(TORSO, {BELT[0]: belt[0], BELT[1]: belt[1]}),
        recolor(TORSO + THIGH + KNEE, ramp(SHORTS, ramp5)),
        recolor(SHIN, ramp(SHIN_SKIN, ramp5[1:4])),
        recolor(FOREARM, {WRIST[0]: ramp5[0], WRIST[1]: ramp5[3], WRIST[2]: ramp5[4]}),
        recolor(SHOES, {**ramp(SHOE['main'], ramp5[2:5]), '#d64908': ramp5[3], '#fffbe7': ramp5[1],
                        '#d6cbb5': ramp5[4], '#8c8273': ramp5[4]}),
    ]
    look = {'id': id_, 'base': 1, 'accent': accent, '_raw_heads': True, 'recolor': rules, 'parts': {}}
    if with_cape:
        write_parts(look, armour(rules, belt), pal)
    else:
        # The suit of the future: sleek, the red bat on the chest.
        def bat(id_, p):
            wings = ((0, 0), (1, 0), (3, 0), (4, 0), (-1, 1), (0, 1), (1, 1), (2, 1), (3, 1), (4, 1), (5, 1),
                     (0, 2), (1, 2), (2, 2), (3, 2), (4, 2), (2, 3))
            at = {57: (4, 5), 61: (3, 5)}.get(id_)
            if at:
                for dx, dy in wings:
                    if p.get(at[0] + dx, at[1] + dy):
                        p.set(at[0] + dx, at[1] + dy, '#e02020')
            return p
        write_parts(look, outfit_parts(1, rules, {'chest': 0}, bat), pal)
    look['parts']['25'] = head
    look['parts']['29'] = front
    if with_cape:
        look['ribbons'] = {'cape': {'anchor': 'back', 'offset': [2, 0], 'texture': cape_texture(), 'segments': 6,
                                    'stiffness': 0.3, 'gravity': 300, 'drag': 2.2}}
    look['palette'] = pal.pal
    path = write_look('flittermouse', look)
    rotate(path, [25])
    preview(id_)


# The bat on the chest: dark on the armour, red on the suit of the future.
bat = '''
..........
..........
..........
..........
..........
..BB.BB...
.BBBBBBB..
...BBB....
....B.....
..........
..........
..........
'''
bat_suit('armored', ARMOR, 'w', ['#e0b040', '#8a6a20'], grid(bat.replace('B', 'k'), {}), True, '#ffd23a')
bat_suit('future', SUIT, 'r', ['#2a2a32', '#0c0c10'], grid(bat, {}), False, '#e02020')

fx = {
    'palette': {'k': '#0c0c10', 'K': '#2a2a34', 'g': '#4a4a58', 'y': '#ffd23a', 'd': '#1a1a24', 'D': '#30303c'},
    'sprites': {
        'bat1': ['K.....K', 'kK.k.Kk', '.kkkkk.', '...k...'],
        'bat2': ['...k...', '.kkkkk.', 'kK...Kk', 'K.....K'],
        'bat3': ['.......', 'KkkkkkK', '..kkk..', '...k...'],
        'wisp1': ['.DD.', 'DddD', '.DD.'],
        'wisp2': ['..DD..', '.DddD.', 'DddddD', '.DddD.', '..DD..'],
    },
    'emitters': {
        'bats': {
            'while': ['run', 'air', 'wall'], 'every': 18, 'minSpeed': 50, 'anchor': 'neck', 'jitter': [2, 3],
            'speed': [25, 50], 'angle': [20, 70], 'inherit': 0.1, 'gravity': -20, 'drag': 0.6,
            'life': [900, 1400], 'fadeOut': 400, 'flutter': {'amp': 2, 'freq': 4}, 'face': True,
            'sprite': {'frames': ['bat1', 'bat3', 'bat2', 'bat3'], 'fps': 14}, 'max': 18, 'reduced': 0.3,
        },
        'swarm': {
            'enter': ['flip', 'land', 'wall', 'roll'], 'burst': [5, 8], 'anchor': 'body', 'speed': [40, 90],
            'angle': [10, 170], 'gravity': -30, 'drag': 0.8, 'life': [800, 1200], 'fadeOut': 400,
            'flutter': {'amp': 2, 'freq': 4}, 'sprite': {'frames': ['bat1', 'bat3', 'bat2', 'bat3'], 'fps': 14},
        },
        'shade': {
            'while': ['run', 'air', 'wall'], 'every': 6, 'minSpeed': 40, 'anchor': 'chest', 'offset': [5, 2], 'jitter': [2, 4],
            'speed': [6, 16], 'angle': [-10, 40], 'gravity': -12, 'drag': 1.5, 'life': [600, 1000], 'fadeOut': 500,
            'sprite': {'frames': ['wisp1', 'wisp2'], 'fps': 3, 'loop': False}, 'max': 30,
        },
        'burst': {
            'burst': 18, 'anchor': 'body', 'speed': [30, 90], 'angle': [0, 360], 'gravity': -30, 'drag': 0.8,
            'life': [900, 1300], 'fadeOut': 400, 'flutter': {'amp': 2, 'freq': 4},
            'sprite': {'frames': ['bat1', 'bat3', 'bat2', 'bat3'], 'fps': 14},
        },
        'smoke': {
            'burst': 10, 'anchor': 'body', 'speed': [10, 30], 'angle': [0, 360], 'gravity': -10, 'drag': 1.5,
            'life': [700, 1100], 'fadeOut': 500, 'sprite': {'frames': ['wisp1', 'wisp2'], 'fps': 3, 'loop': False},
        },
        'idle': {
            'perSecond': 0.8, 'anchor': 'head', 'jitter': [8, 4], 'speed': [10, 20], 'angle': [60, 120], 'gravity': -10,
            'life': [1000, 1400], 'fadeOut': 400, 'flutter': {'amp': 2, 'freq': 4},
            'sprite': {'frames': ['bat1', 'bat3', 'bat2', 'bat3'], 'fps': 14},
        },
    },
    'ribbons': {
        'shadow': {'anchor': 'neck', 'offset': [3, 1], 'segments': 7, 'length': 3, 'width': [5, 2],
                   'colors': ['#1a1a24', '#24242e', '#30303c'], 'gravity': 120, 'drag': 2.2},
    },
    'variants': {'swarm': {'emitters': ['bats', 'swarm']}, 'shade': {'emitters': ['shade'], 'ribbons': ['shadow']}},
    'presence': {'idle': ['idle'], 'vanish': ['burst', 'smoke'], 'appear': ['burst', 'smoke']},
}
write_json(BOSSES + '/flittermouse/fx.json', tricks(fx, 'flittermouse'))

# Its outfits in boss.json (its world, stage.json, is drawn in stages.py / stages2.py).
b = json.load(open(BOSSES + '/flittermouse/boss.json', encoding='utf-8'))
b['looks'] = ['armored', 'future']
write_json(BOSSES + '/flittermouse/boss.json', b)
print('flittermouse written')
